"""
Scheduled Retraining Pipeline.

Automates the periodic retraining of AQI forecasting models with
fresh data. Supports configurable schedules, model validation
gates, and rollback on performance degradation.
"""

import argparse
import logging
import os
import sys
import json
import time
from datetime import datetime, timedelta
from typing import Optional, Dict

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from feature_pipeline.feature_store import FeatureStore
from training.train_baseline import train_persistence_models, train_moving_average_models
from training.train_xgboost import train_xgboost

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


class RetrainingPipeline:
    """
    Automated model retraining pipeline.

    Features:
    - Configurable retraining schedule (daily, weekly, monthly)
    - Performance gate: only promote new model if it beats the champion
    - Automatic rollback on degradation
    - Retraining history tracking
    - Dry-run mode for testing
    """

    def __init__(
        self,
        city: str = "delhi",
        data_dir: str = "./data",
        artifact_dir: str = "./artifacts",
        schedule: str = "weekly",
        max_degradation_pct: float = 5.0,
        dry_run: bool = False,
    ):
        """
        Args:
            city: City for model training.
            data_dir: Data directory.
            artifact_dir: Artifact directory.
            schedule: Retraining schedule ('daily', 'weekly', 'monthly').
            max_degradation_pct: Maximum allowed MAE increase (%).
            dry_run: If True, skip model promotion.
        """
        self.city = city
        self.data_dir = data_dir
        self.artifact_dir = artifact_dir
        self.schedule = schedule
        self.max_degradation_pct = max_degradation_pct
        self.dry_run = dry_run
        self.registry_path = os.path.join(artifact_dir, "metadata", "model_registry.json")
        self.history_path = os.path.join(artifact_dir, "metadata", "retraining_history.json")
        self._champion_metrics: Optional[dict] = None

    def _load_champion_metrics(self) -> Optional[dict]:
        """Load current champion model metrics from registry."""
        if os.path.exists(self.registry_path):
            with open(self.registry_path, "r") as f:
                registry = json.load(f)
            champion = registry.get("champion_model")
            if champion:
                return champion.get("metrics", {})
        return None

    def _update_registry(self, model_name: str, metrics: dict, model_path: str) -> None:
        """Update the model registry with new champion."""
        registry = {}
        if os.path.exists(self.registry_path):
            with open(self.registry_path, "r") as f:
                registry = json.load(f)

        # Archive previous champion
        if "champion_model" in registry:
            if "archived_models" not in registry:
                registry["archived_models"] = []
            registry["archived_models"].append({
                **registry["champion_model"],
                "archived_at": datetime.now().isoformat(),
            })

        registry["champion_model"] = {
            "name": model_name,
            "metrics": metrics,
            "model_path": model_path,
            "promoted_at": datetime.now().isoformat(),
        }
        registry["last_updated"] = datetime.now().isoformat()

        os.makedirs(os.path.dirname(self.registry_path), exist_ok=True)
        with open(self.registry_path, "w") as f:
            json.dump(registry, f, indent=2, default=str)
        logger.info(f"Registry updated: champion={model_name}")

    def _log_retraining_event(self, event: dict) -> None:
        """Log a retraining event to history."""
        history = []
        if os.path.exists(self.history_path):
            with open(self.history_path, "r") as f:
                history = json.load(f)
        history.append(event)
        os.makedirs(os.path.dirname(self.history_path), exist_ok=True)
        with open(self.history_path, "w") as f:
            json.dump(history, f, indent=2, default=str)

    def _should_retrain(self) -> bool:
        """Check if retraining is due based on schedule."""
        if not os.path.exists(self.registry_path):
            return True

        with open(self.registry_path, "r") as f:
            registry = json.load(f)

        last_updated = registry.get("last_updated")
        if not last_updated:
            return True

        last = datetime.fromisoformat(last_updated)
        now = datetime.now()
        delta = now - last

        schedule_hours = {"daily": 24, "weekly": 168, "monthly": 720}
        threshold = schedule_hours.get(self.schedule, 168)

        return delta.total_seconds() / 3600 >= threshold

    def _validate_new_model(self, new_metrics: dict) -> bool:
        """
        Validate that the new model meets performance gates.

        Returns:
            True if new model should be promoted.
        """
        champion_metrics = self._load_champion_metrics()
        if champion_metrics is None:
            logger.info("No champion model exists — promoting new model")
            return True

        champion_mae = champion_metrics.get("mae", float("inf"))
        new_mae = new_metrics.get("mae", float("inf"))

        degradation = ((new_mae - champion_mae) / champion_mae) * 100

        if degradation > self.max_degradation_pct:
            logger.warning(
                f"New model MAE ({new_mae:.2f}) is {degradation:.1f}% worse than "
                f"champion ({champion_mae:.2f}). Threshold: {self.max_degradation_pct}%"
            )
            return False

        logger.info(f"New model passes validation: MAE improvement={-degradation:.1f}%")
        return True

    def run(self) -> dict:
        """
        Execute the full retraining pipeline.

        Returns:
            Pipeline execution result.
        """
        start_time = datetime.now()
        logger.info(f"Starting retraining pipeline for {self.city}")

        if not self._should_retrain():
            logger.info("Retraining not due yet. Skipping.")
            return {"status": "skipped", "reason": "not_due"}

        # Load fresh data
        store = FeatureStore(data_dir=self.data_dir, default_city=self.city)
        df = store.get_training_data(city=self.city, include_weather=True)
        logger.info(f"Loaded {len(df)} rows of fresh data")

        split_idx = int(len(df) * 0.8)
        y_train = df["aqi"].iloc[:split_idx]
        y_test = df["aqi"].iloc[split_idx:]

        # Train candidate model (XGBoost as default)
        logger.info("Training candidate XGBoost model...")
        result = train_xgboost(
            df, artifact_dir=os.path.join(self.artifact_dir, "models/xgboost_candidate"),
        )

        new_metrics = result.get("test_metrics", {})

        # Validate
        should_promote = self._validate_new_model(new_metrics) and not self.dry_run

        # Promote or rollback
        if should_promote:
            self._update_registry(
                model_name=result["model_name"],
                metrics=new_metrics,
                model_path=result["model_path"],
            )
            status = "promoted"
        else:
            status = "rolled_back"
            logger.info("Keeping existing champion model")

        # Log event
        event = {
            "timestamp": start_time.isoformat(),
            "city": self.city,
            "status": status,
            "new_model_metrics": new_metrics,
            "champion_metrics": self._load_champion_metrics(),
            "duration_seconds": (datetime.now() - start_time).total_seconds(),
            "dry_run": self.dry_run,
        }
        self._log_retraining_event(event)

        logger.info(f"Retraining complete: status={status}")
        return event

    def run_scheduled(self, interval_seconds: int = 3600) -> None:
        """Run the pipeline on a loop with the specified interval."""
        logger.info(f"Starting scheduled retraining (interval={interval_seconds}s)")
        while True:
            try:
                self.run()
            except Exception as e:
                logger.error(f"Retraining failed: {e}")
            logger.info(f"Sleeping for {interval_seconds}s...")
            time.sleep(interval_seconds)


def main():
    parser = argparse.ArgumentParser(description="Run model retraining pipeline")
    parser.add_argument("--city", type=str, default="delhi")
    parser.add_argument("--data-dir", type=str, default="./data")
    parser.add_argument("--artifact-dir", type=str, default="./artifacts")
    parser.add_argument("--schedule", type=str, default="weekly",
                        choices=["daily", "weekly", "monthly"])
    parser.add_argument("--max-degradation", type=float, default=5.0)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--daemon", action="store_true", help="Run as daemon")
    args = parser.parse_args()

    pipeline = RetrainingPipeline(
        city=args.city, data_dir=args.data_dir,
        artifact_dir=args.artifact_dir, schedule=args.schedule,
        max_degradation_pct=args.max_degradation, dry_run=args.dry_run,
    )

    if args.daemon:
        pipeline.run_scheduled()
    else:
        result = pipeline.run()
        print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()

"""
Compare All Models - Leaderboard Generation.

Runs all trained models on the same test set and produces a
comparative leaderboard with MAE, RMSE, R2, and MAPE metrics.
Saves results to the model registry.
"""

import argparse
import logging
import os
import sys
import json
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.baseline.persistence_model import PersistenceModel
from models.baseline.moving_average import MovingAverageModel, WeightedMovingAverageModel
from models.classical.xgboost_model import XGBoostAQIModel
from feature_pipeline.feature_store import FeatureStore

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def load_model(model_path: str, model_type: str):
    """Load a trained model from disk based on type."""
    try:
        if model_type == "persistence":
            return PersistenceModel.load(model_path)
        elif model_type == "sma":
            return MovingAverageModel.load(model_path)
        elif model_type == "wma":
            return WeightedMovingAverageModel.load(model_path)
        elif model_type == "xgboost":
            return XGBoostAQIModel.load(model_path)
        else:
            logger.warning(f"Unknown model type: {model_type}")
            return None
    except Exception as e:
        logger.warning(f"Could not load model from {model_path}: {e}")
        return None


def evaluate_model(model, y_train: pd.Series, y_test: pd.Series,
                    horizon: int = 72, model_type: str = "baseline") -> dict:
    """
    Evaluate a model and return metrics.

    Args:
        model: Fitted model.
        y_train: Training series for models that need history.
        y_test: Test series.
        horizon: Forecast horizon.
        model_type: Type hint for prediction dispatch.

    Returns:
        Metrics dict.
    """
    try:
        if model_type in ("persistence", "sma", "wma"):
            predictions = model.predict(horizon=horizon)
        elif model_type == "xgboost":
            predictions = model.predict(y_train, horizon=horizon)
        else:
            predictions = model.predict(horizon=horizon)

        actual = y_test.values[:horizon]
        min_len = min(len(predictions), len(actual))

        mae = float(mean_absolute_error(actual[:min_len], predictions[:min_len]))
        rmse = float(np.sqrt(mean_squared_error(actual[:min_len], predictions[:min_len])))
        r2 = float(r2_score(actual[:min_len], predictions[:min_len]))
        mape = float(np.mean(np.abs((actual[:min_len] - predictions[:min_len]) /
                                     (actual[:min_len] + 1e-8))) * 100)

        return {"mae": mae, "rmse": rmse, "r2": r2, "mape": mape, "status": "success"}
    except Exception as e:
        return {"status": "failed", "error": str(e), "mae": float("inf")}


def compare_models(
    city: str = "delhi",
    data_dir: str = "./data",
    artifact_dir: str = "./artifacts",
    horizon: int = 72,
    test_fraction: float = 0.2,
) -> dict:
    """
    Run all models on the same test set and produce a leaderboard.

    Args:
        city: City for evaluation.
        data_dir: Data directory.
        artifact_dir: Artifact directory containing saved models.
        horizon: Forecast horizon.
        test_fraction: Test set fraction.

    Returns:
        Comparison results with leaderboard.
    """
    # Load data
    store = FeatureStore(data_dir=data_dir, default_city=city)
    df = store.get_training_data(city=city, include_weather=True)

    split_idx = int(len(df) * (1 - test_fraction))
    y_train = df["aqi"].iloc[:split_idx]
    y_test = df["aqi"].iloc[split_idx:]

    # Define models to evaluate
    model_configs = [
        {"name": "persistence_lag1", "type": "persistence",
         "path": os.path.join(artifact_dir, "models/baseline/persistence_lag1.pkl")},
        {"name": "persistence_lag24", "type": "persistence",
         "path": os.path.join(artifact_dir, "models/baseline/persistence_lag24.pkl")},
        {"name": "sma_window24", "type": "sma",
         "path": os.path.join(artifact_dir, "models/baseline/sma_window24.pkl")},
        {"name": "wma_window24", "type": "wma",
         "path": os.path.join(artifact_dir, "models/baseline/wma_window24.pkl")},
        {"name": "xgboost_aqi", "type": "xgboost",
         "path": os.path.join(artifact_dir, "models/xgboost/xgboost_aqi")},
    ]

    # Evaluate each model
    results = {}
    for config in model_configs:
        logger.info(f"Evaluating {config['name']}...")
        model = load_model(config["path"], config["type"])
        if model is not None:
            metrics = evaluate_model(model, y_train, y_test, horizon, config["type"])
            results[config["name"]] = {
                "model_type": config["type"],
                "metrics": metrics,
            }
        else:
            # Create fresh baseline models if not saved
            logger.info(f"Training fresh {config['name']} for comparison")
            if config["type"] == "persistence":
                lag = int(config["name"].split("lag")[-1])
                model = PersistenceModel(seasonal_lag=lag, name=config["name"])
            elif config["type"] == "sma":
                window = int(config["name"].split("window")[-1])
                model = MovingAverageModel(window=window, name=config["name"])
            elif config["type"] == "wma":
                window = int(config["name"].split("window")[-1])
                model = WeightedMovingAverageModel(window=window, name=config["name"])
            else:
                continue

            model.fit(y_train)
            metrics = evaluate_model(model, y_train, y_test, horizon, config["type"])
            results[config["name"]] = {
                "model_type": config["type"],
                "metrics": metrics,
            }

    # Generate leaderboard
    leaderboard = sorted(
        [(name, res["metrics"]) for name, res in results.items() if res["metrics"].get("status") == "success"],
        key=lambda x: x[1].get("mae", float("inf"))
    )

    # Print leaderboard
    logger.info("\n" + "=" * 70)
    logger.info("MODEL COMPARISON LEADERBOARD")
    logger.info("=" * 70)
    logger.info(f"{'Rank':<5} {'Model':<25} {'MAE':<10} {'RMSE':<10} {'R2':<10} {'MAPE':<10}")
    logger.info("-" * 70)
    for rank, (name, metrics) in enumerate(leaderboard, 1):
        logger.info(f"#{rank:<4} {name:<25} {metrics['mae']:<10.2f} "
                     f"{metrics['rmse']:<10.2f} {metrics['r2']:<10.3f} {metrics['mape']:<10.2f}")

    # Save comparison results
    comparison = {
        "city": city,
        "horizon": horizon,
        "test_samples": len(y_test),
        "leaderboard": [{"rank": i + 1, "name": name, **metrics}
                         for i, (name, metrics) in enumerate(leaderboard)],
        "all_results": results,
        "champion": leaderboard[0][0] if leaderboard else None,
        "compared_at": datetime.now().isoformat(),
    }

    results_path = os.path.join(artifact_dir, "model_comparison.json")
    with open(results_path, "w") as f:
        json.dump(comparison, f, indent=2, default=str)

    logger.info(f"\nChampion model: {comparison['champion']}")
    logger.info(f"Results saved to {results_path}")

    return comparison


def main():
    parser = argparse.ArgumentParser(description="Compare all AQI forecasting models")
    parser.add_argument("--city", type=str, default="delhi")
    parser.add_argument("--data-dir", type=str, default="./data")
    parser.add_argument("--artifact-dir", type=str, default="./artifacts")
    parser.add_argument("--horizon", type=int, default=72)
    args = parser.parse_args()

    compare_models(
        city=args.city, data_dir=args.data_dir,
        artifact_dir=args.artifact_dir, horizon=args.horizon,
    )


if __name__ == "__main__":
    main()

"""
Accuracy Tracker for AQI Predictions.

Monitors prediction accuracy over time by comparing forecasts
against actual AQI values. Generates alerts when accuracy degrades.
"""

import numpy as np
import pandas as pd
import logging
import json
import os
from typing import Optional, Dict, List
from datetime import datetime, timedelta
from sklearn.metrics import mean_absolute_error, mean_squared_error

logger = logging.getLogger(__name__)


class AccuracyTracker:
    """
    Tracks and monitors AQI forecast accuracy over time.

    Features:
    - Records predictions and corresponding actual values
    - Computes rolling accuracy metrics (MAE, RMSE, bias)
    - Detects accuracy degradation trends
    - Generates alerts when accuracy drops below thresholds
    - Maintains historical accuracy data for analysis
    """

    def __init__(
        self,
        window_size: int = 100,
        alert_threshold_mae: float = 30.0,
        alert_threshold_bias: float = 15.0,
        degradation_pct: float = 20.0,
        storage_dir: str = "./artifacts/accuracy_tracking",
    ):
        """
        Args:
            window_size: Number of recent predictions for rolling metrics.
            alert_threshold_mae: MAE threshold for accuracy alerts.
            alert_threshold_bias: Bias threshold for alerts.
            degradation_pct: Percentage degradation to trigger alert.
            storage_dir: Directory for accuracy history storage.
        """
        self.window_size = window_size
        self.alert_threshold_mae = alert_threshold_mae
        self.alert_threshold_bias = alert_threshold_bias
        self.degradation_pct = degradation_pct
        self.storage_dir = storage_dir
        os.makedirs(storage_dir, exist_ok=True)

        # In-memory tracking
        self._predictions: List[Dict] = []
        self._alerts: List[Dict] = []
        self._baseline_mae: Optional[float] = None

    def record_prediction(
        self,
        city: str,
        model_name: str,
        predicted_aqi: float,
        actual_aqi: Optional[float] = None,
        forecast_horizon: int = 72,
        timestamp: Optional[str] = None,
    ) -> None:
        """
        Record a prediction and optionally its actual value.

        Args:
            city: City for the prediction.
            model_name: Model that generated the prediction.
            predicted_aqi: Predicted AQI value.
            actual_aqi: Actual AQI value (may be None at prediction time).
            forecast_horizon: Forecast horizon in hours.
            timestamp: Prediction timestamp.
        """
        record = {
            "city": city,
            "model_name": model_name,
            "predicted_aqi": float(predicted_aqi),
            "actual_aqi": float(actual_aqi) if actual_aqi is not None else None,
            "forecast_horizon": forecast_horizon,
            "timestamp": timestamp or datetime.now().isoformat(),
            "recorded_at": datetime.now().isoformat(),
        }
        self._predictions.append(record)
        logger.debug(f"Recorded prediction: {city}, predicted={predicted_aqi:.1f}")

    def update_actual(
        self,
        city: str,
        timestamp: str,
        actual_aqi: float,
        model_name: Optional[str] = None,
    ) -> int:
        """
        Update recorded predictions with actual AQI values.

        Args:
            city: City name.
            timestamp: Prediction timestamp to match.
            actual_aqi: Actual observed AQI.
            model_name: Optional model name filter.

        Returns:
            Number of predictions updated.
        """
        updated = 0
        for pred in self._predictions:
            if (pred["city"] == city and pred["timestamp"] == timestamp
                    and pred["actual_aqi"] is None):
                if model_name is None or pred["model_name"] == model_name:
                    pred["actual_aqi"] = float(actual_aqi)
                    pred["actual_updated_at"] = datetime.now().isoformat()
                    updated += 1
        return updated

    def compute_metrics(self, city: Optional[str] = None,
                         model_name: Optional[str] = None) -> Dict:
        """
        Compute accuracy metrics for predictions with actuals.

        Args:
            city: Filter by city.
            model_name: Filter by model.

        Returns:
            Dict of accuracy metrics.
        """
        # Filter predictions with actuals
        preds_with_actuals = [
            p for p in self._predictions
            if p["actual_aqi"] is not None
            and (city is None or p["city"] == city)
            and (model_name is None or p["model_name"] == model_name)
        ]

        if not preds_with_actuals:
            return {"status": "no_data", "n_predictions": 0}

        # Use recent window
        recent = preds_with_actuals[-self.window_size:]

        predicted = np.array([p["predicted_aqi"] for p in recent])
        actual = np.array([p["actual_aqi"] for p in recent])

        errors = actual - predicted
        abs_errors = np.abs(errors)

        metrics = {
            "n_predictions": len(recent),
            "mae": float(np.mean(abs_errors)),
            "rmse": float(np.sqrt(np.mean(errors ** 2))),
            "bias": float(np.mean(errors)),
            "mape": float(np.mean(np.abs(errors / (actual + 1e-8))) * 100),
            "median_ae": float(np.median(abs_errors)),
            "max_ae": float(np.max(abs_errors)),
            "within_10_pct": float(np.mean(abs_errors / (actual + 1e-8) <= 0.10) * 100),
            "within_25_pct": float(np.mean(abs_errors / (actual + 1e-8) <= 0.25) * 100),
            "p90_error": float(np.percentile(abs_errors, 90)),
            "city": city,
            "model_name": model_name,
            "window_size": self.window_size,
            "computed_at": datetime.now().isoformat(),
        }

        # Set baseline if not set
        if self._baseline_mae is None:
            self._baseline_mae = metrics["mae"]

        # Check for alerts
        self._check_alerts(metrics)

        return metrics

    def compute_metrics_by_horizon(self, city: Optional[str] = None) -> Dict[int, Dict]:
        """
        Compute accuracy metrics segmented by forecast horizon.

        Returns:
            Dict mapping horizon to metrics.
        """
        preds_with_actuals = [
            p for p in self._predictions
            if p["actual_aqi"] is not None and (city is None or p["city"] == city)
        ]

        by_horizon = {}
        for pred in preds_with_actuals:
            h = pred["forecast_horizon"]
            if h not in by_horizon:
                by_horizon[h] = {"predicted": [], "actual": []}
            by_horizon[h]["predicted"].append(pred["predicted_aqi"])
            by_horizon[h]["actual"].append(pred["actual_aqi"])

        results = {}
        for horizon, data in by_horizon.items():
            predicted = np.array(data["predicted"])
            actual = np.array(data["actual"])
            errors = actual - predicted
            results[horizon] = {
                "n_predictions": len(predicted),
                "mae": float(np.mean(np.abs(errors))),
                "rmse": float(np.sqrt(np.mean(errors ** 2))),
                "bias": float(np.mean(errors)),
            }

        return results

    def _check_alerts(self, metrics: Dict) -> None:
        """Check if metrics trigger any alerts."""
        mae = metrics["mae"]
        bias = abs(metrics["bias"])

        # Absolute threshold alerts
        if mae > self.alert_threshold_mae:
            alert = {
                "type": "high_mae",
                "message": f"MAE ({mae:.2f}) exceeds threshold ({self.alert_threshold_mae})",
                "value": mae, "threshold": self.alert_threshold_mae,
                "timestamp": datetime.now().isoformat(),
            }
            self._alerts.append(alert)
            logger.warning(alert["message"])

        if bias > self.alert_threshold_bias:
            alert = {
                "type": "high_bias",
                "message": f"Bias ({bias:.2f}) exceeds threshold ({self.alert_threshold_bias})",
                "value": bias, "threshold": self.alert_threshold_bias,
                "timestamp": datetime.now().isoformat(),
            }
            self._alerts.append(alert)
            logger.warning(alert["message"])

        # Degradation alert
        if self._baseline_mae and self._baseline_mae > 0:
            degradation = ((mae - self._baseline_mae) / self._baseline_mae) * 100
            if degradation > self.degradation_pct:
                alert = {
                    "type": "degradation",
                    "message": f"MAE degraded by {degradation:.1f}% from baseline ({self._baseline_mae:.2f})",
                    "degradation_pct": degradation,
                    "baseline_mae": self._baseline_mae,
                    "current_mae": mae,
                    "timestamp": datetime.now().isoformat(),
                }
                self._alerts.append(alert)
                logger.warning(alert["message"])

    def get_alerts(self, since: Optional[str] = None) -> List[Dict]:
        """Get recent alerts, optionally filtered by time."""
        if since is None:
            return self._alerts[-50:]
        return [a for a in self._alerts if a["timestamp"] >= since]

    def get_summary(self) -> Dict:
        """Get overall accuracy tracking summary."""
        total_preds = len(self._predictions)
        with_actuals = sum(1 for p in self._predictions if p["actual_aqi"] is not None)
        return {
            "total_predictions": total_preds,
            "predictions_with_actuals": with_actuals,
            "pending_actuals": total_preds - with_actuals,
            "total_alerts": len(self._alerts),
            "baseline_mae": self._baseline_mae,
            "window_size": self.window_size,
        }

    def save(self) -> None:
        """Save tracking data to disk."""
        data = {
            "predictions": self._predictions[-1000:],  # Keep last 1000
            "alerts": self._alerts[-100:],
            "baseline_mae": self._baseline_mae,
            "saved_at": datetime.now().isoformat(),
        }
        path = os.path.join(self.storage_dir, "accuracy_data.json")
        with open(path, "w") as f:
            json.dump(data, f, indent=2, default=str)

    def load(self) -> None:
        """Load tracking data from disk."""
        path = os.path.join(self.storage_dir, "accuracy_data.json")
        if os.path.exists(path):
            with open(path, "r") as f:
                data = json.load(f)
            self._predictions = data.get("predictions", [])
            self._alerts = data.get("alerts", [])
            self._baseline_mae = data.get("baseline_mae")
            logger.info(f"Loaded accuracy data: {len(self._predictions)} predictions")

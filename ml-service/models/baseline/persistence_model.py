"""
Persistence Model for AQI Forecasting.

The simplest baseline: tomorrow's AQI equals today's AQI.
Useful as a lower-bound benchmark — any serious model must beat this.
"""

import numpy as np
import pandas as pd
from typing import Optional
import joblib
import os
import logging

logger = logging.getLogger(__name__)


class PersistenceModel:
    """
    Persistence (naive) forecasting model.

    Predicts that the AQI value at horizon h ahead will be the same
    as the most recent observed value. Supports both single-step
    and multi-step forecasting by repeating the last observation.

    Optionally applies a seasonal lag (e.g., use value from 24h ago
    instead of the most recent one) for data with strong daily cycles.
    """

    def __init__(self, seasonal_lag: int = 1, name: str = "persistence"):
        """
        Args:
            seasonal_lag: Number of steps to look back for the persistence
                          value. 1 = last observation, 24 = same hour yesterday
                          (for hourly data with daily seasonality).
            name: Identifier for the model variant.
        """
        self.seasonal_lag = seasonal_lag
        self.name = name
        self.last_values: Optional[np.ndarray] = None
        self.fitted = False
        self.training_metrics: dict = {}

    def fit(self, y: pd.Series) -> "PersistenceModel":
        """
        "Fit" the persistence model by storing the tail of the series
        so we have enough look-back values for seasonal lag.

        Args:
            y: Training time series of AQI values.

        Returns:
            self
        """
        if len(y) < self.seasonal_lag:
            raise ValueError(
                f"Series length ({len(y)}) must be >= seasonal_lag ({self.seasonal_lag})"
            )
        self.last_values = y.values[-self.seasonal_lag:].copy()
        self.fitted = True

        # Compute training-set metrics for reference
        predictions = y.shift(self.seasonal_lag).dropna()
        actuals = y.iloc[self.seasonal_lag:]
        if len(predictions) == len(actuals):
            residuals = actuals.values - predictions.values
            self.training_metrics = {
                "mae": float(np.mean(np.abs(residuals))),
                "rmse": float(np.sqrt(np.mean(residuals ** 2))),
                "mape": float(np.mean(np.abs(residuals / (actuals.values + 1e-8))) * 100),
                "n_samples": len(actuals),
            }
        logger.info(
            f"PersistenceModel(lag={self.seasonal_lag}) fitted. "
            f"Training MAE={self.training_metrics.get('mae', 'N/A'):.2f}"
        )
        return self

    def predict(self, horizon: int = 24) -> np.ndarray:
        """
        Generate persistence forecasts for the given horizon.

        Args:
            horizon: Number of future steps to forecast.

        Returns:
            Array of shape (horizon,) with predicted AQI values.
        """
        if not self.fitted:
            raise RuntimeError("Model must be fit before prediction.")
        # For seasonal persistence, repeat the value at the seasonal lag
        persistence_value = self.last_values[0]
        forecasts = np.full(horizon, persistence_value, dtype=float)
        logger.debug(f"Persistence forecast: {forecasts[:3]}... (horizon={horizon})")
        return forecasts

    def predict_with_confidence(self, horizon: int = 24, quantile: float = 0.95) -> dict:
        """
        Produce point forecasts plus a simple confidence interval based
        on the training residual standard deviation.

        Args:
            horizon: Forecast horizon.
            quantile: Confidence level for the interval.

        Returns:
            Dict with 'forecast', 'lower', 'upper' arrays.
        """
        forecasts = self.predict(horizon)
        if self.training_metrics:
            residual_std = self.training_metrics["rmse"]
        else:
            residual_std = 0.0
        from scipy.stats import norm
        z = norm.ppf((1 + quantile) / 2)
        margin = z * residual_std
        return {
            "forecast": forecasts,
            "lower": forecasts - margin,
            "upper": forecasts + margin,
            "confidence_level": quantile,
        }

    def save(self, path: str) -> None:
        """Serialize model to disk."""
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        state = {
            "seasonal_lag": self.seasonal_lag,
            "name": self.name,
            "last_values": self.last_values,
            "fitted": self.fitted,
            "training_metrics": self.training_metrics,
        }
        joblib.dump(state, path)
        logger.info(f"PersistenceModel saved to {path}")

    @classmethod
    def load(cls, path: str) -> "PersistenceModel":
        """Load a persisted model from disk."""
        state = joblib.load(path)
        model = cls(seasonal_lag=state["seasonal_lag"], name=state["name"])
        model.last_values = state["last_values"]
        model.fitted = state["fitted"]
        model.training_metrics = state.get("training_metrics", {})
        logger.info(f"PersistenceModel loaded from {path}")
        return model

    def get_info(self) -> dict:
        """Return model metadata."""
        return {
            "model_type": "persistence",
            "name": self.name,
            "seasonal_lag": self.seasonal_lag,
            "fitted": self.fitted,
            "training_metrics": self.training_metrics,
        }

"""
Moving Average Models for AQI Forecasting.

Implements Simple Moving Average (SMA) and Weighted Moving Average (WMA)
as baseline forecasting approaches. These models smooth out short-term
fluctuations and can capture local trends better than persistence.
"""

import numpy as np
import pandas as pd
from typing import Optional, Union
import joblib
import os
import logging

logger = logging.getLogger(__name__)


class MovingAverageModel:
    """
    Simple Moving Average (SMA) forecasting model.

    Forecasts future AQI as the average of the last `window` observations.
    This is equivalent to an AR(window) model with equal coefficients.
    """

    def __init__(self, window: int = 24, name: str = "sma"):
        """
        Args:
            window: Number of recent observations to average over.
            name: Model identifier.
        """
        if window < 1:
            raise ValueError("Window size must be >= 1")
        self.window = window
        self.name = name
        self.last_values: Optional[np.ndarray] = None
        self.fitted = False
        self.training_metrics: dict = {}

    def fit(self, y: pd.Series) -> "MovingAverageModel":
        """
        Fit by storing the tail of the series and computing training metrics.

        Args:
            y: Training AQI time series.

        Returns:
            self
        """
        if len(y) < self.window:
            raise ValueError(
                f"Series length ({len(y)}) must be >= window ({self.window})"
            )
        self.last_values = y.values[-self.window:].copy()
        self.fitted = True

        # Training metrics
        sma = y.rolling(window=self.window).mean().dropna()
        actuals = y.iloc[self.window:]
        if len(sma) == len(actuals):
            residuals = actuals.values - sma.values
            self.training_metrics = {
                "mae": float(np.mean(np.abs(residuals))),
                "rmse": float(np.sqrt(np.mean(residuals ** 2))),
                "mape": float(np.mean(np.abs(residuals / (actuals.values + 1e-8))) * 100),
                "n_samples": len(actuals),
            }
        logger.info(
            f"SMA(window={self.window}) fitted. "
            f"Training MAE={self.training_metrics.get('mae', 'N/A'):.2f}"
        )
        return self

    def predict(self, horizon: int = 24) -> np.ndarray:
        """Forecast by repeating the last moving average value."""
        if not self.fitted:
            raise RuntimeError("Model must be fit before prediction.")
        avg = float(np.mean(self.last_values))
        return np.full(horizon, avg, dtype=float)

    def predict_rolling(self, horizon: int = 24) -> np.ndarray:
        """
        Iterative rolling forecast: each new prediction feeds back
        into the moving average window for the next step.
        """
        if not self.fitted:
            raise RuntimeError("Model must be fit before prediction.")
        buffer = list(self.last_values)
        forecasts = []
        for _ in range(horizon):
            avg = np.mean(buffer[-self.window:])
            forecasts.append(avg)
            buffer.append(avg)
        return np.array(forecasts)

    def save(self, path: str) -> None:
        """Save model to disk."""
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        joblib.dump(self._get_state(), path)

    @classmethod
    def load(cls, path: str) -> "MovingAverageModel":
        state = joblib.load(path)
        model = cls(window=state["window"], name=state["name"])
        model.last_values = state["last_values"]
        model.fitted = state["fitted"]
        model.training_metrics = state.get("training_metrics", {})
        return model

    def _get_state(self) -> dict:
        return {
            "window": self.window, "name": self.name,
            "last_values": self.last_values, "fitted": self.fitted,
            "training_metrics": self.training_metrics,
        }

    def get_info(self) -> dict:
        return {"model_type": "sma", "name": self.name, "window": self.window,
                "fitted": self.fitted, "training_metrics": self.training_metrics}


class WeightedMovingAverageModel:
    """
    Weighted Moving Average (WMA) forecasting model.

    Assigns linearly decreasing weights so that more recent observations
    have a greater influence on the forecast. Can also accept custom weights.
    """

    def __init__(self, window: int = 24, weights: Optional[np.ndarray] = None,
                 name: str = "wma"):
        """
        Args:
            window: Number of recent observations to use.
            weights: Custom weight vector of length `window`. If None,
                     linearly decreasing weights are used (most recent = highest).
            name: Model identifier.
        """
        if window < 1:
            raise ValueError("Window size must be >= 1")
        self.window = window
        self.name = name
        if weights is not None:
            if len(weights) != window:
                raise ValueError(f"Weights length ({len(weights)}) must equal window ({window})")
            self.weights = np.array(weights, dtype=float)
        else:
            # Linearly decreasing: window, window-1, ..., 1
            self.weights = np.arange(window, 0, -1, dtype=float)
        # Normalize weights to sum to 1
        self.weights = self.weights / self.weights.sum()
        self.last_values: Optional[np.ndarray] = None
        self.fitted = False
        self.training_metrics: dict = {}

    def fit(self, y: pd.Series) -> "WeightedMovingAverageModel":
        """
        Fit by storing tail values and computing training metrics.
        """
        if len(y) < self.window:
            raise ValueError(
                f"Series length ({len(y)}) must be >= window ({self.window})"
            )
        self.last_values = y.values[-self.window:].copy()
        self.fitted = True

        # Compute weighted moving average for training metrics
        actuals_list, pred_list = [], []
        for i in range(self.window, len(y)):
            window_slice = y.values[i - self.window:i]
            wma = np.dot(window_slice, self.weights)
            actuals_list.append(y.values[i])
            pred_list.append(wma)
        actuals_arr = np.array(actuals_list)
        preds_arr = np.array(pred_list)
        residuals = actuals_arr - preds_arr
        self.training_metrics = {
            "mae": float(np.mean(np.abs(residuals))),
            "rmse": float(np.sqrt(np.mean(residuals ** 2))),
            "mape": float(np.mean(np.abs(residuals / (actuals_arr + 1e-8))) * 100),
            "n_samples": len(actuals_arr),
        }
        logger.info(
            f"WMA(window={self.window}) fitted. "
            f"Training MAE={self.training_metrics.get('mae', 'N/A'):.2f}"
        )
        return self

    def predict(self, horizon: int = 24) -> np.ndarray:
        """Forecast by repeating the last weighted average value."""
        if not self.fitted:
            raise RuntimeError("Model must be fit before prediction.")
        wma = float(np.dot(self.last_values, self.weights))
        return np.full(horizon, wma, dtype=float)

    def predict_rolling(self, horizon: int = 24) -> np.ndarray:
        """
        Iterative rolling weighted forecast.
        """
        if not self.fitted:
            raise RuntimeError("Model must be fit before prediction.")
        buffer = list(self.last_values)
        forecasts = []
        for _ in range(horizon):
            window_slice = np.array(buffer[-self.window:])
            wma = float(np.dot(window_slice, self.weights))
            forecasts.append(wma)
            buffer.append(wma)
        return np.array(forecasts)

    def predict_with_confidence(self, horizon: int = 24, quantile: float = 0.95) -> dict:
        """Produce forecasts with confidence intervals."""
        forecasts = self.predict_rolling(horizon)
        residual_std = self.training_metrics.get("rmse", 0.0)
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
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        state = {
            "window": self.window, "name": self.name,
            "weights": self.weights, "last_values": self.last_values,
            "fitted": self.fitted, "training_metrics": self.training_metrics,
        }
        joblib.dump(state, path)

    @classmethod
    def load(cls, path: str) -> "WeightedMovingAverageModel":
        state = joblib.load(path)
        model = cls(window=state["window"], weights=state["weights"], name=state["name"])
        model.last_values = state["last_values"]
        model.fitted = state["fitted"]
        model.training_metrics = state.get("training_metrics", {})
        return model

    def get_info(self) -> dict:
        return {"model_type": "wma", "name": self.name, "window": self.window,
                "fitted": self.fitted, "training_metrics": self.training_metrics}

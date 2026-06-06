"""
Prophet Model for AQI Forecasting.

Wraps Facebook Prophet with weather regressors for multi-step AQI
forecasting. Prophet handles daily/weekly/yearly seasonality and
holiday effects naturally, making it well-suited for air quality
data with strong temporal patterns.
"""

import pandas as pd
import numpy as np
import logging
import joblib
import os
from typing import Optional, List, Dict
from datetime import datetime

logger = logging.getLogger(__name__)


class ProphetForecaster:
    """
    Prophet-based AQI forecaster with optional weather regressors.

    Uses Facebook Prophet to model AQI time series with:
    - Automatic seasonality detection (daily, weekly, yearly)
    - Holiday effects (optional)
    - Weather regressors (temperature, humidity, wind_speed, etc.)
    - Custom seasonality for pollution patterns
    """

    def __init__(
        self,
        changepoint_prior_scale: float = 0.05,
        seasonality_prior_scale: float = 10.0,
        holidays_prior_scale: float = 10.0,
        seasonality_mode: str = "additive",
        yearly_fourier: int = 10,
        weekly_fourier: int = 3,
        daily_fourier: int = 10,
        regressors: Optional[List[str]] = None,
        name: str = "prophet",
    ):
        """
        Args:
            changepoint_prior_scale: Flexibility of trend changes.
            seasonality_prior_scale: Strength of seasonality model.
            holidays_prior_scale: Strength of holiday effects.
            seasonality_mode: 'additive' or 'multiplicative'.
            yearly_fourier: Fourier order for yearly seasonality.
            weekly_fourier: Fourier order for weekly seasonality.
            daily_fourier: Fourier order for daily seasonality.
            regressors: List of extra regressor column names.
            name: Model identifier.
        """
        self.changepoint_prior_scale = changepoint_prior_scale
        self.seasonality_prior_scale = seasonality_prior_scale
        self.holidays_prior_scale = holidays_prior_scale
        self.seasonality_mode = seasonality_mode
        self.yearly_fourier = yearly_fourier
        self.weekly_fourier = weekly_fourier
        self.daily_fourier = daily_fourier
        self.regressors = regressors or []
        self.name = name
        self.model = None
        self.fitted = False
        self.training_metrics: dict = {}

    def _build_model(self):
        """Construct the Prophet model with configured hyperparameters."""
        try:
            from prophet import Prophet
        except ImportError:
            logger.error("prophet package not installed. Run: pip install prophet")
            raise

        model = Prophet(
            changepoint_prior_scale=self.changepoint_prior_scale,
            seasonality_prior_scale=self.seasonality_prior_scale,
            holidays_prior_scale=self.holidays_prior_scale,
            seasonality_mode=self.seasonality_mode,
            yearly_seasonality=False,
            weekly_seasonality=False,
            daily_seasonality=False,
        )
        # Add custom fourier seasonalities for finer control
        model.add_seasonality(
            name="yearly", period=365.25, fourier_order=self.yearly_fourier
        )
        model.add_seasonality(
            name="weekly", period=7, fourier_order=self.weekly_fourier
        )
        model.add_seasonality(
            name="daily", period=1, fourier_order=self.daily_fourier
        )
        # Add extra regressors
        for reg in self.regressors:
            model.add_regressor(reg)
            logger.debug(f"Added regressor: {reg}")
        return model

    def _prepare_dataframe(self, y: pd.Series, X: Optional[pd.DataFrame] = None) -> pd.DataFrame:
        """
        Convert input series to Prophet-compatible DataFrame.

        Args:
            y: Target AQI series with datetime index.
            X: Optional DataFrame with weather regressors.

        Returns:
            DataFrame with 'ds' and 'y' columns plus regressors.
        """
        df = pd.DataFrame({"ds": y.index, "y": y.values})
        if X is not None:
            for col in self.regressors:
                if col in X.columns:
                    df[col] = X[col].values
                else:
                    logger.warning(f"Regressor '{col}' not found in X, filling with 0")
                    df[col] = 0.0
        return df

    def fit(self, y: pd.Series, X: Optional[pd.DataFrame] = None) -> "ProphetForecaster":
        """
        Fit Prophet model on AQI time series.

        Args:
            y: Target AQI series with datetime index.
            X: Optional weather features aligned with y.

        Returns:
            self
        """
        self.model = self._build_model()
        df = self._prepare_dataframe(y, X)
        self.model.fit(df)
        self.fitted = True

        # Cross-validation metrics
        try:
            from prophet.diagnostics import cross_validation, performance_metrics
            df_cv = cross_validation(self.model, initial="720 hours", period="168 hours",
                                      horizon="72 hours")
            df_p = performance_metrics(df_cv)
            self.training_metrics = {
                "mae": float(df_p["mae"].mean()),
                "rmse": float(df_p["rmse"].mean()),
                "mape": float(df_p["mape"].mean() * 100),
                "coverage": float(df_p["coverage"].mean()),
            }
            logger.info(f"Prophet CV metrics: MAE={self.training_metrics['mae']:.2f}")
        except Exception as e:
            logger.warning(f"Prophet cross-validation skipped: {e}")
            self.training_metrics = {"note": "CV skipped due to insufficient data"}

        logger.info("Prophet model fitted successfully")
        return self

    def predict(
        self,
        horizon: int = 72,
        freq: str = "h",
        X_future: Optional[pd.DataFrame] = None,
    ) -> dict:
        """
        Generate AQI forecasts for the given horizon.

        Args:
            horizon: Number of steps to forecast.
            freq: Frequency string ('h' for hourly, 'D' for daily).
            X_future: Future regressor values for the forecast period.

        Returns:
            Dict with 'forecast', 'lower', 'upper', 'ds' arrays.
        """
        if not self.fitted:
            raise RuntimeError("Model must be fit before prediction.")

        future = self.model.make_future_dataframe(periods=horizon, freq=freq)
        # Add future regressor values
        if X_future is not None:
            for col in self.regressors:
                if col in X_future.columns:
                    future.loc[future.index[-len(X_future):], col] = X_future[col].values
                else:
                    future.loc[future.index[-horizon:], col] = 0.0
        elif self.regressors:
            # Use last known values as forward-fill
            last_row = self.model.history[self.regressors].iloc[-1]
            for col in self.regressors:
                future.loc[future.index[-horizon:], col] = last_row[col]

        forecast_df = self.model.predict(future)
        result = forecast_df.iloc[-horizon:]
        return {
            "forecast": result["yhat"].values,
            "lower": result["yhat_lower"].values,
            "upper": result["yhat_upper"].values,
            "ds": result["ds"].values,
            "trend": result["trend"].values,
        }

    def get_components(self) -> dict:
        """Extract decomposed seasonality components."""
        if not self.fitted:
            raise RuntimeError("Model must be fit first.")
        forecast = self.model.predict(self.model.history)
        components = {}
        for col in forecast.columns:
            if col not in ["ds", "yhat", "yhat_lower", "yhat_upper", "trend"]:
                components[col] = forecast[col].values.tolist()
        return components

    def save(self, path: str) -> None:
        """Serialize Prophet model and config."""
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        state = {
            "config": {
                "changepoint_prior_scale": self.changepoint_prior_scale,
                "seasonality_prior_scale": self.seasonality_prior_scale,
                "holidays_prior_scale": self.holidays_prior_scale,
                "seasonality_mode": self.seasonality_mode,
                "yearly_fourier": self.yearly_fourier,
                "weekly_fourier": self.weekly_fourier,
                "daily_fourier": self.daily_fourier,
                "regressors": self.regressors,
                "name": self.name,
            },
            "fitted": self.fitted,
            "training_metrics": self.training_metrics,
        }
        joblib.dump(state, path + "_config")
        if self.fitted and self.model is not None:
            # Prophet models are serialized with json
            import json
            from prophet.serialize import model_to_json
            with open(path + "_model.json", "w") as f:
                json.dump(model_to_json(self.model), f)
        logger.info(f"Prophet model saved to {path}")

    @classmethod
    def load(cls, path: str) -> "ProphetForecaster":
        """Load a persisted Prophet model."""
        state = joblib.load(path + "_config")
        config = state["config"]
        model = cls(**config)
        model.fitted = state["fitted"]
        model.training_metrics = state.get("training_metrics", {})
        if model.fitted:
            import json
            from prophet.serialize import model_from_json
            with open(path + "_model.json", "r") as f:
                model.model = model_from_json(json.load(f))
        logger.info(f"Prophet model loaded from {path}")
        return model

    def get_info(self) -> dict:
        return {
            "model_type": "prophet",
            "name": self.name,
            "fitted": self.fitted,
            "regressors": self.regressors,
            "training_metrics": self.training_metrics,
        }

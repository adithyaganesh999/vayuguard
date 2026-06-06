"""
ARIMA/SARIMA Model for AQI Forecasting.

Implements Auto-ARIMA for automatic order selection and SARIMA for
seasonal AQI patterns. Supports exogenous variables (weather data)
through the SARIMAX formulation.
"""

import pandas as pd
import numpy as np
import logging
import joblib
import os
from typing import Optional, Tuple, Dict
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.stattools import adfuller, acf, pacf
import warnings

logger = logging.getLogger(__name__)
warnings.filterwarnings("ignore", category=FutureWarning)


class ARIMAModel:
    """
    ARIMA/SARIMA model for AQI time series forecasting.

    Supports:
    - Automatic order selection via AIC/BIC grid search
    - Seasonal components (SARIMA)
    - Exogenous variables (SARIMAX) for weather regressors
    - Stationarity testing via Augmented Dickey-Fuller
    """

    def __init__(
        self,
        order: Tuple[int, int, int] = (1, 1, 1),
        seasonal_order: Tuple[int, int, int, int] = (1, 1, 1, 24),
        enforce_stationarity: bool = True,
        enforce_invertibility: bool = True,
        auto_arima: bool = False,
        max_p: int = 3,
        max_q: int = 3,
        max_d: int = 2,
        information_criterion: str = "aic",
        name: str = "arima",
    ):
        """
        Args:
            order: (p, d, q) ARIMA order.
            seasonal_order: (P, D, Q, s) seasonal order; s=24 for hourly daily cycle.
            enforce_stationarity: Whether to enforce stationarity.
            enforce_invertibility: Whether to enforce invertibility.
            auto_arima: If True, perform grid search for best order.
            max_p, max_q, max_d: Max values for auto ARIMA search.
            information_criterion: 'aic' or 'bic' for model selection.
            name: Model identifier.
        """
        self.order = order
        self.seasonal_order = seasonal_order
        self.enforce_stationarity = enforce_stationarity
        self.enforce_invertibility = enforce_invertibility
        self.auto_arima = auto_arima
        self.max_p = max_p
        self.max_q = max_q
        self.max_d = max_d
        self.information_criterion = information_criterion
        self.name = name
        self.model = None
        self.results = None
        self.fitted = False
        self.training_metrics: dict = {}

    def _check_stationarity(self, y: pd.Series) -> dict:
        """
        Perform Augmented Dickey-Fuller test.

        Returns:
            Dict with test statistic, p-value, and stationarity flag.
        """
        result = adfuller(y.dropna(), autolag="AIC")
        return {
            "adf_statistic": result[0],
            "p_value": result[1],
            "critical_values": result[4],
            "is_stationary": result[1] < 0.05,
            "used_lag": result[2],
        }

    def _auto_select_order(self, y: pd.Series, X: Optional[pd.DataFrame] = None) -> Tuple:
        """
        Grid search for best (p, d, q) based on AIC/BIC.

        Returns:
            Best (order, seasonal_order) tuple.
        """
        best_aic = np.inf
        best_order = self.order
        best_seasonal = self.seasonal_order
        d = 0
        # Determine differencing order
        for test_d in range(self.max_d + 1):
            diff_y = y.diff(test_d).dropna()
            stationarity = self._check_stationarity(diff_y)
            if stationarity["is_stationary"]:
                d = test_d
                break

        logger.info(f"Auto-ARIMA: selected d={d}")
        total_models = 0
        for p in range(self.max_p + 1):
            for q in range(self.max_q + 1):
                if p == 0 and q == 0:
                    continue
                try:
                    model = SARIMAX(
                        y, exog=X, order=(p, d, q),
                        seasonal_order=self.seasonal_order,
                        enforce_stationarity=self.enforce_stationarity,
                        enforce_invertibility=self.enforce_invertibility,
                    )
                    results = model.fit(disp=False, maxiter=50)
                    current_aic = results.aic
                    total_models += 1
                    if current_aic < best_aic:
                        best_aic = current_aic
                        best_order = (p, d, q)
                except Exception as e:
                    logger.debug(f"ARIMA({p},{d},{q}) failed: {e}")
                    continue

        logger.info(
            f"Auto-ARIMA: evaluated {total_models} models. "
            f"Best order={best_order}, AIC={best_aic:.2f}"
        )
        return best_order

    def fit(self, y: pd.Series, X: Optional[pd.DataFrame] = None) -> "ARIMAModel":
        """
        Fit SARIMAX model on AQI time series.

        Args:
            y: Target AQI series with datetime index.
            X: Optional exogenous variables (weather features).

        Returns:
            self
        """
        # Stationarity check
        stationarity = self._check_stationarity(y)
        logger.info(f"ADF test: statistic={stationarity['adf_statistic']:.3f}, "
                     f"p-value={stationarity['p_value']:.4f}")

        # Auto order selection
        if self.auto_arima:
            self.order = self._auto_select_order(y, X)

        # Fit the model
        self.model = SARIMAX(
            y, exog=X,
            order=self.order,
            seasonal_order=self.seasonal_order,
            enforce_stationarity=self.enforce_stationarity,
            enforce_invertibility=self.enforce_invertibility,
        )
        self.results = self.model.fit(disp=False, maxiter=200)
        self.fitted = True

        # Training metrics from in-sample residuals
        residuals = self.results.resid
        self.training_metrics = {
            "mae": float(np.mean(np.abs(residuals))),
            "rmse": float(np.sqrt(np.mean(residuals ** 2))),
            "aic": float(self.results.aic),
            "bic": float(self.results.bic),
            "log_likelihood": float(self.results.llf),
            "stationarity": stationarity,
        }
        logger.info(
            f"ARIMA{self.order}x{self.seasonal_order} fitted. "
            f"AIC={self.results.aic:.2f}, Training RMSE={self.training_metrics['rmse']:.2f}"
        )
        return self

    def predict(
        self,
        horizon: int = 72,
        X_future: Optional[pd.DataFrame] = None,
        alpha: float = 0.05,
    ) -> dict:
        """
        Forecast AQI values.

        Args:
            horizon: Number of steps ahead.
            X_future: Future exogenous variable values.
            alpha: Significance level for confidence intervals.

        Returns:
            Dict with 'forecast', 'lower', 'upper' arrays.
        """
        if not self.fitted:
            raise RuntimeError("Model must be fit before prediction.")

        forecast_result = self.results.get_forecast(
            steps=horizon, exog=X_future
        )
        predicted_mean = forecast_result.predicted_mean
        conf_int = forecast_result.conf_int(alpha=alpha)

        return {
            "forecast": predicted_mean.values,
            "lower": conf_int.iloc[:, 0].values,
            "upper": conf_int.iloc[:, 1].values,
        }

    def diagnostics(self) -> dict:
        """
        Run model diagnostics including Ljung-Box test and residual analysis.
        """
        if not self.fitted:
            raise RuntimeError("Model must be fit first.")
        from statsmodels.stats.diagnostic import acorr_ljungbox
        residuals = self.results.resid.dropna()
        lb_test = acorr_ljungbox(residuals, lags=[10, 20], return_df=True)
        return {
            "ljung_box": lb_test.to_dict(),
            "residual_mean": float(residuals.mean()),
            "residual_std": float(residuals.std()),
            "residual_skew": float(residuals.skew()),
            "residual_kurtosis": float(residuals.kurtosis()),
            "summary": str(self.results.summary()),
        }

    def save(self, path: str) -> None:
        """Save model to disk."""
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        if self.results is not None:
            self.results.save(path + "_results")
        config = {
            "order": self.order, "seasonal_order": self.seasonal_order,
            "enforce_stationarity": self.enforce_stationarity,
            "enforce_invertibility": self.enforce_invertibility,
            "auto_arima": self.auto_arima, "name": self.name,
            "fitted": self.fitted, "training_metrics": self.training_metrics,
        }
        joblib.dump(config, path + "_config")

    @classmethod
    def load(cls, path: str) -> "ARIMAModel":
        """Load model from disk."""
        config = joblib.load(path + "_config")
        model = cls(
            order=config["order"], seasonal_order=config["seasonal_order"],
            enforce_stationarity=config["enforce_stationarity"],
            enforce_invertibility=config["enforce_invertibility"],
            auto_arima=config["auto_arima"], name=config["name"],
        )
        model.fitted = config["fitted"]
        model.training_metrics = config.get("training_metrics", {})
        if model.fitted:
            from statsmodels.tsa.statespace.sarimax import SARIMAXResultsWrapper
            model.results = joblib.load(path + "_results")
        return model

    def get_info(self) -> dict:
        return {
            "model_type": "arima", "name": self.name,
            "order": self.order, "seasonal_order": self.seasonal_order,
            "fitted": self.fitted, "training_metrics": self.training_metrics,
        }

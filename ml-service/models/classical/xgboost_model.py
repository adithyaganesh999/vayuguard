"""
XGBoost Model for AQI Forecasting.

Implements gradient-boosted trees with lag features and weather regressors
for multi-step AQI prediction. XGBoost excels at capturing non-linear
relationships between weather variables and AQI.
"""

import pandas as pd
import numpy as np
import logging
import joblib
import os
from typing import Optional, Dict, List
from xgboost import XGBRegressor
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

logger = logging.getLogger(__name__)


class XGBoostAQIModel:
    """
    XGBoost-based AQI forecasting model.

    Features:
    - Lag features (1h, 3h, 6h, 12h, 24h, 48h lookback)
    - Rolling statistics (mean, std, min, max over windows)
    - Time features (hour, day_of_week, month, is_weekend)
    - Weather regressors (temperature, humidity, wind_speed, etc.)
    - Cross-validated hyperparameter tuning
    - Feature importance analysis
    """

    def __init__(
        self,
        n_estimators: int = 500,
        max_depth: int = 6,
        learning_rate: float = 0.05,
        subsample: float = 0.8,
        colsample_bytree: float = 0.8,
        min_child_weight: int = 5,
        reg_alpha: float = 0.1,
        reg_lambda: float = 1.0,
        lag_features: Optional[List[int]] = None,
        rolling_windows: Optional[List[int]] = None,
        name: str = "xgboost",
    ):
        """
        Args:
            n_estimators: Number of boosting rounds.
            max_depth: Maximum tree depth.
            learning_rate: Step size shrinkage.
            subsample: Subsample ratio of training instances.
            colsample_bytree: Subsample ratio of columns.
            min_child_weight: Minimum sum of instance weight needed in a child.
            reg_alpha: L1 regularization.
            reg_lambda: L2 regularization.
            lag_features: List of lag periods to use as features.
            rolling_windows: Window sizes for rolling statistics.
            name: Model identifier.
        """
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.subsample = subsample
        self.colsample_bytree = colsample_bytree
        self.min_child_weight = min_child_weight
        self.reg_alpha = reg_alpha
        self.reg_lambda = reg_lambda
        self.lag_features = lag_features or [1, 3, 6, 12, 24, 48]
        self.rolling_windows = rolling_windows or [6, 12, 24, 48]
        self.name = name
        self.model: Optional[XGBRegressor] = None
        self.feature_names: List[str] = []
        self.fitted = False
        self.training_metrics: dict = {}
        self.cv_metrics: dict = {}

    def _build_feature_names(self, weather_cols: List[str]) -> List[str]:
        """Generate the complete list of feature names."""
        names = []
        # Lag features
        for lag in self.lag_features:
            names.append(f"aqi_lag_{lag}")
        # Rolling features
        for w in self.rolling_windows:
            names.extend([f"aqi_roll_mean_{w}", f"aqi_roll_std_{w}",
                          f"aqi_roll_min_{w}", f"aqi_roll_max_{w}"])
        # Time features
        names.extend(["hour", "day_of_week", "month", "is_weekend",
                       "hour_sin", "hour_cos", "dow_sin", "dow_cos"])
        # Weather features
        for col in weather_cols:
            names.append(f"weather_{col}")
        return names

    def build_features(self, y: pd.Series, X: Optional[pd.DataFrame] = None) -> pd.DataFrame:
        """
        Construct feature matrix from raw AQI time series and weather data.

        Args:
            y: AQI target series with datetime index.
            X: Optional weather DataFrame aligned with y.

        Returns:
            Feature DataFrame ready for XGBoost.
        """
        features = pd.DataFrame(index=y.index)

        # Lag features
        for lag in self.lag_features:
            features[f"aqi_lag_{lag}"] = y.shift(lag)

        # Rolling statistics
        for w in self.rolling_windows:
            features[f"aqi_roll_mean_{w}"] = y.rolling(window=w).mean()
            features[f"aqi_roll_std_{w}"] = y.rolling(window=w).std()
            features[f"aqi_roll_min_{w}"] = y.rolling(window=w).min()
            features[f"aqi_roll_max_{w}"] = y.rolling(window=w).max()

        # Time features with cyclical encoding
        features["hour"] = y.index.hour
        features["day_of_week"] = y.index.dayofweek
        features["month"] = y.index.month
        features["is_weekend"] = (y.index.dayofweek >= 5).astype(int)
        features["hour_sin"] = np.sin(2 * np.pi * y.index.hour / 24)
        features["hour_cos"] = np.cos(2 * np.pi * y.index.hour / 24)
        features["dow_sin"] = np.sin(2 * np.pi * y.index.dayofweek / 7)
        features["dow_cos"] = np.cos(2 * np.pi * y.index.dayofweek / 7)

        # Weather features
        weather_cols = list(X.columns) if X is not None else []
        if X is not None:
            for col in X.columns:
                features[f"weather_{col}"] = X[col]

        self.feature_names = self._build_feature_names(weather_cols)
        return features

    def fit(self, y: pd.Series, X: Optional[pd.DataFrame] = None,
            cv_folds: int = 5) -> "XGBoostAQIModel":
        """
        Train XGBoost with time-series cross-validation.

        Args:
            y: Target AQI series.
            X: Optional weather features.
            cv_folds: Number of CV folds.

        Returns:
            self
        """
        features = self.build_features(y, X)
        target = y

        # Drop rows with NaN from lag/rolling features
        valid_mask = features.notna().all(axis=1) & target.notna()
        X_clean = features[valid_mask]
        y_clean = target[valid_mask]

        self.model = XGBRegressor(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            learning_rate=self.learning_rate,
            subsample=self.subsample,
            colsample_bytree=self.colsample_bytree,
            min_child_weight=self.min_child_weight,
            reg_alpha=self.reg_alpha,
            reg_lambda=self.reg_lambda,
            objective="reg:squarederror",
            random_state=42,
            n_jobs=-1,
        )

        # Time-series cross-validation
        tscv = TimeSeriesSplit(n_splits=cv_folds)
        cv_scores = {"mae": [], "rmse": [], "r2": []}
        for fold, (train_idx, val_idx) in enumerate(tscv.split(X_clean)):
            X_train, X_val = X_clean.iloc[train_idx], X_clean.iloc[val_idx]
            y_train, y_val = y_clean.iloc[train_idx], y_clean.iloc[val_idx]
            self.model.fit(X_train, y_train, eval_set=[(X_val, y_val)],
                           verbose=False)
            y_pred = self.model.predict(X_val)
            cv_scores["mae"].append(mean_absolute_error(y_val, y_pred))
            cv_scores["rmse"].append(np.sqrt(mean_squared_error(y_val, y_pred)))
            cv_scores["r2"].append(r2_score(y_val, y_pred))
            logger.debug(f"Fold {fold+1}: MAE={cv_scores['mae'][-1]:.2f}")

        # Fit on full data
        self.model.fit(X_clean, y_clean, verbose=False)
        self.fitted = True

        self.cv_metrics = {k: {"mean": float(np.mean(v)), "std": float(np.std(v))}
                           for k, v in cv_scores.items()}
        self.training_metrics = {
            "mae": float(np.mean(cv_scores["mae"])),
            "rmse": float(np.mean(cv_scores["rmse"])),
            "r2": float(np.mean(cv_scores["r2"])),
            "cv_folds": cv_folds,
        }
        logger.info(f"XGBoost fitted. CV MAE={self.training_metrics['mae']:.2f}, "
                     f"RMSE={self.training_metrics['rmse']:.2f}, R2={self.training_metrics['r2']:.3f}")
        return self

    def predict(self, y_history: pd.Series, X_future: Optional[pd.DataFrame] = None,
                horizon: int = 72) -> np.ndarray:
        """
        Iterative multi-step forecast using previous predictions as lag inputs.

        Args:
            y_history: Historical AQI series up to forecast origin.
            X_future: Future weather features for the forecast period.
            horizon: Number of steps to forecast.

        Returns:
            Array of predicted AQI values.
        """
        if not self.fitted:
            raise RuntimeError("Model must be fit before prediction.")

        forecasts = []
        current_y = y_history.copy()

        for step in range(horizon):
            future_time = current_y.index[-1] + pd.Timedelta(hours=1)
            step_features = self._build_single_step_features(current_y, X_future, step)
            step_features = step_features.reindex(columns=self.feature_names, fill_value=0)
            pred = self.model.predict(step_features.values.reshape(1, -1))[0]
            pred = max(0, pred)  # AQI cannot be negative
            forecasts.append(pred)
            # Append prediction to history for next step
            current_y = pd.concat([current_y, pd.Series([pred], index=[future_time])])

        return np.array(forecasts)

    def _build_single_step_features(self, y: pd.Series, X_future: Optional[pd.DataFrame],
                                     step: int) -> pd.Series:
        """Build features for a single forecast step."""
        features = {}
        for lag in self.lag_features:
            features[f"aqi_lag_{lag}"] = y.iloc[-lag] if len(y) >= lag else y.iloc[-1]
        for w in self.rolling_windows:
            window_data = y.iloc[-w:] if len(y) >= w else y
            features[f"aqi_roll_mean_{w}"] = window_data.mean()
            features[f"aqi_roll_std_{w}"] = window_data.std()
            features[f"aqi_roll_min_{w}"] = window_data.min()
            features[f"aqi_roll_max_{w}"] = window_data.max()
        future_time = y.index[-1] + pd.Timedelta(hours=1)
        features["hour"] = future_time.hour
        features["day_of_week"] = future_time.dayofweek
        features["month"] = future_time.month
        features["is_weekend"] = int(future_time.dayofweek >= 5)
        features["hour_sin"] = np.sin(2 * np.pi * future_time.hour / 24)
        features["hour_cos"] = np.cos(2 * np.pi * future_time.hour / 24)
        features["dow_sin"] = np.sin(2 * np.pi * future_time.dayofweek / 7)
        features["dow_cos"] = np.cos(2 * np.pi * future_time.dayofweek / 7)
        if X_future is not None and step < len(X_future):
            for col in X_future.columns:
                features[f"weather_{col}"] = X_future.iloc[step][col]
        return pd.Series(features)

    def get_feature_importance(self, top_n: int = 20) -> Dict[str, float]:
        """Return feature importance scores."""
        if not self.fitted:
            raise RuntimeError("Model must be fit first.")
        importance = self.model.feature_importances_
        feat_imp = dict(zip(self.feature_names, importance))
        sorted_imp = dict(sorted(feat_imp.items(), key=lambda x: x[1], reverse=True)[:top_n])
        return sorted_imp

    def save(self, path: str) -> None:
        """Save model and config."""
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        config = {
            "n_estimators": self.n_estimators, "max_depth": self.max_depth,
            "learning_rate": self.learning_rate, "subsample": self.subsample,
            "colsample_bytree": self.colsample_bytree,
            "min_child_weight": self.min_child_weight,
            "reg_alpha": self.reg_alpha, "reg_lambda": self.reg_lambda,
            "lag_features": self.lag_features, "rolling_windows": self.rolling_windows,
            "name": self.name, "feature_names": self.feature_names,
            "fitted": self.fitted,
            "training_metrics": self.training_metrics, "cv_metrics": self.cv_metrics,
        }
        joblib.dump(config, path + "_config")
        if self.model is not None:
            self.model.save_model(path + "_model.json")

    @classmethod
    def load(cls, path: str) -> "XGBoostAQIModel":
        """Load model from disk."""
        config = joblib.load(path + "_config")
        model = cls(
            n_estimators=config["n_estimators"], max_depth=config["max_depth"],
            learning_rate=config["learning_rate"], subsample=config["subsample"],
            colsample_bytree=config["colsample_bytree"],
            min_child_weight=config["min_child_weight"],
            reg_alpha=config["reg_alpha"], reg_lambda=config["reg_lambda"],
            lag_features=config["lag_features"], rolling_windows=config["rolling_windows"],
            name=config["name"],
        )
        model.feature_names = config.get("feature_names", [])
        model.fitted = config["fitted"]
        model.training_metrics = config.get("training_metrics", {})
        model.cv_metrics = config.get("cv_metrics", {})
        if model.fitted:
            model.model = XGBRegressor()
            model.model.load_model(path + "_model.json")
        return model

    def get_info(self) -> dict:
        return {
            "model_type": "xgboost", "name": self.name, "fitted": self.fitted,
            "lag_features": self.lag_features, "rolling_windows": self.rolling_windows,
            "training_metrics": self.training_metrics, "cv_metrics": self.cv_metrics,
        }

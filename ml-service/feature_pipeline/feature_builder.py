"""
Feature Builder for AQI Forecasting.

Constructs ML-ready feature matrices from raw AQI time series and
weather data. Creates lag features, rolling statistics, time-based
features, and interaction terms.
"""

import pandas as pd
import numpy as np
import logging
from typing import Optional, List, Dict, Tuple

logger = logging.getLogger(__name__)


class FeatureBuilder:
    """
    Builds feature matrices for AQI forecasting models.

    Feature categories:
    1. Lag features: AQI values at t-1, t-3, t-6, t-12, t-24, t-48
    2. Rolling statistics: mean, std, min, max over configurable windows
    3. Delta features: Change from previous periods
    4. Time features: Hour, day-of-week, month with cyclical encoding
    5. Weather features: Temperature, humidity, wind, pressure interactions
    6. AQI category features: One-hot encoded health categories
    """

    def __init__(
        self,
        lag_periods: Optional[List[int]] = None,
        rolling_windows: Optional[List[int]] = None,
        include_time_features: bool = True,
        include_weather_interactions: bool = True,
        include_aqi_categories: bool = True,
        target_col: str = "aqi",
    ):
        """
        Args:
            lag_periods: List of lag periods for lag features.
            rolling_windows: Window sizes for rolling statistics.
            include_time_features: Whether to include cyclical time features.
            include_weather_interactions: Whether to include weather interaction terms.
            include_aqi_categories: Whether to include AQI category features.
            target_col: Name of the target AQI column.
        """
        self.lag_periods = lag_periods or [1, 2, 3, 6, 12, 24, 48, 168]
        self.rolling_windows = rolling_windows or [3, 6, 12, 24, 48, 168]
        self.include_time_features = include_time_features
        self.include_weather_interactions = include_weather_interactions
        self.include_aqi_categories = include_aqi_categories
        self.target_col = target_col
        self.feature_names_: List[str] = []

    def build(self, df: pd.DataFrame, weather_cols: Optional[List[str]] = None) -> Tuple[pd.DataFrame, pd.Series]:
        """
        Build feature matrix from input DataFrame.

        Args:
            df: Input DataFrame with AQI and optional weather columns.
                Must have a DatetimeIndex.
            weather_cols: Names of weather columns to include.

        Returns:
            Tuple of (features DataFrame, target Series).
        """
        if not isinstance(df.index, pd.DatetimeIndex):
            raise ValueError("DataFrame must have a DatetimeIndex")

        y = df[self.target_col].copy()
        features = pd.DataFrame(index=df.index)

        # 1. Lag features
        features = self._add_lag_features(features, y)

        # 2. Rolling statistics
        features = self._add_rolling_features(features, y)

        # 3. Delta features
        features = self._add_delta_features(features, y)

        # 4. Time features
        if self.include_time_features:
            features = self._add_time_features(features, df.index)

        # 5. Weather features and interactions
        if weather_cols:
            for col in weather_cols:
                if col in df.columns:
                    features[f"weather_{col}"] = df[col]
            if self.include_weather_interactions:
                features = self._add_weather_interactions(features, df, weather_cols)

        # 6. AQI category features
        if self.include_aqi_categories:
            features = self._add_aqi_category_features(features, y)

        # Store feature names
        self.feature_names_ = list(features.columns)
        logger.info(f"Built {len(self.feature_names_)} features from {len(df)} rows")
        return features, y

    def _add_lag_features(self, features: pd.DataFrame, y: pd.Series) -> pd.DataFrame:
        """Add lagged AQI values as features."""
        for lag in self.lag_periods:
            features[f"aqi_lag_{lag}"] = y.shift(lag)
        return features

    def _add_rolling_features(self, features: pd.DataFrame, y: pd.Series) -> pd.DataFrame:
        """Add rolling statistical features."""
        for window in self.rolling_windows:
            features[f"aqi_roll_mean_{window}"] = y.rolling(window=window).mean()
            features[f"aqi_roll_std_{window}"] = y.rolling(window=window).std()
            features[f"aqi_roll_min_{window}"] = y.rolling(window=window).min()
            features[f"aqi_roll_max_{window}"] = y.rolling(window=window).max()
            features[f"aqi_roll_median_{window}"] = y.rolling(window=window).median()
            # Exponential weighted mean
            features[f"aqi_ewm_{window}"] = y.ewm(span=window).mean()
        return features

    def _add_delta_features(self, features: pd.DataFrame, y: pd.Series) -> pd.DataFrame:
        """Add change/delta features."""
        features["aqi_diff_1"] = y.diff(1)
        features["aqi_diff_3"] = y.diff(3)
        features["aqi_diff_24"] = y.diff(24)
        features["aqi_pct_change_1"] = y.pct_change(1)
        features["aqi_pct_change_24"] = y.pct_change(24)
        # Acceleration (change of change)
        features["aqi_accel"] = y.diff(1).diff(1)
        return features

    def _add_time_features(self, features: pd.DataFrame, index: pd.DatetimeIndex) -> pd.DataFrame:
        """Add cyclical time features."""
        features["hour"] = index.hour
        features["day_of_week"] = index.dayofweek
        features["month"] = index.month
        features["day_of_year"] = index.dayofyear
        features["is_weekend"] = (index.dayofweek >= 5).astype(int)
        features["is_rush_hour"] = index.hour.isin([7, 8, 9, 17, 18, 19]).astype(int)

        # Cyclical encoding
        features["hour_sin"] = np.sin(2 * np.pi * index.hour / 24)
        features["hour_cos"] = np.cos(2 * np.pi * index.hour / 24)
        features["dow_sin"] = np.sin(2 * np.pi * index.dayofweek / 7)
        features["dow_cos"] = np.cos(2 * np.pi * index.dayofweek / 7)
        features["month_sin"] = np.sin(2 * np.pi * index.month / 12)
        features["month_cos"] = np.cos(2 * np.pi * index.month / 12)
        features["doy_sin"] = np.sin(2 * np.pi * index.dayofyear / 365.25)
        features["doy_cos"] = np.cos(2 * np.pi * index.dayofyear / 365.25)
        return features

    def _add_weather_interactions(self, features: pd.DataFrame, df: pd.DataFrame,
                                   weather_cols: List[str]) -> pd.DataFrame:
        """Add interaction terms between weather variables and AQI lags."""
        for i, col1 in enumerate(weather_cols):
            if col1 not in df.columns:
                continue
            # Pairwise interactions
            for col2 in weather_cols[i + 1:]:
                if col2 in df.columns:
                    features[f"wx_{col1}_x_{col2}"] = df[col1] * df[col2]
            # Interaction with AQI lag
            features[f"wx_{col1}_x_aqi_lag1"] = df[col1] * features.get("aqi_lag_1", 0)
        return features

    def _add_aqi_category_features(self, features: pd.DataFrame, y: pd.Series) -> pd.DataFrame:
        """Add AQI health category features."""
        bins = [0, 50, 100, 150, 200, 300, 500]
        labels = ["good", "moderate", "unhealthy_sensitive", "unhealthy", "very_unhealthy", "hazardous"]
        categories = pd.cut(y, bins=bins, labels=labels)
        dummies = pd.get_dummies(categories, prefix="aqi_cat")
        features = pd.concat([features, dummies], axis=1)
        return features

    def build_forecast_features(self, y_history: pd.Series,
                                 weather_future: Optional[pd.DataFrame] = None,
                                 horizon: int = 72) -> pd.DataFrame:
        """
        Build features for the forecast period using iterative approach.

        Args:
            y_history: Recent AQI history.
            weather_future: Future weather data.
            horizon: Number of future steps.

        Returns:
            Feature DataFrame for the forecast period.
        """
        feature_rows = []
        current_y = y_history.copy()

        for step in range(horizon):
            future_idx = current_y.index[-1] + pd.Timedelta(hours=1)
            row = {}

            # Lag features
            for lag in self.lag_periods:
                if len(current_y) >= lag:
                    row[f"aqi_lag_{lag}"] = current_y.iloc[-lag]
                else:
                    row[f"aqi_lag_{lag}"] = current_y.iloc[-1]

            # Rolling features
            for w in self.rolling_windows:
                window_data = current_y.iloc[-w:] if len(current_y) >= w else current_y
                row[f"aqi_roll_mean_{w}"] = window_data.mean()
                row[f"aqi_roll_std_{w}"] = window_data.std()
                row[f"aqi_roll_min_{w}"] = window_data.min()
                row[f"aqi_roll_max_{w}"] = window_data.max()
                row[f"aqi_roll_median_{w}"] = window_data.median()
                row[f"aqi_ewm_{w}"] = current_y.ewm(span=w).mean().iloc[-1]

            # Time features
            row["hour"] = future_idx.hour
            row["day_of_week"] = future_idx.dayofweek
            row["month"] = future_idx.month
            row["is_weekend"] = int(future_idx.dayofweek >= 5)
            row["hour_sin"] = np.sin(2 * np.pi * future_idx.hour / 24)
            row["hour_cos"] = np.cos(2 * np.pi * future_idx.hour / 24)

            feature_rows.append(row)

        return pd.DataFrame(feature_rows)

    def get_feature_names(self) -> List[str]:
        """Return the list of feature names from the last build."""
        return self.feature_names_

    def get_feature_summary(self) -> Dict:
        """Return a summary of feature groups."""
        groups = {
            "lag": [f for f in self.feature_names_ if "lag" in f],
            "rolling": [f for f in self.feature_names_ if "roll" in f or "ewm" in f],
            "delta": [f for f in self.feature_names_ if "diff" in f or "pct" in f or "accel" in f],
            "time": [f for f in self.feature_names_ if any(t in f for t in ["hour", "day", "month", "doy", "weekend", "rush"])],
            "weather": [f for f in self.feature_names_ if "wx" in f or "weather" in f],
            "category": [f for f in self.feature_names_ if "aqi_cat" in f],
        }
        return {k: {"count": len(v), "features": v} for k, v in groups.items()}

"""
VayuGuard Data Pipeline - Feature Store
==========================================
Creates ML features from cleaned AQI + weather data:
- Lag features (1h, 3h, 6h, 12h, 24h, 48h, 168h)
- Rolling statistics (mean, std, min, max over windows)
- Time features (hour, day_of_week, month, season, is_holiday)
- Interaction features (weather x AQI)
"""

import os
import logging
from datetime import datetime
from typing import Optional

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# Default lag hours for feature creation
DEFAULT_LAG_HOURS = [1, 3, 6, 12, 24, 48, 168]

# Default rolling window sizes (in hours)
DEFAULT_ROLLING_WINDOWS = [3, 6, 12, 24, 48, 168]

# Indian public holidays (approximate - should be maintained)
INDIAN_HOLIDAYS = {
    "2024-01-26", "2024-03-25", "2024-03-29", "2024-04-14",
    "2024-04-21", "2024-05-20", "2024-06-17", "2024-08-15",
    "2024-10-02", "2024-10-12", "2024-11-01", "2024-12-25",
    "2025-01-26", "2025-03-14", "2025-03-31", "2025-04-14",
    "2025-04-18", "2025-05-12", "2025-06-07", "2025-08-15",
    "2025-10-02", "2025-10-20", "2025-11-05", "2025-12-25",
}


class FeatureStore:
    """
    Creates ML-ready features from cleaned AQI and weather data.
    
    Feature categories:
    1. Lag features - previous AQI values at various time offsets
    2. Rolling statistics - moving averages, std dev, min/max
    3. Time features - cyclical encodings, seasons, holidays
    4. Weather features - direct and interaction features
    5. Spatial features - city-level aggregated statistics
    """

    def __init__(
        self,
        lag_hours: Optional[list[int]] = None,
        rolling_windows: Optional[list[int]] = None,
        target_column: str = "value",
        group_columns: Optional[list[str]] = None,
    ):
        """
        Args:
            lag_hours: List of lag offsets in hours
            rolling_windows: List of rolling window sizes in hours
            target_column: Column to create features from
            group_columns: Columns to group by (default: city, parameter)
        """
        self.lag_hours = lag_hours or DEFAULT_LAG_HOURS
        self.rolling_windows = rolling_windows or DEFAULT_ROLLING_WINDOWS
        self.target_column = target_column
        self.group_columns = group_columns or ["city", "parameter"]
        self.feature_names: list[str] = []

    def create_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Create all features from the input DataFrame.

        Args:
            df: Merged AQI + weather DataFrame

        Returns:
            DataFrame with all engineered features
        """
        logger.info(f"Creating features from {len(df)} records")

        if df.empty:
            logger.warning("Empty DataFrame received")
            return df

        df = df.copy()

        # Ensure timestamp is sorted
        ts_col = "timestamp_utc" if "timestamp_utc" in df.columns else "timestamp_local"
        if ts_col in df.columns:
            df[ts_col] = pd.to_datetime(df[ts_col], utc=True, errors="coerce")
            df = df.sort_values(self.group_columns + [ts_col])

        # Create feature groups
        df = self._create_lag_features(df)
        df = self._create_rolling_features(df)
        df = self._create_time_features(df)
        df = self._create_weather_features(df)
        df = self._create_interaction_features(df)
        df = self._create_spatial_features(df)

        # Drop rows with all NaN features (from lag/rolling windows)
        feature_cols = [c for c in df.columns if c not in [
            "city", "location", "parameter", "value", "unit",
            "timestamp_utc", "timestamp_local", "date", "source",
            "country", "latitude", "longitude",
        ]]
        self.feature_names = feature_cols

        logger.info(f"Created {len(self.feature_names)} features. Output shape: {df.shape}")
        return df

    def _create_lag_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Create lag features: previous AQI values at various time offsets.
        
        For each lag period, creates a column like 'value_lag_1h'.
        """
        ts_col = "timestamp_utc" if "timestamp_utc" in df.columns else "timestamp_local"
        if ts_col not in df.columns or self.target_column not in df.columns:
            return df

        df = df.sort_values(self.group_columns + [ts_col])

        for lag_h in self.lag_hours:
            col_name = f"{self.target_column}_lag_{lag_h}h"
            df[col_name] = df.groupby(self.group_columns)[self.target_column].shift(
                periods=lag_h,  # Assuming hourly data
            )
            # Difference from lag
            df[f"{self.target_column}_diff_{lag_h}h"] = df[self.target_column] - df[col_name]
            # Pct change from lag
            df[f"{self.target_column}_pct_{lag_h}h"] = df.groupby(self.group_columns)[
                self.target_column
            ].pct_change(periods=lag_h)

        return df

    def _create_rolling_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Create rolling window statistics: mean, std, min, max, median.
        
        For each window, creates columns like 'value_roll_mean_24h'.
        """
        if self.target_column not in df.columns:
            return df

        for window in self.rolling_windows:
            group = df.groupby(self.group_columns)[self.target_column]
            
            # Rolling mean
            df[f"{self.target_column}_roll_mean_{window}h"] = group.transform(
                lambda x: x.rolling(window=window, min_periods=1).mean()
            )
            
            # Rolling std
            df[f"{self.target_column}_roll_std_{window}h"] = group.transform(
                lambda x: x.rolling(window=window, min_periods=1).std()
            )
            
            # Rolling min and max
            df[f"{self.target_column}_roll_min_{window}h"] = group.transform(
                lambda x: x.rolling(window=window, min_periods=1).min()
            )
            df[f"{self.target_column}_roll_max_{window}h"] = group.transform(
                lambda x: x.rolling(window=window, min_periods=1).max()
            )
            
            # Rolling median
            df[f"{self.target_column}_roll_median_{window}h"] = group.transform(
                lambda x: x.rolling(window=window, min_periods=1).median()
            )

            # Exponential moving average
            df[f"{self.target_column}_ema_{window}h"] = group.transform(
                lambda x: x.ewm(span=window, min_periods=1).mean()
            )

        return df

    def _create_time_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Create time-based features with cyclical encoding.
        
        Features:
        - Hour of day (sin/cos encoded)
        - Day of week (sin/cos encoded)
        - Month (sin/cos encoded)
        - Is weekend, is holiday, season
        """
        ts_col = "timestamp_utc" if "timestamp_utc" in df.columns else "timestamp_local"
        if ts_col not in df.columns:
            return df

        ts = pd.to_datetime(df[ts_col], utc=True, errors="coerce")

        # Hour of day - cyclical encoding
        df["hour_sin"] = np.sin(2 * np.pi * ts.dt.hour / 24)
        df["hour_cos"] = np.cos(2 * np.pi * ts.dt.hour / 24)
        df["hour_of_day"] = ts.dt.hour

        # Day of week - cyclical encoding
        df["dow_sin"] = np.sin(2 * np.pi * ts.dt.dayofweek / 7)
        df["dow_cos"] = np.cos(2 * np.pi * ts.dt.dayofweek / 7)
        df["day_of_week"] = ts.dt.dayofweek
        df["is_weekend"] = (ts.dt.dayofweek >= 5).astype(int)

        # Month - cyclical encoding
        df["month_sin"] = np.sin(2 * np.pi * ts.dt.month / 12)
        df["month_cos"] = np.cos(2 * np.pi * ts.dt.month / 12)
        df["month"] = ts.dt.month

        # Day of year - cyclical encoding
        df["doy_sin"] = np.sin(2 * np.pi * ts.dt.dayofyear / 365)
        df["doy_cos"] = np.cos(2 * np.pi * ts.dt.dayofyear / 365)

        # Is holiday
        dates = ts.dt.strftime("%Y-%m-%d")
        df["is_holiday"] = dates.isin(INDIAN_HOLIDAYS).astype(int)

        # Season
        df["season"] = ts.dt.month.map({
            12: "winter", 1: "winter", 2: "winter",
            3: "spring", 4: "spring", 5: "spring",
            6: "monsoon", 7: "monsoon", 8: "monsoon", 9: "monsoon",
            10: "post_monsoon", 11: "post_monsoon",
        })

        # One-hot encode season
        season_dummies = pd.get_dummies(df["season"], prefix="season", dtype=int)
        df = pd.concat([df, season_dummies], axis=1)

        # Rush hours (morning 8-10, evening 17-20)
        df["is_rush_hour"] = ts.dt.hour.isin([8, 9, 10, 17, 18, 19]).astype(int)

        # Diurnal phase
        df["is_daytime"] = ts.dt.hour.isin(range(6, 19)).astype(int)

        return df

    def _create_weather_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Create weather-derived features.
        
        Features:
        - Temperature lag and rolling
        - Wind direction components
        - Atmospheric stability proxy
        """
        # Temperature features
        if "temperature_2m" in df.columns:
            df["temp_lag_24h"] = df.groupby(self.group_columns)["temperature_2m"].shift(24)
            df["temp_diff_24h"] = df["temperature_2m"] - df["temp_lag_24h"]
            df["temp_roll_mean_24h"] = df.groupby(self.group_columns)["temperature_2m"].transform(
                lambda x: x.rolling(24, min_periods=1).mean()
            )

        # Wind features
        if "wind_speed_10m" in df.columns and "wind_direction_10m" in df.columns:
            # Convert wind direction to components
            wd_rad = np.deg2rad(df["wind_direction_10m"])
            df["wind_u"] = df["wind_speed_10m"] * np.cos(wd_rad)
            df["wind_v"] = df["wind_speed_10m"] * np.sin(wd_rad)

            # Calm wind indicator
            df["is_calm_wind"] = (df["wind_speed_10m"] < 1.5).astype(int)

        # Humidity features
        if "relative_humidity_2m" in df.columns:
            df["humidity_roll_mean_24h"] = df.groupby(self.group_columns)["relative_humidity_2m"].transform(
                lambda x: x.rolling(24, min_periods=1).mean()
            )
            # High humidity indicator (>80%)
            df["is_high_humidity"] = (df["relative_humidity_2m"] > 80).astype(int)

        # Precipitation features
        if "precipitation" in df.columns:
            df["precip_roll_sum_24h"] = df.groupby(self.group_columns)["precipitation"].transform(
                lambda x: x.rolling(24, min_periods=1).sum()
            )
            df["hours_since_rain"] = df.groupby(self.group_columns)["precipitation"].transform(
                lambda x: self._hours_since_event(x)
            )

        return df

    def _create_interaction_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Create interaction features between AQI and weather variables.
        """
        # Temperature x Humidity interaction
        if "temperature_2m" in df.columns and "relative_humidity_2m" in df.columns:
            df["temp_x_humidity"] = df["temperature_2m"] * df["relative_humidity_2m"] / 100

        # Wind speed x AQI (dispersion proxy)
        if "wind_speed_10m" in df.columns and self.target_column in df.columns:
            df["wind_x_aqi"] = df["wind_speed_10m"] * df[self.target_column]
            # Inverse wind as stagnation proxy
            df["stagnation_index"] = 1.0 / (df["wind_speed_10m"] + 0.1)

        # Temperature inversion proxy (low wind + high humidity + winter)
        if all(c in df.columns for c in ["wind_speed_10m", "relative_humidity_2m", "temperature_2m"]):
            df["inversion_proxy"] = (
                (1 / (df["wind_speed_10m"] + 0.1)) *
                df["relative_humidity_2m"] / 100 *
                np.maximum(0, 20 - df["temperature_2m"])  # Stronger in cold weather
            )

        # Rain cleanup effect
        if "precipitation" in df.columns and self.target_column in df.columns:
            df["rain_cleanup"] = df["precipitation"] * df[self.target_column]

        return df

    def _create_spatial_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Create spatial aggregation features.
        
        For each record, compute city-level and overall statistics
        at the same timestamp.
        """
        if "city" not in df.columns or self.target_column not in df.columns:
            return df

        # City-level statistics at same timestamp
        ts_col = "timestamp_utc" if "timestamp_utc" in df.columns else "timestamp_local"
        if ts_col in df.columns:
            city_stats = df.groupby(["city", ts_col])[self.target_column].agg(
                ["mean", "std", "min", "max", "count"]
            ).reset_index()
            city_stats.columns = ["city", ts_col, "city_mean_aqi", "city_std_aqi",
                                   "city_min_aqi", "city_max_aqi", "city_station_count"]

            df = df.merge(city_stats, on=["city", ts_col], how="left")

        return df

    @staticmethod
    def _hours_since_event(series: pd.Series, threshold: float = 0.0) -> pd.Series:
        """Calculate hours since last event (e.g., rain) occurred."""
        result = pd.Series(np.nan, index=series.index)
        counter = np.nan
        
        for i, val in enumerate(series):
            if pd.notna(val) and val > threshold:
                counter = 0
            elif pd.notna(counter):
                counter += 1
            result.iloc[i] = counter
        
        return result

    def get_feature_names(self) -> list[str]:
        """Return list of generated feature column names."""
        return self.feature_names.copy()

    def get_feature_importance_groups(self) -> dict[str, list[str]]:
        """Return features grouped by category."""
        groups = {
            "lag": [f for f in self.feature_names if "lag" in f or "diff" in f or "pct" in f],
            "rolling": [f for f in self.feature_names if "roll" in f or "ema" in f],
            "time": [f for f in self.feature_names if any(t in f for t in [
                "hour", "dow", "month", "doy", "weekend", "holiday", "season", "rush", "daytime"
            ])],
            "weather": [f for f in self.feature_names if any(t in f for t in [
                "temp", "wind", "humidity", "precip", "calm", "rain", "inversion", "stagnation"
            ])],
            "interaction": [f for f in self.feature_names if any(t in f for t in [
                "x_aqi", "x_humidity", "cleanup"
            ])],
            "spatial": [f for f in self.feature_names if "city_" in f],
        }
        return groups


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Create ML features")
    parser.add_argument("--input", type=str, required=True, help="Input CSV path")
    parser.add_argument("--output", type=str, default="features.csv", help="Output CSV path")
    args = parser.parse_args()

    df = pd.read_csv(args.input)
    store = FeatureStore()
    features_df = store.create_features(df)
    features_df.to_csv(args.output, index=False)
    print(f"Created {len(store.get_feature_names())} features. Output: {args.output}")


if __name__ == "__main__":
    main()

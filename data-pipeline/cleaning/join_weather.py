"""
VayuGuard Data Pipeline - Weather Joiner
==========================================
Merges AQI data with weather data on city + timestamp,
handling missing joins, time alignment, and feature enrichment.
"""

import logging
from typing import Optional

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# Maximum time difference for joining (in minutes)
DEFAULT_TIME_TOLERANCE_MINUTES = 30

# Weather columns to include in the join
WEATHER_COLUMNS = [
    "temperature_2m",
    "relative_humidity_2m",
    "dew_point_2m",
    "wind_speed_10m",
    "wind_direction_10m",
    "surface_pressure",
    "precipitation",
    "rain",
    "cloud_cover",
    "visibility",
]


class WeatherJoiner:
    """
    Joins cleaned AQI data with weather data.
    
    Handles:
    - Time alignment (nearest-timestamp matching with tolerance)
    - Missing weather data (forward/backward fill within windows)
    - City-based matching
    - Feature enrichment (derived weather features)
    """

    def __init__(
        self,
        time_tolerance_minutes: int = DEFAULT_TIME_TOLERANCE_MINUTES,
        fill_method: str = "ffill",
        fill_limit: int = 3,
    ):
        """
        Args:
            time_tolerance_minutes: Max time difference for matching records
            fill_method: How to fill missing weather ('ffill', 'bfill', 'interpolate', None)
            fill_limit: Max number of consecutive NAs to fill
        """
        self.time_tolerance_minutes = time_tolerance_minutes
        self.fill_method = fill_method
        self.fill_limit = fill_limit
        self.stats = {
            "aqi_records": 0,
            "weather_records": 0,
            "matched_records": 0,
            "unmatched_records": 0,
            "fill_rate": 0.0,
        }

    def join(
        self,
        aqi_df: pd.DataFrame,
        weather_df: pd.DataFrame,
        on_city: bool = True,
    ) -> pd.DataFrame:
        """
        Merge AQI and weather DataFrames.

        Args:
            aqi_df: Cleaned AQI DataFrame (must have city, timestamp_utc)
            weather_df: Weather DataFrame (must have city, timestamp_utc)
            on_city: Whether to join on city name (if False, uses lat/lon proximity)

        Returns:
            Merged DataFrame with AQI + weather columns
        """
        self.stats["aqi_records"] = len(aqi_df)
        self.stats["weather_records"] = len(weather_df)

        logger.info(f"Joining AQI ({len(aqi_df)}) with Weather ({len(weather_df)})")

        if aqi_df.empty or weather_df.empty:
            logger.warning("Cannot join - one or both DataFrames are empty")
            return aqi_df.copy()

        # Prepare timestamps
        aqi_df = self._prepare_timestamps(aqi_df.copy(), "aqi")
        weather_df = self._prepare_timestamps(weather_df.copy(), "weather")

        if on_city and "city" in aqi_df.columns and "city" in weather_df.columns:
            merged = self._join_on_city(aqi_df, weather_df)
        else:
            merged = self._join_on_coordinates(aqi_df, weather_df)

        # Fill missing weather values
        merged = self._fill_missing_weather(merged)

        # Add derived features
        merged = self._add_derived_features(merged)

        self.stats["matched_records"] = len(merged)
        self.stats["unmatched_records"] = self.stats["aqi_records"] - len(merged)
        self.stats["fill_rate"] = len(merged) / max(len(aqi_df), 1) * 100

        logger.info(f"Join complete: {len(merged)} records ({self.stats['fill_rate']:.1f}% match rate)")
        return merged

    def _prepare_timestamps(self, df: pd.DataFrame, prefix: str) -> pd.DataFrame:
        """Prepare and validate timestamp columns."""
        ts_col = "timestamp_utc"

        if ts_col not in df.columns:
            # Try alternative timestamp columns
            for alt in ["timestamp", "date", "time"]:
                if alt in df.columns:
                    df[ts_col] = pd.to_datetime(df[alt], utc=True, errors="coerce")
                    break

        if ts_col in df.columns:
            df[ts_col] = pd.to_datetime(df[ts_col], utc=True, errors="coerce")
            # Round to nearest hour for alignment
            df["_ts_hour"] = df[ts_col].dt.floor("h")

        return df

    def _join_on_city(self, aqi_df: pd.DataFrame, weather_df: pd.DataFrame) -> pd.DataFrame:
        """Join AQI and weather on city name + rounded timestamp."""
        # Select weather columns to merge
        merge_cols = ["city", "_ts_hour"]
        weather_merge_cols = [c for c in WEATHER_COLUMNS if c in weather_df.columns]
        
        # Also include lat/lon if available
        for coord in ["latitude", "longitude"]:
            if coord in weather_df.columns:
                weather_merge_cols.append(coord)

        weather_subset = weather_df[merge_cols + weather_merge_cols].copy()
        
        # Remove duplicates from weather data (keep first per city/hour)
        weather_subset = weather_subset.drop_duplicates(subset=merge_cols, keep="first")

        # Merge
        merged = aqi_df.merge(
            weather_subset,
            on=merge_cols,
            how="left",
            suffixes=("", "_weather"),
        )

        # If exact hour match failed for some, try nearest-match within tolerance
        unmatched = merged[merged[weather_merge_cols[0]].isna()] if weather_merge_cols else pd.DataFrame()
        if not unmatched.empty and len(unmatched) < len(merged):
            logger.info(f"Trying nearest-match for {len(unmatched)} unmatched records...")
            merged = self._nearest_match_fallback(merged, aqi_df, weather_df, weather_merge_cols)

        return merged.drop(columns=["_ts_hour"], errors="ignore")

    def _join_on_coordinates(self, aqi_df: pd.DataFrame, weather_df: pd.DataFrame) -> pd.DataFrame:
        """Join AQI and weather using lat/lon proximity + timestamp."""
        if not all(c in aqi_df.columns for c in ["latitude", "longitude"]):
            logger.warning("Missing coordinate columns for spatial join")
            return aqi_df

        # For each AQI record, find nearest weather record within tolerance
        merged_records = []
        
        for _, aqi_row in aqi_df.iterrows():
            best_match = None
            best_distance = float("inf")

            # Filter weather by time window
            aqi_time = aqi_row.get("timestamp_utc")
            if pd.isna(aqi_time):
                continue

            time_window = pd.Timedelta(minutes=self.time_tolerance_minutes)
            time_mask = (weather_df["timestamp_utc"] >= aqi_time - time_window) & \
                       (weather_df["timestamp_utc"] <= aqi_time + time_window)
            nearby_weather = weather_df[time_mask]

            if nearby_weather.empty:
                merged_records.append(aqi_row.to_dict())
                continue

            # Find nearest by coordinates
            for _, w_row in nearby_weather.iterrows():
                dist = np.sqrt(
                    (aqi_row["latitude"] - w_row.get("latitude", 0)) ** 2 +
                    (aqi_row["longitude"] - w_row.get("longitude", 0)) ** 2
                )
                if dist < best_distance:
                    best_distance = dist
                    best_match = w_row

            record = aqi_row.to_dict()
            if best_match is not None:
                for col in WEATHER_COLUMNS:
                    if col in best_match.index:
                        record[col] = best_match[col]

            merged_records.append(record)

        return pd.DataFrame(merged_records)

    def _nearest_match_fallback(
        self,
        merged: pd.DataFrame,
        aqi_df: pd.DataFrame,
        weather_df: pd.DataFrame,
        weather_cols: list[str],
    ) -> pd.DataFrame:
        """
        For records that didn't match on exact hour, try nearest timestamp within tolerance.
        """
        tolerance = pd.Timedelta(minutes=self.time_tolerance_minutes)
        
        # Find unmatched records
        if not weather_cols:
            return merged
        
        unmatched_mask = merged[weather_cols[0]].isna()
        unmatched_indices = merged[unmatched_mask].index

        for idx in unmatched_indices:
            row = merged.loc[idx]
            city = row.get("city")
            ts = row.get("timestamp_utc")
            
            if pd.isna(ts) or not city:
                continue

            # Find nearest weather for this city within tolerance
            city_weather = weather_df[weather_df["city"] == city] if "city" in weather_df.columns else weather_df
            if city_weather.empty:
                continue

            time_diffs = (city_weather["timestamp_utc"] - ts).abs()
            nearest_idx = time_diffs.idxmin()

            if time_diffs.loc[nearest_idx] <= tolerance:
                for col in weather_cols:
                    if col in city_weather.columns:
                        merged.at[idx, col] = city_weather.loc[nearest_idx, col]

        return merged

    def _fill_missing_weather(self, df: pd.DataFrame) -> pd.DataFrame:
        """Fill remaining missing weather values using the configured method."""
        weather_cols_in_df = [c for c in WEATHER_COLUMNS if c in df.columns]

        if not weather_cols_in_df:
            return df

        missing_before = df[weather_cols_in_df].isnull().sum().sum()

        if self.fill_method == "ffill":
            # Forward fill within city groups
            if "city" in df.columns:
                df[weather_cols_in_df] = df.groupby("city")[weather_cols_in_df].ffill(limit=self.fill_limit)
            else:
                df[weather_cols_in_df] = df[weather_cols_in_df].ffill(limit=self.fill_limit)

        elif self.fill_method == "bfill":
            if "city" in df.columns:
                df[weather_cols_in_df] = df.groupby("city")[weather_cols_in_df].bfill(limit=self.fill_limit)
            else:
                df[weather_cols_in_df] = df[weather_cols_in_df].bfill(limit=self.fill_limit)

        elif self.fill_method == "interpolate":
            if "city" in df.columns:
                df[weather_cols_in_df] = df.groupby("city")[weather_cols_in_df].transform(
                    lambda g: g.interpolate(method="linear", limit=self.fill_limit)
                )
            else:
                df[weather_cols_in_df] = df[weather_cols_in_df].interpolate(method="linear", limit=self.fill_limit)

        missing_after = df[weather_cols_in_df].isnull().sum().sum()
        logger.info(f"Filled {missing_before - missing_after} missing weather values using {self.fill_method}")

        return df

    def _add_derived_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add derived weather features useful for AQI prediction."""
        # Heat index (simplified)
        if "temperature_2m" in df.columns and "relative_humidity_2m" in df.columns:
            t = df["temperature_2m"]
            rh = df["relative_humidity_2m"]
            # Simplified heat index (Steadman)
            df["heat_index"] = 0.5 * (t + 61.0 + ((t - 68.0) * 1.2) + (rh * 0.094))

        # Wind speed categories
        if "wind_speed_10m" in df.columns:
            df["wind_category"] = pd.cut(
                df["wind_speed_10m"],
                bins=[0, 1.5, 3.3, 5.4, 7.9, 10.7, float("inf")],
                labels=["Calm", "Light", "Gentle", "Moderate", "Fresh", "Strong"],
            )

        # Temperature-humidity interaction (proxy for atmospheric stability)
        if "temperature_2m" in df.columns and "relative_humidity_2m" in df.columns:
            df["temp_humidity_index"] = df["temperature_2m"] * df["relative_humidity_2m"] / 100

        # Precipitation flag
        if "precipitation" in df.columns:
            df["is_raining"] = (df["precipitation"] > 0).astype(int)

        # Low visibility flag
        if "visibility" in df.columns:
            df["low_visibility"] = (df["visibility"] < 2000).astype(int)

        # Time-based features
        if "timestamp_utc" in df.columns:
            ts = pd.to_datetime(df["timestamp_utc"], utc=True)
            df["hour_of_day"] = ts.dt.hour
            df["is_weekend"] = ts.dt.dayofweek.isin([5, 6]).astype(int)
            df["season"] = ts.dt.month.map({
                12: "winter", 1: "winter", 2: "winter",
                3: "spring", 4: "spring", 5: "spring",
                6: "monsoon", 7: "monsoon", 8: "monsoon", 9: "monsoon",
                10: "autumn", 11: "autumn",
            })

        return df

    def get_stats(self) -> dict:
        """Return join statistics."""
        return self.stats.copy()


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Join AQI and Weather data")
    parser.add_argument("--aqi", type=str, required=True, help="Cleaned AQI CSV path")
    parser.add_argument("--weather", type=str, required=True, help="Weather CSV path")
    parser.add_argument("--output", type=str, default="merged_data.csv", help="Output CSV path")
    parser.add_argument("--tolerance", type=int, default=30, help="Time tolerance in minutes")
    args = parser.parse_args()

    aqi_df = pd.read_csv(args.aqi)
    weather_df = pd.read_csv(args.weather)
    
    joiner = WeatherJoiner(time_tolerance_minutes=args.tolerance)
    merged = joiner.join(aqi_df, weather_df)
    merged.to_csv(args.output, index=False)
    print(f"Merged: {len(merged)} records. Stats: {joiner.get_stats()}")


if __name__ == "__main__":
    main()

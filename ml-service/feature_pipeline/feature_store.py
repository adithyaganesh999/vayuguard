"""
Feature Store - Connect to Data Pipeline Output.

Provides a unified interface for retrieving AQI and weather data
from various sources (CSV files, databases, APIs). Handles data
validation, caching, and alignment of multi-source data.
"""

import pandas as pd
import numpy as np
import logging
import os
from typing import Optional, Dict, List
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)


class FeatureStore:
    """
    Feature store for AQI forecasting pipeline.

    Responsibilities:
    - Load AQI data from CSV, database, or API sources
    - Load weather data and align with AQI timestamps
    - Validate data quality (missing values, outliers, gaps)
    - Cache processed features for fast retrieval
    - Serve training and inference data with consistent schemas
    """

    def __init__(
        self,
        data_dir: str = "./data",
        cache_dir: str = "./cache",
        aqi_source: str = "csv",
        weather_source: str = "csv",
        default_city: str = "delhi",
        max_cache_size_mb: int = 500,
    ):
        """
        Args:
            data_dir: Base directory for data files.
            cache_dir: Directory for cached feature matrices.
            aqi_source: Source type for AQI data ('csv', 'api').
            weather_source: Source type for weather data ('csv', 'api').
            default_city: Default city for queries.
            max_cache_size_mb: Maximum cache size in megabytes.
        """
        self.data_dir = data_dir
        self.cache_dir = cache_dir
        self.aqi_source = aqi_source
        self.weather_source = weather_source
        self.default_city = default_city
        self.max_cache_size_mb = max_cache_size_mb
        self._cache: Dict[str, pd.DataFrame] = {}
        self._metadata: Dict[str, dict] = {}

        # Ensure directories exist
        os.makedirs(data_dir, exist_ok=True)
        os.makedirs(cache_dir, exist_ok=True)

    def get_training_data(
        self,
        city: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        include_weather: bool = True,
        resample_freq: str = "h",
    ) -> pd.DataFrame:
        """
        Retrieve training data with AQI and optional weather features.

        Args:
            city: City name or None for default.
            start_date: Start date string (YYYY-MM-DD).
            end_date: End date string (YYYY-MM-DD).
            include_weather: Whether to merge weather data.
            resample_freq: Resampling frequency ('h' for hourly).

        Returns:
            DataFrame with DatetimeIndex containing AQI and weather data.
        """
        city = city or self.default_city
        cache_key = f"train_{city}_{start_date}_{end_date}_{resample_freq}"

        if cache_key in self._cache:
            logger.info(f"Returning cached data for {cache_key}")
            return self._cache[cache_key]

        # Load AQI data
        aqi_df = self._load_aqi_data(city, start_date, end_date)

        # Resample to target frequency
        aqi_df = aqi_df.resample(resample_freq).mean().interpolate(method="time")

        if include_weather:
            weather_df = self._load_weather_data(city, start_date, end_date)
            if weather_df is not None and not weather_df.empty:
                weather_df = weather_df.resample(resample_freq).mean().interpolate(method="time")
                aqi_df = aqi_df.join(weather_df, how="left")

        # Validate
        aqi_df = self._validate_and_clean(aqi_df)

        # Cache result
        self._cache[cache_key] = aqi_df
        self._metadata[cache_key] = {
            "city": city, "start_date": start_date, "end_date": end_date,
            "n_rows": len(aqi_df), "n_cols": len(aqi_df.columns),
            "created_at": datetime.now().isoformat(),
        }
        logger.info(f"Loaded training data: {len(aqi_df)} rows, {len(aqi_df.columns)} columns")
        return aqi_df

    def get_latest_data(
        self,
        city: Optional[str] = None,
        hours: int = 168,
        include_weather: bool = True,
    ) -> pd.DataFrame:
        """
        Retrieve the most recent data for inference.

        Args:
            city: City name.
            hours: Number of hours of history to retrieve.
            include_weather: Whether to include weather data.

        Returns:
            Recent data DataFrame.
        """
        city = city or self.default_city
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(hours=hours)).strftime("%Y-%m-%d")
        return self.get_training_data(city, start_date, end_date, include_weather)

    def _load_aqi_data(self, city: str, start_date: Optional[str],
                        end_date: Optional[str]) -> pd.DataFrame:
        """Load AQI data from configured source."""
        if self.aqi_source == "csv":
            csv_path = os.path.join(self.data_dir, f"aqi_{city}.csv")
            if os.path.exists(csv_path):
                df = pd.read_csv(csv_path, parse_dates=["timestamp"], index_col="timestamp")
                if start_date:
                    df = df[df.index >= start_date]
                if end_date:
                    df = df[df.index <= end_date]
                return df
            else:
                logger.warning(f"AQI data file not found: {csv_path}. Generating synthetic data.")
                return self._generate_synthetic_aqi(city, start_date, end_date)
        elif self.aqi_source == "api":
            return self._fetch_aqi_from_api(city, start_date, end_date)
        else:
            raise ValueError(f"Unknown AQI source: {self.aqi_source}")

    def _load_weather_data(self, city: str, start_date: Optional[str],
                            end_date: Optional[str]) -> Optional[pd.DataFrame]:
        """Load weather data from configured source."""
        if self.weather_source == "csv":
            csv_path = os.path.join(self.data_dir, f"weather_{city}.csv")
            if os.path.exists(csv_path):
                df = pd.read_csv(csv_path, parse_dates=["timestamp"], index_col="timestamp")
                if start_date:
                    df = df[df.index >= start_date]
                if end_date:
                    df = df[df.index <= end_date]
                return df
            else:
                logger.warning(f"Weather data file not found: {csv_path}")
                return None
        return None

    def _fetch_aqi_from_api(self, city: str, start_date: Optional[str],
                             end_date: Optional[str]) -> pd.DataFrame:
        """Fetch AQI data from OpenAQ or similar API."""
        try:
            import requests
            base_url = "https://api.openaq.org/v2/measurements"
            params = {
                "city": city,
                "parameter": "pm25",
                "limit": 10000,
                "order_by": "date",
            }
            if start_date:
                params["date_from"] = start_date
            if end_date:
                params["date_to"] = end_date
            response = requests.get(base_url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json().get("results", [])
            if not data:
                logger.warning("No data returned from API, generating synthetic data")
                return self._generate_synthetic_aqi(city, start_date, end_date)
            df = pd.DataFrame(data)
            df["timestamp"] = pd.to_datetime(df["date"].apply(lambda x: x["utc"]))
            df = df.set_index("timestamp")
            df["aqi"] = df["value"]
            return df[["aqi"]]
        except Exception as e:
            logger.error(f"API fetch failed: {e}. Generating synthetic data.")
            return self._generate_synthetic_aqi(city, start_date, end_date)

    def _generate_synthetic_aqi(self, city: str, start_date: Optional[str],
                                 end_date: Optional[str]) -> pd.DataFrame:
        """Generate synthetic AQI data for testing."""
        start = pd.Timestamp(start_date) if start_date else pd.Timestamp("2024-01-01")
        end = pd.Timestamp(end_date) if end_date else pd.Timestamp("2024-12-31")
        idx = pd.date_range(start=start, end=end, freq="h")
        np.random.seed(hash(city) % 2**31)
        base_aqi = {"delhi": 150, "mumbai": 120, "bangalore": 80, "chennai": 90}.get(city, 100)
        # Daily pattern + weekly + noise
        hourly = np.sin(2 * np.pi * idx.hour / 24) * 30
        weekly = np.sin(2 * np.pi * idx.dayofweek / 7) * 15
        yearly = np.sin(2 * np.pi * idx.dayofyear / 365) * 40
        noise = np.random.normal(0, 20, len(idx))
        aqi = base_aqi + hourly + weekly + yearly + noise
        aqi = np.clip(aqi, 0, 500)
        return pd.DataFrame({"aqi": aqi}, index=idx)

    def _validate_and_clean(self, df: pd.DataFrame) -> pd.DataFrame:
        """Validate data quality and handle issues."""
        # Check for missing values
        missing_pct = df.isnull().mean() * 100
        for col in missing_pct[missing_pct > 5].index:
            logger.warning(f"Column '{col}' has {missing_pct[col]:.1f}% missing values")

        # Forward-fill small gaps, then backward-fill
        df = df.fillna(method="ffill", limit=6).fillna(method="bfill", limit=6)

        # Clip AQI to valid range
        if "aqi" in df.columns:
            df["aqi"] = df["aqi"].clip(0, 500)

        # Remove duplicate timestamps
        df = df[~df.index.duplicated(keep="first")]
        return df

    def get_data_summary(self) -> Dict:
        """Return summary of loaded data and cache status."""
        return {
            "cache_size": len(self._cache),
            "cache_keys": list(self._cache.keys()),
            "metadata": self._metadata,
            "data_dir": self.data_dir,
        }

    def clear_cache(self) -> None:
        """Clear the feature cache."""
        self._cache.clear()
        self._metadata.clear()
        logger.info("Feature store cache cleared")

    def save_features(self, df: pd.DataFrame, name: str) -> None:
        """Save a feature matrix to the cache directory."""
        path = os.path.join(self.cache_dir, f"{name}.parquet")
        df.to_parquet(path)
        logger.info(f"Features saved to {path}")

    def load_features(self, name: str) -> Optional[pd.DataFrame]:
        """Load a cached feature matrix."""
        path = os.path.join(self.cache_dir, f"{name}.parquet")
        if os.path.exists(path):
            return pd.read_parquet(path)
        return None

"""
VayuGuard Data Pipeline - Open-Meteo Fetcher
===============================================
Fetches weather data (temperature, humidity, wind speed/direction,
precipitation) from the Open-Meteo API for AQI correlation analysis.
"""

import os
import time
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

OPENMETEO_BASE_URL = "https://api.open-meteo.com/v1"
OPENMETEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1"
OPENMETEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

# Indian city coordinates for weather lookups
INDIAN_CITY_COORDS = {
    "Delhi": {"latitude": 28.6139, "longitude": 77.2090},
    "Mumbai": {"latitude": 19.0760, "longitude": 72.8777},
    "Kolkata": {"latitude": 22.5726, "longitude": 88.3639},
    "Chennai": {"latitude": 13.0827, "longitude": 80.2707},
    "Bangalore": {"latitude": 12.9716, "longitude": 77.5946},
    "Hyderabad": {"latitude": 17.3850, "longitude": 78.4867},
    "Pune": {"latitude": 18.5204, "longitude": 73.8567},
    "Ahmedabad": {"latitude": 23.0225, "longitude": 72.5714},
    "Lucknow": {"latitude": 26.8467, "longitude": 80.9462},
    "Jaipur": {"latitude": 26.9124, "longitude": 75.7873},
    "Varanasi": {"latitude": 25.3176, "longitude": 82.9739},
    "Patna": {"latitude": 25.6093, "longitude": 85.1376},
    "Gurgaon": {"latitude": 28.4595, "longitude": 77.0266},
    "Noida": {"latitude": 28.5355, "longitude": 77.3910},
    "Faridabad": {"latitude": 28.4089, "longitude": 77.3178},
    "Chandigarh": {"latitude": 30.7333, "longitude": 76.7794},
    "Bhopal": {"latitude": 23.2599, "longitude": 77.4126},
    "Amritsar": {"latitude": 31.6340, "longitude": 74.8723},
    "Agra": {"latitude": 27.1767, "longitude": 78.0081},
    "Kanpur": {"latitude": 26.4499, "longitude": 80.3319},
}

# Weather variables to fetch
HOURLY_VARIABLES = [
    "temperature_2m",
    "relative_humidity_2m",
    "dew_point_2m",
    "wind_speed_10m",
    "wind_speed_100m",
    "wind_direction_10m",
    "wind_direction_100m",
    "surface_pressure",
    "precipitation",
    "rain",
    "cloud_cover",
    "cloud_cover_low",
    "cloud_cover_mid",
    "cloud_cover_high",
    "visibility",
]

DAILY_VARIABLES = [
    "temperature_2m_max",
    "temperature_2m_min",
    "temperature_2m_mean",
    "precipitation_sum",
    "precipitation_hours",
    "wind_speed_10m_max",
    "wind_gusts_10m_max",
    "sunshine_duration",
    "uv_index_max",
]


class OpenMeteoFetcher:
    """Fetches weather data from the Open-Meteo API."""

    def __init__(
        self,
        base_url: str = OPENMETEO_BASE_URL,
        rate_limit_delay: float = 0.5,
        max_retries: int = 3,
        timeout: int = 30,
    ):
        self.base_url = base_url
        self.rate_limit_delay = rate_limit_delay
        self.max_retries = max_retries
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({"Accept": "application/json"})
        self._last_request_time = 0.0

    def _rate_limit(self):
        """Enforce rate limiting."""
        elapsed = time.time() - self._last_request_time
        if elapsed < self.rate_limit_delay:
            time.sleep(self.rate_limit_delay - elapsed)
        self._last_request_time = time.time()

    def _make_request(self, url: str, params: dict) -> dict:
        """Make API request with retries."""
        last_exception = None
        for attempt in range(1, self.max_retries + 1):
            self._rate_limit()
            try:
                response = self.session.get(url, params=params, timeout=self.timeout)
                response.raise_for_status()
                return response.json()
            except requests.exceptions.HTTPError as e:
                status = e.response.status_code if e.response else None
                if status == 429:
                    logger.warning("Open-Meteo rate limited. Waiting 30s...")
                    time.sleep(30)
                    continue
                elif status and 500 <= status < 600:
                    wait = 2 ** attempt
                    logger.warning(f"Open-Meteo server error {status}. Retry in {wait}s...")
                    time.sleep(wait)
                    last_exception = e
                    continue
                else:
                    raise
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                wait = 2 ** attempt
                logger.warning(f"Open-Meteo connection error. Retry in {wait}s... {e}")
                time.sleep(wait)
                last_exception = e
                continue

        if last_exception:
            raise last_exception
        raise requests.RequestException(f"Failed to fetch from Open-Meteo: {url}")

    def fetch_hourly_weather(
        self,
        latitude: float,
        longitude: float,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        variables: Optional[list[str]] = None,
    ) -> pd.DataFrame:
        """
        Fetch hourly weather data for a location.

        Args:
            latitude: Location latitude
            longitude: Location longitude
            date_from: Start datetime
            date_to: End datetime
            variables: List of hourly variables to fetch

        Returns:
            DataFrame with hourly weather data
        """
        if date_from is None:
            date_from = datetime.utcnow() - timedelta(hours=24)
        if date_to is None:
            date_to = datetime.utcnow()
        if variables is None:
            variables = HOURLY_VARIABLES

        params = {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": ",".join(variables),
            "start_date": date_from.strftime("%Y-%m-%d"),
            "end_date": date_to.strftime("%Y-%m-%d"),
            "timezone": "Asia/Kolkata",
        }

        data = self._make_request(f"{self.base_url}/forecast", params)
        return self._parse_hourly_response(data, latitude, longitude)

    def _parse_hourly_response(self, data: dict, latitude: float, longitude: float) -> pd.DataFrame:
        """Parse hourly weather response into DataFrame."""
        hourly = data.get("hourly", {})
        if not hourly:
            logger.warning("No hourly data in response")
            return pd.DataFrame()

        times = hourly.get("time", [])
        df = pd.DataFrame({"timestamp": pd.to_datetime(times)})

        for key, values in hourly.items():
            if key == "time":
                continue
            df[key] = values

        df["latitude"] = latitude
        df["longitude"] = longitude
        df["timestamp_utc"] = df["timestamp"].dt.tz_localize("Asia/Kolkata").dt.tz_convert("UTC")
        df = df.drop(columns=["timestamp"])

        # Convert numeric columns
        numeric_cols = [c for c in df.columns if c not in ("timestamp_utc", "latitude", "longitude")]
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        return df

    def fetch_daily_weather(
        self,
        latitude: float,
        longitude: float,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        variables: Optional[list[str]] = None,
    ) -> pd.DataFrame:
        """
        Fetch daily weather summary for a location.

        Args:
            latitude: Location latitude
            longitude: Location longitude
            date_from: Start date
            date_to: End date
            variables: Daily variables to fetch

        Returns:
            DataFrame with daily weather summaries
        """
        if date_from is None:
            date_from = datetime.utcnow() - timedelta(days=30)
        if date_to is None:
            date_to = datetime.utcnow()
        if variables is None:
            variables = DAILY_VARIABLES

        params = {
            "latitude": latitude,
            "longitude": longitude,
            "daily": ",".join(variables),
            "start_date": date_from.strftime("%Y-%m-%d"),
            "end_date": date_to.strftime("%Y-%m-%d"),
            "timezone": "Asia/Kolkata",
        }

        data = self._make_request(f"{self.base_url}/forecast", params)
        return self._parse_daily_response(data, latitude, longitude)

    def _parse_daily_response(self, data: dict, latitude: float, longitude: float) -> pd.DataFrame:
        """Parse daily weather response into DataFrame."""
        daily = data.get("daily", {})
        if not daily:
            logger.warning("No daily data in response")
            return pd.DataFrame()

        times = daily.get("time", [])
        df = pd.DataFrame({"date": pd.to_datetime(times)})

        for key, values in daily.items():
            if key == "time":
                continue
            df[key] = values

        df["latitude"] = latitude
        df["longitude"] = longitude

        numeric_cols = [c for c in df.columns if c not in ("date", "latitude", "longitude")]
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        return df

    def fetch_historical_weather(
        self,
        latitude: float,
        longitude: float,
        date_from: datetime,
        date_to: datetime,
        variables: Optional[list[str]] = None,
    ) -> pd.DataFrame:
        """
        Fetch historical weather data from the archive API.

        Args:
            latitude: Location latitude
            longitude: Location longitude
            date_from: Start date (up to 1950)
            date_to: End date
            variables: Hourly variables to fetch

        Returns:
            DataFrame with historical hourly weather data
        """
        if variables is None:
            variables = HOURLY_VARIABLES[:8]  # Fewer variables for historical

        # Open-Meteo archive API has a max range of 90 days per request
        frames = []
        current_start = date_from
        while current_start < date_to:
            current_end = min(current_start + timedelta(days=89), date_to)
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "start_date": current_start.strftime("%Y-%m-%d"),
                "end_date": current_end.strftime("%Y-%m-%d"),
                "hourly": ",".join(variables),
                "timezone": "Asia/Kolkata",
            }

            try:
                data = self._make_request(f"{OPENMETEO_ARCHIVE_URL}/era5", params)
                df = self._parse_hourly_response(data, latitude, longitude)
                if not df.empty:
                    frames.append(df)
            except requests.RequestException as e:
                logger.error(f"Failed to fetch historical data {current_start} - {current_end}: {e}")

            current_start = current_end + timedelta(days=1)

        if frames:
            return pd.concat(frames, ignore_index=True)
        return pd.DataFrame()

    def fetch_weather_for_city(
        self,
        city: str,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        frequency: str = "hourly",
    ) -> pd.DataFrame:
        """
        Convenience method to fetch weather for an Indian city by name.

        Args:
            city: City name (must be in INDIAN_CITY_COORDS)
            date_from: Start datetime
            date_to: End datetime
            frequency: 'hourly' or 'daily'

        Returns:
            DataFrame with weather data
        """
        coords = INDIAN_CITY_COORDS.get(city)
        if coords is None:
            logger.error(f"City '{city}' not found in coordinates map. Available: {list(INDIAN_CITY_COORDS.keys())}")
            return pd.DataFrame()

        if frequency == "daily":
            df = self.fetch_daily_weather(
                coords["latitude"], coords["longitude"],
                date_from, date_to,
            )
        else:
            df = self.fetch_hourly_weather(
                coords["latitude"], coords["longitude"],
                date_from, date_to,
            )

        if not df.empty:
            df["city"] = city
        return df

    def fetch_all_cities(
        self,
        cities: Optional[list[str]] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        frequency: str = "hourly",
    ) -> pd.DataFrame:
        """
        Fetch weather data for multiple Indian cities.

        Args:
            cities: List of city names (defaults to all tracked)
            date_from: Start datetime
            date_to: End datetime
            frequency: 'hourly' or 'daily'

        Returns:
            Combined DataFrame for all cities
        """
        if cities is None:
            cities = list(INDIAN_CITY_COORDS.keys())

        frames = []
        for city in cities:
            try:
                df = self.fetch_weather_for_city(city, date_from, date_to, frequency)
                if not df.empty:
                    frames.append(df)
            except Exception as e:
                logger.error(f"Error fetching weather for {city}: {e}")
                continue

        if frames:
            return pd.concat(frames, ignore_index=True)
        return pd.DataFrame()

    def save_to_postgres(self, df: pd.DataFrame, table: str = "weather_readings_raw"):
        """Save weather data to PostgreSQL."""
        from sqlalchemy import create_engine

        db_url = os.getenv(
            "DATABASE_URL",
            "postgresql://vayuguard:vayuguard@localhost:5432/vayuguard",
        )
        engine = create_engine(db_url)
        df.to_sql(table, engine, if_exists="append", index=False)
        logger.info(f"Saved {len(df)} weather records to {table}")

    def save_to_csv(self, df: pd.DataFrame, filepath: str):
        """Save DataFrame to CSV."""
        df.to_csv(filepath, index=False)
        logger.info(f"Saved {len(df)} records to {filepath}")


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Fetch weather data from Open-Meteo")
    parser.add_argument("--city", type=str, help="City name")
    parser.add_argument("--frequency", choices=["hourly", "daily"], default="hourly")
    parser.add_argument("--hours-back", type=int, default=24, help="Hours of history")
    parser.add_argument("--output", type=str, default="weather_data.csv", help="Output CSV path")
    args = parser.parse_args()

    fetcher = OpenMeteoFetcher()
    date_from = datetime.utcnow() - timedelta(hours=args.hours_back)

    if args.city:
        cities = [args.city]
    else:
        cities = ["Delhi", "Mumbai", "Bangalore"]

    df = fetcher.fetch_all_cities(cities, date_from=date_from, frequency=args.frequency)

    if not df.empty:
        fetcher.save_to_csv(df, args.output)
        print(f"Fetched {len(df)} records. Saved to {args.output}")
    else:
        print("No data fetched.")


if __name__ == "__main__":
    main()

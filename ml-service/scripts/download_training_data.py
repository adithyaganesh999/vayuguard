"""
Download AQI Training Data from OpenAQ.

Fetches historical AQI data from the OpenAQ API for specified cities
and saves it as CSV files for model training.
"""

import argparse
import logging
import os
import sys
import time
from datetime import datetime, timedelta
from typing import Optional, List

import pandas as pd
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


class OpenAQDownloader:
    """
    Downloads AQI data from the OpenAQ API.

    Supports:
    - Multiple cities and parameters (pm25, pm10, o3, no2, so2, co)
    - Date range specification
    - Rate limiting and retry logic
    - Data validation and cleaning
    - CSV export for training pipeline
    """

    BASE_URL = "https://api.openaq.org/v2/measurements"
    DEFAULT_PARAMETERS = ["pm25", "pm10"]

    def __init__(
        self,
        output_dir: str = "./data",
        rate_limit_delay: float = 1.0,
        max_retries: int = 3,
        api_key: Optional[str] = None,
    ):
        """
        Args:
            output_dir: Directory to save downloaded data.
            rate_limit_delay: Delay between API calls in seconds.
            max_retries: Maximum number of retries on failure.
            api_key: Optional OpenAQ API key for higher rate limits.
        """
        self.output_dir = output_dir
        self.rate_limit_delay = rate_limit_delay
        self.max_retries = max_retries
        self.api_key = api_key
        os.makedirs(output_dir, exist_ok=True)

    def download_city_data(
        self,
        city: str,
        parameter: str = "pm25",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 10000,
    ) -> pd.DataFrame:
        """
        Download AQI data for a specific city.

        Args:
            city: City name.
            parameter: Pollutant parameter (pm25, pm10, etc.).
            start_date: Start date (YYYY-MM-DD).
            end_date: End date (YYYY-MM-DD).
            limit: Maximum records per request.

        Returns:
            DataFrame with AQI measurements.
        """
        import requests

        if start_date is None:
            start_date = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")
        if end_date is None:
            end_date = datetime.now().strftime("%Y-%m-%d")

        logger.info(f"Downloading {parameter} data for {city} ({start_date} to {end_date})")

        all_data = []
        page = 1

        while True:
            params = {
                "city": city,
                "parameter": parameter,
                "date_from": start_date,
                "date_to": end_date,
                "limit": limit,
                "page": page,
                "order_by": "date",
                "sort": "asc",
            }
            if self.api_key:
                params["api_key"] = self.api_key

            for attempt in range(self.max_retries):
                try:
                    response = requests.get(self.BASE_URL, params=params, timeout=30)
                    response.raise_for_status()
                    data = response.json()
                    break
                except requests.exceptions.RequestException as e:
                    logger.warning(f"Attempt {attempt+1} failed: {e}")
                    if attempt < self.max_retries - 1:
                        time.sleep(self.rate_limit_delay * (attempt + 1))
                    else:
                        logger.error(f"Failed to download data after {self.max_retries} attempts")
                        return pd.DataFrame()

            results = data.get("results", [])
            if not results:
                break

            all_data.extend(results)
            logger.info(f"Downloaded page {page}: {len(results)} records")

            # Check if there are more pages
            meta = data.get("meta", {})
            if page * limit >= meta.get("found", 0):
                break
            page += 1
            time.sleep(self.rate_limit_delay)

        if not all_data:
            logger.warning(f"No data found for {city}/{parameter}")
            return pd.DataFrame()

        # Convert to DataFrame
        df = pd.DataFrame(all_data)
        df["timestamp"] = pd.to_datetime(df["date"].apply(lambda x: x.get("utc", x.get("local"))))
        df = df.set_index("timestamp")
        df["value"] = pd.to_numeric(df["value"], errors="coerce")

        # Pivot to get one column per parameter
        df_clean = df[["value"]].rename(columns={"value": parameter})
        df_clean = df_clean[~df_clean.index.duplicated(keep="first")]
        df_clean = df_clean.sort_index()

        logger.info(f"Downloaded {len(df_clean)} records for {city}/{parameter}")
        return df_clean

    def download_multiple_cities(
        self,
        cities: List[str],
        parameters: Optional[List[str]] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> dict:
        """
        Download data for multiple cities.

        Args:
            cities: List of city names.
            parameters: List of pollutant parameters.
            start_date: Start date string.
            end_date: End date string.

        Returns:
            Dict mapping city names to DataFrames.
        """
        parameters = parameters or self.DEFAULT_PARAMETERS
        results = {}

        for city in cities:
            city_data = []
            for param in parameters:
                df = self.download_city_data(city, param, start_date, end_date)
                if not df.empty:
                    city_data.append(df)
                time.sleep(self.rate_limit_delay)

            if city_data:
                combined = pd.concat(city_data, axis=1)
                # Calculate AQI from PM2.5 (simplified conversion)
                if "pm25" in combined.columns:
                    combined["aqi"] = self._pm25_to_aqi(combined["pm25"])
                else:
                    combined["aqi"] = combined.iloc[:, 0]  # Use first available parameter

                # Save to CSV
                output_path = os.path.join(self.output_dir, f"aqi_{city}.csv")
                combined.to_csv(output_path)
                results[city] = combined
                logger.info(f"Saved {city} data to {output_path} ({len(combined)} records)")
            else:
                logger.warning(f"No data available for {city}")

        return results

    def _pm25_to_aqi(self, pm25: pd.Series) -> pd.Series:
        """
        Convert PM2.5 concentration to AQI (US EPA method).

        Args:
            pm25: PM2.5 concentration values.

        Returns:
            AQI values.
        """
        breakpoints = [
            (0, 12.0, 0, 50),
            (12.1, 35.4, 51, 100),
            (35.5, 55.4, 101, 150),
            (55.5, 150.4, 151, 200),
            (150.5, 250.4, 201, 300),
            (250.5, 500.4, 301, 500),
        ]

        def convert_single(val):
            if pd.isna(val):
                return np.nan
            for bp_lo, bp_hi, aqi_lo, aqi_hi in breakpoints:
                if bp_lo <= val <= bp_hi:
                    return ((aqi_hi - aqi_lo) / (bp_hi - bp_lo)) * (val - bp_lo) + aqi_lo
            return 500 if val > 500 else np.nan

        return pm25.apply(convert_single)

    def generate_synthetic_data(self, cities: List[str], days: int = 365) -> None:
        """
        Generate synthetic AQI data for testing when API is unavailable.

        Args:
            cities: List of city names.
            days: Number of days of data to generate.
        """
        logger.info(f"Generating synthetic data for {len(cities)} cities, {days} days")

        for city in cities:
            np.random.seed(hash(city) % 2**31)
            n_hours = days * 24
            idx = pd.date_range("2024-01-01", periods=n_hours, freq="h")

            base_aqi = {"delhi": 150, "mumbai": 120, "bangalore": 80,
                        "chennai": 90, "kolkata": 130}.get(city, 100)

            hourly_pattern = np.sin(2 * np.pi * idx.hour / 24) * 30
            weekly_pattern = np.sin(2 * np.pi * idx.dayofweek / 7) * 15
            seasonal = np.sin(2 * np.pi * idx.dayofyear / 365) * 40
            noise = np.random.normal(0, 20, n_hours)

            aqi = np.clip(base_aqi + hourly_pattern + weekly_pattern + seasonal + noise, 0, 500)
            pm25 = np.clip(aqi * 0.5 + np.random.normal(0, 10, n_hours), 0, 500)
            temperature = 25 + 10 * np.sin(2 * np.pi * idx.dayofyear / 365) + np.random.normal(0, 3, n_hours)
            humidity = 60 + np.random.normal(0, 10, n_hours)
            wind_speed = 10 + np.random.normal(0, 3, n_hours)

            df = pd.DataFrame({
                "aqi": aqi, "pm25": pm25, "temperature": temperature,
                "humidity": humidity, "wind_speed": wind_speed,
            }, index=idx)
            df.index.name = "timestamp"

            output_path = os.path.join(self.output_dir, f"aqi_{city}.csv")
            df.to_csv(output_path)
            logger.info(f"Generated synthetic data for {city}: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Download AQI training data")
    parser.add_argument("--cities", nargs="+", default=["delhi", "mumbai", "bangalore"],
                        help="Cities to download data for")
    parser.add_argument("--output-dir", type=str, default="./data")
    parser.add_argument("--start-date", type=str, default=None)
    parser.add_argument("--end-date", type=str, default=None)
    parser.add_argument("--parameters", nargs="+", default=["pm25", "pm10"])
    parser.add_argument("--synthetic", action="store_true", help="Generate synthetic data")
    parser.add_argument("--days", type=int, default=365, help="Days of synthetic data")
    args = parser.parse_args()

    downloader = OpenAQDownloader(output_dir=args.output_dir)

    if args.synthetic:
        downloader.generate_synthetic_data(args.cities, args.days)
    else:
        downloader.download_multiple_cities(
            args.cities, args.parameters, args.start_date, args.end_date,
        )

    logger.info("Data download complete!")


if __name__ == "__main__":
    main()

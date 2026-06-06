"""
VayuGuard Data Pipeline - OpenAQ Fetcher
==========================================
Fetches AQI data from the OpenAQ API v2 with pagination,
rate limiting, and robust error handling.
"""

import os
import time
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests
import pandas as pd

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

OPENAQ_BASE_URL = "https://api.openaq.org/v2"
DEFAULT_LIMIT = 1000
MAX_RETRIES = 3
RETRY_BACKOFF = 2  # seconds, doubles on each retry
RATE_LIMIT_DELAY = 1.0  # seconds between requests


class OpenAQFetcher:
    """Fetches air quality data from the OpenAQ API v2."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = OPENAQ_BASE_URL,
        rate_limit_delay: float = RATE_LIMIT_DELAY,
        max_retries: int = MAX_RETRIES,
    ):
        self.api_key = api_key or os.getenv("OPENAQ_API_KEY", "")
        self.base_url = base_url
        self.rate_limit_delay = rate_limit_delay
        self.max_retries = max_retries
        self.session = requests.Session()
        self.session.headers.update({"Accept": "application/json"})
        if self.api_key:
            self.session.headers.update({"X-API-Key": self.api_key})
        self._last_request_time = 0.0

    def _rate_limit(self):
        """Enforce rate limiting between requests."""
        elapsed = time.time() - self._last_request_time
        if elapsed < self.rate_limit_delay:
            time.sleep(self.rate_limit_delay - elapsed)
        self._last_request_time = time.time()

    def _make_request(self, endpoint: str, params: dict) -> dict:
        """
        Make an API request with retries and exponential backoff.

        Args:
            endpoint: API endpoint path (e.g., '/measurements')
            params: Query parameters

        Returns:
            JSON response as dict

        Raises:
            requests.RequestException: After all retries exhausted
        """
        url = f"{self.base_url}{endpoint}"
        last_exception = None

        for attempt in range(1, self.max_retries + 1):
            self._rate_limit()
            try:
                logger.debug(f"Request attempt {attempt}/{self.max_retries}: {url} params={params}")
                response = self.session.get(url, params=params, timeout=30)
                response.raise_for_status()
                return response.json()

            except requests.exceptions.HTTPError as e:
                status_code = e.response.status_code if e.response is not None else None
                if status_code == 429:
                    # Rate limited - wait longer
                    retry_after = int(e.response.headers.get("Retry-After", 60))
                    logger.warning(f"Rate limited by OpenAQ. Waiting {retry_after}s...")
                    time.sleep(retry_after)
                    continue
                elif status_code and 500 <= status_code < 600:
                    # Server error - retry with backoff
                    wait = RETRY_BACKOFF * (2 ** (attempt - 1))
                    logger.warning(f"Server error {status_code}. Retrying in {wait}s...")
                    time.sleep(wait)
                    last_exception = e
                    continue
                elif status_code and 400 <= status_code < 500:
                    # Client error - don't retry
                    logger.error(f"Client error {status_code}: {e}")
                    raise
                else:
                    wait = RETRY_BACKOFF * (2 ** (attempt - 1))
                    logger.warning(f"HTTP error. Retrying in {wait}s...")
                    time.sleep(wait)
                    last_exception = e
                    continue

            except requests.exceptions.ConnectionError as e:
                wait = RETRY_BACKOFF * (2 ** (attempt - 1))
                logger.warning(f"Connection error. Retrying in {wait}s... {e}")
                time.sleep(wait)
                last_exception = e
                continue

            except requests.exceptions.Timeout as e:
                wait = RETRY_BACKOFF * (2 ** (attempt - 1))
                logger.warning(f"Timeout. Retrying in {wait}s... {e}")
                time.sleep(wait)
                last_exception = e
                continue

        logger.error(f"All {self.max_retries} retries exhausted for {url}")
        if last_exception:
            raise last_exception
        raise requests.RequestException(f"Failed to fetch from {url}")

    def fetch_measurements(
        self,
        city: Optional[str] = None,
        country: str = "IN",
        parameter: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        limit: int = DEFAULT_LIMIT,
    ) -> pd.DataFrame:
        """
        Fetch AQI measurements with automatic pagination.

        Args:
            city: City name filter
            country: ISO country code (default: IN for India)
            parameter: Pollutant parameter (pm25, pm10, so2, no2, o3, co, bc)
            date_from: Start datetime
            date_to: End datetime
            limit: Results per page

        Returns:
            DataFrame with columns: location, city, country, parameter, value,
            unit, timestamp_utc, latitude, longitude
        """
        all_records = []
        page = 1
        total_fetched = 0

        params = {
            "limit": limit,
            "country": country,
            "order_by": "date",
            "sort": "asc",
        }
        if city:
            params["city"] = city
        if parameter:
            params["parameter"] = parameter
        if date_from:
            params["date_from"] = date_from.isoformat()
        if date_to:
            params["date_to"] = date_to.isoformat()

        while True:
            params["page"] = page
            try:
                data = self._make_request("/measurements", params)
            except requests.RequestException as e:
                logger.error(f"Failed to fetch page {page}: {e}")
                break

            results = data.get("results", [])
            if not results:
                logger.info(f"No more results at page {page}. Stopping pagination.")
                break

            all_records.extend(results)
            total_fetched += len(results)
            logger.info(f"Fetched page {page}: {len(results)} records (total: {total_fetched})")

            # Check if we've retrieved all available results
            meta = data.get("meta", {})
            found = meta.get("found", None)
            if found is not None and total_fetched >= found:
                logger.info(f"All {found} records fetched.")
                break

            # OpenAQ pagination limit check
            if len(results) < limit:
                logger.info("Last page reached (fewer results than limit).")
                break

            page += 1

        if not all_records:
            logger.warning("No records fetched.")
            return pd.DataFrame()

        df = self._normalize_measurements(all_records)
        logger.info(f"Total records fetched: {len(df)}")
        return df

    def _normalize_measurements(self, records: list[dict]) -> pd.DataFrame:
        """Normalize raw measurement records into a clean DataFrame."""
        normalized = []
        for r in records:
            date_info = r.get("date", {})
            coordinates = r.get("coordinates", {})
            normalized.append({
                "location": r.get("location"),
                "city": r.get("city"),
                "country": r.get("country"),
                "parameter": r.get("parameter"),
                "value": r.get("value"),
                "unit": r.get("unit"),
                "timestamp_utc": date_info.get("utc"),
                "timestamp_local": date_info.get("local"),
                "latitude": coordinates.get("latitude"),
                "longitude": coordinates.get("longitude"),
            })
        df = pd.DataFrame(normalized)
        if not df.empty:
            df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"], utc=True)
            df["timestamp_local"] = pd.to_datetime(df["timestamp_local"], utc=True)
            df["value"] = pd.to_numeric(df["value"], errors="coerce")
        return df

    def fetch_cities(self, country: str = "IN", limit: int = 100) -> pd.DataFrame:
        """Fetch available cities for a country."""
        params = {"country": country, "limit": limit}
        data = self._make_request("/cities", params)
        results = data.get("results", [])
        return pd.DataFrame(results)

    def fetch_locations(self, city: Optional[str] = None, country: str = "IN", limit: int = 100) -> pd.DataFrame:
        """Fetch monitoring station locations."""
        params = {"country": country, "limit": limit}
        if city:
            params["city"] = city
        data = self._make_request("/locations", params)
        results = data.get("results", [])
        return pd.DataFrame(results)

    def fetch_latest(
        self,
        city: Optional[str] = None,
        country: str = "IN",
        parameter: Optional[str] = None,
        limit: int = DEFAULT_LIMIT,
    ) -> pd.DataFrame:
        """Fetch the latest measurements for locations."""
        params = {"country": country, "limit": limit}
        if city:
            params["city"] = city
        if parameter:
            params["parameter"] = parameter
        data = self._make_request("/latest", params)
        results = data.get("results", [])
        return pd.DataFrame(results)

    def fetch_recent_readings(
        self,
        cities: list[str],
        parameters: list[str] = None,
        hours_back: int = 24,
    ) -> pd.DataFrame:
        """
        Convenience method to fetch recent AQI readings for multiple cities.

        Args:
            cities: List of city names
            parameters: List of pollutant parameters (default: pm25, pm10)
            hours_back: How many hours back to fetch

        Returns:
            Combined DataFrame of all measurements
        """
        if parameters is None:
            parameters = ["pm25", "pm10"]

        date_from = datetime.utcnow() - timedelta(hours=hours_back)
        frames = []

        for city in cities:
            for param in parameters:
                try:
                    df = self.fetch_measurements(
                        city=city,
                        parameter=param,
                        date_from=date_from,
                    )
                    if not df.empty:
                        frames.append(df)
                except requests.RequestException as e:
                    logger.error(f"Failed to fetch {param} for {city}: {e}")
                    continue

        if frames:
            return pd.concat(frames, ignore_index=True)
        return pd.DataFrame()

    def save_to_postgres(self, df: pd.DataFrame, table: str = "aqi_readings_raw"):
        """Save fetched data to PostgreSQL via SQLAlchemy."""
        from sqlalchemy import create_engine

        db_url = os.getenv(
            "DATABASE_URL",
            "postgresql://vayuguard:vayuguard@localhost:5432/vayuguard",
        )
        engine = create_engine(db_url)
        df.to_sql(table, engine, if_exists="append", index=False)
        logger.info(f"Saved {len(df)} records to {table}")

    def save_to_mongo(self, df: pd.DataFrame, collection: str = "aqi_readings_raw"):
        """Save fetched data to MongoDB."""
        from pymongo import MongoClient

        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        client = MongoClient(mongo_uri)
        db = client["vayuguard"]
        records = df.to_dict("records")
        if records:
            # Convert datetime objects for MongoDB compatibility
            for rec in records:
                for key, val in rec.items():
                    if pd.isna(val):
                        rec[key] = None
                    elif isinstance(val, pd.Timestamp):
                        rec[key] = val.to_pydatetime()
            db[collection].insert_many(records)
            logger.info(f"Saved {len(records)} records to MongoDB {collection}")

    def save_to_csv(self, df: pd.DataFrame, filepath: str):
        """Save DataFrame to CSV file."""
        df.to_csv(filepath, index=False)
        logger.info(f"Saved {len(df)} records to {filepath}")


def main():
    """CLI entry point for standalone execution."""
    import argparse

    parser = argparse.ArgumentParser(description="Fetch AQI data from OpenAQ")
    parser.add_argument("--city", type=str, help="City name")
    parser.add_argument("--country", type=str, default="IN", help="Country code")
    parser.add_argument("--parameter", type=str, default="pm25", help="Pollutant parameter")
    parser.add_argument("--hours-back", type=int, default=24, help="Hours of history to fetch")
    parser.add_argument("--output", type=str, default="openaq_data.csv", help="Output CSV path")
    args = parser.parse_args()

    fetcher = OpenAQFetcher()
    cities = [args.city] if args.city else ["Delhi", "Mumbai", "Bangalore", "Chennai", "Kolkata"]
    df = fetcher.fetch_recent_readings(
        cities=cities,
        parameters=[args.parameter],
        hours_back=args.hours_back,
    )

    if not df.empty:
        fetcher.save_to_csv(df, args.output)
        print(f"Fetched {len(df)} records. Saved to {args.output}")
    else:
        print("No data fetched.")


if __name__ == "__main__":
    main()

"""
VayuGuard Data Pipeline - CPCB Fetcher
========================================
Fetches AQI data from the Indian Central Pollution Control Board (CPCB).
Supports both HTML parsing and JSON API endpoints from the CPCB portal.
"""

import os
import re
import time
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests
import pandas as pd

logger = logging.getLogger(__name__)

CPCB_BASE_URL = "https://app.cpcbccr.com/ccr"
CPCB_API_URL = "https://app.cpcbccr.com/ccr/api"
CPCB_AQI_URL = "https://cpcb.nic.in/AQI"

# Indian cities tracked by CPCB
CPCB_CITIES = [
    "Delhi", "Mumbai", "Kolkata", "Chennai", "Bangalore",
    "Hyderabad", "Pune", "Ahmedabad", "Lucknow", "Jaipur",
    "Varanasi", "Patna", "Gurgaon", "Noida", "Faridabad",
    "Chandigarh", "Bhopal", "Amritsar", "Agra", "Kanpur",
]

# AQI breakpoints as per CPCB standards
AQI_BREAKPOINTS = {
    "Good": (0, 50),
    "Satisfactory": (51, 100),
    "Moderately Polluted": (101, 200),
    "Poor": (201, 300),
    "Very Poor": (301, 400),
    "Severe": (401, 500),
}

# Pollutant parameter mapping
PARAMETER_MAP = {
    "PM2.5": "pm25",
    "PM10": "pm10",
    "SO2": "so2",
    "NO2": "no2",
    "O3": "o3",
    "CO": "co",
    "NH3": "nh3",
    "Pb": "pb",
}


class CPCBFetcher:
    """Fetches air quality data from the CPCB portal."""

    def __init__(
        self,
        base_url: str = CPCB_BASE_URL,
        timeout: int = 30,
        max_retries: int = 3,
    ):
        self.base_url = base_url
        self.timeout = timeout
        self.max_retries = max_retries
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json, text/html",
            "User-Agent": "VayuGuard-Pipeline/1.0",
            "Referer": self.base_url,
        })
        self._last_request_time = 0.0

    def _make_request(self, url: str, params: Optional[dict] = None) -> requests.Response:
        """
        Make an HTTP request with retry logic.

        Args:
            url: Full URL to request
            params: Query parameters

        Returns:
            Response object

        Raises:
            requests.RequestException: After all retries exhausted
        """
        last_exception = None
        for attempt in range(1, self.max_retries + 1):
            try:
                # Rate limiting
                elapsed = time.time() - self._last_request_time
                if elapsed < 1.0:
                    time.sleep(1.0 - elapsed)
                self._last_request_time = time.time()

                logger.debug(f"Request attempt {attempt}/{self.max_retries}: {url}")
                response = self.session.get(url, params=params, timeout=self.timeout)
                response.raise_for_status()
                return response

            except requests.exceptions.HTTPError as e:
                status = e.response.status_code if e.response else None
                if status == 429:
                    retry_after = int(e.response.headers.get("Retry-After", 30))
                    logger.warning(f"CPCB rate limited. Waiting {retry_after}s...")
                    time.sleep(retry_after)
                    continue
                elif status and 500 <= status < 600:
                    wait = 2 ** attempt
                    logger.warning(f"CPCB server error {status}. Retry in {wait}s...")
                    time.sleep(wait)
                    last_exception = e
                    continue
                else:
                    raise

            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                wait = 2 ** attempt
                logger.warning(f"CPCB connection/timeout error. Retry in {wait}s... {e}")
                time.sleep(wait)
                last_exception = e
                continue

        if last_exception:
            raise last_exception
        raise requests.RequestException(f"Failed to fetch from CPCB: {url}")

    def fetch_city_aqi_json(self, city: str) -> pd.DataFrame:
        """
        Fetch AQI data for a city from CPCB JSON API.

        Args:
            city: City name (e.g., 'Delhi')

        Returns:
            DataFrame with station-level AQI data
        """
        url = f"{CPCB_API_URL}/aqi"
        params = {
            "city": city,
            "format": "json",
        }

        try:
            response = self._make_request(url, params)
            data = response.json()
        except (requests.RequestException, ValueError) as e:
            logger.error(f"Failed to fetch JSON AQI for {city}: {e}")
            return pd.DataFrame()

        records = self._parse_json_response(data, city)
        if not records:
            logger.warning(f"No JSON data parsed for {city}, trying HTML fallback...")
            return self.fetch_city_aqi_html(city)

        df = pd.DataFrame(records)
        if not df.empty:
            df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"], utc=True, errors="coerce")
            df["value"] = pd.to_numeric(df["value"], errors="coerce")
        logger.info(f"Fetched {len(df)} records for {city} from JSON API")
        return df

    def _parse_json_response(self, data: dict, city: str) -> list[dict]:
        """Parse CPCB JSON API response into normalized records."""
        records = []
        timestamp = datetime.utcnow().isoformat()

        # Handle various CPCB JSON formats
        stations = data.get("stations", data.get("data", []))
        if isinstance(stations, dict):
            stations = [stations]

        for station in stations:
            station_name = station.get("stationName", station.get("station", ""))
            aqi_value = station.get("aqi", station.get("AQI", None))

            if aqi_value is not None:
                try:
                    aqi_val = float(aqi_value)
                except (ValueError, TypeError):
                    aqi_val = None

                records.append({
                    "location": station_name,
                    "city": city,
                    "country": "IN",
                    "parameter": "aqi",
                    "value": aqi_val,
                    "unit": "NAQI",
                    "timestamp_utc": timestamp,
                    "latitude": station.get("latitude"),
                    "longitude": station.get("longitude"),
                })

            # Parse individual pollutant values
            pollutants = station.get("pollutants", station.get("parameters", {}))
            if isinstance(pollutants, dict):
                for param_name, param_data in pollutants.items():
                    mapped = PARAMETER_MAP.get(param_name, param_name.lower())
                    val = None
                    if isinstance(param_data, dict):
                        val = param_data.get("avg", param_data.get("value"))
                    elif isinstance(param_data, (int, float)):
                        val = param_data
                    if val is not None:
                        try:
                            val = float(val)
                        except (ValueError, TypeError):
                            val = None
                        records.append({
                            "location": station_name,
                            "city": city,
                            "country": "IN",
                            "parameter": mapped,
                            "value": val,
                            "unit": "µg/m³" if mapped not in ("co",) else "mg/m³",
                            "timestamp_utc": timestamp,
                            "latitude": station.get("latitude"),
                            "longitude": station.get("longitude"),
                        })

        return records

    def fetch_city_aqi_html(self, city: str) -> pd.DataFrame:
        """
        Fallback: Fetch AQI data by parsing CPCB HTML page.

        Args:
            city: City name

        Returns:
            DataFrame with parsed AQI data
        """
        url = f"{self.base_url}/#/aqi-dashboard/all"
        try:
            response = self._make_request(url)
        except requests.RequestException as e:
            logger.error(f"Failed to fetch HTML for {city}: {e}")
            return pd.DataFrame()

        return self._parse_html_response(response.text, city)

    def _parse_html_response(self, html: str, city: str) -> pd.DataFrame:
        """Parse CPCB HTML page to extract AQI table data."""
        records = []
        timestamp = datetime.utcnow().isoformat()

        # Try to extract table rows with regex (CPCB HTML structure)
        # Pattern matches station rows with AQI values
        row_pattern = re.compile(
            r'<tr[^>]*>.*?'
            r'(?P<station>[A-Za-z\s,]+).*?'
            r'(?P<aqi>\d+).*?'
            r'</tr>',
            re.DOTALL,
        )

        # Alternative: extract from embedded JSON in script tags
        json_pattern = re.compile(r'var\s+aqiData\s*=\s*(\[.*?\]);', re.DOTALL)

        json_match = json_pattern.search(html)
        if json_match:
            import json
            try:
                stations = json.loads(json_match.group(1))
                for st in stations:
                    records.append({
                        "location": st.get("stationName", ""),
                        "city": city,
                        "country": "IN",
                        "parameter": "aqi",
                        "value": self._safe_float(st.get("aqi")),
                        "unit": "NAQI",
                        "timestamp_utc": timestamp,
                        "latitude": st.get("latitude"),
                        "longitude": st.get("longitude"),
                    })
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f"Failed to parse embedded JSON: {e}")

        # Fallback regex parsing
        if not records:
            for match in row_pattern.finditer(html):
                station = match.group("station").strip()
                aqi = match.group("aqi").strip()
                records.append({
                    "location": station,
                    "city": city,
                    "country": "IN",
                    "parameter": "aqi",
                    "value": self._safe_float(aqi),
                    "unit": "NAQI",
                    "timestamp_utc": timestamp,
                    "latitude": None,
                    "longitude": None,
                })

        df = pd.DataFrame(records)
        if not df.empty:
            df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"], utc=True, errors="coerce")
            df["value"] = pd.to_numeric(df["value"], errors="coerce")
        logger.info(f"Parsed {len(df)} records for {city} from HTML")
        return df

    @staticmethod
    def _safe_float(val) -> Optional[float]:
        """Safely convert a value to float."""
        if val is None:
            return None
        try:
            return float(val)
        except (ValueError, TypeError):
            return None

    def fetch_all_cities(self, cities: Optional[list[str]] = None) -> pd.DataFrame:
        """
        Fetch AQI data for all tracked CPCB cities.

        Args:
            cities: List of city names (defaults to CPCB_CITIES)

        Returns:
            Combined DataFrame for all cities
        """
        if cities is None:
            cities = CPCB_CITIES

        frames = []
        for city in cities:
            try:
                df = self.fetch_city_aqi_json(city)
                if not df.empty:
                    frames.append(df)
            except Exception as e:
                logger.error(f"Error fetching {city}: {e}")
                continue

        if frames:
            return pd.concat(frames, ignore_index=True)
        return pd.DataFrame()

    def fetch_historical(
        self,
        city: str,
        station: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        parameter: str = "pm25",
    ) -> pd.DataFrame:
        """
        Fetch historical data from CPCB for a city/station.

        Args:
            city: City name
            station: Station name (optional)
            date_from: Start date
            date_to: End date
            parameter: Pollutant parameter

        Returns:
            DataFrame of historical readings
        """
        if date_from is None:
            date_from = datetime.utcnow() - timedelta(days=7)
        if date_to is None:
            date_to = datetime.utcnow()

        url = f"{CPCB_API_URL}/historical"
        params = {
            "city": city,
            "parameter": parameter,
            "date_from": date_from.strftime("%Y-%m-%d"),
            "date_to": date_to.strftime("%Y-%m-%d"),
        }
        if station:
            params["station"] = station

        try:
            response = self._make_request(url, params)
            data = response.json()
        except (requests.RequestException, ValueError) as e:
            logger.error(f"Failed to fetch historical data for {city}: {e}")
            return pd.DataFrame()

        records = []
        readings = data.get("readings", data.get("data", []))
        if isinstance(readings, list):
            for r in readings:
                records.append({
                    "city": city,
                    "location": r.get("station", station),
                    "parameter": parameter,
                    "value": self._safe_float(r.get("value", r.get("avg"))),
                    "timestamp_utc": r.get("date", r.get("timestamp")),
                })

        df = pd.DataFrame(records)
        if not df.empty:
            df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"], utc=True, errors="coerce")
            df["value"] = pd.to_numeric(df["value"], errors="coerce")
            df["country"] = "IN"
            df["unit"] = "µg/m³"
        return df

    @staticmethod
    def get_aqi_category(aqi_value: float) -> str:
        """Convert AQI value to CPCB category string."""
        for category, (low, high) in AQI_BREAKPOINTS.items():
            if low <= aqi_value <= high:
                return category
        return "Severe" if aqi_value > 500 else "Unknown"

    def save_to_postgres(self, df: pd.DataFrame, table: str = "cpcb_readings_raw"):
        """Save fetched data to PostgreSQL."""
        from sqlalchemy import create_engine

        db_url = os.getenv(
            "DATABASE_URL",
            "postgresql://vayuguard:vayuguard@localhost:5432/vayuguard",
        )
        engine = create_engine(db_url)
        df.to_sql(table, engine, if_exists="append", index=False)
        logger.info(f"Saved {len(df)} CPCB records to {table}")

    def save_to_csv(self, df: pd.DataFrame, filepath: str):
        """Save DataFrame to CSV."""
        df.to_csv(filepath, index=False)
        logger.info(f"Saved {len(df)} records to {filepath}")


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Fetch AQI data from CPCB")
    parser.add_argument("--city", type=str, help="City name")
    parser.add_argument("--all-cities", action="store_true", help="Fetch all tracked cities")
    parser.add_argument("--output", type=str, default="cpcb_data.csv", help="Output CSV path")
    args = parser.parse_args()

    fetcher = CPCBFetcher()

    if args.all_cities:
        df = fetcher.fetch_all_cities()
    elif args.city:
        df = fetcher.fetch_city_aqi_json(args.city)
    else:
        df = fetcher.fetch_all_cities(["Delhi"])

    if not df.empty:
        fetcher.save_to_csv(df, args.output)
        print(f"Fetched {len(df)} records. Saved to {args.output}")
    else:
        print("No data fetched.")


if __name__ == "__main__":
    main()

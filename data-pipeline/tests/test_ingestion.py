"""
VayuGuard Data Pipeline - Ingestion Tests
============================================
Tests for API fetchers using mocked HTTP responses.
"""

import json
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime

import pandas as pd
import numpy as np

# ====================================================================
# OpenAQ Fetcher Tests
# ====================================================================

class TestOpenAQFetcher:
    """Tests for the OpenAQ API fetcher."""

    def _make_mock_response(self, status_code=200, json_data=None):
        """Create a mock response object."""
        mock_resp = MagicMock()
        mock_resp.status_code = status_code
        mock_resp.json.return_value = json_data or {}
        mock_resp.raise_for_status = MagicMock()
        if status_code >= 400:
            from requests.exceptions import HTTPError
            mock_resp.raise_for_status.side_effect = HTTPError(
                response=mock_resp,
            )
        mock_resp.headers = {}
        return mock_resp

    @patch("ingestion.openaq_fetcher.requests.Session.get")
    def test_fetch_measurements_single_page(self, mock_get):
        """Test fetching measurements from a single page of results."""
        from ingestion.openaq_fetcher import OpenAQFetcher

        mock_data = {
            "results": [
                {
                    "location": "Anand Vihar",
                    "city": "Delhi",
                    "country": "IN",
                    "parameter": "pm25",
                    "value": 156.5,
                    "unit": "µg/m³",
                    "date": {"utc": "2024-01-15T10:00:00Z", "local": "2024-01-15T15:30:00+05:30"},
                    "coordinates": {"latitude": 28.6508, "longitude": 77.3152},
                },
                {
                    "location": "RK Puram",
                    "city": "Delhi",
                    "country": "IN",
                    "parameter": "pm25",
                    "value": 89.3,
                    "unit": "µg/m³",
                    "date": {"utc": "2024-01-15T10:00:00Z", "local": "2024-01-15T15:30:00+05:30"},
                    "coordinates": {"latitude": 28.5633, "longitude": 77.1864},
                },
            ],
            "meta": {"found": 2},
        }
        mock_get.return_value = self._make_mock_response(json_data=mock_data)

        fetcher = OpenAQFetcher()
        df = fetcher.fetch_measurements(city="Delhi", parameter="pm25")

        assert not df.empty
        assert len(df) == 2
        assert "city" in df.columns
        assert "parameter" in df.columns
        assert "value" in df.columns
        assert df["city"].iloc[0] == "Delhi"
        assert df["parameter"].iloc[0] == "pm25"

    @patch("ingestion.openaq_fetcher.requests.Session.get")
    def test_fetch_measurements_pagination(self, mock_get):
        """Test that pagination works correctly across multiple pages."""
        from ingestion.openaq_fetcher import OpenAQFetcher

        page1 = {
            "results": [
                {
                    "location": f"Station_{i}",
                    "city": "Delhi",
                    "country": "IN",
                    "parameter": "pm25",
                    "value": float(i * 10),
                    "unit": "µg/m³",
                    "date": {"utc": "2024-01-15T10:00:00Z", "local": "2024-01-15T15:30:00+05:30"},
                    "coordinates": {"latitude": 28.65, "longitude": 77.31},
                }
                for i in range(100)
            ],
            "meta": {"found": 150},
        }
        page2 = {
            "results": [
                {
                    "location": f"Station_{i}",
                    "city": "Delhi",
                    "country": "IN",
                    "parameter": "pm25",
                    "value": float(i * 10),
                    "unit": "µg/m³",
                    "date": {"utc": "2024-01-15T11:00:00Z", "local": "2024-01-15T16:30:00+05:30"},
                    "coordinates": {"latitude": 28.65, "longitude": 77.31},
                }
                for i in range(50)
            ],
            "meta": {"found": 150},
        }

        mock_get.side_effect = [
            self._make_mock_response(json_data=page1),
            self._make_mock_response(json_data=page2),
        ]

        fetcher = OpenAQFetcher()
        df = fetcher.fetch_measurements(city="Delhi", parameter="pm25", limit=100)

        assert len(df) == 150
        assert mock_get.call_count == 2

    @patch("ingestion.openaq_fetcher.requests.Session.get")
    def test_fetch_empty_results(self, mock_get):
        """Test handling of empty API responses."""
        from ingestion.openaq_fetcher import OpenAQFetcher

        mock_data = {"results": [], "meta": {"found": 0}}
        mock_get.return_value = self._make_mock_response(json_data=mock_data)

        fetcher = OpenAQFetcher()
        df = fetcher.fetch_measurements(city="NonExistentCity")

        assert df.empty

    @patch("ingestion.openaq_fetcher.requests.Session.get")
    def test_retry_on_server_error(self, mock_get):
        """Test that server errors trigger retries."""
        from ingestion.openaq_fetcher import OpenAQFetcher
        from requests.exceptions import HTTPError

        # First two calls fail, third succeeds
        mock_get.side_effect = [
            self._make_mock_response(status_code=500),
            self._make_mock_response(status_code=503),
            self._make_mock_response(json_data={"results": [{"location": "Test", "city": "Delhi", "country": "IN", "parameter": "pm25", "value": 50, "unit": "µg/m³", "date": {"utc": "2024-01-15T10:00:00Z"}, "coordinates": {"latitude": 28.65, "longitude": 77.31}}], "meta": {"found": 1}}),
        ]

        fetcher = OpenAQFetcher(max_retries=3)
        df = fetcher.fetch_measurements(city="Delhi")

        assert not df.empty
        assert mock_get.call_count == 3

    @patch("ingestion.openaq_fetcher.requests.Session.get")
    def test_rate_limit_handling(self, mock_get):
        """Test handling of 429 rate limit responses."""
        from ingestion.openaq_fetcher import OpenAQFetcher

        rate_limited = self._make_mock_response(status_code=429)
        rate_limited.headers = {"Retry-After": "1"}

        success = self._make_mock_response(json_data={
            "results": [{"location": "Test", "city": "Delhi", "country": "IN", "parameter": "pm25", "value": 50, "unit": "µg/m³", "date": {"utc": "2024-01-15T10:00:00Z"}, "coordinates": {"latitude": 28.65, "longitude": 77.31}}],
            "meta": {"found": 1},
        })

        mock_get.side_effect = [rate_limited, success]

        fetcher = OpenAQFetcher(max_retries=3)
        df = fetcher.fetch_measurements(city="Delhi")

        assert not df.empty

    @patch("ingestion.openaq_fetcher.requests.Session.get")
    def test_fetch_cities(self, mock_get):
        """Test fetching available cities."""
        from ingestion.openaq_fetcher import OpenAQFetcher

        mock_data = {
            "results": [
                {"city": "Delhi", "country": "IN", "count": 5000},
                {"city": "Mumbai", "country": "IN", "count": 3000},
            ]
        }
        mock_get.return_value = self._make_mock_response(json_data=mock_data)

        fetcher = OpenAQFetcher()
        df = fetcher.fetch_cities(country="IN")

        assert len(df) == 2


# ====================================================================
# CPCB Fetcher Tests
# ====================================================================

class TestCPCBFetcher:
    """Tests for the CPCB data fetcher."""

    def test_get_aqi_category(self):
        """Test AQI value to category mapping."""
        from ingestion.cpcb_fetcher import CPCBFetcher

        assert CPCBFetcher.get_aqi_category(25) == "Good"
        assert CPCBFetcher.get_aqi_category(75) == "Satisfactory"
        assert CPCBFetcher.get_aqi_category(150) == "Moderately Polluted"
        assert CPCBFetcher.get_aqi_category(250) == "Poor"
        assert CPCBFetcher.get_aqi_category(350) == "Very Poor"
        assert CPCBFetcher.get_aqi_category(450) == "Severe"
        assert CPCBFetcher.get_aqi_category(600) == "Severe"

    @patch("ingestion.cpcb_fetcher.requests.Session.get")
    def test_fetch_city_aqi_json(self, mock_get):
        """Test fetching AQI data from CPCB JSON API."""
        from ingestion.cpcb_fetcher import CPCBFetcher

        mock_data = {
            "stations": [
                {
                    "stationName": "Anand Vihar, Delhi",
                    "aqi": 312,
                    "latitude": 28.6508,
                    "longitude": 77.3152,
                    "pollutants": {
                        "PM2.5": {"avg": 245.6},
                        "PM10": {"avg": 356.2},
                    },
                }
            ]
        }
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_data
        mock_resp.raise_for_status = MagicMock()
        mock_resp.headers = {}
        mock_get.return_value = mock_resp

        fetcher = CPCBFetcher()
        df = fetcher.fetch_city_aqi_json("Delhi")

        assert not df.empty
        assert "city" in df.columns
        assert "value" in df.columns

    def test_parse_json_response(self):
        """Test CPCB JSON response parsing."""
        from ingestion.cpcb_fetcher import CPCBFetcher

        fetcher = CPCBFetcher()
        data = {
            "stations": [
                {
                    "stationName": "Test Station",
                    "aqi": 150,
                    "latitude": 28.65,
                    "longitude": 77.31,
                    "pollutants": {
                        "PM2.5": {"avg": 80.5},
                    },
                }
            ]
        }

        records = fetcher._parse_json_response(data, "Delhi")
        assert len(records) >= 2  # AQI record + PM2.5 record
        aqi_record = next(r for r in records if r["parameter"] == "aqi")
        assert aqi_record["value"] == 150
        pm25_record = next(r for r in records if r["parameter"] == "pm25")
        assert pm25_record["value"] == 80.5

    @patch("ingestion.cpcb_fetcher.requests.Session.get")
    def test_fetch_all_cities(self, mock_get):
        """Test fetching data for multiple cities."""
        from ingestion.cpcb_fetcher import CPCBFetcher

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "stations": [
                {"stationName": "Station 1", "aqi": 100},
            ]
        }
        mock_resp.raise_for_status = MagicMock()
        mock_resp.headers = {}
        mock_get.return_value = mock_resp

        fetcher = CPCBFetcher()
        df = fetcher.fetch_all_cities(["Delhi", "Mumbai"])

        assert not df.empty


# ====================================================================
# Open-Meteo Fetcher Tests
# ====================================================================

class TestOpenMeteoFetcher:
    """Tests for the Open-Meteo weather fetcher."""

    @patch("ingestion.openmeteo_fetcher.requests.Session.get")
    def test_fetch_hourly_weather(self, mock_get):
        """Test fetching hourly weather data."""
        from ingestion.openmeteo_fetcher import OpenMeteoFetcher

        mock_data = {
            "hourly": {
                "time": ["2024-01-15T00:00", "2024-01-15T01:00", "2024-01-15T02:00"],
                "temperature_2m": [15.5, 14.2, 13.8],
                "relative_humidity_2m": [65.0, 68.0, 70.0],
                "wind_speed_10m": [5.2, 4.8, 3.9],
                "precipitation": [0.0, 0.1, 0.0],
            }
        }
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_data
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        fetcher = OpenMeteoFetcher()
        df = fetcher.fetch_hourly_weather(28.6139, 77.2090)

        assert not df.empty
        assert len(df) == 3
        assert "temperature_2m" in df.columns
        assert "relative_humidity_2m" in df.columns
        assert "wind_speed_10m" in df.columns
        assert "precipitation" in df.columns
        assert "latitude" in df.columns
        assert "longitude" in df.columns

    @patch("ingestion.openmeteo_fetcher.requests.Session.get")
    def test_fetch_weather_for_city(self, mock_get):
        """Test weather fetch by city name."""
        from ingestion.openmeteo_fetcher import OpenMeteoFetcher

        mock_data = {
            "hourly": {
                "time": ["2024-01-15T00:00"],
                "temperature_2m": [15.5],
                "relative_humidity_2m": [65.0],
                "wind_speed_10m": [5.2],
            }
        }
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_data
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        fetcher = OpenMeteoFetcher()
        df = fetcher.fetch_weather_for_city("Delhi", frequency="hourly")

        assert not df.empty
        assert "city" in df.columns
        assert df["city"].iloc[0] == "Delhi"

    def test_unknown_city_returns_empty(self):
        """Test that unknown city name returns empty DataFrame."""
        from ingestion.openmeteo_fetcher import OpenMeteoFetcher

        fetcher = OpenMeteoFetcher()
        df = fetcher.fetch_weather_for_city("UnknownCity123")

        assert df.empty

    @patch("ingestion.openmeteo_fetcher.requests.Session.get")
    def test_fetch_daily_weather(self, mock_get):
        """Test fetching daily weather summaries."""
        from ingestion.openmeteo_fetcher import OpenMeteoFetcher

        mock_data = {
            "daily": {
                "time": ["2024-01-15", "2024-01-16"],
                "temperature_2m_max": [25.0, 26.0],
                "temperature_2m_min": [10.0, 11.0],
                "temperature_2m_mean": [17.5, 18.5],
                "precipitation_sum": [0.0, 2.5],
                "wind_speed_10m_max": [15.0, 20.0],
            }
        }
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_data
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        fetcher = OpenMeteoFetcher()
        df = fetcher.fetch_daily_weather(28.6139, 77.2090)

        assert not df.empty
        assert len(df) == 2
        assert "temperature_2m_max" in df.columns
        assert "precipitation_sum" in df.columns

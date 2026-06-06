"""
VayuGuard Data Pipeline - Quality Checks Tests
=================================================
Tests for data quality gate functions.
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta


# ====================================================================
# Fixtures
# ====================================================================

@pytest.fixture
def sample_aqi_df():
    """Create a sample AQI DataFrame for testing."""
    np.random.seed(42)
    n = 500
    cities = ["Delhi", "Mumbai", "Bangalore", "Chennai", "Kolkata"]
    parameters = ["pm25", "pm10", "no2", "so2"]
    
    records = []
    for i in range(n):
        city = cities[i % len(cities)]
        param = parameters[i % len(parameters)]
        value = np.random.lognormal(mean=3.5, sigma=0.8)
        
        # Add some nulls
        if i % 50 == 0:
            value = np.nan
        
        records.append({
            "city": city,
            "location": f"Station_{i % 10}",
            "country": "IN",
            "parameter": param,
            "value": value,
            "unit": "µg/m³",
            "timestamp_utc": datetime.utcnow() - timedelta(hours=i),
            "latitude": np.random.uniform(10, 35),
            "longitude": np.random.uniform(68, 96),
            "source": "openaq",
        })
    
    return pd.DataFrame(records)


@pytest.fixture
def fresh_aqi_df():
    """Create a DataFrame with very recent timestamps."""
    records = []
    for i in range(100):
        records.append({
            "city": "Delhi",
            "parameter": "pm25",
            "value": float(50 + i),
            "timestamp_utc": datetime.utcnow() - timedelta(minutes=i * 30),
            "latitude": 28.65,
            "longitude": 77.31,
        })
    return pd.DataFrame(records)


@pytest.fixture
def stale_aqi_df():
    """Create a DataFrame with old timestamps."""
    records = []
    for i in range(100):
        records.append({
            "city": "Delhi",
            "parameter": "pm25",
            "value": float(50 + i),
            "timestamp_utc": datetime.utcnow() - timedelta(days=7 + i / 24),
        })
    return pd.DataFrame(records)


# ====================================================================
# AQI Cleaner Tests
# ====================================================================

class TestAQICleaner:
    """Tests for the AQI data cleaner."""

    def test_clean_basic(self, sample_aqi_df):
        """Test basic cleaning pipeline."""
        from cleaning.clean_aqi import AQICleaner

        cleaner = AQICleaner()
        cleaned = cleaner.clean(sample_aqi_df)

        assert not cleaned.empty
        assert cleaner.stats["input_records"] == len(sample_aqi_df)
        assert cleaner.stats["output_records"] <= len(sample_aqi_df)
        # Null values should be removed from critical columns
        assert cleaned["value"].notna().all()
        assert cleaned["city"].notna().all()

    def test_null_handling(self):
        """Test that null values in critical columns are removed."""
        from cleaning.clean_aqi import AQICleaner

        df = pd.DataFrame({
            "city": ["Delhi", None, "Mumbai"],
            "parameter": ["pm25", "pm25", None],
            "value": [50.0, np.nan, 80.0],
            "timestamp_utc": [
                datetime.utcnow(),
                datetime.utcnow(),
                datetime.utcnow(),
            ],
        })

        cleaner = AQICleaner()
        cleaned = cleaner.clean(df)

        assert cleaned["value"].notna().all()
        assert cleaned["city"].notna().all()

    def test_outlier_detection_iqr(self):
        """Test IQR outlier detection."""
        from cleaning.clean_aqi import AQICleaner

        # Create data with obvious outliers
        values = [50.0] * 20 + [5000.0]  # 5000 is clearly an outlier
        df = pd.DataFrame({
            "city": ["Delhi"] * 21,
            "parameter": ["pm25"] * 21,
            "value": values,
            "timestamp_utc": [datetime.utcnow() - timedelta(hours=i) for i in range(21)],
        })

        cleaner = AQICleaner(outlier_method="iqr", iqr_multiplier=1.5)
        cleaned = cleaner.clean(df)

        # The outlier should be removed
        assert cleaned["value"].max() < 5000

    def test_outlier_detection_zscore(self):
        """Test z-score outlier detection."""
        from cleaning.clean_aqi import AQICleaner

        values = [50.0] * 20 + [999.0]  # 999 is far from mean
        df = pd.DataFrame({
            "city": ["Delhi"] * 21,
            "parameter": ["pm25"] * 21,
            "value": values,
            "timestamp_utc": [datetime.utcnow() - timedelta(hours=i) for i in range(21)],
        })

        cleaner = AQICleaner(outlier_method="zscore", z_score_threshold=2.0)
        cleaned = cleaner.clean(df)

        assert cleaned["value"].max() < 999

    def test_range_validation(self):
        """Test range validation removes out-of-range values."""
        from cleaning.clean_aqi import AQICleaner

        df = pd.DataFrame({
            "city": ["Delhi"] * 4,
            "parameter": ["pm25", "pm25", "aqi", "aqi"],
            "value": [50.0, -10.0, 300.0, 999.0],  # -10 and 999 are out of range
            "timestamp_utc": [datetime.utcnow()] * 4,
        })

        cleaner = AQICleaner()
        cleaned = cleaner.clean(df)

        assert all(cleaned["value"] >= 0)
        if "aqi" in cleaned["parameter"].values:
            assert cleaned[cleaned["parameter"] == "aqi"]["value"].max() <= 500

    def test_deduplication(self):
        """Test that duplicate records are removed."""
        from cleaning.clean_aqi import AQICleaner

        ts = datetime.utcnow()
        df = pd.DataFrame({
            "city": ["Delhi", "Delhi", "Mumbai"],
            "location": ["Station1", "Station1", "Station2"],
            "parameter": ["pm25", "pm25", "pm25"],
            "value": [50.0, 50.0, 80.0],
            "timestamp_utc": [ts, ts, ts],
            "source": ["openaq", "cpcb", "openaq"],
        })

        cleaner = AQICleaner()
        cleaned = cleaner.clean(df)

        # Should remove one of the Delhi duplicates
        delhi_count = len(cleaned[cleaned["city"] == "Delhi"])
        assert delhi_count == 1

    def test_timezone_normalization(self, sample_aqi_df):
        """Test timezone normalization creates required columns."""
        from cleaning.clean_aqi import AQICleaner

        cleaner = AQICleaner()
        cleaned = cleaner.clean(sample_aqi_df)

        assert "timestamp_local" in cleaned.columns
        assert "date" in cleaned.columns
        assert "hour" in cleaned.columns

    def test_aqi_category_assignment(self):
        """Test AQI category is correctly assigned."""
        from cleaning.clean_aqi import AQICleaner, get_aqi_category

        assert get_aqi_category(25) == "Good"
        assert get_aqi_category(75) == "Satisfactory"
        assert get_aqi_category(150) == "Moderate"
        assert get_aqi_category(250) == "Poor"
        assert get_aqi_category(350) == "Very Poor"
        assert get_aqi_category(450) == "Severe"

    def test_empty_dataframe(self):
        """Test handling of empty DataFrame."""
        from cleaning.clean_aqi import AQICleaner

        cleaner = AQICleaner()
        cleaned = cleaner.clean(pd.DataFrame())

        assert cleaned.empty

    def test_generate_report(self, sample_aqi_df):
        """Test report generation."""
        from cleaning.clean_aqi import AQICleaner

        cleaner = AQICleaner()
        cleaner.clean(sample_aqi_df)
        report = cleaner.generate_report()

        assert "Input records" in report
        assert "Output records" in report
        assert "Retention rate" in report


# ====================================================================
# Quality Checker Tests
# ====================================================================

class TestQualityChecker:
    """Tests for data quality checks."""

    def test_completeness_check_pass(self):
        """Test completeness check passes with complete data."""
        from cleaning.quality_checks import QualityChecker

        df = pd.DataFrame({
            "city": ["Delhi"] * 100,
            "parameter": ["pm25"] * 100,
            "value": np.random.uniform(20, 150, 100),
            "timestamp_utc": [datetime.utcnow() - timedelta(hours=i) for i in range(100)],
        })

        checker = QualityChecker()
        result = checker.check_completeness(df)

        assert result.name == "completeness"
        assert result.passed is True

    def test_completeness_check_fail(self):
        """Test completeness check fails with many nulls."""
        from cleaning.quality_checks import QualityChecker

        df = pd.DataFrame({
            "city": ["Delhi"] * 50 + [None] * 50,
            "parameter": ["pm25"] * 100,
            "value": [None] * 60 + list(np.random.uniform(20, 150, 40)),
            "timestamp_utc": [datetime.utcnow() - timedelta(hours=i) for i in range(100)],
        })

        checker = QualityChecker(completeness_threshold=0.95)
        result = checker.check_completeness(df)

        assert result.passed is False

    def test_freshness_check_pass(self, fresh_aqi_df):
        """Test freshness check passes with recent data."""
        from cleaning.quality_checks import QualityChecker

        checker = QualityChecker(freshness_threshold_hours=2)
        result = checker.check_freshness(fresh_aqi_df)

        assert result.passed is True

    def test_freshness_check_fail(self, stale_aqi_df):
        """Test freshness check fails with stale data."""
        from cleaning.quality_checks import QualityChecker

        checker = QualityChecker(freshness_threshold_hours=2)
        result = checker.check_freshness(stale_aqi_df)

        assert result.passed is False

    def test_value_range_check(self):
        """Test value range validation."""
        from cleaning.quality_checks import QualityChecker

        df = pd.DataFrame({
            "city": ["Delhi"] * 10,
            "parameter": ["pm25"] * 10,
            "value": [25.0, 50.0, 75.0, 100.0, -5.0, 2000.0, 60.0, 80.0, 90.0, 110.0],
            "timestamp_utc": [datetime.utcnow()] * 10,
        })

        checker = QualityChecker()
        result = checker.check_value_ranges(df)

        # -5 and 2000 are out of range for pm25
        assert "violations_by_parameter" in result.details

    def test_uniqueness_check(self):
        """Test duplicate detection."""
        from cleaning.quality_checks import QualityChecker

        ts = datetime.utcnow()
        df = pd.DataFrame({
            "city": ["Delhi", "Delhi", "Mumbai"],
            "location": ["St1", "St1", "St2"],
            "parameter": ["pm25", "pm25", "pm25"],
            "value": [50.0, 50.0, 80.0],
            "timestamp_utc": [ts, ts, ts],
        })

        checker = QualityChecker(duplicate_threshold=0.01)
        result = checker.check_uniqueness(df)

        # Has 1 duplicate out of 3 = 33%
        assert result.details["duplicate_pct"] > 0

    def test_run_all_checks(self, sample_aqi_df):
        """Test running all quality checks."""
        from cleaning.quality_checks import QualityChecker

        checker = QualityChecker()
        report = checker.run_all_checks(sample_aqi_df, dataset_name="test_aqi")

        assert report.dataset_name == "test_aqi"
        assert len(report.results) > 0

    def test_empty_dataframe(self):
        """Test quality checks on empty DataFrame."""
        from cleaning.quality_checks import QualityChecker

        checker = QualityChecker()
        report = checker.run_all_checks(pd.DataFrame(), dataset_name="empty")

        assert not report.passed  # Empty data should fail

    def test_quality_report_summary(self, sample_aqi_df):
        """Test quality report summary generation."""
        from cleaning.quality_checks import QualityChecker

        checker = QualityChecker()
        report = checker.run_all_checks(sample_aqi_df, dataset_name="test")
        summary = report.summary()

        assert "Quality Report" in summary
        assert "test" in summary


# ====================================================================
# Weather Joiner Tests
# ====================================================================

class TestWeatherJoiner:
    """Tests for AQI-weather data joining."""

    def test_basic_join(self):
        """Test basic AQI-weather join on city and timestamp."""
        from cleaning.join_weather import WeatherJoiner

        aqi_df = pd.DataFrame({
            "city": ["Delhi", "Delhi", "Mumbai"],
            "parameter": ["pm25", "pm25", "pm25"],
            "value": [150.0, 160.0, 80.0],
            "timestamp_utc": pd.to_datetime([
                "2024-01-15 10:00:00",
                "2024-01-15 11:00:00",
                "2024-01-15 10:00:00",
            ], utc=True),
        })

        weather_df = pd.DataFrame({
            "city": ["Delhi", "Delhi", "Mumbai"],
            "temperature_2m": [15.5, 16.0, 28.0],
            "wind_speed_10m": [5.2, 4.8, 12.0],
            "timestamp_utc": pd.to_datetime([
                "2024-01-15 10:00:00",
                "2024-01-15 11:00:00",
                "2024-01-15 10:00:00",
            ], utc=True),
        })

        joiner = WeatherJoiner()
        merged = joiner.join(aqi_df, weather_df)

        assert not merged.empty
        assert "temperature_2m" in merged.columns
        assert "wind_speed_10m" in merged.columns

    def test_join_with_missing_weather(self):
        """Test join when some AQI records have no weather match."""
        from cleaning.join_weather import WeatherJoiner

        aqi_df = pd.DataFrame({
            "city": ["Delhi", "Mumbai", "Chennai"],
            "parameter": ["pm25", "pm25", "pm25"],
            "value": [150.0, 80.0, 60.0],
            "timestamp_utc": pd.to_datetime([
                "2024-01-15 10:00:00",
                "2024-01-15 10:00:00",
                "2024-01-15 10:00:00",
            ], utc=True),
        })

        weather_df = pd.DataFrame({
            "city": ["Delhi"],
            "temperature_2m": [15.5],
            "timestamp_utc": pd.to_datetime(["2024-01-15 10:00:00"], utc=True),
        })

        joiner = WeatherJoiner(fill_method="ffill")
        merged = joiner.join(aqi_df, weather_df)

        assert len(merged) == 3  # Left join keeps all AQI records

    def test_derived_features_created(self):
        """Test that derived features are created during join."""
        from cleaning.join_weather import WeatherJoiner

        aqi_df = pd.DataFrame({
            "city": ["Delhi"],
            "parameter": ["pm25"],
            "value": [150.0],
            "timestamp_utc": pd.to_datetime(["2024-01-15 10:00:00"], utc=True),
        })

        weather_df = pd.DataFrame({
            "city": ["Delhi"],
            "temperature_2m": [15.5],
            "relative_humidity_2m": [65.0],
            "wind_speed_10m": [5.2],
            "precipitation": [0.0],
            "timestamp_utc": pd.to_datetime(["2024-01-15 10:00:00"], utc=True),
        })

        joiner = WeatherJoiner()
        merged = joiner.join(aqi_df, weather_df)

        # Check for derived features
        assert "temp_humidity_index" in merged.columns
        assert "is_raining" in merged.columns
        assert "season" in merged.columns

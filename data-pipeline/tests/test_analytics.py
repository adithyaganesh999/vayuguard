"""
VayuGuard Data Pipeline - Analytics Tests
============================================
Tests for analytics functions: hotspots, health impact, cohort, forecast accuracy.
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta


# ====================================================================
# Fixtures
# ====================================================================

@pytest.fixture
def sample_merged_df():
    """Create a sample merged AQI+weather DataFrame for analytics testing."""
    np.random.seed(42)
    n = 500
    cities = ["Delhi", "Mumbai", "Bangalore", "Chennai", "Kolkata"]

    records = []
    for i in range(n):
        city = cities[i % len(cities)]
        # Delhi has higher pollution
        base_aqi = 180 if city == "Delhi" else 80
        value = base_aqi + np.random.normal(0, 40)
        value = max(0, value)

        records.append({
            "city": city,
            "location": f"Station_{i % 5}",
            "parameter": "pm25" if i % 3 != 0 else "pm10",
            "value": value,
            "timestamp_utc": datetime.utcnow() - timedelta(hours=i),
            "latitude": [28.65, 19.08, 12.97, 13.08, 22.57][i % 5] + np.random.uniform(-0.1, 0.1),
            "longitude": [77.31, 72.88, 77.59, 80.27, 88.36][i % 5] + np.random.uniform(-0.1, 0.1),
            "temperature_2m": 20 + np.random.normal(0, 5),
            "relative_humidity_2m": 60 + np.random.normal(0, 10),
            "wind_speed_10m": 5 + np.random.exponential(3),
            "precipitation": max(0, np.random.normal(0, 2)),
            "source": "openaq",
        })

    return pd.DataFrame(records)


@pytest.fixture
def forecast_df():
    """Create a sample forecast vs actual DataFrame."""
    np.random.seed(42)
    n = 200
    cities = ["Delhi", "Mumbai", "Bangalore"]

    records = []
    for i in range(n):
        city = cities[i % len(cities)]
        actual = 100 + np.random.normal(0, 30)
        # Predictions with some error
        predicted = actual + np.random.normal(0, 15)

        records.append({
            "city": city,
            "actual_aqi": max(0, actual),
            "predicted_aqi": max(0, predicted),
            "timestamp_utc": datetime.utcnow() - timedelta(hours=i),
            "forecast_horizon_hours": [1, 6, 24][i % 3],
        })

    return pd.DataFrame(records)


# ====================================================================
# Hotspot Detection Tests
# ====================================================================

class TestHotspotDetector:
    """Tests for pollution hotspot detection."""

    def test_detect_hotspots_dbscan(self, sample_merged_df):
        """Test DBSCAN hotspot detection."""
        from analytics.hotspots import HotspotDetector

        detector = HotspotDetector(method="dbscan", aqi_threshold=100)
        hotspots = detector.detect(sample_merged_df)

        # Should detect at least some hotspots (Delhi has high AQI)
        assert isinstance(hotspots, pd.DataFrame)
        if not hotspots.empty:
            assert "hotspot_id" in hotspots.columns
            assert "center_lat" in hotspots.columns
            assert "center_lon" in hotspots.columns
            assert "avg_aqi" in hotspots.columns
            assert "severity" in hotspots.columns

    def test_detect_hotspots_kmeans(self, sample_merged_df):
        """Test K-Means hotspot detection."""
        from analytics.hotspots import HotspotDetector

        detector = HotspotDetector(method="kmeans", kmeans_n_clusters=3, aqi_threshold=50)
        hotspots = detector.detect(sample_merged_df)

        assert isinstance(hotspots, pd.DataFrame)
        if not hotspots.empty:
            assert len(hotspots) <= 3  # Max n_clusters

    def test_detect_hotspots_grid(self, sample_merged_df):
        """Test grid-based hotspot detection."""
        from analytics.hotspots import HotspotDetector

        detector = HotspotDetector(method="grid", aqi_threshold=50)
        hotspots = detector.detect(sample_merged_df)

        assert isinstance(hotspots, pd.DataFrame)

    def test_empty_dataframe(self):
        """Test hotspot detection with empty DataFrame."""
        from analytics.hotspots import HotspotDetector

        detector = HotspotDetector()
        hotspots = detector.detect(pd.DataFrame())

        assert hotspots.empty

    def test_haversine_distance(self):
        """Test haversine distance calculation."""
        from analytics.hotspots import HotspotDetector

        # Delhi to Mumbai ~1150 km
        distances = HotspotDetector._haversine_distances(
            28.6139, 77.2090,
            np.array([19.0760]),
            np.array([72.8777]),
        )
        assert 1100 < distances[0] < 1200

    def test_risk_score_range(self, sample_merged_df):
        """Test that risk scores are in valid range."""
        from analytics.hotspots import HotspotDetector

        detector = HotspotDetector(method="kmeans", kmeans_n_clusters=3, aqi_threshold=50)
        hotspots = detector.detect(sample_merged_df)

        if not hotspots.empty and "risk_score" in hotspots.columns:
            assert all(hotspots["risk_score"] >= 0)
            assert all(hotspots["risk_score"] <= 100)

    def test_generate_report(self, sample_merged_df):
        """Test hotspot report generation."""
        from analytics.hotspots import HotspotDetector

        detector = HotspotDetector(method="kmeans", kmeans_n_clusters=3, aqi_threshold=50)
        hotspots = detector.detect(sample_merged_df)
        report = detector.generate_hotspot_report(hotspots)

        assert isinstance(report, str)


# ====================================================================
# Health Impact Tests
# ====================================================================

class TestHealthImpactAnalyzer:
    """Tests for health impact analysis."""

    def test_analyze_basic(self, sample_merged_df):
        """Test basic health impact analysis."""
        from analytics.health_impact import HealthImpactAnalyzer

        analyzer = HealthImpactAnalyzer()
        results = analyzer.analyze(sample_merged_df)

        assert isinstance(results, dict)
        assert "exposure_by_category" in results
        assert "risk_by_demographic" in results
        assert "city_vulnerability_index" in results

    def test_city_vulnerability(self, sample_merged_df):
        """Test city vulnerability index computation."""
        from analytics.health_impact import HealthImpactAnalyzer

        analyzer = HealthImpactAnalyzer()
        results = analyzer.analyze(sample_merged_df)

        vuln_df = results["city_vulnerability_index"]
        if not vuln_df.empty:
            assert "vulnerability_index" in vuln_df.columns
            assert "vulnerability_level" in vuln_df.columns
            assert all(vuln_df["vulnerability_index"] >= 0)
            assert all(vuln_df["vulnerability_index"] <= 100)

    def test_demographic_risk(self, sample_merged_df):
        """Test demographic risk analysis."""
        from analytics.health_impact import HealthImpactAnalyzer

        analyzer = HealthImpactAnalyzer()
        results = analyzer.analyze(sample_merged_df)

        demo_df = results["risk_by_demographic"]
        if not demo_df.empty:
            assert "demographic" in demo_df.columns
            assert "risk_score" in demo_df.columns
            assert "vulnerability_multiplier" in demo_df.columns

    def test_classify_aqi(self):
        """Test AQI classification function."""
        from analytics.health_impact import HealthImpactAnalyzer

        assert HealthImpactAnalyzer._classify_aqi(25) == "Good"
        assert HealthImpactAnalyzer._classify_aqi(75) == "Satisfactory"
        assert HealthImpactAnalyzer._classify_aqi(150) == "Moderate"
        assert HealthImpactAnalyzer._classify_aqi(250) == "Poor"
        assert HealthImpactAnalyzer._classify_aqi(350) == "Very Poor"
        assert HealthImpactAnalyzer._classify_aqi(450) == "Severe"

    def test_empty_dataframe(self):
        """Test health impact analysis with empty DataFrame."""
        from analytics.health_impact import HealthImpactAnalyzer

        analyzer = HealthImpactAnalyzer()
        results = analyzer.analyze(pd.DataFrame())

        assert results == {}

    def test_generate_report(self, sample_merged_df):
        """Test health impact report generation."""
        from analytics.health_impact import HealthImpactAnalyzer

        analyzer = HealthImpactAnalyzer()
        results = analyzer.analyze(sample_merged_df)
        report = analyzer.generate_report(results)

        assert isinstance(report, str)
        assert "Health Impact" in report


# ====================================================================
# Cohort Analysis Tests
# ====================================================================

class TestCohortAnalyzer:
    """Tests for cohort analysis."""

    def test_analyze_basic(self, sample_merged_df):
        """Test basic cohort analysis."""
        from analytics.cohort_analysis import CohortAnalyzer

        analyzer = CohortAnalyzer(cohort_period="daily")
        results = analyzer.analyze(sample_merged_df)

        assert isinstance(results, dict)
        assert "zone_cohort" in results
        assert "trend_analysis" in results
        assert "seasonal_patterns" in results
        assert "comparative_rankings" in results

    def test_zone_classification(self):
        """Test zone classification based on AQI."""
        from analytics.cohort_analysis import CohortAnalyzer

        assert CohortAnalyzer._classify_zone(25) == "green_zone"
        assert CohortAnalyzer._classify_zone(75) == "yellow_zone"
        assert CohortAnalyzer._classify_zone(150) == "orange_zone"
        assert CohortAnalyzer._classify_zone(250) == "red_zone"
        assert CohortAnalyzer._classify_zone(350) == "purple_zone"
        assert CohortAnalyzer._classify_zone(450) == "maroon_zone"

    def test_zone_change_type(self):
        """Test zone change classification."""
        from analytics.cohort_analysis import CohortAnalyzer

        assert CohortAnalyzer._zone_change_type("green_zone", "yellow_zone") == "degraded"
        assert CohortAnalyzer._zone_change_type("red_zone", "orange_zone") == "improved"
        assert CohortAnalyzer._zone_change_type("yellow_zone", "yellow_zone") == "stable"
        assert CohortAnalyzer._zone_change_type(None, "green_zone") == "new"

    def test_comparative_rankings(self, sample_merged_df):
        """Test city comparative rankings."""
        from analytics.cohort_analysis import CohortAnalyzer

        analyzer = CohortAnalyzer()
        results = analyzer.analyze(sample_merged_df)

        rankings = results["comparative_rankings"]
        if not rankings.empty:
            assert "city" in rankings.columns
            assert "composite_rank" in rankings.columns
            assert "rank_avg" in rankings.columns

    def test_persistence_analysis(self, sample_merged_df):
        """Test pollution persistence analysis."""
        from analytics.cohort_analysis import CohortAnalyzer

        analyzer = CohortAnalyzer()
        results = analyzer.analyze(sample_merged_df)

        persistence = results["persistence_analysis"]
        if not persistence.empty:
            assert "poor_pct" in persistence.columns
            assert "avg_episode_length_hours" in persistence.columns


# ====================================================================
# Forecast Accuracy Tests
# ====================================================================

class TestForecastAccuracy:
    """Tests for forecast accuracy calculation."""

    def test_perfect_predictions(self):
        """Test metrics with perfect predictions."""
        from analytics.forecast_accuracy import ForecastAccuracyCalculator

        df = pd.DataFrame({
            "city": ["Delhi"] * 50,
            "actual_aqi": np.random.uniform(50, 300, 50),
            "predicted_aqi": np.zeros(50),  # Will be set to actual
            "timestamp_utc": [datetime.utcnow() - timedelta(hours=i) for i in range(50)],
        })
        df["predicted_aqi"] = df["actual_aqi"]  # Perfect prediction

        calculator = ForecastAccuracyCalculator()
        metrics = calculator.compute_metrics(df)

        assert metrics["overall"]["mae"] < 1.0
        assert metrics["overall"]["rmse"] < 1.0
        assert metrics["overall"]["mape"] < 1.0
        assert metrics["overall"]["r_squared"] > 0.99
        assert metrics["overall"]["category_accuracy"] > 95

    def test_poor_predictions(self):
        """Test metrics with very poor predictions."""
        from analytics.forecast_accuracy import ForecastAccuracyCalculator

        np.random.seed(42)
        df = pd.DataFrame({
            "city": ["Delhi"] * 100,
            "actual_aqi": np.random.uniform(50, 300, 100),
            "predicted_aqi": np.random.uniform(50, 300, 100),  # Random predictions
            "timestamp_utc": [datetime.utcnow() - timedelta(hours=i) for i in range(100)],
        })

        calculator = ForecastAccuracyCalculator()
        metrics = calculator.compute_metrics(df)

        assert metrics["overall"]["mae"] > 0
        assert metrics["overall"]["rmse"] > 0
        assert metrics["overall"]["r_squared"] < 0.5  # Poor correlation

    def test_mae_calculation(self):
        """Test MAE calculation correctness."""
        from analytics.forecast_accuracy import ForecastAccuracyCalculator

        df = pd.DataFrame({
            "actual_aqi": [100, 200, 300],
            "predicted_aqi": [110, 190, 310],
            "city": ["Delhi", "Delhi", "Delhi"],
        })

        calculator = ForecastAccuracyCalculator()
        metrics = calculator.compute_metrics(df)

        # MAE = mean(|10|, |10|, |10|) = 10
        assert abs(metrics["overall"]["mae"] - 10.0) < 0.01

    def test_rmse_calculation(self):
        """Test RMSE calculation correctness."""
        from analytics.forecast_accuracy import ForecastAccuracyCalculator

        df = pd.DataFrame({
            "actual_aqi": [100, 200, 300],
            "predicted_aqi": [110, 190, 310],
            "city": ["Delhi", "Delhi", "Delhi"],
        })

        calculator = ForecastAccuracyCalculator()
        metrics = calculator.compute_metrics(df)

        # RMSE = sqrt(mean(100, 100, 100)) = 10
        assert abs(metrics["overall"]["rmse"] - 10.0) < 0.01

    def test_bias_calculation(self):
        """Test bias detection."""
        from analytics.forecast_accuracy import ForecastAccuracyCalculator

        # Over-prediction bias
        df = pd.DataFrame({
            "actual_aqi": [100, 100, 100],
            "predicted_aqi": [120, 120, 120],
            "city": ["Delhi", "Delhi", "Delhi"],
        })

        calculator = ForecastAccuracyCalculator()
        metrics = calculator.compute_metrics(df)

        assert metrics["overall"]["bias"]["direction"] == "over_prediction"
        assert metrics["overall"]["bias"]["mean_bias"] > 0

    def test_per_city_metrics(self, forecast_df):
        """Test per-city metric breakdown."""
        from analytics.forecast_accuracy import ForecastAccuracyCalculator

        calculator = ForecastAccuracyCalculator()
        metrics = calculator.compute_metrics(forecast_df)

        assert "per_city" in metrics
        assert len(metrics["per_city"]) > 0
        for city, city_metrics in metrics["per_city"].items():
            assert "mae" in city_metrics
            assert "rmse" in city_metrics

    def test_per_horizon_metrics(self, forecast_df):
        """Test per-horizon metric breakdown."""
        from analytics.forecast_accuracy import ForecastAccuracyCalculator

        calculator = ForecastAccuracyCalculator()
        metrics = calculator.compute_metrics(forecast_df)

        assert "per_horizon" in metrics
        if metrics["per_horizon"]:
            for horizon, h_metrics in metrics["per_horizon"].items():
                assert "mae" in h_metrics
                assert "rmse" in h_metrics

    def test_empty_dataframe(self):
        """Test with empty DataFrame."""
        from analytics.forecast_accuracy import ForecastAccuracyCalculator

        calculator = ForecastAccuracyCalculator()
        metrics = calculator.compute_metrics(pd.DataFrame())

        assert metrics == {}

    def test_missing_columns(self):
        """Test with missing required columns."""
        from analytics.forecast_accuracy import ForecastAccuracyCalculator

        df = pd.DataFrame({"city": ["Delhi"], "value": [100]})
        calculator = ForecastAccuracyCalculator()
        metrics = calculator.compute_metrics(df)

        assert metrics == {}

    def test_generate_report(self, forecast_df):
        """Test forecast accuracy report generation."""
        from analytics.forecast_accuracy import ForecastAccuracyCalculator

        calculator = ForecastAccuracyCalculator()
        metrics = calculator.compute_metrics(forecast_df)
        report = calculator.generate_report(metrics)

        assert "Forecast Accuracy" in report
        assert "MAE" in report
        assert "RMSE" in report

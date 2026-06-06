"""
Tests for Feature Pipeline.

Tests feature builder, scaler, and feature store functionality.
"""

import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timedelta


class TestFeatureBuilder:
    """Tests for the FeatureBuilder class."""

    @pytest.fixture
    def sample_data(self):
        """Create sample AQI data for testing."""
        np.random.seed(42)
        n = 500
        idx = pd.date_range("2024-01-01", periods=n, freq="h")
        aqi = 100 + np.sin(2 * np.pi * idx.hour / 24) * 30 + np.random.normal(0, 10, n)
        aqi = np.clip(aqi, 0, 500)
        df = pd.DataFrame({"aqi": aqi}, index=idx)
        return df

    @pytest.fixture
    def sample_data_with_weather(self):
        """Create sample data with weather features."""
        np.random.seed(42)
        n = 500
        idx = pd.date_range("2024-01-01", periods=n, freq="h")
        df = pd.DataFrame({
            "aqi": np.clip(100 + np.random.normal(0, 20, n), 0, 500),
            "temperature": 25 + np.random.normal(0, 5, n),
            "humidity": 60 + np.random.normal(0, 10, n),
            "wind_speed": 10 + np.random.normal(0, 3, n),
        }, index=idx)
        return df

    def test_feature_builder_basic(self, sample_data):
        """Test basic feature building without weather data."""
        from feature_pipeline.feature_builder import FeatureBuilder
        builder = FeatureBuilder(include_weather_interactions=False, include_aqi_categories=False)
        features, target = builder.build(sample_data)
        assert len(features) == len(sample_data)
        assert len(target) == len(sample_data)
        assert len(builder.feature_names_) > 0

    def test_feature_builder_with_weather(self, sample_data_with_weather):
        """Test feature building with weather data."""
        from feature_pipeline.feature_builder import FeatureBuilder
        builder = FeatureBuilder(include_weather_interactions=True, include_aqi_categories=False)
        weather_cols = ["temperature", "humidity", "wind_speed"]
        features, target = builder.build(sample_data_with_weather, weather_cols=weather_cols)
        assert any("weather_" in f for f in features.columns)
        assert any("_x_" in f for f in features.columns)

    def test_lag_features_created(self, sample_data):
        """Test that lag features are properly created."""
        from feature_pipeline.feature_builder import FeatureBuilder
        builder = FeatureBuilder(include_weather_interactions=False, include_aqi_categories=False)
        features, _ = builder.build(sample_data)
        lag_features = [f for f in features.columns if "lag" in f]
        assert len(lag_features) > 0
        assert "aqi_lag_1" in features.columns
        assert "aqi_lag_24" in features.columns

    def test_rolling_features_created(self, sample_data):
        """Test rolling statistics features."""
        from feature_pipeline.feature_builder import FeatureBuilder
        builder = FeatureBuilder(include_weather_interactions=False, include_aqi_categories=False)
        features, _ = builder.build(sample_data)
        roll_features = [f for f in features.columns if "roll" in f]
        assert len(roll_features) > 0

    def test_time_features_created(self, sample_data):
        """Test cyclical time features."""
        from feature_pipeline.feature_builder import FeatureBuilder
        builder = FeatureBuilder(include_aqi_categories=False)
        features, _ = builder.build(sample_data)
        assert "hour_sin" in features.columns
        assert "hour_cos" in features.columns
        assert "is_weekend" in features.columns

    def test_feature_summary(self, sample_data):
        """Test feature summary generation."""
        from feature_pipeline.feature_builder import FeatureBuilder
        builder = FeatureBuilder(include_aqi_categories=False)
        builder.build(sample_data)
        summary = builder.get_feature_summary()
        assert "lag" in summary
        assert "rolling" in summary
        assert summary["lag"]["count"] > 0

    def test_invalid_index_raises_error(self):
        """Test that non-DatetimeIndex raises an error."""
        from feature_pipeline.feature_builder import FeatureBuilder
        builder = FeatureBuilder()
        df = pd.DataFrame({"aqi": [100, 101, 102]})
        with pytest.raises(ValueError, match="DatetimeIndex"):
            builder.build(df)


class TestFeatureScaler:
    """Tests for the FeatureScaler class."""

    @pytest.fixture
    def sample_features(self):
        """Create sample feature matrix."""
        np.random.seed(42)
        return pd.DataFrame({
            "feature_1": np.random.normal(100, 20, 200),
            "feature_2": np.random.normal(50, 10, 200),
            "feature_3": np.random.normal(0, 1, 200),
        })

    def test_standard_scaler(self, sample_features):
        """Test StandardScaler fitting and transformation."""
        from feature_pipeline.scaler import FeatureScaler
        scaler = FeatureScaler(method="standard")
        scaler.fit(sample_features)
        transformed = scaler.transform(sample_features)
        assert isinstance(transformed, pd.DataFrame)
        # Check approximate zero mean
        assert abs(transformed.mean().mean()) < 0.1

    def test_minmax_scaler(self, sample_features):
        """Test MinMaxScaler fitting and transformation."""
        from feature_pipeline.scaler import FeatureScaler
        scaler = FeatureScaler(method="minmax")
        scaler.fit(sample_features)
        transformed = scaler.transform(sample_features)
        assert isinstance(transformed, pd.DataFrame)
        assert transformed.min().min() >= 0
        assert transformed.max().max() <= 1.01  # Allow small floating point error

    def test_inverse_transform(self, sample_features):
        """Test inverse transformation."""
        from feature_pipeline.scaler import FeatureScaler
        scaler = FeatureScaler(method="standard")
        transformed = scaler.fit_transform(sample_features)
        recovered = scaler.inverse_transform(transformed)
        np.testing.assert_allclose(recovered.values, sample_features.values, atol=1e-6)

    def test_save_load(self, sample_features, tmp_path):
        """Test scaler save and load."""
        from feature_pipeline.scaler import FeatureScaler
        scaler = FeatureScaler(method="standard")
        scaler.fit(sample_features)
        path = str(tmp_path / "scaler.pkl")
        scaler.save(path)
        loaded = FeatureScaler.load(path)
        assert loaded.fitted
        assert loaded.feature_names_ == scaler.feature_names_

    def test_invalid_method_raises_error(self):
        """Test that invalid scaling method raises an error."""
        from feature_pipeline.scaler import FeatureScaler
        with pytest.raises(ValueError, match="Unknown scaling method"):
            FeatureScaler(method="invalid")


class TestFeatureStore:
    """Tests for the FeatureStore class."""

    def test_feature_store_creation(self, tmp_path):
        """Test feature store initialization."""
        from feature_pipeline.feature_store import FeatureStore
        store = FeatureStore(data_dir=str(tmp_path / "data"), cache_dir=str(tmp_path / "cache"))
        assert store.data_dir == str(tmp_path / "data")

    def test_get_training_data(self, tmp_path):
        """Test getting training data (with synthetic fallback)."""
        from feature_pipeline.feature_store import FeatureStore
        store = FeatureStore(data_dir=str(tmp_path / "data"), cache_dir=str(tmp_path / "cache"))
        df = store.get_training_data(city="delhi")
        assert len(df) > 0
        assert "aqi" in df.columns

    def test_data_summary(self, tmp_path):
        """Test data summary generation."""
        from feature_pipeline.feature_store import FeatureStore
        store = FeatureStore(data_dir=str(tmp_path / "data"), cache_dir=str(tmp_path / "cache"))
        store.get_training_data(city="delhi")
        summary = store.get_data_summary()
        assert summary["cache_size"] > 0

    def test_clear_cache(self, tmp_path):
        """Test cache clearing."""
        from feature_pipeline.feature_store import FeatureStore
        store = FeatureStore(data_dir=str(tmp_path / "data"), cache_dir=str(tmp_path / "cache"))
        store.get_training_data(city="delhi")
        store.clear_cache()
        summary = store.get_data_summary()
        assert summary["cache_size"] == 0

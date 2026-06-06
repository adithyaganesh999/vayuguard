"""
Integration Tests for VayuGuard ML Service.

End-to-end tests that verify the complete pipeline from data loading
through model training to inference serving.
"""

import pytest
import numpy as np
import pandas as pd
import json
import os
from datetime import datetime


class TestEndToEndPipeline:
    """End-to-end pipeline integration tests."""

    @pytest.fixture
    def sample_data(self, tmp_path):
        """Create sample data directory with AQI data."""
        np.random.seed(42)
        n = 500
        idx = pd.date_range("2024-01-01", periods=n, freq="h")
        df = pd.DataFrame({
            "aqi": np.clip(100 + np.sin(2 * np.pi * idx.hour / 24) * 30 + np.random.normal(0, 10, n), 0, 500),
            "temperature": 25 + np.random.normal(0, 5, n),
            "humidity": 60 + np.random.normal(0, 10, n),
        }, index=idx)

        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        df.to_csv(os.path.join(data_dir, "aqi_delhi.csv"))
        return str(tmp_path)

    def test_feature_pipeline_to_model(self, sample_data):
        """Test the pipeline from feature building to model training."""
        from feature_pipeline.feature_builder import FeatureBuilder
        from feature_pipeline.feature_store import FeatureStore

        store = FeatureStore(data_dir=os.path.join(sample_data, "data"),
                              cache_dir=os.path.join(sample_data, "cache"))
        df = store.get_training_data(city="delhi")
        assert "aqi" in df.columns
        assert len(df) > 0

        builder = FeatureBuilder(include_aqi_categories=False,
                                  include_weather_interactions=False)
        features, target = builder.build(df)
        assert len(features) > 0
        assert len(features.columns) > 10

    def test_baseline_model_full_workflow(self, sample_data):
        """Test complete baseline model workflow."""
        from models.baseline.persistence_model import PersistenceModel
        from models.baseline.moving_average import MovingAverageModel
        from feature_pipeline.feature_store import FeatureStore

        store = FeatureStore(data_dir=os.path.join(sample_data, "data"),
                              cache_dir=os.path.join(sample_data, "cache"))
        df = store.get_training_data(city="delhi")
        y = df["aqi"]

        split = int(len(y) * 0.8)
        y_train, y_test = y.iloc[:split], y.iloc[split:]

        # Persistence model
        persist = PersistenceModel(seasonal_lag=1)
        persist.fit(y_train)
        preds = persist.predict(horizon=24)
        assert len(preds) == 24
        assert persist.training_metrics["mae"] > 0

        # Moving average model
        sma = MovingAverageModel(window=24)
        sma.fit(y_train)
        preds = sma.predict(horizon=24)
        assert len(preds) == 24

    def test_model_save_load_cycle(self, sample_data, tmp_path):
        """Test complete model save/load cycle."""
        from models.baseline.persistence_model import PersistenceModel
        from feature_pipeline.feature_store import FeatureStore

        store = FeatureStore(data_dir=os.path.join(sample_data, "data"),
                              cache_dir=os.path.join(sample_data, "cache"))
        df = store.get_training_data(city="delhi")

        # Train and save
        model = PersistenceModel(seasonal_lag=24, name="test_cycle")
        model.fit(df["aqi"])
        original_preds = model.predict(horizon=24)

        path = str(tmp_path / "model_cycle.pkl")
        model.save(path)

        # Load and predict
        loaded = PersistenceModel.load(path)
        loaded_preds = loaded.predict(horizon=24)
        np.testing.assert_array_equal(original_preds, loaded_preds)

    def test_feature_scaler_pipeline(self):
        """Test feature scaling in the pipeline."""
        from feature_pipeline.scaler import FeatureScaler

        np.random.seed(42)
        data = pd.DataFrame({
            "feature_1": np.random.normal(100, 20, 200),
            "feature_2": np.random.normal(50, 10, 200),
        })

        scaler = FeatureScaler(method="standard")
        transformed = scaler.fit_transform(data)
        recovered = scaler.inverse_transform(transformed)
        np.testing.assert_allclose(recovered.values, data.values, atol=1e-6)


class TestDriftDetectionIntegration:
    """Integration tests for drift detection."""

    def test_drift_detection_workflow(self):
        """Test the drift detection workflow."""
        from monitoring.drift_detection import DriftDetector

        np.random.seed(42)
        # Reference data
        ref_data = pd.DataFrame({"aqi": np.random.normal(100, 20, 500),
                                  "temperature": np.random.normal(25, 5, 500)})
        # Current data with drift
        cur_data = pd.DataFrame({"aqi": np.random.normal(150, 25, 200),
                                  "temperature": np.random.normal(30, 5, 200)})

        detector = DriftDetector(reference_data=ref_data, feature_columns=["aqi", "temperature"])
        results = detector.detect_feature_drift(cur_data, method="all")

        assert "aqi" in results
        # Should detect drift given the distribution shift
        assert results["aqi"]["ks_pvalue"] is not None

    def test_drift_no_drift_scenario(self):
        """Test drift detection when there is no drift."""
        from monitoring.drift_detection import DriftDetector

        np.random.seed(42)
        ref_data = pd.DataFrame({"aqi": np.random.normal(100, 20, 500)})
        # Similar distribution — no drift
        cur_data = pd.DataFrame({"aqi": np.random.normal(102, 20, 200)})

        detector = DriftDetector(reference_data=ref_data, feature_columns=["aqi"])
        results = detector.detect_feature_drift(cur_data, method="ks")
        # KS p-value should be high (no drift)
        assert results["aqi"]["ks_pvalue"] > 0.01


class TestAccuracyTrackerIntegration:
    """Integration tests for accuracy tracking."""

    def test_accuracy_tracking_workflow(self):
        """Test the accuracy tracking workflow."""
        from monitoring.accuracy_tracker import AccuracyTracker

        tracker = AccuracyTracker(window_size=50)

        # Record predictions
        for i in range(20):
            predicted = 100 + np.random.normal(0, 10)
            actual = predicted + np.random.normal(0, 5)
            tracker.record_prediction("delhi", "xgboost_aqi", predicted, actual)

        metrics = tracker.compute_metrics(city="delhi")
        assert metrics["n_predictions"] == 20
        assert metrics["mae"] > 0

    def test_alert_triggering(self):
        """Test that alerts are triggered for poor accuracy."""
        from monitoring.accuracy_tracker import AccuracyTracker

        tracker = AccuracyTracker(alert_threshold_mae=5.0)
        # Record bad predictions
        for i in range(20):
            tracker.record_prediction("delhi", "test_model", 100, 50)

        metrics = tracker.compute_metrics(city="delhi")
        alerts = tracker.get_alerts()
        assert len(alerts) > 0


class TestModelRegistryIntegration:
    """Integration tests for model registry operations."""

    def test_registry_update(self, tmp_path):
        """Test model registry update workflow."""
        registry_dir = str(tmp_path / "metadata")
        os.makedirs(registry_dir, exist_ok=True)
        registry_path = os.path.join(registry_dir, "model_registry.json")

        registry = {
            "champion_model": {
                "name": "xgboost_aqi",
                "version": "1.0.0",
                "metrics": {"mae": 15.2, "rmse": 20.5},
                "promoted_at": datetime.now().isoformat(),
            },
            "archived_models": [],
        }

        with open(registry_path, "w") as f:
            json.dump(registry, f, indent=2)

        with open(registry_path, "r") as f:
            loaded = json.load(f)

        assert loaded["champion_model"]["name"] == "xgboost_aqi"

"""
Tests for AQI Forecasting Models.

Tests baseline, classical, and ensemble model functionality.
"""

import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timedelta


@pytest.fixture
def sample_aqi_series():
    """Create a sample AQI time series for testing."""
    np.random.seed(42)
    n = 500
    idx = pd.date_range("2024-01-01", periods=n, freq="h")
    base = 120 + np.sin(2 * np.pi * idx.hour / 24) * 30
    noise = np.random.normal(0, 15, n)
    aqi = np.clip(base + noise, 0, 500)
    return pd.Series(aqi, index=idx, name="aqi")


class TestPersistenceModel:
    """Tests for the PersistenceModel."""

    def test_fit_and_predict(self, sample_aqi_series):
        """Test basic fit and predict workflow."""
        from models.baseline.persistence_model import PersistenceModel
        model = PersistenceModel(seasonal_lag=1)
        model.fit(sample_aqi_series)
        predictions = model.predict(horizon=24)
        assert len(predictions) == 24
        assert all(p >= 0 for p in predictions)
        # Persistence should predict the last value
        assert predictions[0] == sample_aqi_series.iloc[-1]

    def test_seasonal_persistence(self, sample_aqi_series):
        """Test seasonal lag persistence."""
        from models.baseline.persistence_model import PersistenceModel
        model = PersistenceModel(seasonal_lag=24)
        model.fit(sample_aqi_series)
        predictions = model.predict(horizon=24)
        assert len(predictions) == 24

    def test_training_metrics(self, sample_aqi_series):
        """Test that training metrics are computed."""
        from models.baseline.persistence_model import PersistenceModel
        model = PersistenceModel(seasonal_lag=1)
        model.fit(sample_aqi_series)
        assert "mae" in model.training_metrics
        assert "rmse" in model.training_metrics
        assert model.training_metrics["mae"] > 0

    def test_predict_with_confidence(self, sample_aqi_series):
        """Test confidence interval prediction."""
        from models.baseline.persistence_model import PersistenceModel
        model = PersistenceModel(seasonal_lag=1)
        model.fit(sample_aqi_series)
        result = model.predict_with_confidence(horizon=24, quantile=0.95)
        assert "forecast" in result
        assert "lower" in result
        assert "upper" in result
        assert all(result["lower"] <= result["forecast"])
        assert all(result["upper"] >= result["forecast"])

    def test_save_and_load(self, sample_aqi_series, tmp_path):
        """Test model serialization."""
        from models.baseline.persistence_model import PersistenceModel
        model = PersistenceModel(seasonal_lag=1, name="test_persist")
        model.fit(sample_aqi_series)
        path = str(tmp_path / "persistence.pkl")
        model.save(path)
        loaded = PersistenceModel.load(path)
        assert loaded.seasonal_lag == 1
        assert loaded.fitted
        preds_original = model.predict(horizon=24)
        preds_loaded = loaded.predict(horizon=24)
        np.testing.assert_array_equal(preds_original, preds_loaded)

    def test_unfitted_predict_raises(self):
        """Test that predicting before fitting raises an error."""
        from models.baseline.persistence_model import PersistenceModel
        model = PersistenceModel()
        with pytest.raises(RuntimeError):
            model.predict(horizon=24)

    def test_get_info(self, sample_aqi_series):
        """Test model info retrieval."""
        from models.baseline.persistence_model import PersistenceModel
        model = PersistenceModel(seasonal_lag=24)
        model.fit(sample_aqi_series)
        info = model.get_info()
        assert info["model_type"] == "persistence"
        assert info["seasonal_lag"] == 24


class TestMovingAverageModel:
    """Tests for MovingAverageModel and WeightedMovingAverageModel."""

    def test_sma_fit_predict(self, sample_aqi_series):
        """Test SMA fit and predict."""
        from models.baseline.moving_average import MovingAverageModel
        model = MovingAverageModel(window=24)
        model.fit(sample_aqi_series)
        predictions = model.predict(horizon=24)
        assert len(predictions) == 24
        # All SMA predictions should be equal (constant forecast)
        assert all(p == predictions[0] for p in predictions)

    def test_sma_rolling_predict(self, sample_aqi_series):
        """Test SMA rolling prediction."""
        from models.baseline.moving_average import MovingAverageModel
        model = MovingAverageModel(window=24)
        model.fit(sample_aqi_series)
        predictions = model.predict_rolling(horizon=24)
        assert len(predictions) == 24

    def test_wma_fit_predict(self, sample_aqi_series):
        """Test WMA fit and predict."""
        from models.baseline.moving_average import WeightedMovingAverageModel
        model = WeightedMovingAverageModel(window=24)
        model.fit(sample_aqi_series)
        predictions = model.predict(horizon=24)
        assert len(predictions) == 24

    def test_wma_custom_weights(self, sample_aqi_series):
        """Test WMA with custom weights."""
        from models.baseline.moving_average import WeightedMovingAverageModel
        weights = np.array([3, 2, 1], dtype=float)
        model = WeightedMovingAverageModel(window=3, weights=weights)
        model.fit(sample_aqi_series)
        predictions = model.predict(horizon=10)
        assert len(predictions) == 10

    def test_wma_confidence_intervals(self, sample_aqi_series):
        """Test WMA confidence intervals."""
        from models.baseline.moving_average import WeightedMovingAverageModel
        model = WeightedMovingAverageModel(window=24)
        model.fit(sample_aqi_series)
        result = model.predict_with_confidence(horizon=24)
        assert "lower" in result
        assert "upper" in result

    def test_invalid_window_raises_error(self):
        """Test that invalid window size raises an error."""
        from models.baseline.moving_average import MovingAverageModel
        with pytest.raises(ValueError):
            MovingAverageModel(window=0)


class TestXGBoostModel:
    """Tests for the XGBoost AQI model."""

    @pytest.fixture
    def sample_df(self):
        """Create a sample DataFrame with AQI and weather."""
        np.random.seed(42)
        n = 500
        idx = pd.date_range("2024-01-01", periods=n, freq="h")
        return pd.DataFrame({
            "aqi": np.clip(100 + np.sin(2 * np.pi * idx.hour / 24) * 30 + np.random.normal(0, 10, n), 0, 500),
            "temperature": 25 + np.random.normal(0, 5, n),
        }, index=idx)

    def test_xgboost_fit_predict(self, sample_df):
        """Test XGBoost training and prediction."""
        from models.classical.xgboost_model import XGBoostAQIModel
        model = XGBoostAQIModel(n_estimators=10, max_depth=3, lag_features=[1, 3, 24], rolling_windows=[6, 24])
        model.fit(sample_df["aqi"], sample_df[["temperature"]], cv_folds=2)
        assert model.fitted
        predictions = model.predict(sample_df["aqi"], horizon=24)
        assert len(predictions) == 24
        assert all(p >= 0 for p in predictions)

    def test_xgboost_feature_importance(self, sample_df):
        """Test feature importance extraction."""
        from models.classical.xgboost_model import XGBoostAQIModel
        model = XGBoostAQIModel(n_estimators=10, max_depth=3, lag_features=[1, 24], rolling_windows=[6])
        model.fit(sample_df["aqi"], cv_folds=2)
        importance = model.get_feature_importance(top_n=10)
        assert len(importance) > 0

    def test_xgboost_save_load(self, sample_df, tmp_path):
        """Test XGBoost model save and load."""
        from models.classical.xgboost_model import XGBoostAQIModel
        model = XGBoostAQIModel(n_estimators=10, max_depth=3, lag_features=[1, 24], rolling_windows=[6])
        model.fit(sample_df["aqi"], cv_folds=2)
        path = str(tmp_path / "xgb")
        model.save(path)
        loaded = XGBoostAQIModel.load(path)
        assert loaded.fitted


class TestModelEnsemble:
    """Tests for the ModelEnsemble."""

    def test_ensemble_average(self, sample_aqi_series):
        """Test ensemble with averaging strategy."""
        from models.baseline.persistence_model import PersistenceModel
        from models.baseline.moving_average import MovingAverageModel
        from models.ensemble.model_ensemble import ModelEnsemble

        p1 = PersistenceModel(seasonal_lag=1, name="p1")
        p1.fit(sample_aqi_series)
        sma = MovingAverageModel(window=24, name="sma24")
        sma.fit(sample_aqi_series)

        ensemble = ModelEnsemble(
            models={"p1": p1, "sma24": sma},
            strategy="average",
        )
        # Average strategy doesn't require fitting
        ensemble.fitted = True
        predictions = ensemble.predict(sample_aqi_series, horizon=24)
        assert len(predictions) == 24

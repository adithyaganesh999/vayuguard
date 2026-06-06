"""
Tests for FastAPI Inference Server.

Tests API endpoints, request validation, and response schemas.
"""

import pytest
from fastapi.testclient import TestClient
import numpy as np


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    from inference.fastapi_app import app
    return TestClient(app)


class TestRootEndpoint:
    """Tests for the root endpoint."""

    def test_root(self, client):
        """Test root endpoint returns service info."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "VayuGuard ML Service"
        assert "version" in data


class TestHealthEndpoints:
    """Tests for health check endpoints."""

    def test_health_check(self, client):
        """Test health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "version" in data

    def test_liveness_check(self, client):
        """Test liveness check endpoint."""
        response = client.get("/live")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "alive"

    def test_readiness_check(self, client):
        """Test readiness check endpoint."""
        response = client.get("/ready")
        assert response.status_code in (200, 503)


class TestForecastEndpoint:
    """Tests for the forecast API endpoint."""

    def test_forecast_default(self, client):
        """Test forecast with default parameters."""
        response = client.get("/api/forecast")
        assert response.status_code == 200
        data = response.json()
        assert "city" in data
        assert "data" in data
        assert "model_name" in data

    def test_forecast_with_city(self, client):
        """Test forecast with city parameter."""
        response = client.get("/api/forecast?city=mumbai&hours=48")
        assert response.status_code == 200
        data = response.json()
        assert data["city"] == "mumbai"
        assert data["forecast_horizon_hours"] == 48

    def test_forecast_invalid_hours(self, client):
        """Test forecast with invalid hours parameter."""
        response = client.get("/api/forecast?hours=0")
        assert response.status_code == 422

    def test_forecast_excessive_hours(self, client):
        """Test forecast with hours exceeding limit."""
        response = client.get("/api/forecast?hours=200")
        assert response.status_code == 422

    def test_forecast_data_points_structure(self, client):
        """Test that forecast data points have correct structure."""
        response = client.get("/api/forecast?hours=6")
        assert response.status_code == 200
        data = response.json()
        if data["data"]:
            point = data["data"][0]
            assert "timestamp" in point
            assert "aqi" in point
            assert "category" in point

    def test_forecast_aqi_range(self, client):
        """Test that forecast AQI values are in valid range."""
        response = client.get("/api/forecast?hours=24")
        if response.status_code == 200:
            data = response.json()
            for point in data["data"]:
                assert 0 <= point["aqi"] <= 500


class TestHealthRiskEndpoint:
    """Tests for the health risk API endpoint."""

    def test_health_risk_default(self, client):
        """Test health risk with default parameters."""
        response = client.post("/api/health-risk", json={"city": "delhi"})
        assert response.status_code == 200
        data = response.json()
        assert "current_aqi" in data
        assert "risk" in data
        assert "recommendations" in data

    def test_health_risk_with_aqi(self, client):
        """Test health risk with specific AQI value."""
        response = client.post("/api/health-risk", json={
            "city": "delhi", "current_aqi": 200, "population_group": "elderly",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["current_aqi"] == 200

    def test_health_risk_invalid_population(self, client):
        """Test health risk with invalid population group."""
        response = client.post("/api/health-risk", json={
            "city": "delhi", "population_group": "invalid_group",
        })
        assert response.status_code == 422

    def test_health_risk_score_range(self, client):
        """Test that risk score is within valid range."""
        response = client.post("/api/health-risk", json={"city": "delhi"})
        if response.status_code == 200:
            data = response.json()
            assert 0 <= data["risk"]["score"] <= 100


class TestModelInfoEndpoint:
    """Tests for the model info API endpoint."""

    def test_model_version(self, client):
        """Test model version endpoint."""
        response = client.get("/api/model/version")
        assert response.status_code == 200
        data = response.json()
        assert "model_name" in data
        assert "model_type" in data

    def test_model_list(self, client):
        """Test model list endpoint."""
        response = client.get("/api/model/list")
        assert response.status_code == 200
        data = response.json()
        assert "available_models" in data


class TestMetricsEndpoint:
    """Tests for the Prometheus metrics endpoint."""

    def test_metrics_endpoint(self, client):
        """Test Prometheus metrics endpoint."""
        response = client.get("/metrics")
        assert response.status_code in (200, 501)


class TestRequestValidation:
    """Tests for request input validation."""

    def test_city_normalization(self):
        """Test that city names are normalized."""
        from inference.dependencies.validation import validate_city
        assert validate_city("Delhi") == "delhi"
        assert validate_city("New Delhi") == "new_delhi"
        assert validate_city("  Mumbai  ") == "mumbai"

    def test_aqi_category(self):
        """Test AQI category classification."""
        from inference.dependencies.validation import get_aqi_category
        cat = get_aqi_category(30)
        assert cat["label"] == "Good"
        cat = get_aqi_category(75)
        assert cat["label"] == "Moderate"
        cat = get_aqi_category(175)
        assert cat["label"] == "Unhealthy"
        cat = get_aqi_category(400)
        assert cat["label"] == "Hazardous"

    def test_health_risk_score(self):
        """Test health risk score calculation."""
        from inference.dependencies.validation import get_health_risk_score
        risk = get_health_risk_score(50, "general", "moderate")
        assert risk["score"] < 30
        risk = get_health_risk_score(300, "elderly", "heavy")
        assert risk["score"] > 60

    def test_validate_horizon(self):
        """Test horizon validation."""
        from inference.dependencies.validation import validate_horizon
        from fastapi import HTTPException
        assert validate_horizon(72) == 72
        with pytest.raises(HTTPException):
            validate_horizon(0)
        with pytest.raises(HTTPException):
            validate_horizon(200)

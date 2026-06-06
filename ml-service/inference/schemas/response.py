"""
Pydantic Response Models for VayuGuard ML Service.

Defines the schema for all API response payloads.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class ForecastDataPoint(BaseModel):
    """Single forecast data point."""
    timestamp: str = Field(description="ISO format timestamp")
    aqi: float = Field(description="Predicted AQI value", ge=0)
    aqi_lower: Optional[float] = Field(None, description="Lower confidence bound")
    aqi_upper: Optional[float] = Field(None, description="Upper confidence bound")
    category: str = Field(description="AQI category (Good, Moderate, etc.)")
    category_color: str = Field(description="Color code for the category")


class ForecastResponse(BaseModel):
    """Response model for AQI forecast."""
    city: str = Field(description="City name")
    model_name: str = Field(description="Model used for forecast")
    model_version: str = Field(description="Model version")
    forecast_horizon_hours: int = Field(description="Forecast horizon")
    generated_at: str = Field(description="Timestamp of forecast generation")
    data: List[ForecastDataPoint] = Field(description="Forecast data points")
    current_aqi: Optional[float] = Field(None, description="Current AQI at forecast time")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class HealthRiskLevel(BaseModel):
    """Health risk level details."""
    level: str = Field(description="Risk level name")
    score: float = Field(description="Risk score 0-100", ge=0, le=100)
    color: str = Field(description="Risk level color")
    description: str = Field(description="Risk description")


class HealthRiskRecommendation(BaseModel):
    """Health risk recommendation."""
    category: str = Field(description="Recommendation category")
    message: str = Field(description="Recommendation text")
    priority: str = Field(description="Priority level (low, medium, high)")


class HealthRiskResponse(BaseModel):
    """Response model for health risk assessment."""
    city: str
    current_aqi: float
    category: str
    risk: HealthRiskLevel
    peak_aqi_next_24h: Optional[float] = None
    avg_aqi_next_24h: Optional[float] = None
    sensitive_groups: List[str] = Field(default_factory=list)
    recommendations: List[HealthRiskRecommendation] = Field(default_factory=list)
    forecast_summary: Optional[Dict[str, Any]] = None
    generated_at: str


class ModelMetrics(BaseModel):
    """Model performance metrics."""
    mae: Optional[float] = None
    rmse: Optional[float] = None
    r2: Optional[float] = None
    mape: Optional[float] = None
    cv_folds: Optional[int] = None


class ModelInfoResponse(BaseModel):
    """Response model for model information."""
    model_name: str
    model_type: str
    model_version: str
    fitted: bool
    is_champion: bool
    trained_at: Optional[str] = None
    training_metrics: Optional[ModelMetrics] = None
    hyperparameters: Dict[str, Any] = Field(default_factory=dict)
    feature_importance: Optional[Dict[str, float]] = None
    supported_cities: List[str] = Field(default_factory=lambda: ["delhi", "mumbai", "bangalore", "chennai"])
    forecast_horizon: int = 72


class ModelListResponse(BaseModel):
    """Response for listing available models."""
    champion_model: Optional[str] = None
    available_models: List[ModelInfoResponse]
    total_models: int


class ErrorResponse(BaseModel):
    """Error response model."""
    error: str
    detail: Optional[str] = None
    status_code: int
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = Field(description="Service status")
    version: str = Field(description="Service version")
    model_loaded: bool = Field(description="Whether the ML model is loaded")
    uptime_seconds: Optional[float] = None
    last_prediction_at: Optional[str] = None

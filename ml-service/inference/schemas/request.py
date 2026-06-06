"""
Pydantic Request Models for VayuGuard ML Service.

Defines the schema for all API request payloads with validation.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict
from datetime import datetime


class ForecastRequest(BaseModel):
    """Request model for AQI forecast."""
    city: str = Field(
        default="delhi",
        description="City name for the forecast",
        min_length=1,
        max_length=100,
        examples=["delhi", "mumbai", "bangalore"],
    )
    hours: int = Field(
        default=72,
        description="Forecast horizon in hours",
        ge=1,
        le=168,
        examples=[24, 48, 72],
    )
    model_name: Optional[str] = Field(
        default=None,
        description="Specific model to use. None = champion model.",
        examples=["xgboost_aqi", "prophet_aqi", "lstm_aqi"],
    )
    include_confidence: bool = Field(
        default=True,
        description="Whether to include confidence intervals",
    )
    confidence_level: float = Field(
        default=0.95,
        description="Confidence level for intervals",
        ge=0.5,
        le=0.99,
    )

    @validator("city")
    def normalize_city(cls, v):
        return v.strip().lower().replace(" ", "_")


class HealthRiskRequest(BaseModel):
    """Request model for health risk assessment."""
    city: str = Field(
        default="delhi",
        description="City name",
        min_length=1,
    )
    current_aqi: Optional[float] = Field(
        default=None,
        description="Current AQI value. If None, fetches latest.",
        ge=0,
        le=500,
    )
    forecast_hours: int = Field(
        default=24,
        description="Hours to look ahead for risk assessment",
        ge=1,
        le=168,
    )
    population_group: str = Field(
        default="general",
        description="Target population group for risk assessment",
        examples=["general", "children", "elderly", "respiratory", "athletes"],
    )
    activity_level: str = Field(
        default="moderate",
        description="Activity level for exposure calculation",
        examples=["sedentary", "light", "moderate", "heavy"],
    )

    @validator("population_group")
    def validate_population(cls, v):
        valid = ["general", "children", "elderly", "respiratory", "athletes"]
        if v not in valid:
            raise ValueError(f"population_group must be one of {valid}")
        return v

    @validator("activity_level")
    def validate_activity(cls, v):
        valid = ["sedentary", "light", "moderate", "heavy"]
        if v not in valid:
            raise ValueError(f"activity_level must be one of {valid}")
        return v


class ModelInfoRequest(BaseModel):
    """Request model for model information."""
    model_name: Optional[str] = Field(
        default=None,
        description="Specific model name. None = champion model.",
    )
    include_feature_importance: bool = Field(
        default=False,
        description="Include feature importance data",
    )
    include_training_history: bool = Field(
        default=False,
        description="Include training history",
    )


class BatchForecastRequest(BaseModel):
    """Request model for batch forecasts across multiple cities."""
    cities: List[str] = Field(
        description="List of cities to forecast",
        min_length=1,
        max_length=50,
    )
    hours: int = Field(
        default=72,
        ge=1,
        le=168,
    )
    model_name: Optional[str] = None


class DriftCheckRequest(BaseModel):
    """Request model for data drift check."""
    reference_data_size: int = Field(
        default=1000,
        description="Number of reference samples to use",
        ge=100,
    )
    current_data_size: int = Field(
        default=100,
        description="Number of current samples to compare",
        ge=10,
    )
    significance_level: float = Field(
        default=0.05,
        description="Statistical significance level",
        ge=0.01,
        le=0.1,
    )

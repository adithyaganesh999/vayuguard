"""
Input Validation Dependencies.

Provides FastAPI dependency injection functions for validating
input parameters and sanitizing requests.
"""

import logging
from typing import Optional
from fastapi import HTTPException, Query

logger = logging.getLogger(__name__)

# Supported cities with their configurations
SUPPORTED_CITIES = {
    "delhi": {"lat": 28.6139, "lon": 77.2090, "timezone": "Asia/Kolkata"},
    "mumbai": {"lat": 19.0760, "lon": 72.8777, "timezone": "Asia/Kolkata"},
    "bangalore": {"lat": 12.9716, "lon": 77.5946, "timezone": "Asia/Kolkata"},
    "chennai": {"lat": 13.0827, "lon": 80.2707, "timezone": "Asia/Kolkata"},
    "kolkata": {"lat": 22.5726, "lon": 88.3639, "timezone": "Asia/Kolkata"},
    "hyderabad": {"lat": 17.3850, "lon": 78.4867, "timezone": "Asia/Kolkata"},
    "pune": {"lat": 18.5204, "lon": 73.8567, "timezone": "Asia/Kolkata"},
    "ahmedabad": {"lat": 23.0225, "lon": 72.5714, "timezone": "Asia/Kolkata"},
    "jaipur": {"lat": 26.9124, "lon": 75.7873, "timezone": "Asia/Kolkata"},
    "lucknow": {"lat": 26.8467, "lon": 80.9462, "timezone": "Asia/Kolkata"},
}

# Available models
AVAILABLE_MODELS = [
    "persistence_lag1", "persistence_lag24",
    "sma_window24", "wma_window24",
    "prophet_aqi", "arima_aqi",
    "xgboost_aqi", "lstm_aqi", "gru_aqi",
    "ensemble_aqi",
]

# AQI category definitions
AQI_CATEGORIES = [
    {"min": 0, "max": 50, "label": "Good", "color": "#00e400"},
    {"min": 51, "max": 100, "label": "Moderate", "color": "#ffff00"},
    {"min": 101, "max": 150, "label": "Unhealthy for Sensitive", "color": "#ff7e00"},
    {"min": 151, "max": 200, "label": "Unhealthy", "color": "#ff0000"},
    {"min": 201, "max": 300, "label": "Very Unhealthy", "color": "#8f3f97"},
    {"min": 301, "max": 500, "label": "Hazardous", "color": "#7e0023"},
]


def get_aqi_category(aqi: float) -> dict:
    """
    Get the AQI category and color for a given AQI value.

    Args:
        aqi: AQI value.

    Returns:
        Dict with 'label' and 'color' keys.
    """
    for cat in AQI_CATEGORIES:
        if cat["min"] <= aqi <= cat["max"]:
            return {"label": cat["label"], "color": cat["color"]}
    return {"label": "Hazardous", "color": "#7e0023"}


def validate_city(city: str) -> str:
    """
    Validate and normalize a city name.

    Args:
        city: City name string.

    Returns:
        Normalized city name.

    Raises:
        HTTPException: If city is not supported.
    """
    normalized = city.strip().lower().replace(" ", "_")
    if normalized not in SUPPORTED_CITIES:
        logger.warning(f"Unsupported city requested: {city}")
        # Don't raise error — allow new cities but log warning
    return normalized


def validate_horizon(hours: int) -> int:
    """
    Validate forecast horizon.

    Args:
        hours: Number of hours to forecast.

    Returns:
        Validated hours value.

    Raises:
        HTTPException: If horizon is out of range.
    """
    if hours < 1 or hours > 168:
        raise HTTPException(
            status_code=400,
            detail=f"Forecast horizon must be between 1 and 168 hours, got {hours}",
        )
    return hours


def validate_model_name(model_name: Optional[str]) -> Optional[str]:
    """
    Validate model name if provided.

    Args:
        model_name: Optional model name string.

    Returns:
        Validated model name or None.

    Raises:
        HTTPException: If model name is not recognized.
    """
    if model_name is None:
        return None
    normalized = model_name.strip().lower()
    if normalized not in AVAILABLE_MODELS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model: {model_name}. Available: {AVAILABLE_MODELS}",
        )
    return normalized


def validate_aqi_value(aqi: float) -> float:
    """
    Validate an AQI value.

    Args:
        aqi: AQI value.

    Returns:
        Validated AQI value.

    Raises:
        HTTPException: If AQI is out of valid range.
    """
    if aqi < 0 or aqi > 500:
        raise HTTPException(
            status_code=400,
            detail=f"AQI must be between 0 and 500, got {aqi}",
        )
    return aqi


def get_city_config(city: str) -> dict:
    """Get configuration for a supported city."""
    return SUPPORTED_CITIES.get(city, {"lat": 0, "lon": 0, "timezone": "UTC"})


def get_health_risk_score(aqi: float, population_group: str = "general",
                           activity_level: str = "moderate") -> dict:
    """
    Calculate health risk score based on AQI and population sensitivity.

    Args:
        aqi: Current AQI value.
        population_group: Target population group.
        activity_level: Activity level.

    Returns:
        Risk assessment dict.
    """
    # Population sensitivity multipliers
    sensitivity = {
        "general": 1.0, "children": 1.3, "elderly": 1.4,
        "respiratory": 1.6, "athletes": 1.2,
    }

    # Activity exposure multipliers
    exposure = {
        "sedentary": 0.7, "light": 0.85, "moderate": 1.0, "heavy": 1.3,
    }

    # Base risk from AQI (0-100 scale)
    base_risk = min((aqi / 500) * 100, 100)

    # Adjusted risk
    adjusted_risk = base_risk * sensitivity.get(population_group, 1.0) * exposure.get(activity_level, 1.0)
    adjusted_risk = min(adjusted_risk, 100)

    # Risk level
    if adjusted_risk <= 20:
        level, color = "Low", "#00e400"
    elif adjusted_risk <= 40:
        level, color = "Moderate", "#ffff00"
    elif adjusted_risk <= 60:
        level, color = "High", "#ff7e00"
    elif adjusted_risk <= 80:
        level, color = "Very High", "#ff0000"
    else:
        level, color = "Extreme", "#7e0023"

    # Sensitive groups
    sensitive_groups = []
    if aqi > 50:
        sensitive_groups.append("People with respiratory conditions")
    if aqi > 100:
        sensitive_groups.extend(["Children", "Elderly"])
    if aqi > 150:
        sensitive_groups.extend(["Outdoor workers", "Athletes"])
    if aqi > 200:
        sensitive_groups.append("General population")

    return {
        "level": level,
        "score": round(adjusted_risk, 1),
        "color": color,
        "sensitive_groups": sensitive_groups,
    }


def get_recommendations(aqi: float, population_group: str = "general") -> list:
    """
    Generate health recommendations based on AQI level.

    Args:
        aqi: Current AQI value.
        population_group: Target population group.

    Returns:
        List of recommendation dicts.
    """
    recommendations = []

    if aqi <= 50:
        recommendations.append({"category": "outdoor", "message": "Air quality is good. Enjoy outdoor activities!", "priority": "low"})
    elif aqi <= 100:
        recommendations.append({"category": "outdoor", "message": "Moderate air quality. Sensitive individuals should limit prolonged outdoor exertion.", "priority": "medium"})
    elif aqi <= 150:
        recommendations.append({"category": "outdoor", "message": "Unhealthy for sensitive groups. Consider reducing outdoor activities.", "priority": "high"})
        recommendations.append({"category": "protection", "message": "Wear N95 mask if going outdoors.", "priority": "medium"})
    elif aqi <= 200:
        recommendations.append({"category": "outdoor", "message": "Unhealthy air quality. Avoid prolonged outdoor activities.", "priority": "high"})
        recommendations.append({"category": "protection", "message": "Wear N95 mask outdoors. Use air purifiers indoors.", "priority": "high"})
    elif aqi <= 300:
        recommendations.append({"category": "outdoor", "message": "Very unhealthy. Avoid all outdoor physical activities.", "priority": "high"})
        recommendations.append({"category": "health", "message": "Keep rescue medication accessible if you have asthma.", "priority": "high"})
    else:
        recommendations.append({"category": "emergency", "message": "Hazardous air quality. Stay indoors with windows closed.", "priority": "high"})
        recommendations.append({"category": "health", "message": "Seek medical attention if experiencing breathing difficulty.", "priority": "high"})

    # Population-specific
    if population_group in ("children", "elderly", "respiratory") and aqi > 50:
        recommendations.append({"category": "precaution", "message": f"Extra caution recommended for {population_group} group.", "priority": "high"})

    return recommendations

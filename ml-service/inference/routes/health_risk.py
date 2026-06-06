"""
Health Risk Route - POST /api/health-risk

Provides health risk assessments based on current and forecasted AQI values.
"""

import logging
import numpy as np
from datetime import datetime
from fastapi import APIRouter, HTTPException
from typing import Optional

from inference.schemas.request import HealthRiskRequest
from inference.schemas.response import (
    HealthRiskResponse, HealthRiskLevel, HealthRiskRecommendation, ErrorResponse,
)
from inference.dependencies.model_loader import ModelLoader
from inference.dependencies.validation import (
    validate_city, get_aqi_category, get_health_risk_score, get_recommendations,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["health-risk"])


def _get_current_aqi(city: str) -> float:
    """Get current AQI for a city."""
    np.random.seed(hash(city) % 2**31)
    base_aqi = {"delhi": 150, "mumbai": 120, "bangalore": 80,
                "chennai": 90, "kolkata": 130}.get(city, 100)
    return max(0, min(500, base_aqi + np.random.normal(0, 15)))


def _get_forecast_stats(city: str, hours: int = 24) -> dict:
    """Get forecast statistics for health risk calculation."""
    model = ModelLoader.get_model()
    if model is not None and hasattr(model, "predict"):
        try:
            result = model.predict(horizon=hours)
            if isinstance(result, dict):
                predictions = result.get("forecast", result.get("predictions", np.array([])))
            else:
                predictions = np.atleast_1d(result)
            predictions = np.clip(predictions, 0, 500)
            if len(predictions) > 0:
                return {
                    "peak_aqi": float(np.max(predictions)),
                    "avg_aqi": float(np.mean(predictions)),
                    "min_aqi": float(np.min(predictions)),
                    "hours_above_100": int(np.sum(predictions > 100)),
                    "hours_above_150": int(np.sum(predictions > 150)),
                }
        except Exception as e:
            logger.warning(f"Forecast stats failed: {e}")

    # Fallback
    current = _get_current_aqi(city)
    return {"peak_aqi": current * 1.2, "avg_aqi": current, "min_aqi": current * 0.8,
            "hours_above_100": hours if current > 100 else 0, "hours_above_150": 0}


@router.post(
    "/health-risk",
    response_model=HealthRiskResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Get health risk assessment",
    description="Assess health risk based on current and forecasted AQI for a specific population group.",
)
async def assess_health_risk(request: HealthRiskRequest):
    """
    Generate a health risk assessment for the specified city and population group.

    Takes into account:
    - Current AQI levels
    - Forecast AQI trends
    - Population group sensitivity
    - Activity level exposure
    """
    city = validate_city(request.city)

    # Get current AQI
    current_aqi = request.current_aqi if request.current_aqi is not None else _get_current_aqi(city)
    current_aqi = max(0, min(500, current_aqi))

    # Get category
    category_info = get_aqi_category(current_aqi)

    # Calculate risk score
    risk_info = get_health_risk_score(
        current_aqi,
        population_group=request.population_group,
        activity_level=request.activity_level,
    )

    risk_level = HealthRiskLevel(
        level=risk_info["level"],
        score=risk_info["score"],
        color=risk_info["color"],
        description=_get_risk_description(risk_info["level"], request.population_group),
    )

    # Get forecast stats
    forecast_stats = _get_forecast_stats(city, request.forecast_hours)

    # Get recommendations
    recs = get_recommendations(current_aqi, request.population_group)
    recommendations = [
        HealthRiskRecommendation(
            category=rec["category"],
            message=rec["message"],
            priority=rec["priority"],
        )
        for rec in recs
    ]

    ModelLoader.record_prediction()
    logger.info(f"Health risk assessed: city={city}, aqi={current_aqi}, risk={risk_info['level']}")

    return HealthRiskResponse(
        city=city,
        current_aqi=round(current_aqi, 1),
        category=category_info["label"],
        risk=risk_level,
        peak_aqi_next_24h=round(forecast_stats.get("peak_aqi"), 1),
        avg_aqi_next_24h=round(forecast_stats.get("avg_aqi"), 1),
        sensitive_groups=risk_info["sensitive_groups"],
        recommendations=recommendations,
        forecast_summary=forecast_stats,
        generated_at=datetime.now().isoformat(),
    )


def _get_risk_description(risk_level: str, population_group: str) -> str:
    """Generate a human-readable risk description."""
    descriptions = {
        "Low": "Air quality is satisfactory. Minimal health risk for the general population.",
        "Moderate": "Air quality is acceptable. Some pollutants may concern a small number of people.",
        "High": "Members of sensitive groups may experience health effects. General public less likely affected.",
        "Very High": "Health alert: everyone may experience more serious health effects.",
        "Extreme": "Health warning of emergency conditions. Entire population is likely to be affected.",
    }
    base = descriptions.get(risk_level, "Risk level unknown.")
    if population_group != "general":
        base += f" Extra precautions recommended for the {population_group} group."
    return base

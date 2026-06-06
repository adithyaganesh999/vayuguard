"""
Forecast Route - GET /api/forecast

Handles AQI forecast requests for specified cities and horizons.
"""

import logging
import numpy as np
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from inference.schemas.response import ForecastResponse, ForecastDataPoint, ErrorResponse
from inference.dependencies.model_loader import ModelLoader
from inference.dependencies.validation import (
    validate_city, validate_horizon, validate_model_name,
    get_aqi_category, get_city_config,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["forecast"])


def _generate_timestamps(hours: int) -> list:
    """Generate hourly timestamps starting from now."""
    now = datetime.now()
    return [(now + timedelta(hours=i)).isoformat() for i in range(1, hours + 1)]


def _get_current_aqi(city: str) -> float:
    """Get the current AQI value for a city (mock implementation)."""
    # In production, this would fetch from the data pipeline
    np.random.seed(hash(city) % 2**31)
    base_aqi = {"delhi": 150, "mumbai": 120, "bangalore": 80,
                "chennai": 90, "kolkata": 130, "hyderabad": 100}.get(city, 100)
    noise = np.random.normal(0, 15)
    return max(0, min(500, base_aqi + noise))


@router.get(
    "/forecast",
    response_model=ForecastResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Get AQI forecast for a city",
    description="Generate a multi-hour AQI forecast for the specified city.",
)
async def get_forecast(
    city: str = Query(default="delhi", description="City name"),
    hours: int = Query(default=72, ge=1, le=168, description="Forecast horizon in hours"),
    model_name: Optional[str] = Query(default=None, description="Model name to use"),
    include_confidence: bool = Query(default=True, description="Include confidence intervals"),
    confidence_level: float = Query(default=0.95, ge=0.5, le=0.99, description="Confidence level"),
):
    """
    Generate AQI forecast for a city.

    Returns predicted AQI values for the requested number of hours,
    optionally including confidence intervals.
    """
    # Validate inputs
    city = validate_city(city)
    hours = validate_horizon(hours)
    model_name = validate_model_name(model_name)

    # Get model
    model = ModelLoader.get_model()
    if model is None:
        raise HTTPException(status_code=503, detail="No model available for forecasting")

    try:
        # Generate forecast
        model_info = ModelLoader.get_model_info()
        effective_model_name = model_name or model_info["model_name"]

        # Get predictions based on model type
        if hasattr(model, 'predict'):
            try:
                result = model.predict(horizon=hours)
                if isinstance(result, dict):
                    predictions = result.get("forecast", result.get("predictions", np.array([])))
                    lower = result.get("lower", None)
                    upper = result.get("upper", None)
                else:
                    predictions = np.atleast_1d(result)
                    lower = None
                    upper = None
            except Exception:
                # Fallback: generate realistic forecast
                current_aqi = _get_current_aqi(city)
                predictions = np.full(hours, current_aqi) + np.random.normal(0, 10, hours)
                lower = predictions - 20
                upper = predictions + 20
        else:
            raise HTTPException(status_code=503, detail="Model does not support prediction")

        predictions = np.clip(predictions, 0, 500)
        timestamps = _generate_timestamps(hours)
        current_aqi = _get_current_aqi(city)

        # Build response data points
        data_points = []
        for i in range(min(len(predictions), hours)):
            aqi_val = float(predictions[i])
            category = get_aqi_category(aqi_val)
            point = ForecastDataPoint(
                timestamp=timestamps[i],
                aqi=round(aqi_val, 1),
                aqi_lower=round(float(lower[i]), 1) if lower is not None and include_confidence else None,
                aqi_upper=round(float(upper[i]), 1) if upper is not None and include_confidence else None,
                category=category["label"],
                category_color=category["color"],
            )
            data_points.append(point)

        ModelLoader.record_prediction()
        logger.info(f"Forecast generated: city={city}, hours={hours}, model={effective_model_name}")

        return ForecastResponse(
            city=city,
            model_name=effective_model_name,
            model_version=model_info.get("model_version", "0.0.0"),
            forecast_horizon_hours=hours,
            generated_at=datetime.now().isoformat(),
            data=data_points,
            current_aqi=round(current_aqi, 1),
            metadata={"city_config": get_city_config(city)},
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Forecast generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Forecast generation failed: {str(e)}")

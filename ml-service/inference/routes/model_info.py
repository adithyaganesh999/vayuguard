"""
Model Info Route - GET /api/model/version

Provides information about the currently loaded ML model,
including version, metrics, and feature importance.
"""

import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from inference.schemas.request import ModelInfoRequest
from inference.schemas.response import ModelInfoResponse, ModelListResponse, ModelMetrics, ErrorResponse
from inference.dependencies.model_loader import ModelLoader

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["model"])


@router.get(
    "/model/version",
    response_model=ModelInfoResponse,
    responses={500: {"model": ErrorResponse}},
    summary="Get current model information",
    description="Returns metadata about the currently loaded champion model.",
)
async def get_model_version(
    model_name: Optional[str] = Query(default=None, description="Specific model name"),
    include_feature_importance: bool = Query(default=False, description="Include feature importance"),
):
    """
    Get information about the active ML model.

    Returns model type, version, training metrics, and optionally
    feature importance data.
    """
    model_info = ModelLoader.get_model_info()
    model = ModelLoader.get_model()

    # Get training metrics from model if available
    training_metrics = None
    if model is not None and hasattr(model, "training_metrics"):
        tm = model.training_metrics
        training_metrics = ModelMetrics(
            mae=tm.get("mae"),
            rmse=tm.get("rmse"),
            r2=tm.get("r2"),
            mape=tm.get("mape"),
            cv_folds=tm.get("cv_folds"),
        )

    # Get feature importance if requested
    feature_importance = None
    if include_feature_importance and model is not None and hasattr(model, "get_feature_importance"):
        try:
            feature_importance = model.get_feature_importance(top_n=20)
        except Exception as e:
            logger.warning(f"Could not get feature importance: {e}")

    # Get hyperparameters if available
    hyperparams = {}
    if model is not None and hasattr(model, "get_info"):
        try:
            info = model.get_info()
            for key in ["lag_features", "rolling_windows", "hidden_size", "num_layers",
                         "order", "seasonal_order", "n_estimators", "max_depth"]:
                if key in info:
                    hyperparams[key] = info[key]
        except Exception:
            pass

    return ModelInfoResponse(
        model_name=model_info.get("model_name", "unknown"),
        model_type=model_info.get("model_type", "unknown"),
        model_version=model_info.get("model_version", "0.0.0"),
        fitted=model_info.get("is_fallback", True) is False,
        is_champion=True,
        trained_at=model_info.get("loaded_at"),
        training_metrics=training_metrics,
        hyperparameters=hyperparams,
        feature_importance=feature_importance,
        forecast_horizon=72,
    )


@router.get(
    "/model/list",
    response_model=ModelListResponse,
    summary="List available models",
    description="List all available models with their status.",
)
async def list_models():
    """List all available models and the current champion."""
    model_info = ModelLoader.get_model_info()

    # Champion model info
    champion = ModelInfoResponse(
        model_name=model_info.get("model_name", "unknown"),
        model_type=model_info.get("model_type", "unknown"),
        model_version=model_info.get("model_version", "0.0.0"),
        fitted=True,
        is_champion=True,
    )

    # Available model list (static for now, in production would read from registry)
    available = [
        ModelInfoResponse(
            model_name="persistence_lag1", model_type="persistence",
            model_version="1.0.0", fitted=True, is_champion=False, forecast_horizon=72,
        ),
        ModelInfoResponse(
            model_name="xgboost_aqi", model_type="xgboost",
            model_version="1.0.0", fitted=True, is_champion=model_info.get("model_name") == "xgboost_aqi",
            forecast_horizon=72,
        ),
        ModelInfoResponse(
            model_name="prophet_aqi", model_type="prophet",
            model_version="1.0.0", fitted=True, is_champion=False, forecast_horizon=72,
        ),
        ModelInfoResponse(
            model_name="lstm_aqi", model_type="lstm",
            model_version="1.0.0", fitted=True, is_champion=False, forecast_horizon=72,
        ),
    ]

    return ModelListResponse(
        champion_model=model_info.get("model_name"),
        available_models=available,
        total_models=len(available),
    )


@router.post(
    "/model/reload",
    summary="Reload champion model",
    description="Trigger a reload of the champion model from the registry.",
)
async def reload_model():
    """Reload the champion model from the model registry."""
    try:
        ModelLoader.load_champion()
        return {"status": "success", "message": "Model reloaded successfully",
                "model_info": ModelLoader.get_model_info()}
    except Exception as e:
        logger.error(f"Model reload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Model reload failed: {str(e)}")

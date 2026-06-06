"""
Model Loader - Load Champion Model on Startup.

Handles loading the champion ML model into memory at FastAPI startup,
with fallback strategies and model versioning support.
"""

import os
import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class ModelLoader:
    """
    Singleton model loader that manages the lifecycle of ML models.

    Features:
    - Loads champion model from registry on startup
    - Supports hot-swapping models without restart
    - Maintains model metadata for API responses
    - Fallback to baseline models if champion fails to load
    """

    _instance: Optional["ModelLoader"] = None
    _model = None
    _model_name: Optional[str] = None
    _model_type: Optional[str] = None
    _model_version: str = "0.0.0"
    _model_path: Optional[str] = None
    _registry: Dict[str, Any] = {}
    _loaded_at: Optional[datetime] = None
    _last_prediction_at: Optional[datetime] = None
    _prediction_count: int = 0

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    def load_champion(cls, artifact_dir: str = "./artifacts") -> None:
        """
        Load the champion model from the model registry.

        Args:
            artifact_dir: Base artifact directory.
        """
        registry_path = os.path.join(artifact_dir, "metadata", "model_registry.json")

        if os.path.exists(registry_path):
            with open(registry_path, "r") as f:
                cls._registry = json.load(f)
            champion = cls._registry.get("champion_model", {})
            cls._model_name = champion.get("name", "unknown")
            cls._model_path = champion.get("model_path")
            cls._model_version = champion.get("version", "0.0.0")
            logger.info(f"Found champion model: {cls._model_name}")
        else:
            logger.warning("No model registry found. Using fallback.")
            cls._model_name = "fallback_persistence"
            cls._model_type = "persistence"

        # Attempt to load the actual model
        if cls._model_path:
            try:
                cls._model = cls._load_model_from_path(cls._model_path, cls._model_type)
                logger.info(f"Champion model loaded successfully: {cls._model_name}")
            except Exception as e:
                logger.error(f"Failed to load champion model: {e}. Using fallback.")
                cls._model = None
                cls._model_name = "fallback_persistence"
                cls._model_type = "persistence"

        # Create fallback if needed
        if cls._model is None:
            cls._create_fallback_model()

        cls._loaded_at = datetime.now()
        logger.info(f"Model loader initialized: {cls._model_name} v{cls._model_version}")

    @classmethod
    def _load_model_from_path(cls, path: str, model_type: Optional[str]) -> Any:
        """Load a model from a file path based on its type."""
        import joblib

        if model_type == "xgboost":
            from models.classical.xgboost_model import XGBoostAQIModel
            return XGBoostAQIModel.load(path)
        elif model_type == "prophet":
            from models.classical.prophet_model import ProphetForecaster
            return ProphetForecaster.load(path)
        elif model_type in ("persistence", "sma", "wma"):
            return joblib.load(path + ".pkl") if os.path.exists(path + ".pkl") else None
        else:
            # Try loading as XGBoost (most common champion)
            from models.classical.xgboost_model import XGBoostAQIModel
            return XGBoostAQIModel.load(path)

    @classmethod
    def _create_fallback_model(cls) -> None:
        """Create a simple persistence model as fallback."""
        import numpy as np
        from models.baseline.persistence_model import PersistenceModel

        cls._model = PersistenceModel(seasonal_lag=1, name="fallback_persistence")
        # Fit with dummy data so it can serve predictions
        dummy_series = __import__("pandas").Series(
            np.random.normal(100, 30, 168),
            index=__import__("pandas").date_range("2024-01-01", periods=168, freq="h"),
        )
        cls._model.fit(dummy_series)
        cls._model_type = "persistence"
        cls._model_name = "fallback_persistence"
        logger.info("Fallback persistence model created")

    @classmethod
    def get_model(cls) -> Any:
        """Get the currently loaded model."""
        return cls._model

    @classmethod
    def get_model_info(cls) -> Dict[str, Any]:
        """Get metadata about the loaded model."""
        return {
            "model_name": cls._model_name,
            "model_type": cls._model_type,
            "model_version": cls._model_version,
            "model_path": cls._model_path,
            "loaded_at": cls._loaded_at.isoformat() if cls._loaded_at else None,
            "last_prediction_at": cls._last_prediction_at.isoformat() if cls._last_prediction_at else None,
            "prediction_count": cls._prediction_count,
            "is_fallback": cls._model_name == "fallback_persistence",
        }

    @classmethod
    def record_prediction(cls) -> None:
        """Record that a prediction was made."""
        cls._last_prediction_at = datetime.now()
        cls._prediction_count += 1

    @classmethod
    def swap_model(cls, model_path: str, model_name: str, model_type: str) -> bool:
        """
        Hot-swap the model without restarting the service.

        Args:
            model_path: Path to the new model.
            model_name: Name of the new model.
            model_type: Type of the new model.

        Returns:
            True if swap was successful.
        """
        try:
            new_model = cls._load_model_from_path(model_path, model_type)
            if new_model is not None:
                old_name = cls._model_name
                cls._model = new_model
                cls._model_name = model_name
                cls._model_type = model_type
                cls._loaded_at = datetime.now()
                logger.info(f"Model swapped: {old_name} -> {model_name}")
                return True
            return False
        except Exception as e:
            logger.error(f"Model swap failed: {e}")
            return False

    @classmethod
    def reset(cls) -> None:
        """Reset the singleton (useful for testing)."""
        cls._instance = None
        cls._model = None
        cls._model_name = None
        cls._model_type = None
        cls._model_version = "0.0.0"
        cls._model_path = None
        cls._registry = {}
        cls._loaded_at = None
        cls._last_prediction_at = None
        cls._prediction_count = 0

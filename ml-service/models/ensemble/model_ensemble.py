"""
Model Ensemble for AQI Forecasting.

Implements stacking and blending strategies to combine predictions
from multiple champion models. Ensembles often outperform individual
models by reducing variance and bias.
"""

import numpy as np
import pandas as pd
import logging
import joblib
import os
from typing import Optional, Dict, List
from sklearn.linear_model import RidgeCV
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

logger = logging.getLogger(__name__)


class ModelEnsemble:
    """
    Ensemble of AQI forecasting models using stacking or blending.

    Supports:
    - Simple averaging of model predictions
    - Weighted averaging with configurable weights
    - Stacking with a meta-learner (Ridge regression by default)
    - Dynamic weight adjustment based on recent performance
    """

    def __init__(
        self,
        models: Optional[Dict[str, object]] = None,
        weights: Optional[Dict[str, float]] = None,
        strategy: str = "stacking",
        meta_learner: Optional[object] = None,
        name: str = "ensemble",
    ):
        """
        Args:
            models: Dict mapping model names to fitted model objects.
            weights: Dict mapping model names to blend weights.
            strategy: 'average', 'weighted', 'stacking', or 'dynamic'.
            meta_learner: Sklearn-compatible model for stacking. Default: RidgeCV.
            name: Ensemble identifier.
        """
        self.models = models or {}
        self.weights = weights or {}
        self.strategy = strategy
        self.meta_learner = meta_learner or RidgeCV(alphas=np.logspace(-3, 3, 10))
        self.name = name
        self.fitted = False
        self.training_metrics: dict = {}
        self.model_performance: Dict[str, dict] = {}

    def add_model(self, name: str, model: object) -> None:
        """Add a model to the ensemble."""
        self.models[name] = model
        logger.info(f"Added model '{name}' to ensemble")

    def remove_model(self, name: str) -> None:
        """Remove a model from the ensemble."""
        if name in self.models:
            del self.models[name]
            self.weights.pop(name, None)
            logger.info(f"Removed model '{name}' from ensemble")

    def set_weights(self, weights: Dict[str, float]) -> None:
        """Set blending weights. Must sum to 1.0."""
        total = sum(weights.values())
        if abs(total - 1.0) > 1e-6:
            logger.warning(f"Weights sum to {total:.4f}, normalizing to 1.0")
            weights = {k: v / total for k, v in weights.items()}
        self.weights = weights

    def _get_model_predictions(self, model, y_history: pd.Series,
                                horizon: int, **kwargs) -> np.ndarray:
        """Extract predictions from a single model."""
        try:
            if hasattr(model, 'predict'):
                result = model.predict(horizon=horizon) if 'horizon' in model.predict.__code__.co_varnames else model.predict(y_history, **kwargs)
                if isinstance(result, dict):
                    return result.get("forecast", result.get("predictions", np.array(result.values()).flatten()))
                return np.atleast_1d(result)
        except Exception as e:
            logger.warning(f"Model prediction failed: {e}")
            return None

    def fit(self, y: pd.Series, X: Optional[pd.DataFrame] = None,
            horizon: int = 72, val_fraction: float = 0.2) -> "ModelEnsemble":
        """
        Fit the ensemble meta-learner on validation predictions.

        For stacking: trains the meta-learner on out-of-fold predictions.
        For other strategies: computes individual model metrics.

        Args:
            y: Target AQI series.
            X: Optional features.
            horizon: Forecast horizon.
            val_fraction: Fraction of data for validation.

        Returns:
            self
        """
        if not self.models:
            raise ValueError("No models in ensemble. Add models first.")

        # Split data for validation
        split_idx = int(len(y) * (1 - val_fraction))
        y_train = y.iloc[:split_idx]
        y_val = y.iloc[split_idx:]

        # Get predictions from each model on validation set
        val_predictions = {}
        for name, model in self.models.items():
            try:
                preds = self._get_model_predictions(model, y_train, horizon=min(horizon, len(y_val)))
                if preds is not None:
                    val_predictions[name] = preds
                    # Compute individual model metrics
                    actual = y_val.values[:len(preds)]
                    self.model_performance[name] = {
                        "mae": float(mean_absolute_error(actual, preds)),
                        "rmse": float(np.sqrt(mean_squared_error(actual, preds))),
                        "r2": float(r2_score(actual, preds)),
                    }
                    logger.info(f"Model '{name}': MAE={self.model_performance[name]['mae']:.2f}")
            except Exception as e:
                logger.warning(f"Could not get predictions from '{name}': {e}")

        if self.strategy == "stacking" and len(val_predictions) > 1:
            # Stack predictions as features for meta-learner
            min_len = min(len(p) for p in val_predictions.values())
            X_meta = np.column_stack([p[:min_len] for p in val_predictions.values()])
            y_meta = y_val.values[:min_len]
            self.meta_learner.fit(X_meta, y_meta)
            logger.info("Stacking meta-learner fitted")

        elif self.strategy == "weighted" and not self.weights:
            # Compute weights inversely proportional to MAE
            maes = {name: perf["mae"] for name, perf in self.model_performance.items()}
            inv_maes = {name: 1.0 / (mae + 1e-8) for name, mae in maes.items()}
            total = sum(inv_maes.values())
            self.weights = {name: inv / total for name, inv in inv_maes.items()}
            logger.info(f"Auto-computed weights: {self.weights}")

        elif self.strategy == "dynamic":
            logger.info("Dynamic strategy: weights will be computed at prediction time")

        self.fitted = True

        # Ensemble metrics on validation
        ensemble_preds = self.predict(y_train, horizon=min(horizon, len(y_val)))
        actual = y_val.values[:len(ensemble_preds)]
        self.training_metrics = {
            "mae": float(mean_absolute_error(actual, ensemble_preds)),
            "rmse": float(np.sqrt(mean_squared_error(actual, ensemble_preds))),
            "r2": float(r2_score(actual, ensemble_preds)),
            "strategy": self.strategy,
            "n_models": len(val_predictions),
        }
        logger.info(f"Ensemble ({self.strategy}): MAE={self.training_metrics['mae']:.2f}, "
                     f"RMSE={self.training_metrics['rmse']:.2f}")
        return self

    def predict(self, y_history: pd.Series, horizon: int = 72, **kwargs) -> np.ndarray:
        """
        Generate ensemble forecast.

        Args:
            y_history: Historical AQI values.
            horizon: Forecast horizon.

        Returns:
            Array of ensemble predicted AQI values.
        """
        if not self.fitted and self.strategy != "average":
            raise RuntimeError("Ensemble must be fit before prediction.")

        all_preds = {}
        for name, model in self.models.items():
            preds = self._get_model_predictions(model, y_history, horizon, **kwargs)
            if preds is not None:
                all_preds[name] = preds[:horizon]

        if not all_preds:
            raise RuntimeError("No models produced valid predictions.")

        min_len = min(len(p) for p in all_preds.values())

        if self.strategy == "average":
            return np.mean([p[:min_len] for p in all_preds.values()], axis=0)

        elif self.strategy == "weighted":
            result = np.zeros(min_len)
            for name, preds in all_preds.items():
                weight = self.weights.get(name, 0.0)
                result += weight * preds[:min_len]
            return result

        elif self.strategy == "stacking":
            X_meta = np.column_stack([p[:min_len] for p in all_preds.values()])
            return self.meta_learner.predict(X_meta)

        elif self.strategy == "dynamic":
            # Weight by inverse of recent MAE
            weights = {}
            for name in all_preds:
                mae = self.model_performance.get(name, {}).get("mae", 100)
                weights[name] = 1.0 / (mae + 1e-8)
            total = sum(weights.values())
            weights = {k: v / total for k, v in weights.items()}
            result = np.zeros(min_len)
            for name, preds in all_preds.items():
                result += weights[name] * preds[:min_len]
            return result

        return np.mean([p[:min_len] for p in all_preds.values()], axis=0)

    def get_model_ranking(self) -> List[Dict]:
        """Return models ranked by validation MAE."""
        ranking = []
        for name, perf in self.model_performance.items():
            ranking.append({"name": name, **perf})
        return sorted(ranking, key=lambda x: x["mae"])

    def save(self, path: str) -> None:
        """Save ensemble config and meta-learner."""
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        state = {
            "strategy": self.strategy, "name": self.name,
            "weights": self.weights, "fitted": self.fitted,
            "training_metrics": self.training_metrics,
            "model_performance": self.model_performance,
            "model_names": list(self.models.keys()),
        }
        joblib.dump(state, path + "_config")
        if self.strategy == "stacking" and self.fitted:
            joblib.dump(self.meta_learner, path + "_meta")

    @classmethod
    def load(cls, path: str) -> "ModelEnsemble":
        """Load ensemble from disk."""
        state = joblib.load(path + "_config")
        ensemble = cls(strategy=state["strategy"], name=state["name"])
        ensemble.weights = state.get("weights", {})
        ensemble.fitted = state["fitted"]
        ensemble.training_metrics = state.get("training_metrics", {})
        ensemble.model_performance = state.get("model_performance", {})
        if ensemble.strategy == "stacking" and ensemble.fitted:
            ensemble.meta_learner = joblib.load(path + "_meta")
        return ensemble

    def get_info(self) -> dict:
        return {
            "model_type": "ensemble", "name": self.name,
            "strategy": self.strategy, "fitted": self.fitted,
            "n_models": len(self.models),
            "model_names": list(self.models.keys()),
            "weights": self.weights,
            "training_metrics": self.training_metrics,
        }

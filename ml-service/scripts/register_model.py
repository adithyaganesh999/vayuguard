"""
Register Model in Model Registry.

Adds a trained model to the model registry with metadata,
metrics, and promotion status.
"""

import argparse
import json
import logging
import os
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


class ModelRegistry:
    """
    Model registry for tracking trained models and their metadata.

    Maintains a JSON-based registry that tracks:
    - Current champion model
    - Archived models with promotion history
    - Model metadata (name, type, version, metrics, path)
    - Promotion/demotion timestamps
    """

    def __init__(self, registry_path: str = "./artifacts/metadata/model_registry.json"):
        """
        Args:
            registry_path: Path to the model registry JSON file.
        """
        self.registry_path = registry_path
        self.registry = self._load_registry()

    def _load_registry(self) -> dict:
        """Load the registry from disk."""
        if os.path.exists(self.registry_path):
            with open(self.registry_path, "r") as f:
                return json.load(f)
        return {"champion_model": None, "archived_models": [], "models": {}}

    def _save_registry(self) -> None:
        """Save the registry to disk."""
        os.makedirs(os.path.dirname(self.registry_path), exist_ok=True)
        self.registry["last_updated"] = datetime.now().isoformat()
        with open(self.registry_path, "w") as f:
            json.dump(self.registry, f, indent=2, default=str)
        logger.info(f"Registry saved to {self.registry_path}")

    def register_model(
        self,
        name: str,
        model_type: str,
        version: str,
        model_path: str,
        metrics: dict,
        hyperparameters: dict = None,
        description: str = "",
        promote: bool = False,
    ) -> dict:
        """
        Register a new model in the registry.

        Args:
            name: Model name.
            model_type: Type of model (xgboost, prophet, lstm, etc.).
            version: Model version string.
            model_path: Path to the model artifacts.
            metrics: Dict of model performance metrics.
            hyperparameters: Dict of model hyperparameters.
            description: Human-readable description.
            promote: Whether to promote as champion immediately.

        Returns:
            Registration result dict.
        """
        model_entry = {
            "name": name,
            "model_type": model_type,
            "version": version,
            "model_path": model_path,
            "metrics": metrics,
            "hyperparameters": hyperparameters or {},
            "description": description,
            "registered_at": datetime.now().isoformat(),
            "status": "registered",
        }

        self.registry["models"][name] = model_entry
        logger.info(f"Registered model: {name} v{version}")

        if promote:
            self.promote_model(name)

        self._save_registry()
        return model_entry

    def promote_model(self, name: str) -> bool:
        """
        Promote a model to champion status.

        Args:
            name: Name of the model to promote.

        Returns:
            True if promotion was successful.
        """
        if name not in self.registry["models"]:
            logger.error(f"Model '{name}' not found in registry")
            return False

        # Archive current champion
        if self.registry["champion_model"]:
            archived = self.registry["champion_model"].copy()
            archived["demoted_at"] = datetime.now().isoformat()
            archived["demotion_reason"] = f"Replaced by {name}"
            self.registry["archived_models"].append(archived)

        # Promote new champion
        model = self.registry["models"][name]
        self.registry["champion_model"] = {
            **model,
            "promoted_at": datetime.now().isoformat(),
        }
        logger.info(f"Model '{name}' promoted to champion")
        self._save_registry()
        return True

    def archive_model(self, name: str) -> bool:
        """
        Archive a model (remove from active but keep history).

        Args:
            name: Model name to archive.

        Returns:
            True if archival was successful.
        """
        if name not in self.registry["models"]:
            return False

        model = self.registry["models"].pop(name)
        model["archived_at"] = datetime.now().isoformat()
        self.registry["archived_models"].append(model)
        logger.info(f"Model '{name}' archived")
        self._save_registry()
        return True

    def get_champion(self) -> dict:
        """Get the current champion model info."""
        return self.registry.get("champion_model", {})

    def get_model(self, name: str) -> dict:
        """Get a specific model's info."""
        return self.registry["models"].get(name, {})

    def list_models(self) -> list:
        """List all registered models."""
        return list(self.registry["models"].keys())

    def compare_models(self) -> list:
        """
        Compare all models by their metrics.

        Returns:
            List of models sorted by MAE (ascending).
        """
        models = []
        for name, entry in self.registry["models"].items():
            metrics = entry.get("metrics", {})
            models.append({
                "name": name,
                "type": entry.get("model_type"),
                "version": entry.get("version"),
                "mae": metrics.get("mae", float("inf")),
                "rmse": metrics.get("rmse", float("inf")),
                "r2": metrics.get("r2", 0),
            })

        return sorted(models, key=lambda x: x["mae"])

    def get_registry_summary(self) -> dict:
        """Get a summary of the registry state."""
        return {
            "total_models": len(self.registry["models"]),
            "champion": self.registry.get("champion_model", {}).get("name"),
            "archived_count": len(self.registry.get("archived_models", [])),
            "last_updated": self.registry.get("last_updated"),
            "model_names": list(self.registry["models"].keys()),
        }


def main():
    parser = argparse.ArgumentParser(description="Register a model in the VayuGuard model registry")
    parser.add_argument("--name", type=str, required=True, help="Model name")
    parser.add_argument("--type", type=str, required=True, help="Model type")
    parser.add_argument("--version", type=str, default="1.0.0")
    parser.add_argument("--path", type=str, required=True, help="Path to model artifacts")
    parser.add_argument("--mae", type=float, required=True, help="Model MAE")
    parser.add_argument("--rmse", type=float, required=True, help="Model RMSE")
    parser.add_argument("--r2", type=float, default=0.0, help="Model R2 score")
    parser.add_argument("--description", type=str, default="")
    parser.add_argument("--promote", action="store_true", help="Promote to champion")
    parser.add_argument("--registry-path", type=str, default="./artifacts/metadata/model_registry.json")
    args = parser.parse_args()

    registry = ModelRegistry(registry_path=args.registry_path)

    result = registry.register_model(
        name=args.name,
        model_type=args.type,
        version=args.version,
        model_path=args.path,
        metrics={"mae": args.mae, "rmse": args.rmse, "r2": args.r2},
        description=args.description,
        promote=args.promote,
    )

    print(f"Model registered: {result['name']} v{result['version']}")
    if args.promote:
        print(f"Model promoted to champion!")
    print(f"Registry: {registry.get_registry_summary()}")


if __name__ == "__main__":
    main()

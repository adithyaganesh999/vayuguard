"""
Train XGBoost Model with Cross-Validation.

Trains XGBoost AQI forecasting model using time-series cross-validation,
performs hyperparameter tuning, and saves the best model.
"""

import argparse
import logging
import os
import sys
import json
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.classical.xgboost_model import XGBoostAQIModel
from feature_pipeline.feature_store import FeatureStore

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def train_xgboost(
    df: pd.DataFrame,
    n_estimators: int = 500,
    max_depth: int = 6,
    learning_rate: float = 0.05,
    subsample: float = 0.8,
    colsample_bytree: float = 0.8,
    cv_folds: int = 5,
    test_fraction: float = 0.2,
    horizon: int = 72,
    artifact_dir: str = "./artifacts/models/xgboost",
) -> dict:
    """
    Train XGBoost model with cross-validation and evaluation.

    Args:
        df: DataFrame with 'aqi' column and optional weather columns.
        n_estimators: Number of boosting rounds.
        max_depth: Maximum tree depth.
        learning_rate: Step size shrinkage.
        subsample: Subsample ratio.
        colsample_bytree: Column subsample ratio.
        cv_folds: Number of CV folds.
        test_fraction: Test set fraction.
        horizon: Forecast horizon.
        artifact_dir: Model save directory.

    Returns:
        Training results dict.
    """
    weather_cols = [col for col in df.columns if col != "aqi"]
    logger.info(f"Training XGBoost with {len(weather_cols)} weather features")

    # Split data
    split_idx = int(len(df) * (1 - test_fraction))
    df_train = df.iloc[:split_idx]
    df_test = df.iloc[split_idx:]

    y_train = df_train["aqi"]
    y_test = df_test["aqi"]
    X_train_weather = df_train[weather_cols] if weather_cols else None
    X_test_weather = df_test[weather_cols] if weather_cols else None

    # Train model
    model = XGBoostAQIModel(
        n_estimators=n_estimators,
        max_depth=max_depth,
        learning_rate=learning_rate,
        subsample=subsample,
        colsample_bytree=colsample_bytree,
        name="xgboost_aqi",
    )

    model.fit(y_train, X_train_weather, cv_folds=cv_folds)

    # Evaluate on test set
    predictions = model.predict(y_train, X_test_weather, horizon=horizon)
    actual = y_test.values[:horizon]
    min_len = min(len(predictions), len(actual))

    test_metrics = {
        "mae": float(mean_absolute_error(actual[:min_len], predictions[:min_len])),
        "rmse": float(np.sqrt(mean_squared_error(actual[:min_len], predictions[:min_len]))),
        "r2": float(r2_score(actual[:min_len], predictions[:min_len])),
    }

    logger.info(f"XGBoost test metrics: MAE={test_metrics['mae']:.2f}, "
                 f"RMSE={test_metrics['rmse']:.2f}, R2={test_metrics['r2']:.3f}")

    # Feature importance
    feature_importance = model.get_feature_importance(top_n=20)

    # Save model
    os.makedirs(artifact_dir, exist_ok=True)
    model_path = os.path.join(artifact_dir, "xgboost_aqi")
    model.save(model_path)

    result = {
        "model_type": "xgboost",
        "model_name": "xgboost_aqi",
        "hyperparameters": {
            "n_estimators": n_estimators, "max_depth": max_depth,
            "learning_rate": learning_rate, "subsample": subsample,
            "colsample_bytree": colsample_bytree,
        },
        "test_metrics": test_metrics,
        "cv_metrics": model.cv_metrics,
        "training_metrics": model.training_metrics,
        "feature_importance": feature_importance,
        "horizon": horizon,
        "train_samples": len(y_train),
        "test_samples": len(y_test),
        "trained_at": datetime.now().isoformat(),
        "model_path": model_path,
    }

    results_path = os.path.join(artifact_dir, "xgboost_results.json")
    with open(results_path, "w") as f:
        json.dump(result, f, indent=2, default=str)

    return result


def hyperparameter_search(df: pd.DataFrame, artifact_dir: str) -> dict:
    """
    Grid search over XGBoost hyperparameters.

    Args:
        df: Training DataFrame.
        artifact_dir: Save directory.

    Returns:
        Best model results.
    """
    param_grid = {
        "max_depth": [4, 6, 8],
        "learning_rate": [0.01, 0.05, 0.1],
        "n_estimators": [300, 500, 800],
        "subsample": [0.7, 0.8, 0.9],
    }

    best_mae = float("inf")
    best_result = None

    for md in param_grid["max_depth"]:
        for lr in param_grid["learning_rate"]:
            for ne in param_grid["n_estimators"]:
                for ss in param_grid["subsample"]:
                    logger.info(f"Trying: depth={md}, lr={lr}, n_est={ne}, subsample={ss}")
                    try:
                        result = train_xgboost(
                            df, n_estimators=ne, max_depth=md,
                            learning_rate=lr, subsample=ss,
                            artifact_dir=artifact_dir, cv_folds=3,
                        )
                        if result["test_metrics"]["mae"] < best_mae:
                            best_mae = result["test_metrics"]["mae"]
                            best_result = result
                            logger.info(f"New best MAE: {best_mae:.2f}")
                    except Exception as e:
                        logger.warning(f"Failed: {e}")

    logger.info(f"Best XGBoost: MAE={best_mae:.2f}")
    return best_result


def main():
    parser = argparse.ArgumentParser(description="Train XGBoost AQI forecasting model")
    parser.add_argument("--city", type=str, default="delhi")
    parser.add_argument("--data-dir", type=str, default="./data")
    parser.add_argument("--artifact-dir", type=str, default="./artifacts/models/xgboost")
    parser.add_argument("--horizon", type=int, default=72)
    parser.add_argument("--n-estimators", type=int, default=500)
    parser.add_argument("--max-depth", type=int, default=6)
    parser.add_argument("--learning-rate", type=float, default=0.05)
    parser.add_argument("--cv-folds", type=int, default=5)
    parser.add_argument("--tune", action="store_true", help="Run hyperparameter search")
    args = parser.parse_args()

    store = FeatureStore(data_dir=args.data_dir, default_city=args.city)
    df = store.get_training_data(city=args.city, include_weather=True)

    if args.tune:
        result = hyperparameter_search(df, args.artifact_dir)
    else:
        result = train_xgboost(
            df, n_estimators=args.n_estimators, max_depth=args.max_depth,
            learning_rate=args.learning_rate, cv_folds=args.cv_folds,
            horizon=args.horizon, artifact_dir=args.artifact_dir,
        )

    logger.info(f"\nXGBoost training complete. Test MAE={result['test_metrics']['mae']:.2f}")


if __name__ == "__main__":
    main()

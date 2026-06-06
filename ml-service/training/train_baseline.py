"""
Train Baseline Models (Persistence & Moving Average).

Trains persistence and moving average models on historical AQI data,
evaluates their performance, and saves the trained models to disk.
These serve as the benchmark that all other models must beat.
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

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.baseline.persistence_model import PersistenceModel
from models.baseline.moving_average import MovingAverageModel, WeightedMovingAverageModel
from feature_pipeline.feature_store import FeatureStore

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def evaluate_model(model, y_test: pd.Series, horizon: int = 72) -> dict:
    """
    Evaluate a model on test data using walk-forward validation.

    Args:
        model: Fitted model with predict method.
        y_test: Test AQI series.
        horizon: Forecast horizon.

    Returns:
        Dict of evaluation metrics.
    """
    predictions = model.predict(horizon=horizon)
    actual = y_test.values[:horizon]
    min_len = min(len(predictions), len(actual))
    predictions = predictions[:min_len]
    actual = actual[:min_len]

    mae = mean_absolute_error(actual, predictions)
    rmse = np.sqrt(mean_squared_error(actual, predictions))
    r2 = r2_score(actual, predictions)
    mape = np.mean(np.abs((actual - predictions) / (actual + 1e-8))) * 100

    return {
        "mae": float(mae),
        "rmse": float(rmse),
        "r2": float(r2),
        "mape": float(mape),
        "horizon": horizon,
    }


def train_persistence_models(y_train: pd.Series, y_test: pd.Series,
                              artifact_dir: str) -> dict:
    """
    Train persistence models with different seasonal lags.

    Args:
        y_train: Training AQI series.
        y_test: Test AQI series.
        artifact_dir: Directory to save models.

    Returns:
        Dict of model results.
    """
    results = {}
    seasonal_lags = [1, 24, 168]  # Last hour, same hour yesterday, same hour last week

    for lag in seasonal_lags:
        model_name = f"persistence_lag{lag}"
        logger.info(f"Training {model_name}...")

        model = PersistenceModel(seasonal_lag=lag, name=model_name)
        model.fit(y_train)

        # Evaluate
        metrics = evaluate_model(model, y_test)
        results[model_name] = {
            "model_type": "persistence",
            "seasonal_lag": lag,
            "metrics": metrics,
            "training_metrics": model.training_metrics,
        }

        # Save model
        save_path = os.path.join(artifact_dir, f"{model_name}.pkl")
        model.save(save_path)
        logger.info(f"{model_name}: MAE={metrics['mae']:.2f}, RMSE={metrics['rmse']:.2f}")

    return results


def train_moving_average_models(y_train: pd.Series, y_test: pd.Series,
                                 artifact_dir: str) -> dict:
    """
    Train moving average models with different window sizes.

    Args:
        y_train: Training AQI series.
        y_test: Test AQI series.
        artifact_dir: Directory to save models.

    Returns:
        Dict of model results.
    """
    results = {}
    windows = [6, 12, 24, 48, 168]

    for window in windows:
        # Simple Moving Average
        model_name = f"sma_window{window}"
        logger.info(f"Training {model_name}...")

        model = MovingAverageModel(window=window, name=model_name)
        model.fit(y_train)

        metrics = evaluate_model(model, y_test)
        results[model_name] = {
            "model_type": "sma",
            "window": window,
            "metrics": metrics,
            "training_metrics": model.training_metrics,
        }

        save_path = os.path.join(artifact_dir, f"{model_name}.pkl")
        model.save(save_path)
        logger.info(f"{model_name}: MAE={metrics['mae']:.2f}, RMSE={metrics['rmse']:.2f}")

        # Weighted Moving Average
        model_name = f"wma_window{window}"
        logger.info(f"Training {model_name}...")

        model = WeightedMovingAverageModel(window=window, name=model_name)
        model.fit(y_train)

        metrics = evaluate_model(model, y_test)
        results[model_name] = {
            "model_type": "wma",
            "window": window,
            "metrics": metrics,
            "training_metrics": model.training_metrics,
        }

        save_path = os.path.join(artifact_dir, f"{model_name}.pkl")
        model.save(save_path)
        logger.info(f"{model_name}: MAE={metrics['mae']:.2f}, RMSE={metrics['rmse']:.2f}")

    return results


def main():
    parser = argparse.ArgumentParser(description="Train baseline AQI forecasting models")
    parser.add_argument("--city", type=str, default="delhi", help="City for training")
    parser.add_argument("--data-dir", type=str, default="./data", help="Data directory")
    parser.add_argument("--artifact-dir", type=str, default="./artifacts/models/baseline",
                        help="Artifact save directory")
    parser.add_argument("--horizon", type=int, default=72, help="Forecast horizon in hours")
    parser.add_argument("--test-fraction", type=float, default=0.2, help="Test set fraction")
    args = parser.parse_args()

    logger.info(f"Training baseline models for {args.city}")

    # Load data
    store = FeatureStore(data_dir=args.data_dir, default_city=args.city)
    df = store.get_training_data(city=args.city)

    # Split into train/test
    split_idx = int(len(df) * (1 - args.test_fraction))
    y_train = df["aqi"].iloc[:split_idx]
    y_test = df["aqi"].iloc[split_idx:]

    logger.info(f"Train: {len(y_train)} samples, Test: {len(y_test)} samples")

    # Create artifact directory
    os.makedirs(args.artifact_dir, exist_ok=True)

    # Train all baseline models
    all_results = {}

    persistence_results = train_persistence_models(y_train, y_test, args.artifact_dir)
    all_results.update(persistence_results)

    ma_results = train_moving_average_models(y_train, y_test, args.artifact_dir)
    all_results.update(ma_results)

    # Save results summary
    results_path = os.path.join(args.artifact_dir, "baseline_results.json")
    with open(results_path, "w") as f:
        json.dump(all_results, f, indent=2, default=str)

    # Print leaderboard
    logger.info("\n" + "=" * 60)
    logger.info("BASELINE MODEL LEADERBOARD")
    logger.info("=" * 60)
    leaderboard = sorted(all_results.items(), key=lambda x: x[1]["metrics"]["mae"])
    for rank, (name, result) in enumerate(leaderboard, 1):
        metrics = result["metrics"]
        logger.info(f"  #{rank} {name}: MAE={metrics['mae']:.2f}, RMSE={metrics['rmse']:.2f}, "
                     f"R2={metrics['r2']:.3f}")

    logger.info(f"\nResults saved to {results_path}")


if __name__ == "__main__":
    main()

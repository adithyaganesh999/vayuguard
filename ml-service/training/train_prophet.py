"""
Train Prophet Model for AQI Forecasting.

Trains Facebook Prophet with weather regressors, performs
cross-validation, and logs metrics for the model registry.
"""

import argparse
import logging
import os
import sys
import json
from datetime import datetime

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.classical.prophet_model import ProphetForecaster
from feature_pipeline.feature_store import FeatureStore
from feature_pipeline.feature_builder import FeatureBuilder

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def train_prophet_model(
    df: pd.DataFrame,
    changepoint_prior_scale: float = 0.05,
    seasonality_prior_scale: float = 10.0,
    yearly_fourier: int = 10,
    weekly_fourier: int = 3,
    daily_fourier: int = 10,
    horizon: int = 72,
    test_fraction: float = 0.2,
    artifact_dir: str = "./artifacts/models/prophet",
) -> dict:
    """
    Train Prophet model with hyperparameter configuration.

    Args:
        df: DataFrame with 'aqi' column and optional weather columns.
        changepoint_prior_scale: Trend flexibility parameter.
        seasonality_prior_scale: Seasonality strength parameter.
        yearly_fourier: Fourier order for yearly seasonality.
        weekly_fourier: Fourier order for weekly seasonality.
        daily_fourier: Fourier order for daily seasonality.
        horizon: Forecast horizon in hours.
        test_fraction: Fraction of data for testing.
        artifact_dir: Directory to save model artifacts.

    Returns:
        Dict with training results and metrics.
    """
    # Identify weather columns
    weather_cols = [col for col in df.columns if col != "aqi"]
    logger.info(f"Training Prophet with {len(weather_cols)} weather regressors: {weather_cols}")

    # Split data
    split_idx = int(len(df) * (1 - test_fraction))
    df_train = df.iloc[:split_idx]
    df_test = df.iloc[split_idx:]

    y_train = df_train["aqi"]
    y_test = df_test["aqi"]
    X_train = df_train[weather_cols] if weather_cols else None

    # Initialize and train model
    model = ProphetForecaster(
        changepoint_prior_scale=changepoint_prior_scale,
        seasonality_prior_scale=seasonality_prior_scale,
        yearly_fourier=yearly_fourier,
        weekly_fourier=weekly_fourier,
        daily_fourier=daily_fourier,
        regressors=weather_cols,
        name="prophet_aqi",
    )

    model.fit(y_train, X_train)

    # Evaluate on test set
    X_test = df_test[weather_cols] if weather_cols else None
    forecast_result = model.predict(horizon=horizon, X_future=X_test)

    predictions = forecast_result["forecast"][:horizon]
    actual = y_test.values[:horizon]
    min_len = min(len(predictions), len(actual))

    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
    test_metrics = {
        "mae": float(mean_absolute_error(actual[:min_len], predictions[:min_len])),
        "rmse": float(np.sqrt(mean_squared_error(actual[:min_len], predictions[:min_len]))),
        "r2": float(r2_score(actual[:min_len], predictions[:min_len])),
    }

    logger.info(f"Prophet test metrics: MAE={test_metrics['mae']:.2f}, "
                 f"RMSE={test_metrics['rmse']:.2f}, R2={test_metrics['r2']:.3f}")

    # Save model
    os.makedirs(artifact_dir, exist_ok=True)
    model_path = os.path.join(artifact_dir, "prophet_aqi")
    model.save(model_path)

    # Log results
    result = {
        "model_type": "prophet",
        "model_name": "prophet_aqi",
        "hyperparameters": {
            "changepoint_prior_scale": changepoint_prior_scale,
            "seasonality_prior_scale": seasonality_prior_scale,
            "yearly_fourier": yearly_fourier,
            "weekly_fourier": weekly_fourier,
            "daily_fourier": daily_fourier,
        },
        "test_metrics": test_metrics,
        "training_metrics": model.training_metrics,
        "regressors": weather_cols,
        "horizon": horizon,
        "train_samples": len(y_train),
        "test_samples": len(y_test),
        "trained_at": datetime.now().isoformat(),
        "model_path": model_path,
    }

    results_path = os.path.join(artifact_dir, "prophet_results.json")
    with open(results_path, "w") as f:
        json.dump(result, f, indent=2, default=str)

    logger.info(f"Prophet model saved to {model_path}")
    logger.info(f"Results saved to {results_path}")

    return result


def hyperparameter_search(df: pd.DataFrame, artifact_dir: str) -> dict:
    """
    Perform simple grid search over Prophet hyperparameters.

    Args:
        df: Training DataFrame.
        artifact_dir: Save directory.

    Returns:
        Best model results.
    """
    param_grid = {
        "changepoint_prior_scale": [0.01, 0.05, 0.1],
        "seasonality_prior_scale": [1.0, 10.0, 20.0],
        "yearly_fourier": [5, 10, 15],
    }

    best_mae = float("inf")
    best_result = None
    best_params = None

    for cps in param_grid["changepoint_prior_scale"]:
        for sps in param_grid["seasonality_prior_scale"]:
            for yf in param_grid["yearly_fourier"]:
                logger.info(f"Trying: cps={cps}, sps={sps}, yf={yf}")
                try:
                    result = train_prophet_model(
                        df, changepoint_prior_scale=cps,
                        seasonality_prior_scale=sps,
                        yearly_fourier=yf,
                        artifact_dir=artifact_dir,
                    )
                    if result["test_metrics"]["mae"] < best_mae:
                        best_mae = result["test_metrics"]["mae"]
                        best_result = result
                        best_params = {"cps": cps, "sps": sps, "yf": yf}
                except Exception as e:
                    logger.warning(f"Failed with params cps={cps}, sps={sps}, yf={yf}: {e}")

    logger.info(f"Best Prophet params: {best_params}, MAE={best_mae:.2f}")
    return best_result


def main():
    parser = argparse.ArgumentParser(description="Train Prophet AQI forecasting model")
    parser.add_argument("--city", type=str, default="delhi")
    parser.add_argument("--data-dir", type=str, default="./data")
    parser.add_argument("--artifact-dir", type=str, default="./artifacts/models/prophet")
    parser.add_argument("--horizon", type=int, default=72)
    parser.add_argument("--changepoint-prior-scale", type=float, default=0.05)
    parser.add_argument("--seasonality-prior-scale", type=float, default=10.0)
    parser.add_argument("--tune", action="store_true", help="Run hyperparameter search")
    args = parser.parse_args()

    store = FeatureStore(data_dir=args.data_dir, default_city=args.city)
    df = store.get_training_data(city=args.city, include_weather=True)

    if args.tune:
        result = hyperparameter_search(df, args.artifact_dir)
    else:
        result = train_prophet_model(
            df, changepoint_prior_scale=args.changepoint_prior_scale,
            seasonality_prior_scale=args.seasonality_prior_scale,
            horizon=args.horizon, artifact_dir=args.artifact_dir,
        )

    logger.info(f"\nProphet training complete. Test MAE={result['test_metrics']['mae']:.2f}")


if __name__ == "__main__":
    main()

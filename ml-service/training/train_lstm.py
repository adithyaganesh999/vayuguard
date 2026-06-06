"""
Train LSTM Model with Grid Search.

Trains LSTM/GRU models for AQI forecasting with hyperparameter
grid search and early stopping.
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

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.deep.lstm_model import LSTMAQIModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def train_lstm(
    df: pd.DataFrame,
    hidden_size: int = 128,
    num_layers: int = 2,
    dropout: float = 0.2,
    cell_type: str = "lstm",
    lookback_window: int = 168,
    forecast_horizon: int = 72,
    test_fraction: float = 0.2,
    artifact_dir: str = "./artifacts/models/lstm",
) -> dict:
    """
    Train LSTM/GRU model for AQI forecasting.

    Args:
        df: DataFrame with 'aqi' column.
        hidden_size: Hidden state dimension.
        num_layers: Number of recurrent layers.
        dropout: Dropout rate.
        cell_type: 'lstm' or 'gru'.
        lookback_window: Input sequence length.
        forecast_horizon: Output sequence length.
        test_fraction: Test set fraction.
        artifact_dir: Model save directory.

    Returns:
        Training results dict.
    """
    weather_cols = [col for col in df.columns if col != "aqi"]
    input_size = 1 + len(weather_cols)
    logger.info(f"Training {cell_type.upper()} model: hidden={hidden_size}, "
                 f"layers={num_layers}, lookback={lookback_window}, horizon={forecast_horizon}")

    # Split data
    split_idx = int(len(df) * (1 - test_fraction))
    df_train = df.iloc[:split_idx]
    df_test = df.iloc[split_idx:]

    y_train = df_train["aqi"]
    y_test = df_test["aqi"]
    X_train_weather = df_train[weather_cols] if weather_cols else None

    # Build and train model
    model = LSTMAQIModel(
        input_size=input_size,
        hidden_size=hidden_size,
        num_layers=num_layers,
        forecast_horizon=forecast_horizon,
        lookback_window=lookback_window,
        dropout=dropout,
        cell_type=cell_type,
        name=f"{cell_type}_aqi",
    )

    model.fit(y_train, X_train_weather)

    # Evaluate
    y_history = y_train.iloc[-lookback_window:] if len(y_train) >= lookback_window else y_train
    predictions = model.predict(y_history)
    actual = y_test.values[:forecast_horizon]
    min_len = min(len(predictions), len(actual))

    test_metrics = {
        "mae": float(mean_absolute_error(actual[:min_len], predictions[:min_len])),
        "rmse": float(np.sqrt(mean_squared_error(actual[:min_len], predictions[:min_len]))),
        "r2": float(r2_score(actual[:min_len], predictions[:min_len])),
    }

    logger.info(f"LSTM test metrics: MAE={test_metrics['mae']:.2f}, "
                 f"RMSE={test_metrics['rmse']:.2f}, R2={test_metrics['r2']:.3f}")

    # Save model
    os.makedirs(artifact_dir, exist_ok=True)
    model_path = os.path.join(artifact_dir, f"{cell_type}_aqi")
    model.save(model_path)

    result = {
        "model_type": cell_type,
        "model_name": f"{cell_type}_aqi",
        "hyperparameters": {
            "hidden_size": hidden_size, "num_layers": num_layers,
            "dropout": dropout, "cell_type": cell_type,
            "lookback_window": lookback_window, "forecast_horizon": forecast_horizon,
        },
        "test_metrics": test_metrics,
        "training_metrics": model.training_metrics,
        "horizon": forecast_horizon,
        "train_samples": len(y_train),
        "test_samples": len(y_test),
        "trained_at": datetime.now().isoformat(),
        "model_path": model_path,
    }

    results_path = os.path.join(artifact_dir, f"{cell_type}_results.json")
    with open(results_path, "w") as f:
        json.dump(result, f, indent=2, default=str)

    return result


def grid_search(df: pd.DataFrame, artifact_dir: str) -> dict:
    """
    Grid search over LSTM hyperparameters.

    Args:
        df: Training DataFrame.
        artifact_dir: Save directory.

    Returns:
        Best model results.
    """
    param_grid = {
        "hidden_size": [64, 128, 256],
        "num_layers": [1, 2, 3],
        "dropout": [0.1, 0.2, 0.3],
        "cell_type": ["lstm", "gru"],
        "lookback_window": [72, 168],
    }

    best_mae = float("inf")
    best_result = None
    total_configs = 1
    for v in param_grid.values():
        total_configs *= len(v)
    logger.info(f"Grid search: {total_configs} configurations")

    config_count = 0
    for hs in param_grid["hidden_size"]:
        for nl in param_grid["num_layers"]:
            for dr in param_grid["dropout"]:
                for ct in param_grid["cell_type"]:
                    for lw in param_grid["lookback_window"]:
                        config_count += 1
                        logger.info(f"[{config_count}/{total_configs}] "
                                     f"hs={hs}, nl={nl}, dr={dr}, ct={ct}, lw={lw}")
                        try:
                            result = train_lstm(
                                df, hidden_size=hs, num_layers=nl,
                                dropout=dr, cell_type=ct,
                                lookback_window=lw, artifact_dir=artifact_dir,
                            )
                            if result["test_metrics"]["mae"] < best_mae:
                                best_mae = result["test_metrics"]["mae"]
                                best_result = result
                                logger.info(f"New best MAE: {best_mae:.2f}")
                        except Exception as e:
                            logger.warning(f"Config failed: {e}")

    logger.info(f"Best LSTM config: MAE={best_mae:.2f}")
    return best_result


def main():
    parser = argparse.ArgumentParser(description="Train LSTM AQI forecasting model")
    parser.add_argument("--city", type=str, default="delhi")
    parser.add_argument("--data-dir", type=str, default="./data")
    parser.add_argument("--artifact-dir", type=str, default="./artifacts/models/lstm")
    parser.add_argument("--horizon", type=int, default=72)
    parser.add_argument("--hidden-size", type=int, default=128)
    parser.add_argument("--num-layers", type=int, default=2)
    parser.add_argument("--cell-type", type=str, default="lstm", choices=["lstm", "gru"])
    parser.add_argument("--lookback", type=int, default=168)
    parser.add_argument("--tune", action="store_true", help="Run grid search")
    args = parser.parse_args()

    store = FeatureStore(data_dir=args.data_dir, default_city=args.city)
    df = store.get_training_data(city=args.city, include_weather=True)

    if args.tune:
        result = grid_search(df, args.artifact_dir)
    else:
        result = train_lstm(
            df, hidden_size=args.hidden_size, num_layers=args.num_layers,
            cell_type=args.cell_type, lookback_window=args.lookback,
            forecast_horizon=args.horizon, artifact_dir=args.artifact_dir,
        )

    logger.info(f"\nLSTM training complete. Test MAE={result['test_metrics']['mae']:.2f}")


if __name__ == "__main__":
    main()

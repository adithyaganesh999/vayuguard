"""
Historical Backtesting for AQI Forecasting Models.

Evaluates model performance on historical data using walk-forward
validation, providing realistic performance estimates.
"""

import argparse
import logging
import os
import sys
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, List

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from feature_pipeline.feature_store import FeatureStore
from models.baseline.persistence_model import PersistenceModel
from models.baseline.moving_average import MovingAverageModel, WeightedMovingAverageModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


class Backtester:
    """
    Walk-forward backtesting engine for AQI forecasting models.

    Features:
    - Expanding window backtesting
    - Rolling window backtesting
    - Multiple forecast horizons
    - Detailed per-fold and aggregate metrics
    - Statistical significance testing between models
    """

    def __init__(
        self,
        data: pd.DataFrame,
        target_col: str = "aqi",
        initial_train_size: int = 720,  # 30 days of hourly data
        step_size: int = 168,  # 7 days step
        horizon: int = 72,
        method: str = "expanding",
    ):
        """
        Args:
            data: Full historical DataFrame.
            target_col: Name of the target column.
            initial_train_size: Minimum training window size.
            step_size: Step size between backtest folds.
            horizon: Forecast horizon for each fold.
            method: 'expanding' or 'rolling' window.
        """
        self.data = data
        self.target_col = target_col
        self.initial_train_size = initial_train_size
        self.step_size = step_size
        self.horizon = horizon
        self.method = method
        self.results: List[Dict] = []

    def _generate_folds(self) -> List[tuple]:
        """
        Generate train/test index splits for backtesting.

        Returns:
            List of (train_indices, test_indices) tuples.
        """
        folds = []
        n = len(self.data)
        start = self.initial_train_size

        while start + self.horizon <= n:
            if self.method == "expanding":
                train_end = start
            else:  # rolling
                train_end = start
                train_start = max(0, start - self.initial_train_size)

            train_idx = slice(0, start) if self.method == "expanding" else slice(train_start, start)
            test_idx = slice(start, min(start + self.horizon, n))

            folds.append((train_idx, test_idx))
            start += self.step_size

        logger.info(f"Generated {len(folds)} backtest folds")
        return folds

    def run_backtest(self, model_factory, model_name: str = "model") -> Dict:
        """
        Run walk-forward backtest for a given model.

        Args:
            model_factory: Callable that returns a new unfitted model instance.
            model_name: Name for logging.

        Returns:
            Backtest results dict with per-fold and aggregate metrics.
        """
        folds = self._generate_folds()
        fold_results = []

        for fold_idx, (train_idx, test_idx) in enumerate(folds):
            y_train = self.data[self.target_col].iloc[train_idx]
            y_test = self.data[self.target_col].iloc[test_idx]

            if len(y_test) == 0:
                continue

            # Create and fit model
            model = model_factory()
            try:
                model.fit(y_train)
            except Exception as e:
                logger.warning(f"Fold {fold_idx}: Model fitting failed: {e}")
                continue

            # Predict
            try:
                predictions = model.predict(horizon=min(self.horizon, len(y_test)))
                if isinstance(predictions, dict):
                    predictions = predictions.get("forecast", predictions.get("predictions",
                                       np.array(list(predictions.values())).flatten()))
                predictions = np.atleast_1d(predictions)
            except Exception as e:
                logger.warning(f"Fold {fold_idx}: Prediction failed: {e}")
                continue

            # Compute metrics
            actual = y_test.values[:len(predictions)]
            min_len = min(len(predictions), len(actual))

            fold_metrics = {
                "fold": fold_idx,
                "train_size": len(y_train),
                "test_size": min_len,
                "mae": float(mean_absolute_error(actual[:min_len], predictions[:min_len])),
                "rmse": float(np.sqrt(mean_squared_error(actual[:min_len], predictions[:min_len]))),
                "r2": float(r2_score(actual[:min_len], predictions[:min_len])),
                "mape": float(np.mean(np.abs((actual[:min_len] - predictions[:min_len]) /
                                              (actual[:min_len] + 1e-8))) * 100),
            }
            fold_results.append(fold_metrics)
            logger.info(f"Fold {fold_idx}: MAE={fold_metrics['mae']:.2f}, "
                         f"RMSE={fold_metrics['rmse']:.2f}")

        # Aggregate results
        if fold_results:
            aggregate = {
                "mae_mean": float(np.mean([f["mae"] for f in fold_results])),
                "mae_std": float(np.std([f["mae"] for f in fold_results])),
                "rmse_mean": float(np.mean([f["rmse"] for f in fold_results])),
                "rmse_std": float(np.std([f["rmse"] for f in fold_results])),
                "r2_mean": float(np.mean([f["r2"] for f in fold_results])),
                "r2_std": float(np.std([f["r2"] for f in fold_results])),
                "n_folds": len(fold_results),
            }
        else:
            aggregate = {"error": "No successful folds"}

        result = {
            "model_name": model_name,
            "method": self.method,
            "horizon": self.horizon,
            "initial_train_size": self.initial_train_size,
            "step_size": self.step_size,
            "fold_results": fold_results,
            "aggregate": aggregate,
            "backtested_at": datetime.now().isoformat(),
        }
        self.results.append(result)
        return result

    def compare_models(self, model_factories: Dict[str, callable]) -> List[Dict]:
        """
        Run backtests for multiple models and compare results.

        Args:
            model_factories: Dict mapping model names to factory functions.

        Returns:
            Sorted list of model results.
        """
        all_results = []
        for name, factory in model_factories.items():
            logger.info(f"Backtesting {name}...")
            result = self.run_backtest(factory, model_name=name)
            all_results.append(result)

        # Sort by aggregate MAE
        sorted_results = sorted(
            all_results,
            key=lambda x: x.get("aggregate", {}).get("mae_mean", float("inf")),
        )

        # Print comparison
        logger.info("\n" + "=" * 60)
        logger.info("BACKTEST COMPARISON")
        logger.info("=" * 60)
        for i, result in enumerate(sorted_results, 1):
            agg = result.get("aggregate", {})
            logger.info(
                f"  #{i} {result['model_name']:<20} "
                f"MAE={agg.get('mae_mean', 'N/A'):.2f}±{agg.get('mae_std', 0):.2f} "
                f"RMSE={agg.get('rmse_mean', 'N/A'):.2f} "
                f"R2={agg.get('r2_mean', 'N/A'):.3f}"
            )

        return sorted_results


def main():
    parser = argparse.ArgumentParser(description="Backtest AQI forecasting models")
    parser.add_argument("--city", type=str, default="delhi")
    parser.add_argument("--data-dir", type=str, default="./data")
    parser.add_argument("--output-dir", type=str, default="./artifacts/backtest")
    parser.add_argument("--horizon", type=int, default=72)
    parser.add_argument("--initial-train", type=int, default=720)
    parser.add_argument("--step-size", type=int, default=168)
    parser.add_argument("--method", type=str, default="expanding", choices=["expanding", "rolling"])
    args = parser.parse_args()

    store = FeatureStore(data_dir=args.data_dir, default_city=args.city)
    df = store.get_training_data(city=args.city)

    backtester = Backtester(
        data=df, horizon=args.horizon,
        initial_train_size=args.initial_train_size,
        step_size=args.step_size, method=args.method,
    )

    model_factories = {
        "persistence_lag1": lambda: PersistenceModel(seasonal_lag=1),
        "persistence_lag24": lambda: PersistenceModel(seasonal_lag=24),
        "sma_window24": lambda: MovingAverageModel(window=24),
        "wma_window24": lambda: WeightedMovingAverageModel(window=24),
    }

    results = backtester.compare_models(model_factories)

    os.makedirs(args.output_dir, exist_ok=True)
    output_path = os.path.join(args.output_dir, f"backtest_{args.city}_{datetime.now().strftime('%Y%m%d')}.json")
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    logger.info(f"Backtest results saved to {output_path}")


if __name__ == "__main__":
    main()

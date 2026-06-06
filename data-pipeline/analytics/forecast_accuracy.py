"""
VayuGuard Data Pipeline - Forecast Accuracy
==============================================
Compares ML predictions against actual AQI values and computes
accuracy metrics: MAE, RMSE, MAPE, R², and category accuracy.
"""

import logging
from datetime import datetime
from typing import Optional

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


class ForecastAccuracyCalculator:
    """
    Compares ML forecast predictions against actual AQI observations.
    
    Metrics:
    - MAE (Mean Absolute Error)
    - RMSE (Root Mean Square Error)
    - MAPE (Mean Absolute Percentage Error)
    - R² (Coefficient of Determination)
    - Category Accuracy (exact AQI category match)
    - Directional Accuracy (correct trend direction)
    - Bias (systematic over/under prediction)
    - Skill Score (vs naive baseline)
    """

    def __init__(
        self,
        actual_col: str = "actual_aqi",
        predicted_col: str = "predicted_aqi",
        timestamp_col: str = "timestamp_utc",
        city_col: str = "city",
    ):
        self.actual_col = actual_col
        self.predicted_col = predicted_col
        self.timestamp_col = timestamp_col
        self.city_col = city_col

    def compute_metrics(self, df: pd.DataFrame) -> dict:
        """
        Compute comprehensive forecast accuracy metrics.

        Args:
            df: DataFrame with both actual and predicted AQI columns

        Returns:
            Dict with overall and per-city metrics
        """
        required = [self.actual_col, self.predicted_col]
        missing = [c for c in required if c not in df.columns]
        if missing:
            logger.error(f"Missing columns: {missing}")
            return {}

        # Drop rows with missing actual or predicted values
        valid = df.dropna(subset=required).copy()
        if valid.empty:
            logger.warning("No valid records for accuracy calculation")
            return {}

        actual = valid[self.actual_col].values
        predicted = valid[self.predicted_col].values
        errors = predicted - actual

        # Overall metrics
        overall = {
            "total_records": len(valid),
            "mae": self._compute_mae(actual, predicted),
            "rmse": self._compute_rmse(actual, predicted),
            "mape": self._compute_mape(actual, predicted),
            "r_squared": self._compute_r_squared(actual, predicted),
            "category_accuracy": self._compute_category_accuracy(actual, predicted),
            "directional_accuracy": self._compute_directional_accuracy(valid),
            "bias": self._compute_bias(errors),
            "skill_score": self._compute_skill_score(actual, predicted),
            "within_10_pct": self._compute_within_tolerance(actual, predicted, 0.10),
            "within_20_pct": self._compute_within_tolerance(actual, predicted, 0.20),
            "within_50_aqi": self._compute_within_absolute(actual, predicted, 50),
        }

        # Per-city metrics
        per_city = {}
        if self.city_col in valid.columns:
            for city in valid[self.city_col].unique():
                city_df = valid[valid[self.city_col] == city]
                city_actual = city_df[self.actual_col].values
                city_predicted = city_df[self.predicted_col].values
                city_errors = city_predicted - city_actual

                per_city[city] = {
                    "records": len(city_df),
                    "mae": self._compute_mae(city_actual, city_predicted),
                    "rmse": self._compute_rmse(city_actual, city_predicted),
                    "mape": self._compute_mape(city_actual, city_predicted),
                    "r_squared": self._compute_r_squared(city_actual, city_predicted),
                    "category_accuracy": self._compute_category_accuracy(city_actual, city_predicted),
                    "bias": self._compute_bias(city_errors),
                }

        # Per forecast horizon metrics (if available)
        per_horizon = {}
        if "forecast_horizon_hours" in valid.columns:
            for horizon in sorted(valid["forecast_horizon_hours"].unique()):
                h_df = valid[valid["forecast_horizon_hours"] == horizon]
                h_actual = h_df[self.actual_col].values
                h_predicted = h_df[self.predicted_col].values

                per_horizon[int(horizon)] = {
                    "records": len(h_df),
                    "mae": self._compute_mae(h_actual, h_predicted),
                    "rmse": self._compute_rmse(h_actual, h_predicted),
                    "category_accuracy": self._compute_category_accuracy(h_actual, h_predicted),
                }

        return {
            "overall": overall,
            "per_city": per_city,
            "per_horizon": per_horizon,
        }

    @staticmethod
    def _compute_mae(actual: np.ndarray, predicted: np.ndarray) -> float:
        """Mean Absolute Error."""
        return float(np.mean(np.abs(actual - predicted)))

    @staticmethod
    def _compute_rmse(actual: np.ndarray, predicted: np.ndarray) -> float:
        """Root Mean Square Error."""
        return float(np.sqrt(np.mean((actual - predicted) ** 2)))

    @staticmethod
    def _compute_mape(actual: np.ndarray, predicted: np.ndarray) -> float:
        """Mean Absolute Percentage Error (symmetric)."""
        mask = actual != 0
        if not mask.any():
            return float("inf")
        return float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100)

    @staticmethod
    def _compute_r_squared(actual: np.ndarray, predicted: np.ndarray) -> float:
        """Coefficient of Determination (R²)."""
        ss_res = np.sum((actual - predicted) ** 2)
        ss_tot = np.sum((actual - np.mean(actual)) ** 2)
        if ss_tot == 0:
            return 0.0
        return float(1 - ss_res / ss_tot)

    @staticmethod
    def _compute_category_accuracy(actual: np.ndarray, predicted: np.ndarray) -> float:
        """
        Accuracy of AQI category prediction.
        
        Both actual and predicted are classified into CPCB categories,
        then exact match percentage is computed.
        """
        categories = [
            (0, 50), (51, 100), (101, 200), (201, 300), (301, 400), (401, 500),
        ]

        def classify(aqi_vals):
            result = np.zeros(len(aqi_vals), dtype=int)
            for i, (low, high) in enumerate(categories):
                mask = (aqi_vals >= low) & (aqi_vals <= high)
                result[mask] = i
            result[aqi_vals > 500] = 5
            return result

        actual_cats = classify(actual)
        predicted_cats = classify(predicted)
        return float(np.mean(actual_cats == predicted_cats) * 100)

    def _compute_directional_accuracy(self, df: pd.DataFrame) -> float:
        """
        Accuracy of trend direction prediction.
        
        Compares whether predicted and actual values move in the same
        direction relative to the previous time step.
        """
        if self.timestamp_col not in df.columns or self.city_col not in df.columns:
            return 0.0

        df = df.sort_values([self.city_col, self.timestamp_col])
        
        correct = 0
        total = 0
        for city in df[self.city_col].unique():
            city_df = df[df[self.city_col] == city]
            if len(city_df) < 2:
                continue

            actual_diff = city_df[self.actual_col].diff().dropna()
            pred_diff = city_df[self.predicted_col].diff().dropna()

            # Both predict same direction
            same_direction = (actual_diff * pred_diff) > 0
            # Both flat
            both_flat = (actual_diff == 0) & (pred_diff == 0)

            correct += (same_direction | both_flat).sum()
            total += len(same_direction)

        return float(correct / max(total, 1) * 100)

    @staticmethod
    def _compute_bias(errors: np.ndarray) -> dict:
        """Compute forecast bias (systematic over/under prediction)."""
        mean_bias = float(np.mean(errors))
        median_bias = float(np.median(errors))
        return {
            "mean_bias": round(mean_bias, 4),
            "median_bias": round(median_bias, 4),
            "direction": "over_prediction" if mean_bias > 0 else "under_prediction" if mean_bias < 0 else "unbiased",
        }

    @staticmethod
    def _compute_skill_score(actual: np.ndarray, predicted: np.ndarray) -> float:
        """
        Compute skill score vs naive persistence baseline.
        
        Skill = 1 - (RMSE_model / RMSE_naive)
        Positive skill means the model outperforms the naive baseline.
        """
        # Naive baseline: previous value = current value
        if len(actual) < 2:
            return 0.0
        
        naive_predictions = actual[:-1]
        naive_actuals = actual[1:]
        model_actuals = actual[1:]
        model_predictions = predicted[1:]

        rmse_model = np.sqrt(np.mean((model_actuals - model_predictions) ** 2))
        rmse_naive = np.sqrt(np.mean((naive_actuals - naive_predictions) ** 2))

        if rmse_naive == 0:
            return 0.0

        return float(1 - rmse_model / rmse_naive)

    @staticmethod
    def _compute_within_tolerance(actual: np.ndarray, predicted: np.ndarray, tolerance: float) -> float:
        """Percentage of predictions within tolerance of actual."""
        pct_errors = np.abs((actual - predicted) / np.maximum(actual, 1))
        return float(np.mean(pct_errors <= tolerance) * 100)

    @staticmethod
    def _compute_within_absolute(actual: np.ndarray, predicted: np.ndarray, threshold: float) -> float:
        """Percentage of predictions within absolute AQI units of actual."""
        abs_errors = np.abs(actual - predicted)
        return float(np.mean(abs_errors <= threshold) * 100)

    def compute_error_distribution(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Compute error distribution statistics for visualization.

        Args:
            df: DataFrame with actual and predicted columns

        Returns:
            DataFrame with error distribution bins
        """
        required = [self.actual_col, self.predicted_col]
        valid = df.dropna(subset=required)
        if valid.empty:
            return pd.DataFrame()

        errors = valid[self.predicted_col] - valid[self.actual_col]
        
        # Create error bins
        bins = [-500, -200, -100, -50, -20, -10, 0, 10, 20, 50, 100, 200, 500]
        labels = ["<-200", "-200:-100", "-100:-50", "-50:-20", "-20:-10", "-10:0",
                  "0:10", "10:20", "20:50", "50:100", "100:200", ">200"]

        valid = valid.copy()
        valid["error"] = errors
        valid["error_bin"] = pd.cut(errors, bins=bins, labels=labels)

        dist = valid.groupby("error_bin").agg(
            count=("error", "count"),
            avg_error=("error", "mean"),
        ).reset_index()

        dist["pct"] = (dist["count"] / dist["count"].sum() * 100).round(2)
        return dist

    def generate_report(self, metrics: dict) -> str:
        """Generate a human-readable accuracy report."""
        if not metrics or "overall" not in metrics:
            return "No metrics available."

        o = metrics["overall"]
        lines = [
            "VayuGuard Forecast Accuracy Report",
            "=" * 50,
            f"Total predictions evaluated: {o['total_records']}",
            "",
            "Overall Metrics:",
            "-" * 30,
            f"  MAE:                 {o['mae']:.2f} AQI",
            f"  RMSE:                {o['rmse']:.2f} AQI",
            f"  MAPE:                {o['mape']:.2f}%",
            f"  R²:                  {o['r_squared']:.4f}",
            f"  Category Accuracy:   {o['category_accuracy']:.1f}%",
            f"  Directional Accuracy:{o['directional_accuracy']:.1f}%",
            f"  Within 10%:          {o['within_10_pct']:.1f}%",
            f"  Within 20%:          {o['within_20_pct']:.1f}%",
            f"  Within 50 AQI:       {o['within_50_aqi']:.1f}%",
            f"  Bias:                {o['bias']['mean_bias']:.2f} ({o['bias']['direction']})",
            f"  Skill Score:         {o['skill_score']:.4f}",
        ]

        if "per_city" in metrics and metrics["per_city"]:
            lines.append("\nPer-City MAE Ranking:")
            lines.append("-" * 30)
            sorted_cities = sorted(metrics["per_city"].items(), key=lambda x: x[1]["mae"], reverse=True)
            for city, city_metrics in sorted_cities[:10]:
                lines.append(f"  {city}: MAE={city_metrics['mae']:.2f}, RMSE={city_metrics['rmse']:.2f}")

        if "per_horizon" in metrics and metrics["per_horizon"]:
            lines.append("\nPer-Horizon Accuracy:")
            lines.append("-" * 30)
            for horizon, h_metrics in sorted(metrics["per_horizon"].items()):
                lines.append(f"  {horizon}h: MAE={h_metrics['mae']:.2f}, RMSE={h_metrics['rmse']:.2f}")

        return "\n".join(lines)


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Forecast accuracy evaluation")
    parser.add_argument("--input", type=str, required=True, help="Input CSV with actual_aqi and predicted_aqi columns")
    parser.add_argument("--output", type=str, default="accuracy_report.json", help="Output report path")
    args = parser.parse_args()

    df = pd.read_csv(args.input)
    calculator = ForecastAccuracyCalculator()
    metrics = calculator.compute_metrics(df)
    print(calculator.generate_report(metrics))

    # Save metrics
    import json
    with open(args.output, "w") as f:
        json.dump(metrics, f, indent=2, default=str)


if __name__ == "__main__":
    main()

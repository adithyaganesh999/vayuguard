"""
Data Drift Detection using Kolmogorov-Smirnov Test.

Monitors input feature distributions for shifts that could degrade
model performance. Triggers alerts when significant drift is detected.
"""

import numpy as np
import pandas as pd
import logging
import json
import os
from typing import Optional, Dict, List, Tuple
from datetime import datetime
from scipy.stats import ks_2samp, wasserstein_distance

logger = logging.getLogger(__name__)


class DriftDetector:
    """
    Data drift detection for AQI forecasting features.

    Uses statistical tests to compare current data distributions
    against reference (training) distributions:

    1. Kolmogorov-Smirnov (KS) test — non-parametric distribution comparison
    2. Wasserstein distance — earth mover's distance
    3. Population stability index (PSI) — industry standard for drift

    Detects:
    - Feature drift: individual feature distribution shifts
    - Concept drift: relationship between features and target changes
    - Prediction drift: output distribution shifts
    """

    def __init__(
        self,
        reference_data: Optional[pd.DataFrame] = None,
        significance_level: float = 0.05,
        psi_threshold: float = 0.2,
        wasserstein_threshold: float = 0.5,
        feature_columns: Optional[List[str]] = None,
        history_dir: str = "./artifacts/drift_history",
    ):
        """
        Args:
            reference_data: Reference (training) data distribution.
            significance_level: P-value threshold for KS test.
            psi_threshold: PSI value threshold for drift alert.
            wasserstein_threshold: Wasserstein distance threshold.
            feature_columns: Columns to monitor for drift.
            history_dir: Directory for drift detection history.
        """
        self.reference_data = reference_data
        self.significance_level = significance_level
        self.psi_threshold = psi_threshold
        self.wasserstein_threshold = wasserstein_threshold
        self.feature_columns = feature_columns
        self.history_dir = history_dir
        self._drift_history: List[dict] = []
        os.makedirs(history_dir, exist_ok=True)

    def set_reference(self, data: pd.DataFrame, feature_columns: Optional[List[str]] = None) -> None:
        """
        Set the reference data distribution.

        Args:
            data: Reference DataFrame (typically training data).
            feature_columns: Columns to monitor.
        """
        self.reference_data = data
        self.feature_columns = feature_columns or list(data.columns)
        logger.info(f"Reference data set: {len(data)} rows, {len(self.feature_columns)} features")

    def detect_feature_drift(
        self,
        current_data: pd.DataFrame,
        method: str = "ks",
    ) -> Dict[str, dict]:
        """
        Detect drift in individual features.

        Args:
            current_data: Current data to compare against reference.
            method: Detection method ('ks', 'wasserstein', 'psi', 'all').

        Returns:
            Dict mapping feature names to drift results.
        """
        if self.reference_data is None:
            raise ValueError("Reference data not set. Call set_reference() first.")

        results = {}
        features = self.feature_columns or [c for c in current_data.columns if c in self.reference_data.columns]

        for feature in features:
            if feature not in self.reference_data.columns or feature not in current_data.columns:
                continue

            ref_values = self.reference_data[feature].dropna().values
            cur_values = current_data[feature].dropna().values

            if len(ref_values) < 10 or len(cur_values) < 10:
                results[feature] = {"status": "insufficient_data"}
                continue

            feature_result = {}

            if method in ("ks", "all"):
                ks_stat, ks_pvalue = ks_2samp(ref_values, cur_values)
                feature_result["ks_statistic"] = float(ks_stat)
                feature_result["ks_pvalue"] = float(ks_pvalue)
                feature_result["ks_drift_detected"] = ks_pvalue < self.significance_level

            if method in ("wasserstein", "all"):
                wd = wasserstein_distance(ref_values, cur_values)
                feature_result["wasserstein_distance"] = float(wd)
                feature_result["wasserstein_drift_detected"] = wd > self.wasserstein_threshold

            if method in ("psi", "all"):
                psi_value = self._calculate_psi(ref_values, cur_values)
                feature_result["psi"] = float(psi_value)
                feature_result["psi_drift_detected"] = psi_value > self.psi_threshold

            # Overall drift flag
            drift_flags = [k for k in feature_result if k.endswith("_drift_detected") and feature_result[k]]
            feature_result["drift_detected"] = len(drift_flags) > 0
            feature_result["severity"] = self._assess_severity(feature_result)

            results[feature] = feature_result

            if feature_result["drift_detected"]:
                logger.warning(f"Drift detected in feature '{feature}': {feature_result}")

        # Log results
        drift_summary = {
            "timestamp": datetime.now().isoformat(),
            "n_features_checked": len(results),
            "n_features_drifted": sum(1 for r in results.values() if r.get("drift_detected")),
            "results": results,
        }
        self._drift_history.append(drift_summary)
        self._save_history(drift_summary)

        n_drifted = drift_summary["n_features_drifted"]
        logger.info(f"Drift detection: {n_drifted}/{len(results)} features show drift")

        return results

    def detect_prediction_drift(
        self,
        reference_predictions: np.ndarray,
        current_predictions: np.ndarray,
    ) -> dict:
        """
        Detect drift in model predictions.

        Args:
            reference_predictions: Reference period predictions.
            current_predictions: Current period predictions.

        Returns:
            Prediction drift result dict.
        """
        ks_stat, ks_pvalue = ks_2samp(reference_predictions, current_predictions)
        wd = wasserstein_distance(reference_predictions, current_predictions)

        result = {
            "ks_statistic": float(ks_stat),
            "ks_pvalue": float(ks_pvalue),
            "ks_drift_detected": ks_pvalue < self.significance_level,
            "wasserstein_distance": float(wd),
            "prediction_mean_ref": float(np.mean(reference_predictions)),
            "prediction_mean_cur": float(np.mean(current_predictions)),
            "prediction_std_ref": float(np.std(reference_predictions)),
            "prediction_std_cur": float(np.std(current_predictions)),
            "drift_detected": ks_pvalue < self.significance_level,
        }

        if result["drift_detected"]:
            logger.warning(f"Prediction drift detected: KS={ks_stat:.4f}, p={ks_pvalue:.4f}")

        return result

    def _calculate_psi(self, expected: np.ndarray, actual: np.ndarray,
                        n_bins: int = 10) -> float:
        """
        Calculate Population Stability Index (PSI).

        PSI < 0.1: No significant change
        0.1 <= PSI < 0.2: Moderate change
        PSI >= 0.2: Significant change (drift)

        Args:
            expected: Reference distribution values.
            actual: Current distribution values.
            n_bins: Number of bins for histogram comparison.

        Returns:
            PSI value.
        """
        breakpoints = np.linspace(min(expected.min(), actual.min()),
                                   max(expected.max(), actual.max()) + 1e-6,
                                   n_bins + 1)

        expected_counts = np.histogram(expected, bins=breakpoints)[0]
        actual_counts = np.histogram(actual, bins=breakpoints)[0]

        expected_pct = expected_counts / len(expected) + 1e-6
        actual_pct = actual_counts / len(actual) + 1e-6

        psi = np.sum((actual_pct - expected_pct) * np.log(actual_pct / expected_pct))
        return psi

    def _assess_severity(self, result: dict) -> str:
        """Assess the severity of detected drift."""
        drift_count = sum(1 for k, v in result.items() if k.endswith("_drift_detected") and v)
        if drift_count == 0:
            return "none"
        elif drift_count == 1:
            return "low"
        elif drift_count == 2:
            return "medium"
        else:
            return "high"

    def _save_history(self, summary: dict) -> None:
        """Save drift detection result to history file."""
        filename = f"drift_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        path = os.path.join(self.history_dir, filename)
        with open(path, "w") as f:
            json.dump(summary, f, indent=2, default=str)

    def get_drift_summary(self) -> dict:
        """Get summary of all drift detections."""
        if not self._drift_history:
            return {"total_checks": 0}
        latest = self._drift_history[-1]
        return {
            "total_checks": len(self._drift_history),
            "last_check": latest["timestamp"],
            "last_drift_count": latest["n_features_drifted"],
            "total_drifts_detected": sum(h["n_features_drifted"] for h in self._drift_history),
        }

    def should_retrain(self) -> bool:
        """
        Determine if retraining should be triggered based on drift severity.

        Returns:
            True if retraining is recommended.
        """
        if not self._drift_history:
            return False
        latest = self._drift_history[-1]
        severity_counts = {}
        for feat, result in latest.get("results", {}).items():
            sev = result.get("severity", "none")
            severity_counts[sev] = severity_counts.get(sev, 0) + 1

        # Retrain if any high-severity drift or multiple medium
        return severity_counts.get("high", 0) > 0 or severity_counts.get("medium", 0) >= 3

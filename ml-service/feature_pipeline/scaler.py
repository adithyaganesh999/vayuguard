"""
Feature Scaler with Save/Load.

Provides StandardScaler and MinMaxScaler wrappers that persist
scaling parameters to disk for consistent train/serve transformations.
"""

import numpy as np
import pandas as pd
import joblib
import os
import logging
from typing import Optional, Dict, Union
from sklearn.preprocessing import StandardScaler, MinMaxScaler

logger = logging.getLogger(__name__)


class FeatureScaler:
    """
    Feature scaling utility with persistence.

    Supports:
    - StandardScaler (zero mean, unit variance)
    - MinMaxScaler (scale to [0, 1] or custom range)
    - Per-column scaling with independent parameters
    - Save/load for consistent inference-time scaling
    - Inverse transform for converting predictions back to original scale
    """

    def __init__(
        self,
        method: str = "standard",
        feature_range: tuple = (0, 1),
        clip: bool = True,
    ):
        """
        Args:
            method: 'standard' for StandardScaler, 'minmax' for MinMaxScaler.
            feature_range: Target range for MinMaxScaler.
            clip: Whether to clip values after inverse transform to valid AQI range.
        """
        if method not in ("standard", "minmax"):
            raise ValueError(f"Unknown scaling method: {method}. Use 'standard' or 'minmax'.")
        self.method = method
        self.feature_range = feature_range
        self.clip = clip
        self.scaler: Optional[Union[StandardScaler, MinMaxScaler]] = None
        self.fitted = False
        self.feature_names_: Optional[list] = None
        self.scale_params_: Dict = {}

    def fit(self, X: Union[pd.DataFrame, np.ndarray],
            feature_names: Optional[list] = None) -> "FeatureScaler":
        """
        Fit the scaler on training data.

        Args:
            X: Training feature matrix.
            feature_names: Optional column names.

        Returns:
            self
        """
        if isinstance(X, pd.DataFrame):
            self.feature_names_ = list(X.columns)
            X_values = X.values
        else:
            self.feature_names_ = feature_names or [f"feature_{i}" for i in range(X.shape[1])]
            X_values = X

        if self.method == "standard":
            self.scaler = StandardScaler()
        else:
            self.scaler = MinMaxScaler(feature_range=self.feature_range)

        self.scaler.fit(X_values)
        self.fitted = True

        # Store scaling parameters
        if self.method == "standard":
            self.scale_params_ = {
                "mean": self.scaler.mean_.tolist(),
                "std": self.scaler.scale_.tolist(),
                "var": self.scaler.var_.tolist(),
                "n_samples_seen": int(self.scaler.n_samples_seen_),
            }
        else:
            self.scale_params_ = {
                "min": self.scaler.data_min_.tolist(),
                "max": self.scaler.data_max_.tolist(),
                "scale": self.scaler.scale_.tolist(),
                "n_samples_seen": int(self.scaler.n_samples_seen_),
            }

        logger.info(f"FeatureScaler ({self.method}) fitted on {X_values.shape[1]} features, "
                     f"{X_values.shape[0]} samples")
        return self

    def transform(self, X: Union[pd.DataFrame, np.ndarray]) -> Union[pd.DataFrame, np.ndarray]:
        """
        Scale features using fitted parameters.

        Args:
            X: Feature matrix to transform.

        Returns:
            Scaled feature matrix (same type as input).
        """
        if not self.fitted:
            raise RuntimeError("Scaler must be fit before transform.")
        is_dataframe = isinstance(X, pd.DataFrame)
        X_values = X.values if is_dataframe else X

        # Handle NaN values by imputing with 0 before scaling
        nan_mask = np.isnan(X_values)
        X_clean = np.where(nan_mask, 0, X_values)
        X_scaled = self.scaler.transform(X_clean)
        # Restore NaN positions
        X_scaled[nan_mask] = np.nan

        if is_dataframe:
            return pd.DataFrame(X_scaled, index=X.index, columns=X.columns)
        return X_scaled

    def inverse_transform(self, X: Union[pd.DataFrame, np.ndarray],
                           column: Optional[int] = None) -> Union[pd.DataFrame, np.ndarray]:
        """
        Inverse scale features back to original range.

        Args:
            X: Scaled feature matrix.
            column: If specified, inverse transform only this column index.

        Returns:
            Original-scale feature matrix.
        """
        if not self.fitted:
            raise RuntimeError("Scaler must be fit before inverse_transform.")

        is_dataframe = isinstance(X, pd.DataFrame)
        X_values = X.values if is_dataframe else X

        if column is not None:
            # Inverse transform a single column
            col_values = X_values[:, column:column + 1]
            dummy = np.zeros((len(col_values), self.scaler.scale_.shape[0]))
            dummy[:, column] = col_values.flatten()
            inversed = self.scaler.inverse_transform(dummy)[:, column]
            if self.clip:
                inversed = np.clip(inversed, 0, 500)  # AQI range
            return inversed
        else:
            X_inv = self.scaler.inverse_transform(X_values)
            if self.clip:
                X_inv = np.clip(X_inv, 0, 500)
            if is_dataframe:
                return pd.DataFrame(X_inv, index=X.index, columns=X.columns)
            return X_inv

    def fit_transform(self, X: Union[pd.DataFrame, np.ndarray],
                       feature_names: Optional[list] = None) -> Union[pd.DataFrame, np.ndarray]:
        """Fit and transform in one step."""
        self.fit(X, feature_names)
        return self.transform(X)

    def get_params(self) -> Dict:
        """Return scaling parameters as a dictionary."""
        if not self.fitted:
            return {}
        return {
            "method": self.method,
            "feature_range": self.feature_range,
            "feature_names": self.feature_names_,
            "scale_params": self.scale_params_,
        }

    def save(self, path: str) -> None:
        """
        Save scaler to disk.

        Args:
            path: File path for the scaler pickle.
        """
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        save_dict = {
            "method": self.method,
            "feature_range": self.feature_range,
            "clip": self.clip,
            "scaler": self.scaler,
            "fitted": self.fitted,
            "feature_names_": self.feature_names_,
            "scale_params_": self.scale_params_,
        }
        joblib.dump(save_dict, path)
        logger.info(f"FeatureScaler saved to {path}")

    @classmethod
    def load(cls, path: str) -> "FeatureScaler":
        """
        Load scaler from disk.

        Args:
            path: File path of the saved scaler.

        Returns:
            Loaded FeatureScaler instance.
        """
        save_dict = joblib.load(path)
        scaler = cls(method=save_dict["method"], feature_range=save_dict["feature_range"],
                      clip=save_dict["clip"])
        scaler.scaler = save_dict["scaler"]
        scaler.fitted = save_dict["fitted"]
        scaler.feature_names_ = save_dict.get("feature_names_")
        scaler.scale_params_ = save_dict.get("scale_params_", {})
        logger.info(f"FeatureScaler loaded from {path}")
        return scaler

    def __repr__(self) -> str:
        return (f"FeatureScaler(method={self.method}, fitted={self.fitted}, "
                f"n_features={len(self.feature_names_) if self.feature_names_ else 'N/A'})")

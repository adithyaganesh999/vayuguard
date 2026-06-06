"""
VayuGuard Data Pipeline - AQI Data Cleaning
==============================================
Handles null values, outlier detection (IQR and z-score),
deduplication, timezone normalization, and data type validation.
"""

import logging
from datetime import datetime
from typing import Optional

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# Valid AQI parameter ranges (CPCB standards)
PARAMETER_RANGES = {
    "pm25": {"min": 0, "max": 999, "unit": "µg/m³"},
    "pm10": {"min": 0, "max": 999, "unit": "µg/m³"},
    "so2": {"min": 0, "max": 1000, "unit": "µg/m³"},
    "no2": {"min": 0, "max": 1000, "unit": "µg/m³"},
    "o3": {"min": 0, "max": 500, "unit": "µg/m³"},
    "co": {"min": 0, "max": 50, "unit": "mg/m³"},
    "nh3": {"min": 0, "max": 1000, "unit": "µg/m³"},
    "aqi": {"min": 0, "max": 500, "unit": "NAQI"},
}

# AQI categories per CPCB
AQI_CATEGORIES = {
    (0, 50): "Good",
    (51, 100): "Satisfactory",
    (101, 200): "Moderate",
    (201, 300): "Poor",
    (301, 400): "Very Poor",
    (401, 500): "Severe",
}


def get_aqi_category(aqi: float) -> str:
    """Map AQI value to CPCB category."""
    for (low, high), category in AQI_CATEGORIES.items():
        if low <= aqi <= high:
            return category
    return "Severe" if aqi > 500 else "Unknown"


class AQICleaner:
    """
    Cleans and validates AQI data with multiple processing stages:
    1. Type validation and coercion
    2. Null handling
    3. Range validation
    4. Outlier detection (IQR + z-score)
    5. Deduplication
    6. Timezone normalization
    """

    def __init__(
        self,
        outlier_method: str = "iqr",
        iqr_multiplier: float = 1.5,
        z_score_threshold: float = 3.0,
        target_timezone: str = "Asia/Kolkata",
    ):
        """
        Args:
            outlier_method: 'iqr', 'zscore', or 'both'
            iqr_multiplier: IQR multiplier for outlier bounds
            z_score_threshold: Z-score threshold for outlier detection
            target_timezone: Target timezone for normalization
        """
        self.outlier_method = outlier_method
        self.iqr_multiplier = iqr_multiplier
        self.z_score_threshold = z_score_threshold
        self.target_timezone = target_timezone
        self.stats = {
            "input_records": 0,
            "nulls_removed": 0,
            "outliers_removed": 0,
            "duplicates_removed": 0,
            "range_violations": 0,
            "output_records": 0,
        }

    def clean(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Run the full cleaning pipeline on AQI data.

        Args:
            df: Raw AQI DataFrame

        Returns:
            Cleaned DataFrame
        """
        self.stats["input_records"] = len(df)
        logger.info(f"Starting AQI cleaning: {len(df)} records")

        if df.empty:
            logger.warning("Empty DataFrame received")
            return df

        # Make a copy to avoid modifying original
        df = df.copy()

        # Step 1: Validate and coerce data types
        df = self._validate_types(df)

        # Step 2: Handle nulls
        df = self._handle_nulls(df)

        # Step 3: Range validation
        df = self._validate_ranges(df)

        # Step 4: Outlier detection
        df = self._remove_outliers(df)

        # Step 5: Deduplication
        df = self._deduplicate(df)

        # Step 6: Timezone normalization
        df = self._normalize_timezones(df)

        # Step 7: Add AQI category
        df = self._add_aqi_category(df)

        # Step 8: Sort and reset index
        df = df.sort_values(["city", "timestamp_utc"]).reset_index(drop=True)

        self.stats["output_records"] = len(df)
        logger.info(f"Cleaning complete: {len(df)} records ({self.stats})")
        return df

    def _validate_types(self, df: pd.DataFrame) -> pd.DataFrame:
        """Validate and coerce column data types."""
        # Ensure required columns exist
        required = ["city", "parameter", "value", "timestamp_utc"]
        missing = [c for c in required if c not in df.columns]
        if missing:
            logger.warning(f"Missing required columns: {missing}")

        # Coerce types
        if "value" in df.columns:
            df["value"] = pd.to_numeric(df["value"], errors="coerce")
        if "latitude" in df.columns:
            df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
        if "longitude" in df.columns:
            df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")

        # Parse timestamps
        for ts_col in ["timestamp_utc", "timestamp_local"]:
            if ts_col in df.columns:
                df[ts_col] = pd.to_datetime(df[ts_col], utc=True, errors="coerce")

        # String columns
        for str_col in ["city", "location", "country", "parameter", "unit", "source"]:
            if str_col in df.columns:
                df[str_col] = df[str_col].astype(str).replace("nan", np.nan)

        return df

    def _handle_nulls(self, df: pd.DataFrame) -> pd.DataFrame:
        """Handle null values in critical columns."""
        initial_len = len(df)

        # Drop rows with null values in critical columns
        critical_cols = [c for c in ["value", "city", "parameter", "timestamp_utc"] if c in df.columns]
        if critical_cols:
            null_mask = df[critical_cols].isnull().any(axis=1)
            null_count = null_mask.sum()
            if null_count > 0:
                logger.info(f"Dropping {null_count} rows with null critical values")
                df = df[~null_mask]

        # Fill optional columns with defaults
        if "country" in df.columns:
            df["country"] = df["country"].fillna("IN")
        if "unit" in df.columns:
            df["unit"] = df["unit"].fillna("µg/m³")

        self.stats["nulls_removed"] = initial_len - len(df)
        return df

    def _validate_ranges(self, df: pd.DataFrame) -> pd.DataFrame:
        """Validate that values fall within acceptable ranges for each parameter."""
        if "parameter" not in df.columns or "value" not in df.columns:
            return df

        initial_len = len(df)
        mask = pd.Series([True] * len(df), index=df.index)

        for param, ranges in PARAMETER_RANGES.items():
            param_mask = df["parameter"] == param
            if param_mask.any():
                value_mask = (df["value"] < ranges["min"]) | (df["value"] > ranges["max"])
                violations = (param_mask & value_mask).sum()
                if violations > 0:
                    logger.info(f"Range violations for {param}: {violations} records")
                    mask &= ~(param_mask & value_mask)

        df = df[mask]
        self.stats["range_violations"] = initial_len - len(df)
        return df

    def _remove_outliers(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Remove outliers using IQR and/or z-score methods.

        Outliers are detected per (city, parameter) group.
        """
        if "parameter" not in df.columns or "value" not in df.columns or "city" not in df.columns:
            return df

        initial_len = len(df)
        outlier_mask = pd.Series([False] * len(df), index=df.index)

        for (city, param), group in df.groupby(["city", "parameter"]):
            if len(group) < 5:  # Need minimum records for outlier detection
                continue

            values = group["value"]
            group_outliers = pd.Series([False] * len(group), index=group.index)

            if self.outlier_method in ("iqr", "both"):
                iqr_outliers = self._detect_iqr_outliers(values)
                group_outliers |= iqr_outliers

            if self.outlier_method in ("zscore", "both"):
                zscore_outliers = self._detect_zscore_outliers(values)
                group_outliers |= zscore_outliers

            outlier_mask |= group_outliers

        outlier_count = outlier_mask.sum()
        if outlier_count > 0:
            logger.info(f"Detected {outlier_count} outliers")
            df = df[~outlier_mask]

        self.stats["outliers_removed"] = initial_len - len(df)
        return df

    def _detect_iqr_outliers(self, values: pd.Series) -> pd.Series:
        """
        Detect outliers using the Interquartile Range (IQR) method.

        Values outside Q1 - multiplier*IQR and Q3 + multiplier*IQR are outliers.
        """
        q1 = values.quantile(0.25)
        q3 = values.quantile(0.75)
        iqr = q3 - q1

        if iqr == 0:
            return pd.Series([False] * len(values), index=values.index)

        lower_bound = q1 - self.iqr_multiplier * iqr
        upper_bound = q3 + self.iqr_multiplier * iqr

        return (values < lower_bound) | (values > upper_bound)

    def _detect_zscore_outliers(self, values: pd.Series) -> pd.Series:
        """
        Detect outliers using the z-score method.

        Values with |z-score| > threshold are outliers.
        """
        mean = values.mean()
        std = values.std()

        if std == 0:
            return pd.Series([False] * len(values), index=values.index)

        z_scores = np.abs((values - mean) / std)
        return z_scores > self.z_score_threshold

    def _deduplicate(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Remove duplicate records based on (city, location, parameter, timestamp_utc).

        Keeps the most recent record (by source priority: cpcb > openaq).
        """
        initial_len = len(df)

        if all(c in df.columns for c in ["city", "parameter", "timestamp_utc"]):
            subset = ["city", "location", "parameter", "timestamp_utc"]
            subset = [c for c in subset if c in df.columns]

            # Sort by source priority (cpcb first) before dedup
            if "source" in df.columns:
                source_priority = {"cpcb": 0, "openaq": 1}
                df["_source_priority"] = df["source"].map(source_priority).fillna(2)
                df = df.sort_values("_source_priority")
                df = df.drop(columns=["_source_priority"])

            df = df.drop_duplicates(subset=subset, keep="first")

        self.stats["duplicates_removed"] = initial_len - len(df)
        return df

    def _normalize_timezones(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Normalize all timestamps to target timezone (Asia/Kolkata for India).

        Also creates local timestamp column and date/hour bins.
        """
        if "timestamp_utc" not in df.columns:
            return df

        # Ensure UTC timezone
        if df["timestamp_utc"].dt.tz is None:
            df["timestamp_utc"] = df["timestamp_utc"].dt.tz_localize("UTC")

        # Create local timestamp
        try:
            df["timestamp_local"] = df["timestamp_utc"].dt.tz_convert(self.target_timezone)
        except Exception as e:
            logger.warning(f"Timezone conversion failed: {e}")
            df["timestamp_local"] = df["timestamp_utc"]

        # Create date and hour bins
        df["date"] = df["timestamp_local"].dt.date
        df["hour"] = df["timestamp_local"].dt.hour
        df["day_of_week"] = df["timestamp_local"].dt.dayofweek
        df["month"] = df["timestamp_local"].dt.month

        return df

    def _add_aqi_category(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add AQI category column based on value and parameter."""
        if "parameter" in df.columns and "value" in df.columns:
            # For AQI parameter, use direct mapping
            aqi_mask = df["parameter"] == "aqi"
            if aqi_mask.any():
                df.loc[aqi_mask, "aqi_category"] = df.loc[aqi_mask, "value"].apply(get_aqi_category)

            # For PM2.5, compute sub-AQI and then category
            pm25_mask = df["parameter"] == "pm25"
            if pm25_mask.any():
                df.loc[pm25_mask, "aqi_category"] = df.loc[pm25_mask, "value"].apply(
                    lambda x: get_aqi_category(self._pm25_to_aqi(x))
                )

        return df

    @staticmethod
    def _pm25_to_aqi(pm25: float) -> float:
        """Convert PM2.5 concentration to approximate AQI (CPCB breakpoints)."""
        breakpoints = [
            (0, 30, 0, 50),
            (31, 60, 51, 100),
            (61, 90, 101, 200),
            (91, 120, 201, 300),
            (121, 250, 301, 400),
            (251, 500, 401, 500),
        ]
        for bp_low, bp_high, aqi_low, aqi_high in breakpoints:
            if bp_low <= pm25 <= bp_high:
                return ((aqi_high - aqi_low) / (bp_high - bp_low)) * (pm25 - bp_low) + aqi_low
        return 500 if pm25 > 500 else 0

    def get_stats(self) -> dict:
        """Return cleaning statistics."""
        return self.stats.copy()

    def generate_report(self) -> str:
        """Generate a human-readable cleaning report."""
        lines = [
            "AQI Data Cleaning Report",
            "=" * 40,
            f"Input records:     {self.stats['input_records']}",
            f"Nulls removed:     {self.stats['nulls_removed']}",
            f"Range violations:  {self.stats['range_violations']}",
            f"Outliers removed:  {self.stats['outliers_removed']}",
            f"Duplicates removed:{self.stats['duplicates_removed']}",
            f"Output records:    {self.stats['output_records']}",
            f"Retention rate:    {self.stats['output_records'] / max(self.stats['input_records'], 1) * 100:.1f}%",
        ]
        return "\n".join(lines)


def main():
    """CLI entry point for standalone cleaning."""
    import argparse

    parser = argparse.ArgumentParser(description="Clean AQI data")
    parser.add_argument("--input", type=str, required=True, help="Input CSV path")
    parser.add_argument("--output", type=str, default="cleaned_aqi.csv", help="Output CSV path")
    parser.add_argument("--outlier-method", choices=["iqr", "zscore", "both"], default="iqr")
    args = parser.parse_args()

    df = pd.read_csv(args.input)
    cleaner = AQICleaner(outlier_method=args.outlier_method)
    cleaned = cleaner.clean(df)
    cleaned.to_csv(args.output, index=False)
    print(cleaner.generate_report())


if __name__ == "__main__":
    main()

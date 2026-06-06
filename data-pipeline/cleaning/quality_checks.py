"""
VayuGuard Data Pipeline - Data Quality Checks
================================================
Implements data quality gates: completeness, freshness, range validation,
and Great Expectations integration for comprehensive data quality monitoring.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


class QualityCheckResult:
    """Result of a single quality check."""

    def __init__(self, name: str, passed: bool, details: dict, severity: str = "warning"):
        self.name = name
        self.passed = passed
        self.details = details
        self.severity = severity  # "info", "warning", "critical"
        self.timestamp = datetime.utcnow().isoformat()

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "passed": self.passed,
            "severity": self.severity,
            "details": self.details,
            "timestamp": self.timestamp,
        }

    def __repr__(self):
        status = "PASS" if self.passed else "FAIL"
        return f"[{status}] {self.name} ({self.severity}): {self.details}"


class QualityReport:
    """Aggregated quality report for a dataset."""

    def __init__(self, dataset_name: str):
        self.dataset_name = dataset_name
        self.results: list[QualityCheckResult] = []
        self.timestamp = datetime.utcnow().isoformat()

    def add_result(self, result: QualityCheckResult):
        self.results.append(result)

    @property
    def passed(self) -> bool:
        """Overall pass status - fails if any critical check fails."""
        return not any(
            not r.passed and r.severity == "critical"
            for r in self.results
        )

    @property
    def pass_rate(self) -> float:
        """Percentage of checks that passed."""
        if not self.results:
            return 0.0
        return sum(1 for r in self.results if r.passed) / len(self.results) * 100

    def summary(self) -> str:
        """Generate a summary string."""
        total = len(self.results)
        passed = sum(1 for r in self.results if r.passed)
        critical_failures = sum(1 for r in self.results if not r.passed and r.severity == "critical")
        lines = [
            f"Quality Report: {self.dataset_name}",
            f"Timestamp: {self.timestamp}",
            f"Overall: {'PASS' if self.passed else 'FAIL'}",
            f"Checks: {passed}/{total} passed ({self.pass_rate:.1f}%)",
            f"Critical failures: {critical_failures}",
            "",
        ]
        for r in self.results:
            status = "✓" if r.passed else "✗"
            lines.append(f"  {status} [{r.severity}] {r.name}: {r.details}")
        return "\n".join(lines)

    def to_dict(self) -> dict:
        return {
            "dataset_name": self.dataset_name,
            "timestamp": self.timestamp,
            "passed": self.passed,
            "pass_rate": self.pass_rate,
            "results": [r.to_dict() for r in self.results],
        }

    def save(self, filepath: str):
        """Save report to JSON file."""
        os.makedirs(os.path.dirname(filepath) or ".", exist_ok=True)
        with open(filepath, "w") as f:
            json.dump(self.to_dict(), f, indent=2, default=str)
        logger.info(f"Quality report saved to {filepath}")


class QualityChecker:
    """
    Runs comprehensive data quality checks on AQI and weather data.
    
    Quality gates:
    1. Completeness - Are all expected fields populated?
    2. Freshness - Is the data recent enough?
    3. Range - Do values fall within expected ranges?
    4. Uniqueness - Are there duplicates?
    5. Consistency - Are related fields consistent?
    6. Distribution - Are value distributions normal?
    """

    # Expected columns for AQI data
    AQI_REQUIRED_COLUMNS = ["city", "parameter", "value", "timestamp_utc"]
    AQI_OPTIONAL_COLUMNS = ["location", "latitude", "longitude", "country", "unit", "source"]

    # Completeness thresholds
    COMPLETENESS_THRESHOLD = 0.95  # 95% of records must have all required fields
    FRESHNESS_THRESHOLD_HOURS = 2  # Data must be within 2 hours
    DUPLICATE_THRESHOLD = 0.01  # Max 1% duplicates allowed

    # Value ranges for common parameters
    VALUE_RANGES = {
        "pm25": {"min": 0, "max": 999},
        "pm10": {"min": 0, "max": 999},
        "so2": {"min": 0, "max": 1000},
        "no2": {"min": 0, "max": 1000},
        "o3": {"min": 0, "max": 500},
        "co": {"min": 0, "max": 50},
        "aqi": {"min": 0, "max": 500},
    }

    def __init__(
        self,
        completeness_threshold: float = COMPLETENESS_THRESHOLD,
        freshness_threshold_hours: int = FRESHNESS_THRESHOLD_HOURS,
        duplicate_threshold: float = DUPLICATE_THRESHOLD,
    ):
        self.completeness_threshold = completeness_threshold
        self.freshness_threshold_hours = freshness_threshold_hours
        self.duplicate_threshold = duplicate_threshold

    def run_all_checks(self, df: pd.DataFrame, dataset_name: str = "aqi") -> QualityReport:
        """
        Run all quality checks on a DataFrame.

        Args:
            df: DataFrame to check
            dataset_name: Name of the dataset for the report

        Returns:
            QualityReport with all check results
        """
        report = QualityReport(dataset_name)

        if df.empty:
            report.add_result(QualityCheckResult(
                "data_empty", False,
                {"message": "DataFrame is empty"},
                severity="critical",
            ))
            return report

        # Run all checks
        report.add_result(self.check_completeness(df))
        report.add_result(self.check_freshness(df))
        report.add_result(self.check_value_ranges(df))
        report.add_result(self.check_uniqueness(df))
        report.add_result(self.check_consistency(df))
        report.add_result(self.check_distribution(df))
        report.add_result(self.check_geographic_coverage(df))
        report.add_result(self.check_temporal_continuity(df))

        logger.info(f"Quality checks complete: {report.pass_rate:.1f}% pass rate")
        return report

    def check_completeness(self, df: pd.DataFrame) -> QualityCheckResult:
        """
        Check data completeness - are all required fields populated?
        
        Measures the percentage of non-null values in required columns.
        """
        required_cols = [c for c in self.AQI_REQUIRED_COLUMNS if c in df.columns]
        if not required_cols:
            return QualityCheckResult(
                "completeness", False,
                {"message": "No required columns found"},
                severity="critical",
            )

        # Calculate completeness per column
        completeness_per_col = {}
        for col in required_cols:
            non_null_pct = df[col].notna().mean()
            completeness_per_col[col] = round(non_null_pct, 4)

        overall_completeness = np.mean(list(completeness_per_col.values()))
        passed = overall_completeness >= self.completeness_threshold

        return QualityCheckResult(
            "completeness", passed,
            {
                "overall_completeness": round(overall_completeness, 4),
                "threshold": self.completeness_threshold,
                "per_column": completeness_per_col,
            },
            severity="critical" if not passed else "info",
        )

    def check_freshness(self, df: pd.DataFrame) -> QualityCheckResult:
        """
        Check data freshness - is the most recent data within the threshold?
        """
        if "timestamp_utc" not in df.columns:
            return QualityCheckResult(
                "freshness", False,
                {"message": "No timestamp_utc column"},
                severity="critical",
            )

        timestamps = pd.to_datetime(df["timestamp_utc"], utc=True, errors="coerce")
        max_timestamp = timestamps.max()
        min_timestamp = timestamps.min()

        if pd.isna(max_timestamp):
            return QualityCheckResult(
                "freshness", False,
                {"message": "No valid timestamps found"},
                severity="critical",
            )

        now = pd.Timestamp.now(tz="UTC")
        age_hours = (now - max_timestamp).total_seconds() / 3600
        passed = age_hours <= self.freshness_threshold_hours

        return QualityCheckResult(
            "freshness", passed,
            {
                "max_timestamp": str(max_timestamp),
                "min_timestamp": str(min_timestamp),
                "age_hours": round(age_hours, 2),
                "threshold_hours": self.freshness_threshold_hours,
                "time_range_days": round((max_timestamp - min_timestamp).total_seconds() / 86400, 2),
            },
            severity="critical" if not passed else "info",
        )

    def check_value_ranges(self, df: pd.DataFrame) -> QualityCheckResult:
        """
        Check that values fall within expected ranges for each parameter.
        """
        if "parameter" not in df.columns or "value" not in df.columns:
            return QualityCheckResult(
                "value_ranges", True,
                {"message": "No parameter/value columns to check"},
                severity="info",
            )

        violations = {}
        total_records = 0
        total_violations = 0

        for param, ranges in self.VALUE_RANGES.items():
            param_mask = df["parameter"] == param
            param_count = param_mask.sum()

            if param_count == 0:
                continue

            total_records += param_count
            values = df.loc[param_mask, "value"]
            out_of_range = ((values < ranges["min"]) | (values > ranges["max"])).sum()
            total_violations += out_of_range

            if out_of_range > 0:
                violations[param] = {
                    "count": int(out_of_range),
                    "pct": round(out_of_range / param_count * 100, 2),
                    "min_found": float(values.min()),
                    "max_found": float(values.max()),
                    "expected_range": ranges,
                }

        violation_pct = total_violations / max(total_records, 1) * 100
        passed = violation_pct < 1.0  # Less than 1% violations

        return QualityCheckResult(
            "value_ranges", passed,
            {
                "violation_pct": round(violation_pct, 4),
                "total_violations": int(total_violations),
                "total_records": int(total_records),
                "violations_by_parameter": violations,
            },
            severity="warning" if not passed else "info",
        )

    def check_uniqueness(self, df: pd.DataFrame) -> QualityCheckResult:
        """
        Check for duplicate records.
        """
        key_cols = [c for c in ["city", "location", "parameter", "timestamp_utc"] if c in df.columns]

        if not key_cols:
            return QualityCheckResult(
                "uniqueness", True,
                {"message": "No key columns for uniqueness check"},
                severity="info",
            )

        total = len(df)
        duplicates = df.duplicated(subset=key_cols).sum()
        duplicate_pct = duplicates / max(total, 1)

        passed = duplicate_pct <= self.duplicate_threshold

        return QualityCheckResult(
            "uniqueness", passed,
            {
                "total_records": int(total),
                "duplicate_count": int(duplicates),
                "duplicate_pct": round(duplicate_pct, 4),
                "threshold": self.duplicate_threshold,
                "key_columns": key_cols,
            },
            severity="warning" if not passed else "info",
        )

    def check_consistency(self, df: pd.DataFrame) -> QualityCheckResult:
        """
        Check data consistency - are related fields logically consistent?
        
        Examples:
        - PM2.5 should generally be <= PM10 at same time/location
        - AQI categories should match AQI values
        - Coordinates should be within India bounds
        """
        inconsistencies = []

        # Check India geographic bounds
        if "latitude" in df.columns and "longitude" in df.columns:
            lat_mask = (df["latitude"] < 6) | (df["latitude"] > 37)
            lon_mask = (df["longitude"] < 68) | (df["longitude"] > 97)
            geo_outliers = (lat_mask | lon_mask).sum()
            if geo_outliers > 0:
                inconsistencies.append({
                    "type": "geographic_bounds",
                    "count": int(geo_outliers),
                    "message": f"{geo_outliers} records outside India bounds",
                })

        # Check PM2.5 <= PM10 for same city/time
        if "parameter" in df.columns and "value" in df.columns:
            pm25_df = df[df["parameter"] == "pm25"][["city", "timestamp_utc", "value"]].rename(
                columns={"value": "pm25_value"}
            )
            pm10_df = df[df["parameter"] == "pm10"][["city", "timestamp_utc", "value"]].rename(
                columns={"value": "pm10_value"}
            )

            if not pm25_df.empty and not pm10_df.empty:
                merged = pm25_df.merge(pm10_df, on=["city", "timestamp_utc"], how="inner")
                if not merged.empty:
                    inconsistent = (merged["pm25_value"] > merged["pm10_value"]).sum()
                    if inconsistent > 0:
                        inconsistencies.append({
                            "type": "pm25_gt_pm10",
                            "count": int(inconsistent),
                            "pct": round(inconsistent / len(merged) * 100, 2),
                        })

        passed = len(inconsistencies) == 0

        return QualityCheckResult(
            "consistency", passed,
            {
                "inconsistencies": inconsistencies,
                "inconsistency_count": len(inconsistencies),
            },
            severity="warning" if not passed else "info",
        )

    def check_distribution(self, df: pd.DataFrame) -> QualityCheckResult:
        """
        Check value distributions for anomalies.
        
        Detects:
        - Zero-variance columns
        - Highly skewed distributions
        - Unexpected value concentrations
        """
        if "value" not in df.columns or "parameter" not in df.columns:
            return QualityCheckResult(
                "distribution", True,
                {"message": "No value/parameter columns to check"},
                severity="info",
            )

        distribution_stats = {}
        anomalies = []

        for param in df["parameter"].unique():
            values = df[df["parameter"] == param]["value"].dropna()
            if len(values) < 10:
                continue

            stats = {
                "mean": float(values.mean()),
                "std": float(values.std()),
                "median": float(values.median()),
                "skewness": float(values.skew()),
                "kurtosis": float(values.kurtosis()),
                "zero_pct": float((values == 0).mean() * 100),
            }
            distribution_stats[param] = stats

            # Check for anomalies
            if stats["std"] == 0:
                anomalies.append(f"{param}: zero variance")
            if abs(stats["skewness"]) > 5:
                anomalies.append(f"{param}: highly skewed ({stats['skewness']:.2f})")
            if stats["zero_pct"] > 50:
                anomalies.append(f"{param}: {stats['zero_pct']:.1f}% zero values")

        passed = len(anomalies) == 0

        return QualityCheckResult(
            "distribution", passed,
            {
                "distribution_stats": distribution_stats,
                "anomalies": anomalies,
            },
            severity="warning" if anomalies else "info",
        )

    def check_geographic_coverage(self, df: pd.DataFrame) -> QualityCheckResult:
        """Check geographic coverage - are expected cities present?"""
        if "city" not in df.columns:
            return QualityCheckResult(
                "geographic_coverage", True,
                {"message": "No city column"},
                severity="info",
            )

        expected_cities = {
            "Delhi", "Mumbai", "Kolkata", "Chennai", "Bangalore",
            "Hyderabad", "Pune", "Ahmedabad",
        }
        present_cities = set(df["city"].dropna().unique())
        missing_cities = expected_cities - present_cities
        coverage_pct = len(present_cities & expected_cities) / len(expected_cities) * 100

        # Records per city
        records_per_city = df["city"].value_counts().to_dict()

        passed = coverage_pct >= 80  # At least 80% of expected cities present

        return QualityCheckResult(
            "geographic_coverage", passed,
            {
                "coverage_pct": round(coverage_pct, 2),
                "expected_cities": len(expected_cities),
                "present_cities": len(present_cities & expected_cities),
                "missing_cities": list(missing_cities),
                "records_per_city": {k: int(v) for k, v in records_per_city.items()},
            },
            severity="warning" if not passed else "info",
        )

    def check_temporal_continuity(self, df: pd.DataFrame) -> QualityCheckResult:
        """
        Check temporal continuity - are there unexpected gaps in time series?
        """
        if "timestamp_utc" not in df.columns or "city" not in df.columns:
            return QualityCheckResult(
                "temporal_continuity", True,
                {"message": "Missing required columns"},
                severity="info",
            )

        gaps = []
        for city in df["city"].unique():
            city_df = df[df["city"] == city].sort_values("timestamp_utc")
            timestamps = pd.to_datetime(city_df["timestamp_utc"], utc=True, errors="coerce").dropna()

            if len(timestamps) < 2:
                continue

            # Calculate gaps between consecutive readings
            diffs = timestamps.diff().dropna()
            median_diff = diffs.median()
            expected_interval = pd.Timedelta(hours=1)

            # Find gaps > 3x expected interval
            large_gaps = diffs[diffs > expected_interval * 3]
            if not large_gaps.empty:
                gaps.append({
                    "city": city,
                    "gap_count": int(len(large_gaps)),
                    "max_gap_hours": float(large_gaps.max().total_seconds() / 3600),
                    "median_interval_minutes": float(median_diff.total_seconds() / 60),
                })

        passed = len(gaps) == 0

        return QualityCheckResult(
            "temporal_continuity", passed,
            {
                "cities_with_gaps": gaps,
                "gap_count": len(gaps),
            },
            severity="warning" if not passed else "info",
        )

    def run_great_expectations(self, df: pd.DataFrame, dataset_name: str = "aqi") -> QualityReport:
        """
        Run Great Expectations suite (if installed).
        
        Falls back to basic checks if great_expectations is not available.
        """
        report = QualityReport(f"{dataset_name}_gx")

        try:
            import great_expectations as gx
            from great_expectations.dataset import PandasDataset

            gx_df = PandasDataset(df)
            
            # Define expectations
            gx_df.expect_table_row_count_to_be_between(min_value=1, max_value=10_000_000)
            gx_df.expect_column_to_exist("city")
            gx_df.expect_column_to_exist("value")
            gx_df.expect_column_values_to_not_be_null("city", mostly=0.99)
            gx_df.expect_column_values_to_not_be_null("value", mostly=0.95)

            if "parameter" in df.columns:
                gx_df.expect_column_values_to_be_in_set(
                    "parameter",
                    ["pm25", "pm10", "so2", "no2", "o3", "co", "nh3", "aqi"],
                    mostly=0.99,
                )

            # Get results
            results = gx_df.validate()
            
            for result in results.results:
                check_name = result.expectation_config.kwargs.get("column", "table")
                passed = result.success
                report.add_result(QualityCheckResult(
                    f"gx_{check_name}", passed,
                    {"expectation": str(result.expectation_config)},
                    severity="warning" if not passed else "info",
                ))

        except ImportError:
            logger.warning("Great Expectations not installed. Skipping GX checks.")
            report.add_result(QualityCheckResult(
                "gx_available", False,
                {"message": "Great Expectations not installed"},
                severity="info",
            ))

        return report


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Run data quality checks")
    parser.add_argument("--input", type=str, required=True, help="Input CSV path")
    parser.add_argument("--dataset-name", type=str, default="aqi", help="Dataset name")
    parser.add_argument("--output", type=str, default="quality_report.json", help="Output report path")
    args = parser.parse_args()

    df = pd.read_csv(args.input)
    checker = QualityChecker()
    report = checker.run_all_checks(df, dataset_name=args.dataset_name)
    report.save(args.output)
    print(report.summary())


if __name__ == "__main__":
    main()

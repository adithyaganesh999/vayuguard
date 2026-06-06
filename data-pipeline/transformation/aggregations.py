"""
VayuGuard Data Pipeline - Aggregations
========================================
Computes hourly, daily, and weekly rollups with
min/max/avg/std calculations for AQI and weather data.
"""

import os
import logging
from datetime import datetime
from typing import Optional

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# Aggregation functions
AGG_FUNCTIONS = ["mean", "std", "min", "max", "median"]
AGG_FUNCTIONS_WITH_COUNT = AGG_FUNCTIONS + ["count"]


class Aggregator:
    """
    Computes multi-granularity aggregations of AQI and weather data.
    
    Supports:
    - Hourly rollups (already typically at this granularity)
    - Daily rollups (24-hour summaries)
    - Weekly rollups (7-day summaries)
    - Monthly rollups
    - Custom period rollups
    """

    def __init__(self, timestamp_col: str = "timestamp_utc"):
        self.timestamp_col = timestamp_col

    def aggregate_hourly(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Aggregate to hourly level. Useful when raw data has sub-hourly readings.

        Args:
            df: Cleaned AQI DataFrame with timestamp_utc, city, parameter, value

        Returns:
            Hourly aggregated DataFrame
        """
        if df.empty or self.timestamp_col not in df.columns:
            return df

        df = df.copy()
        df[self.timestamp_col] = pd.to_datetime(df[self.timestamp_col], utc=True, errors="coerce")
        df["hour_bin"] = df[self.timestamp_col].dt.floor("h")

        group_cols = ["city", "parameter", "hour_bin"]
        group_cols = [c for c in group_cols if c in df.columns]

        if not group_cols:
            return df

        agg_dict = {"value": AGG_FUNCTIONS_WITH_COUNT}

        # Add weather aggregations if present
        weather_cols = [
            "temperature_2m", "relative_humidity_2m", "wind_speed_10m",
            "precipitation", "surface_pressure",
        ]
        for col in weather_cols:
            if col in df.columns:
                agg_dict[col] = AGG_FUNCTIONS

        result = df.groupby(group_cols).agg(agg_dict).reset_index()

        # Flatten multi-level columns
        result.columns = [
            "_".join(filter(None, col)).rstrip("_") if isinstance(col, tuple) else col
            for col in result.columns
        ]

        result = result.rename(columns={"hour_bin": "timestamp_hourly"})
        logger.info(f"Hourly aggregation: {len(result)} records from {len(df)} raw records")
        return result

    def aggregate_daily(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Aggregate to daily level with comprehensive statistics.

        Args:
            df: Cleaned AQI DataFrame

        Returns:
            Daily aggregated DataFrame with min/max/avg/std for each parameter
        """
        if df.empty or self.timestamp_col not in df.columns:
            return df

        df = df.copy()
        df[self.timestamp_col] = pd.to_datetime(df[self.timestamp_col], utc=True, errors="coerce")
        df["date_bin"] = df[self.timestamp_col].dt.date

        group_cols = ["city", "parameter", "date_bin"]
        group_cols = [c for c in group_cols if c in df.columns]

        # Core AQI aggregations
        agg_dict = {
            "value": AGG_FUNCTIONS_WITH_COUNT,
        }

        # Weather aggregations
        weather_agg = {
            "temperature_2m": ["mean", "min", "max"],
            "relative_humidity_2m": ["mean", "min", "max"],
            "wind_speed_10m": ["mean", "max"],
            "wind_direction_10m": ["mean"],
            "precipitation": ["sum", "max"],
            "surface_pressure": ["mean"],
        }
        for col, funcs in weather_agg.items():
            if col in df.columns:
                agg_dict[col] = funcs

        result = df.groupby(group_cols).agg(agg_dict).reset_index()

        # Flatten columns
        result.columns = [
            "_".join(filter(None, col)).rstrip("_") if isinstance(col, tuple) else col
            for col in result.columns
        ]

        # Add derived daily metrics
        result = self._add_daily_derived_metrics(result)

        result = result.rename(columns={"date_bin": "date"})
        logger.info(f"Daily aggregation: {len(result)} records")
        return result

    def _add_daily_derived_metrics(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add derived metrics to daily aggregations."""
        # Peak-to-mean ratio (indicates variability)
        if "value_max" in df.columns and "value_mean" in df.columns:
            df["value_peak_to_mean"] = df["value_max"] / df["value_mean"].replace(0, np.nan)

        # Diurnal range
        if "value_max" in df.columns and "value_min" in df.columns:
            df["value_diurnal_range"] = df["value_max"] - df["value_min"]

        # Coefficient of variation
        if "value_std" in df.columns and "value_mean" in df.columns:
            df["value_cv"] = df["value_std"] / df["value_mean"].replace(0, np.nan)

        # Data completeness (observations per day out of 24 expected)
        if "value_count" in df.columns:
            df["data_completeness_pct"] = (df["value_count"] / 24 * 100).clip(0, 100)

        return df

    def aggregate_weekly(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Aggregate to weekly level.

        Args:
            df: Cleaned AQI DataFrame

        Returns:
            Weekly aggregated DataFrame
        """
        if df.empty or self.timestamp_col not in df.columns:
            return df

        df = df.copy()
        df[self.timestamp_col] = pd.to_datetime(df[self.timestamp_col], utc=True, errors="coerce")
        df["week_bin"] = df[self.timestamp_col].dt.to_period("W").apply(lambda r: r.start_time)

        group_cols = ["city", "parameter", "week_bin"]
        group_cols = [c for c in group_cols if c in df.columns]

        agg_dict = {"value": AGG_FUNCTIONS_WITH_COUNT}
        
        for col in ["temperature_2m", "relative_humidity_2m", "wind_speed_10m", "precipitation"]:
            if col in df.columns:
                agg_dict[col] = AGG_FUNCTIONS

        result = df.groupby(group_cols).agg(agg_dict).reset_index()
        result.columns = [
            "_".join(filter(None, col)).rstrip("_") if isinstance(col, tuple) else col
            for col in result.columns
        ]

        # Add weekly derived metrics
        if "value_count" in result.columns:
            result["data_completeness_pct"] = (result["value_count"] / (24 * 7) * 100).clip(0, 100)

        # Unhealthy hours count (approximate)
        if "value_max" in result.columns and "value_mean" in result.columns:
            result["estimated_unhealthy_hours"] = (result["value_mean"] > 100).astype(int) * result.get("value_count", 0)

        result = result.rename(columns={"week_bin": "week_start"})
        logger.info(f"Weekly aggregation: {len(result)} records")
        return result

    def aggregate_monthly(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Aggregate to monthly level.

        Args:
            df: Cleaned AQI DataFrame

        Returns:
            Monthly aggregated DataFrame
        """
        if df.empty or self.timestamp_col not in df.columns:
            return df

        df = df.copy()
        df[self.timestamp_col] = pd.to_datetime(df[self.timestamp_col], utc=True, errors="coerce")
        df["month_bin"] = df[self.timestamp_col].dt.to_period("M").apply(lambda r: r.start_time)

        group_cols = ["city", "parameter", "month_bin"]
        group_cols = [c for c in group_cols if c in df.columns]

        agg_dict = {"value": AGG_FUNCTIONS_WITH_COUNT}
        for col in ["temperature_2m", "relative_humidity_2m", "wind_speed_10m", "precipitation"]:
            if col in df.columns:
                agg_dict[col] = AGG_FUNCTIONS

        result = df.groupby(group_cols).agg(agg_dict).reset_index()
        result.columns = [
            "_".join(filter(None, col)).rstrip("_") if isinstance(col, tuple) else col
            for col in result.columns
        ]

        result = result.rename(columns={"month_bin": "month_start"})
        logger.info(f"Monthly aggregation: {len(result)} records")
        return result

    def compute_city_daily_summary(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Compute a city-level daily summary combining all parameters.

        For each city + date, produces one row with:
        - PM2.5 avg, PM10 avg, AQI avg
        - Dominant pollutant
        - Weather summary
        - Health category

        Args:
            df: Daily aggregated AQI DataFrame

        Returns:
            City-daily summary DataFrame (one row per city per day)
        """
        if df.empty or "city" not in df.columns:
            return df

        # Pivot parameters to columns
        if "parameter" in df.columns and "value_mean" in df.columns:
            pivot = df.pivot_table(
                index=["city", "date"] if "date" in df.columns else ["city"],
                columns="parameter",
                values="value_mean",
                aggfunc="first",
            ).reset_index()
            pivot.columns.name = None
        else:
            return df

        # Determine dominant pollutant (highest relative to standard)
        pollutant_standards = {
            "pm25": 60, "pm10": 150, "so2": 80, "no2": 80,
            "o3": 100, "co": 4, "nh3": 400,
        }

        def get_dominant(row):
            max_ratio = 0
            dominant = None
            for param, standard in pollutant_standards.items():
                if param in row and pd.notna(row[param]):
                    ratio = row[param] / standard
                    if ratio > max_ratio:
                        max_ratio = ratio
                        dominant = param
            return dominant

        pivot["dominant_pollutant"] = pivot.apply(get_dominant, axis=1)

        # Health category based on AQI or PM2.5
        if "aqi" in pivot.columns:
            pivot["health_category"] = pivot["aqi"].apply(self._aqi_to_category)
        elif "pm25" in pivot.columns:
            pivot["health_category"] = pivot["pm25"].apply(self._pm25_to_category)

        logger.info(f"City daily summary: {len(pivot)} records")
        return pivot

    @staticmethod
    def _aqi_to_category(aqi: float) -> str:
        """Map AQI value to health category."""
        if pd.isna(aqi):
            return "Unknown"
        if aqi <= 50:
            return "Good"
        elif aqi <= 100:
            return "Satisfactory"
        elif aqi <= 200:
            return "Moderate"
        elif aqi <= 300:
            return "Poor"
        elif aqi <= 400:
            return "Very Poor"
        else:
            return "Severe"

    @staticmethod
    def _pm25_to_category(pm25: float) -> str:
        """Map PM2.5 to approximate health category."""
        if pd.isna(pm25):
            return "Unknown"
        if pm25 <= 30:
            return "Good"
        elif pm25 <= 60:
            return "Satisfactory"
        elif pm25 <= 90:
            return "Moderate"
        elif pm25 <= 120:
            return "Poor"
        elif pm25 <= 250:
            return "Very Poor"
        else:
            return "Severe"

    def compute_exceedance_days(self, df: pd.DataFrame, threshold: float = 100) -> pd.DataFrame:
        """
        Count days where AQI exceeded a threshold per city.

        Args:
            df: Daily aggregated DataFrame
            threshold: AQI threshold for exceedance

        Returns:
            DataFrame with exceedance counts per city
        """
        if df.empty:
            return pd.DataFrame()

        # Get daily mean values
        if "value_mean" in df.columns and "parameter" in df.columns:
            aqi_daily = df[df["parameter"].isin(["aqi", "pm25"])].copy()
            if aqi_daily.empty:
                return pd.DataFrame()

            exceedance = aqi_daily[aqi_daily["value_mean"] > threshold].groupby("city").agg(
                exceedance_days=("value_mean", "count"),
                avg_exceedance_value=("value_mean", "mean"),
                max_exceedance_value=("value_mean", "max"),
            ).reset_index()

            # Total days for percentage
            total_days = aqi_daily.groupby("city")["value_mean"].count().reset_index()
            total_days.columns = ["city", "total_days"]

            exceedance = exceedance.merge(total_days, on="city", how="left")
            exceedance["exceedance_pct"] = (
                exceedance["exceedance_days"] / exceedance["total_days"] * 100
            ).round(2)

            return exceedance

        return pd.DataFrame()

    def run_all_aggregations(self, df: pd.DataFrame, output_dir: str = "data/aggregations") -> dict[str, pd.DataFrame]:
        """
        Run all aggregation levels and save to CSV.

        Args:
            df: Cleaned AQI DataFrame
            output_dir: Directory to save aggregated files

        Returns:
            Dict of {aggregation_level: DataFrame}
        """
        os.makedirs(output_dir, exist_ok=True)

        results = {}

        # Hourly
        hourly = self.aggregate_hourly(df)
        hourly.to_csv(f"{output_dir}/hourly_agg.csv", index=False)
        results["hourly"] = hourly

        # Daily
        daily = self.aggregate_daily(df)
        daily.to_csv(f"{output_dir}/daily_agg.csv", index=False)
        results["daily"] = daily

        # Weekly
        weekly = self.aggregate_weekly(df)
        weekly.to_csv(f"{output_dir}/weekly_agg.csv", index=False)
        results["weekly"] = weekly

        # Monthly
        monthly = self.aggregate_monthly(df)
        monthly.to_csv(f"{output_dir}/monthly_agg.csv", index=False)
        results["monthly"] = monthly

        # City daily summary
        city_daily = self.compute_city_daily_summary(daily)
        city_daily.to_csv(f"{output_dir}/city_daily_summary.csv", index=False)
        results["city_daily"] = city_daily

        # Exceedance days
        exceedance = self.compute_exceedance_days(daily)
        exceedance.to_csv(f"{output_dir}/exceedance_days.csv", index=False)
        results["exceedance"] = exceedance

        logger.info(f"All aggregations saved to {output_dir}")
        return results


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Compute data aggregations")
    parser.add_argument("--input", type=str, required=True, help="Input CSV path")
    parser.add_argument("--output-dir", type=str, default="data/aggregations", help="Output directory")
    args = parser.parse_args()

    df = pd.read_csv(args.input)
    agg = Aggregator()
    results = agg.run_all_aggregations(df, args.output_dir)
    for level, result_df in results.items():
        print(f"{level}: {len(result_df)} records")


if __name__ == "__main__":
    main()

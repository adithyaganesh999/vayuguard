"""
VayuGuard Data Pipeline - Cohort Analysis
============================================
Zone-based cohort analysis tracking which zones/cities are worst
over time, with trend detection and comparative metrics.
"""

import logging
from typing import Optional

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# Cohort period definitions
COHORT_PERIODS = {
    "daily": "D",
    "weekly": "W",
    "monthly": "M",
}

# AQI zone classifications for cohort grouping
AQI_ZONE_THRESHOLDS = {
    "green_zone": (0, 50),
    "yellow_zone": (51, 100),
    "orange_zone": (101, 200),
    "red_zone": (201, 300),
    "purple_zone": (301, 400),
    "maroon_zone": (401, 500),
}


class CohortAnalyzer:
    """
    Performs zone-based cohort analysis on air quality data.
    
    Tracks how cities/zones perform over time, identifies:
    - Persistently polluted zones
    - Improving/degrading air quality trends
    - Seasonal patterns by zone
    - Comparative cohort metrics
    """

    def __init__(
        self,
        cohort_period: str = "weekly",
        aqi_column: str = "value",
    ):
        """
        Args:
            cohort_period: Aggregation period ('daily', 'weekly', 'monthly')
            aqi_column: Column name containing AQI values
        """
        self.cohort_period = cohort_period
        self.aqi_column = aqi_column

    def analyze(self, df: pd.DataFrame) -> dict:
        """
        Run comprehensive cohort analysis.

        Args:
            df: Merged AQI DataFrame with city, value, timestamp_utc

        Returns:
            Dict with analysis results
        """
        if df.empty:
            logger.warning("Empty DataFrame for cohort analysis")
            return {}

        results = {
            "zone_cohort": self._zone_cohort_analysis(df),
            "trend_analysis": self._trend_analysis(df),
            "seasonal_patterns": self._seasonal_analysis(df),
            "comparative_rankings": self._comparative_rankings(df),
            "persistence_analysis": self._persistence_analysis(df),
        }

        logger.info("Cohort analysis complete")
        return results

    def _zone_cohort_analysis(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Classify cities into AQI zones and track over time periods.
        
        Each city gets a zone classification per period based on avg AQI.
        """
        ts_col = "timestamp_utc" if "timestamp_utc" in df.columns else "timestamp_local"
        if ts_col not in df.columns or "city" not in df.columns:
            return pd.DataFrame()

        df = df.copy()
        df[ts_col] = pd.to_datetime(df[ts_col], utc=True, errors="coerce")

        # Create period bins
        period_map = {"daily": "D", "weekly": "W", "monthly": "M"}
        freq = period_map.get(self.cohort_period, "W")
        df["period"] = df[ts_col].dt.to_period(freq)

        # Compute city-period averages
        city_period = df.groupby(["city", "period"])[self.aqi_column].agg(
            ["mean", "max", "min", "std", "count"]
        ).reset_index()
        city_period.columns = ["city", "period", "avg_aqi", "max_aqi", "min_aqi", "std_aqi", "reading_count"]

        # Classify into zones
        city_period["zone"] = city_period["avg_aqi"].apply(self._classify_zone)

        # Add zone transition tracking
        city_period = city_period.sort_values(["city", "period"])
        city_period["prev_zone"] = city_period.groupby("city")["zone"].shift(1)
        city_period["zone_change"] = city_period.apply(
            lambda row: self._zone_change_type(row["prev_zone"], row["zone"]),
            axis=1,
        )

        return city_period

    def _trend_analysis(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Analyze AQI trends per city using linear regression.
        
        Detects improving, degrading, or stable air quality trends.
        """
        ts_col = "timestamp_utc" if "timestamp_utc" in df.columns else "timestamp_local"
        if ts_col not in df.columns or "city" not in df.columns:
            return pd.DataFrame()

        df = df.copy()
        df[ts_col] = pd.to_datetime(df[ts_col], utc=True, errors="coerce")

        results = []
        for city in df["city"].unique():
            city_df = df[df["city"] == city].sort_values(ts_col)
            if len(city_df) < 10:
                continue

            # Compute daily averages
            daily = city_df.set_index(ts_col).resample("D")[self.aqi_column].mean().dropna()
            if len(daily) < 7:
                continue

            # Linear regression for trend
            x = np.arange(len(daily))
            y = daily.values
            
            try:
                slope, intercept = np.polyfit(x, y, 1)
            except (np.linalg.LinAlgError, ValueError):
                continue

            # Trend statistics
            trend_direction = "improving" if slope < -0.5 else "degrading" if slope > 0.5 else "stable"
            trend_magnitude = abs(slope) * 30  # AQI change per month

            # Compute R² for trend significance
            y_pred = slope * x + intercept
            ss_res = np.sum((y - y_pred) ** 2)
            ss_tot = np.sum((y - np.mean(y)) ** 2)
            r_squared = 1 - ss_res / ss_tot if ss_tot > 0 else 0

            results.append({
                "city": city,
                "trend_slope": round(slope, 4),
                "trend_direction": trend_direction,
                "monthly_aqi_change": round(trend_magnitude, 2),
                "r_squared": round(r_squared, 4),
                "period_start": str(daily.index.min()),
                "period_end": str(daily.index.max()),
                "data_points": len(daily),
                "avg_aqi": round(daily.mean(), 2),
            })

        trend_df = pd.DataFrame(results)
        if not trend_df.empty:
            trend_df = trend_df.sort_values("trend_slope", ascending=False)
        return trend_df

    def _seasonal_analysis(self, df: pd.DataFrame) -> pd.DataFrame:
        """Analyze seasonal patterns in AQI data."""
        ts_col = "timestamp_utc" if "timestamp_utc" in df.columns else "timestamp_local"
        if ts_col not in df.columns or "city" not in df.columns:
            return pd.DataFrame()

        df = df.copy()
        df[ts_col] = pd.to_datetime(df[ts_col], utc=True, errors="coerce")

        df["month"] = df[ts_col].dt.month
        df["season"] = df["month"].map({
            12: "winter", 1: "winter", 2: "winter",
            3: "spring", 4: "spring", 5: "spring",
            6: "monsoon", 7: "monsoon", 8: "monsoon", 9: "monsoon",
            10: "post_monsoon", 11: "post_monsoon",
        })

        seasonal = df.groupby(["city", "season"])[self.aqi_column].agg(
            ["mean", "max", "min", "std", "count"]
        ).reset_index()
        seasonal.columns = ["city", "season", "avg_aqi", "max_aqi", "min_aqi", "std_aqi", "reading_count"]

        # Add worst season per city
        worst_season = seasonal.loc[seasonal.groupby("city")["avg_aqi"].idxmax()][
            ["city", "season", "avg_aqi"]
        ].rename(columns={"season": "worst_season", "avg_aqi": "worst_season_avg_aqi"})

        best_season = seasonal.loc[seasonal.groupby("city")["avg_aqi"].idxmin()][
            ["city", "season", "avg_aqi"]
        ].rename(columns={"season": "best_season", "avg_aqi": "best_season_avg_aqi"})

        seasonal_summary = worst_season.merge(best_season, on="city", how="outer")
        seasonal_summary["seasonal_variation"] = (
            seasonal_summary["worst_season_avg_aqi"] - seasonal_summary["best_season_avg_aqi"]
        ).round(2)

        return seasonal_summary

    def _comparative_rankings(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Rank cities by various AQI metrics.
        
        Rankings:
        - Worst average AQI
        - Most unhealthy hours
        - Highest peak AQI
        - Worst data quality
        """
        if "city" not in df.columns or self.aqi_column not in df.columns:
            return pd.DataFrame()

        rankings = df.groupby("city")[self.aqi_column].agg(
            avg_aqi=("mean"),
            max_aqi=("max"),
            std_aqi=("std"),
            reading_count=("count"),
        ).reset_index()

        # Unhealthy hours (AQI > 200)
        unhealthy = df[df[self.aqi_column] > 200].groupby("city").size().reset_index(name="unhealthy_hours")
        rankings = rankings.merge(unhealthy, on="city", how="left")
        rankings["unhealthy_hours"] = rankings["unhealthy_hours"].fillna(0).astype(int)

        # Rank columns
        rankings["rank_avg"] = rankings["avg_aqi"].rank(ascending=False).astype(int)
        rankings["rank_peak"] = rankings["max_aqi"].rank(ascending=False).astype(int)
        rankings["rank_unhealthy"] = rankings["unhealthy_hours"].rank(ascending=False).astype(int)

        # Composite score
        rankings["composite_rank"] = (
            rankings["rank_avg"] * 0.4 +
            rankings["rank_peak"] * 0.3 +
            rankings["rank_unhealthy"] * 0.3
        ).rank().astype(int)

        return rankings.sort_values("composite_rank")

    def _persistence_analysis(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Analyze persistence of poor air quality episodes.
        
        Metrics:
        - Average episode length (consecutive hours > threshold)
        - Max episode length
        - Recovery time (time to return below threshold)
        """
        ts_col = "timestamp_utc" if "timestamp_utc" in df.columns else "timestamp_local"
        if ts_col not in df.columns or "city" not in df.columns:
            return pd.DataFrame()

        df = df.copy()
        df[ts_col] = pd.to_datetime(df[ts_col], utc=True, errors="coerce")
        df = df.sort_values(["city", ts_col])

        threshold = 200  # Poor AQI threshold
        results = []

        for city in df["city"].unique():
            city_df = df[df["city"] == city].sort_values(ts_col)
            values = city_df[self.aqi_column].values

            if len(values) < 10:
                continue

            # Find episodes
            is_poor = values > threshold
            episodes = []
            episode_start = None

            for i, poor in enumerate(is_poor):
                if poor and episode_start is None:
                    episode_start = i
                elif not poor and episode_start is not None:
                    episodes.append(i - episode_start)
                    episode_start = None

            # Handle episode at end of data
            if episode_start is not None:
                episodes.append(len(is_poor) - episode_start)

            # Compute metrics
            total_poor_hours = int(is_poor.sum())
            poor_pct = total_poor_hours / len(values) * 100
            avg_episode = np.mean(episodes) if episodes else 0
            max_episode = max(episodes) if episodes else 0
            num_episodes = len(episodes)

            results.append({
                "city": city,
                "poor_threshold": threshold,
                "total_poor_hours": total_poor_hours,
                "poor_pct": round(poor_pct, 2),
                "num_episodes": num_episodes,
                "avg_episode_length_hours": round(avg_episode, 1),
                "max_episode_length_hours": max_episode,
            })

        return pd.DataFrame(results).sort_values("poor_pct", ascending=False)

    @staticmethod
    def _classify_zone(aqi: float) -> str:
        """Classify AQI value into zone name."""
        for zone, (low, high) in AQI_ZONE_THRESHOLDS.items():
            if low <= aqi <= high:
                return zone
        return "maroon_zone" if aqi > 500 else "unknown_zone"

    @staticmethod
    def _zone_change_type(prev_zone: Optional[str], current_zone: str) -> str:
        """Classify zone transition type."""
        if pd.isna(prev_zone):
            return "new"
        
        zone_order = list(AQI_ZONE_THRESHOLDS.keys())
        try:
            prev_idx = zone_order.index(prev_zone)
            curr_idx = zone_order.index(current_zone)
        except ValueError:
            return "unknown"
        
        if curr_idx < prev_idx:
            return "improved"
        elif curr_idx > prev_idx:
            return "degraded"
        else:
            return "stable"

    def generate_report(self, results: dict) -> str:
        """Generate human-readable cohort analysis report."""
        lines = [
            "VayuGuard Zone-Based Cohort Analysis Report",
            "=" * 55,
        ]

        if "trend_analysis" in results and not results["trend_analysis"].empty:
            trends = results["trend_analysis"]
            lines.append("\nAQI Trend Analysis:")
            lines.append("-" * 40)
            improving = trends[trends["trend_direction"] == "improving"]
            degrading = trends[trends["trend_direction"] == "degrading"]
            lines.append(f"  Cities improving: {len(improving)}")
            lines.append(f"  Cities degrading: {len(degrading)}")
            lines.append(f"  Cities stable: {len(trends) - len(improving) - len(degrading)}")

        if "comparative_rankings" in results and not results["comparative_rankings"].empty:
            rankings = results["comparative_rankings"]
            lines.append("\nTop 5 Most Polluted Cities (Composite Rank):")
            lines.append("-" * 40)
            for _, row in rankings.head(5).iterrows():
                lines.append(
                    f"  #{row['composite_rank']:.0f} {row['city']}: "
                    f"Avg AQI {row['avg_aqi']:.0f}, "
                    f"Peak {row['max_aqi']:.0f}, "
                    f"Unhealthy hours {row['unhealthy_hours']}"
                )

        if "persistence_analysis" in results and not results["persistence_analysis"].empty:
            persistence = results["persistence_analysis"]
            lines.append("\nPollution Persistence (Poorest Cities):")
            lines.append("-" * 40)
            for _, row in persistence.head(5).iterrows():
                lines.append(
                    f"  {row['city']}: {row['poor_pct']:.1f}% time in poor zone, "
                    f"avg episode {row['avg_episode_length_hours']:.1f}h, "
                    f"max episode {row['max_episode_length_hours']}h"
                )

        return "\n".join(lines)


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Cohort analysis")
    parser.add_argument("--input", type=str, required=True, help="Input CSV path")
    parser.add_argument("--period", choices=["daily", "weekly", "monthly"], default="weekly")
    args = parser.parse_args()

    df = pd.read_csv(args.input)
    analyzer = CohortAnalyzer(cohort_period=args.period)
    results = analyzer.analyze(df)
    print(analyzer.generate_report(results))


if __name__ == "__main__":
    main()

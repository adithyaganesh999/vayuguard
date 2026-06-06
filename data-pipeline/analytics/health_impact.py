"""
VayuGuard Data Pipeline - Health Impact Analysis
===================================================
Analyzes health risks by demographic groups based on AQI exposure,
using WHO and CPCB health impact guidelines.
"""

import logging
from typing import Optional

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# WHO AQI health breakpoints and associated health impacts
HEALTH_IMPACT_LEVELS = {
    (0, 50): {
        "category": "Good",
        "color": "#00e400",
        "general_population": "Air quality is satisfactory, and air pollution poses little or no risk.",
        "sensitive_groups": "No health concern.",
        "health_impact_score": 0,
    },
    (51, 100): {
        "category": "Satisfactory",
        "color": "#ffff00",
        "general_population": "Air quality is acceptable. However, there may be a risk for some people.",
        "sensitive_groups": "People with respiratory disease may experience moderate effects.",
        "health_impact_score": 1,
    },
    (101, 200): {
        "category": "Moderate",
        "color": "#ff7e00",
        "general_population": "Members of sensitive groups may experience health effects.",
        "sensitive_groups": "People with lung disease, older adults, children are at greater risk.",
        "health_impact_score": 2,
    },
    (201, 300): {
        "category": "Poor",
        "color": "#ff0000",
        "general_population": "Everyone may begin to experience health effects.",
        "sensitive_groups": "People with heart/lung disease, older adults, children at serious risk.",
        "health_impact_score": 3,
    },
    (301, 400): {
        "category": "Very Poor",
        "color": "#8f3f97",
        "general_population": "Health alert: everyone may experience more serious health effects.",
        "sensitive_groups": "Emergency conditions. All sensitive groups at severe risk.",
        "health_impact_score": 4,
    },
    (401, 500): {
        "category": "Severe",
        "color": "#7e0023",
        "general_population": "Health warning of emergency conditions. Entire population affected.",
        "sensitive_groups": "Life-threatening conditions for sensitive groups.",
        "health_impact_score": 5,
    },
}

# Demographic vulnerability multipliers (relative risk)
DEMOGRAPHIC_MULTIPLIERS = {
    "children_0_5": 2.5,    # Highest vulnerability
    "children_6_14": 1.8,
    "elderly_65_plus": 2.2,
    "adults_with_asthma": 2.0,
    "adults_with_heart_disease": 2.3,
    "pregnant_women": 1.9,
    "outdoor_workers": 1.7,
    "general_adults": 1.0,  # Baseline
}

# Population distribution by demographic (approximate Indian urban)
DEFAULT_POPULATION_DISTRIBUTION = {
    "children_0_5": 0.10,
    "children_6_14": 0.15,
    "elderly_65_plus": 0.07,
    "adults_with_asthma": 0.05,
    "adults_with_heart_disease": 0.04,
    "pregnant_women": 0.03,
    "outdoor_workers": 0.15,
    "general_adults": 0.41,
}

# Estimated city populations (millions, approximate)
CITY_POPULATIONS = {
    "Delhi": 32.0,
    "Mumbai": 21.0,
    "Kolkata": 15.0,
    "Chennai": 12.0,
    "Bangalore": 14.0,
    "Hyderabad": 10.0,
    "Pune": 8.0,
    "Ahmedabad": 8.0,
    "Lucknow": 4.0,
    "Jaipur": 4.0,
}


class HealthImpactAnalyzer:
    """
    Analyzes health impact of air pollution across demographic groups.
    
    Computes:
    - Population exposure by AQI category
    - Risk-weighted population exposure
    - Estimated health outcomes (respiratory, cardiovascular)
    - Vulnerability index per city
    """

    def __init__(
        self,
        population_distribution: Optional[dict] = None,
        city_populations: Optional[dict] = None,
    ):
        self.population_distribution = population_distribution or DEFAULT_POPULATION_DISTRIBUTION
        self.city_populations = city_populations or CITY_POPULATIONS

    def analyze(self, df: pd.DataFrame) -> dict:
        """
        Run comprehensive health impact analysis.

        Args:
            df: Merged AQI + weather DataFrame with city, value, parameter

        Returns:
            Dict with analysis results:
            - exposure_by_category: Population exposed to each AQI level
            - risk_by_demographic: Risk-weighted exposure per group
            - city_vulnerability_index: Vulnerability score per city
            - estimated_health_outcomes: Projected health events
        """
        if df.empty:
            logger.warning("Empty DataFrame for health impact analysis")
            return {}

        # Get AQI/PM2.5 values
        aqi_data = self._extract_aqi_values(df)
        if aqi_data.empty:
            return {}

        results = {
            "exposure_by_category": self._compute_exposure_by_category(aqi_data),
            "risk_by_demographic": self._compute_risk_by_demographic(aqi_data),
            "city_vulnerability_index": self._compute_city_vulnerability(aqi_data),
            "estimated_health_outcomes": self._estimate_health_outcomes(aqi_data),
            "temporal_health_risk": self._compute_temporal_risk(aqi_data),
        }

        logger.info("Health impact analysis complete")
        return results

    def _extract_aqi_values(self, df: pd.DataFrame) -> pd.DataFrame:
        """Extract AQI or PM2.5 values for analysis."""
        if "parameter" in df.columns:
            aqi_df = df[df["parameter"].isin(["aqi", "pm25"])].copy()
            if aqi_df.empty:
                # Use any available parameter
                aqi_df = df.copy()
        else:
            aqi_df = df.copy()
        return aqi_df

    def _compute_exposure_by_category(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute population exposure by AQI category."""
        if "city" not in df.columns or "value" not in df.columns:
            return pd.DataFrame()

        # Get average AQI per city
        city_avg = df.groupby("city")["value"].mean().reset_index()
        city_avg.columns = ["city", "avg_aqi"]

        # Classify each city
        city_avg["health_category"] = city_avg["avg_aqi"].apply(self._classify_aqi)
        city_avg["impact_score"] = city_avg["avg_aqi"].apply(self._get_impact_score)
        city_avg["population_millions"] = city_avg["city"].map(self.city_populations).fillna(1.0)

        # Exposure by category
        exposure = city_avg.groupby("health_category").agg(
            cities_affected=("city", "count"),
            total_population_millions=("population_millions", "sum"),
            avg_aqi=("avg_aqi", "mean"),
            max_aqi=("avg_aqi", "max"),
        ).reset_index()

        return exposure

    def _compute_risk_by_demographic(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute risk-weighted exposure for each demographic group."""
        if "city" not in df.columns or "value" not in df.columns:
            return pd.DataFrame()

        city_avg = df.groupby("city")["value"].mean().reset_index()
        city_avg.columns = ["city", "avg_aqi"]

        results = []
        for demo, multiplier in DEMOGRAPHIC_MULTIPLIERS.items():
            pop_fraction = self.population_distribution.get(demo, 0.1)
            
            for _, row in city_avg.iterrows():
                impact_score = self._get_impact_score(row["avg_aqi"])
                risk_score = impact_score * multiplier
                city_pop = self.city_populations.get(row["city"], 1.0) * 1_000_000
                exposed_pop = city_pop * pop_fraction
                
                results.append({
                    "demographic": demo,
                    "city": row["city"],
                    "avg_aqi": round(row["avg_aqi"], 2),
                    "impact_score": impact_score,
                    "vulnerability_multiplier": multiplier,
                    "risk_score": round(risk_score, 2),
                    "exposed_population": int(exposed_pop),
                    "risk_weighted_exposure": round(risk_score * exposed_pop / 1_000_000, 2),
                })

        return pd.DataFrame(results)

    def _compute_city_vulnerability(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Compute vulnerability index for each city.
        
        Combines pollution levels, population density, and demographic vulnerability.
        """
        if "city" not in df.columns or "value" not in df.columns:
            return pd.DataFrame()

        city_stats = df.groupby("city")["value"].agg(["mean", "max", "std"]).reset_index()
        city_stats.columns = ["city", "avg_aqi", "max_aqi", "aqi_std"]

        city_stats["population_millions"] = city_stats["city"].map(self.city_populations).fillna(1.0)

        # Compute vulnerability index (0-100)
        city_stats["vulnerability_index"] = city_stats.apply(
            lambda row: self._calculate_vulnerability_index(
                row["avg_aqi"], row["max_aqi"], row["aqi_std"], row["population_millions"]
            ),
            axis=1,
        )

        # Classify vulnerability
        city_stats["vulnerability_level"] = pd.cut(
            city_stats["vulnerability_index"],
            bins=[0, 20, 40, 60, 80, 100],
            labels=["Low", "Moderate", "High", "Very High", "Critical"],
        )

        return city_stats.sort_values("vulnerability_index", ascending=False)

    @staticmethod
    def _calculate_vulnerability_index(avg_aqi, max_aqi, aqi_std, population) -> float:
        """Calculate composite vulnerability index (0-100)."""
        # Pollution component (40%)
        pollution_score = min(avg_aqi / 500 * 100, 100)

        # Peak exposure component (25%)
        peak_score = min(max_aqi / 500 * 100, 100)

        # Variability component (15%) - high variability = harder to prepare
        variability_score = min(aqi_std / 100 * 100, 100) if pd.notna(aqi_std) else 0

        # Population density component (20%)
        pop_score = min(population / 30 * 100, 100)

        return round(
            pollution_score * 0.40 +
            peak_score * 0.25 +
            variability_score * 0.15 +
            pop_score * 0.20,
            2,
        )

    def _estimate_health_outcomes(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Estimate health outcomes based on exposure levels.
        
        Uses WHO relative risk estimates for PM2.5 exposure.
        These are rough estimates for planning purposes.
        """
        if "city" not in df.columns or "value" not in df.columns:
            return pd.DataFrame()

        city_avg = df.groupby("city")["value"].mean().reset_index()
        city_avg.columns = ["city", "avg_aqi"]

        # Baseline rates per 100,000 population (Indian urban estimates)
        BASELINE_RATES = {
            "respiratory_er_visits": 500,
            "asthma_attacks": 300,
            "cv_hospitalizations": 200,
            "premature_deaths": 50,
        }

        # Relative risk multipliers per AQI level
        RR_MULTIPLIERS = {
            (0, 50): 1.0,
            (51, 100): 1.15,
            (101, 200): 1.5,
            (201, 300): 2.2,
            (301, 400): 3.5,
            (401, 500): 5.0,
        }

        results = []
        for _, row in city_avg.iterrows():
            city_pop = self.city_populations.get(row["city"], 1.0) * 1_000_000
            aqi = row["avg_aqi"]

            # Get relative risk for this AQI level
            rr = 1.0
            for (low, high), mult in RR_MULTIPLIERS.items():
                if low <= aqi <= high:
                    rr = mult
                    break
            elif aqi > 500:
                rr = 5.0

            for outcome, baseline in BASELINE_RATES.items():
                estimated = baseline * rr * (city_pop / 100_000)
                attributable = estimated - baseline * (city_pop / 100_000)
                results.append({
                    "city": row["city"],
                    "avg_aqi": round(aqi, 2),
                    "relative_risk": rr,
                    "health_outcome": outcome,
                    "estimated_annual_cases": int(estimated),
                    "pollution_attributable_cases": int(attributable),
                    "population": int(city_pop),
                })

        return pd.DataFrame(results)

    def _compute_temporal_risk(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute health risk by time of day (rush hours vs off-peak)."""
        ts_col = "timestamp_utc" if "timestamp_utc" in df.columns else "timestamp_local"
        if ts_col not in df.columns:
            return pd.DataFrame()

        df = df.copy()
        df[ts_col] = pd.to_datetime(df[ts_col], utc=True, errors="coerce")
        df["hour"] = df[ts_col].dt.hour

        # Define time periods
        def get_time_period(hour):
            if 7 <= hour <= 10:
                return "morning_rush"
            elif 11 <= hour <= 16:
                return "midday"
            elif 17 <= hour <= 20:
                return "evening_rush"
            else:
                return "night"

        df["time_period"] = df["hour"].apply(get_time_period)

        temporal_risk = df.groupby(["city", "time_period"])["value"].agg(
            ["mean", "max", "count"]
        ).reset_index()
        temporal_risk.columns = ["city", "time_period", "avg_aqi", "max_aqi", "reading_count"]
        temporal_risk["health_category"] = temporal_risk["avg_aqi"].apply(self._classify_aqi)

        return temporal_risk

    @staticmethod
    def _classify_aqi(aqi: float) -> str:
        """Classify AQI value into health category."""
        for (low, high), info in HEALTH_IMPACT_LEVELS.items():
            if low <= aqi <= high:
                return info["category"]
        return "Severe" if aqi > 500 else "Unknown"

    @staticmethod
    def _get_impact_score(aqi: float) -> int:
        """Get numeric impact score (0-5) for AQI value."""
        for (low, high), info in HEALTH_IMPACT_LEVELS.items():
            if low <= aqi <= high:
                return info["health_impact_score"]
        return 5 if aqi > 500 else 0

    def generate_report(self, results: dict) -> str:
        """Generate a human-readable health impact report."""
        lines = [
            "VayuGuard Health Impact Analysis Report",
            "=" * 55,
        ]

        if "exposure_by_category" in results and not results["exposure_by_category"].empty:
            lines.append("\nPopulation Exposure by AQI Category:")
            lines.append("-" * 40)
            for _, row in results["exposure_by_category"].iterrows():
                lines.append(
                    f"  {row['health_category']}: "
                    f"{row['cities_affected']} cities, "
                    f"{row['total_population_millions']:.1f}M people exposed"
                )

        if "city_vulnerability_index" in results and not results["city_vulnerability_index"].empty:
            lines.append("\nCity Vulnerability Ranking:")
            lines.append("-" * 40)
            for _, row in results["city_vulnerability_index"].head(10).iterrows():
                lines.append(
                    f"  {row['city']}: Score {row['vulnerability_index']:.1f}/100 "
                    f"({row['vulnerability_level']}) - Avg AQI: {row['avg_aqi']:.0f}"
                )

        if "estimated_health_outcomes" in results and not results["estimated_health_outcomes"].empty:
            outcomes = results["estimated_health_outcomes"]
            total_attributable = outcomes.groupby("health_outcome")["pollution_attributable_cases"].sum()
            lines.append("\nEstimated Annual Pollution-Attributable Health Outcomes:")
            lines.append("-" * 55)
            for outcome, count in total_attributable.items():
                lines.append(f"  {outcome}: {count:,} cases attributable to pollution")

        return "\n".join(lines)


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Health impact analysis")
    parser.add_argument("--input", type=str, required=True, help="Input CSV path")
    parser.add_argument("--output", type=str, default="health_impact.json", help="Output path")
    args = parser.parse_args()

    df = pd.read_csv(args.input)
    analyzer = HealthImpactAnalyzer()
    results = analyzer.analyze(df)
    print(analyzer.generate_report(results))


if __name__ == "__main__":
    main()

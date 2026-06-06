"""
VayuGuard Data Pipeline - Ingestion Orchestrator
==================================================
Main orchestrator that schedules and coordinates all data ingestion
tasks using APScheduler with logging, error recovery, and health checks.
"""

import os
import sys
import time
import logging
import traceback
from datetime import datetime, timedelta
from typing import Optional
from pathlib import Path

import pandas as pd

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from ingestion.openaq_fetcher import OpenAQFetcher
from ingestion.cpcb_fetcher import CPCBFetcher
from ingestion.openmeteo_fetcher import OpenMeteoFetcher

logger = logging.getLogger("vayuguard.orchestrator")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("logs/pipeline.log") if Path("logs").exists() else logging.StreamHandler(),
    ],
)

# Cities to track
DEFAULT_CITIES = [
    "Delhi", "Mumbai", "Kolkata", "Chennai", "Bangalore",
    "Hyderabad", "Pune", "Ahmedabad", "Lucknow", "Jaipur",
]

# Schedule configuration
SCHEDULE_CONFIG = {
    "aqi_ingestion": {"minutes": 30},       # Every 30 min
    "weather_ingestion": {"minutes": 60},   # Every 1 hour
    "data_cleaning": {"minutes": 60},       # Every 1 hour
    "quality_report": {"hour": 6},          # Daily at 06:00 UTC
    "analytics": {"hour": 2},              # Daily at 02:00 UTC
}


class PipelineState:
    """Tracks pipeline execution state for error recovery."""

    def __init__(self, state_file: str = "logs/pipeline_state.json"):
        self.state_file = state_file
        self.state = self._load_state()

    def _load_state(self) -> dict:
        """Load state from file."""
        import json
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file, "r") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                logger.warning(f"Failed to load state file: {e}")
        return {
            "last_aqi_ingestion": None,
            "last_weather_ingestion": None,
            "last_cleaning": None,
            "last_quality_report": None,
            "last_analytics": None,
            "aqi_ingestion_count": 0,
            "weather_ingestion_count": 0,
            "errors": [],
        }

    def save(self):
        """Save state to file."""
        import json
        os.makedirs(os.path.dirname(self.state_file), exist_ok=True)
        with open(self.state_file, "w") as f:
            json.dump(self.state, f, indent=2, default=str)

    def update(self, key: str, value):
        """Update a state value."""
        self.state[key] = value
        self.save()

    def record_error(self, task: str, error: str):
        """Record an error in the state."""
        self.state.setdefault("errors", []).append({
            "task": task,
            "error": error,
            "timestamp": datetime.utcnow().isoformat(),
        })
        # Keep only last 100 errors
        self.state["errors"] = self.state["errors"][-100:]
        self.save()


class IngestionOrchestrator:
    """
    Main orchestrator for the VayuGuard data pipeline.
    
    Coordinates ingestion, cleaning, and analytics tasks with
    scheduling, error recovery, and health monitoring.
    """

    def __init__(
        self,
        cities: Optional[list[str]] = None,
        use_scheduler: bool = True,
        output_dir: str = "data",
        save_mode: str = "csv",  # "csv", "postgres", "mongo"
    ):
        self.cities = cities or DEFAULT_CITIES
        self.use_scheduler = use_scheduler
        self.output_dir = output_dir
        self.save_mode = save_mode
        self.state = PipelineState()

        # Initialize fetchers
        self.openaq = OpenAQFetcher()
        self.cpcb = CPCBFetcher()
        self.openmeteo = OpenMeteoFetcher()

        # Ensure output directories exist
        os.makedirs(f"{self.output_dir}/raw/aqi", exist_ok=True)
        os.makedirs(f"{self.output_dir}/raw/weather", exist_ok=True)
        os.makedirs(f"{self.output_dir}/cleaned", exist_ok=True)
        os.makedirs("logs", exist_ok=True)

        # Health tracking
        self._run_count = 0
        self._error_count = 0
        self._start_time = None

    def run_aqi_ingestion(self, hours_back: int = 1) -> pd.DataFrame:
        """
        Run AQI data ingestion from both OpenAQ and CPCB.

        Args:
            hours_back: How many hours of data to fetch

        Returns:
            Combined AQI DataFrame
        """
        logger.info(f"Starting AQI ingestion for {len(self.cities)} cities (last {hours_back}h)")
        frames = []

        # Fetch from OpenAQ
        try:
            logger.info("Fetching from OpenAQ...")
            openaq_df = self.openaq.fetch_recent_readings(
                cities=self.cities,
                parameters=["pm25", "pm10"],
                hours_back=hours_back,
            )
            if not openaq_df.empty:
                openaq_df["source"] = "openaq"
                frames.append(openaq_df)
                logger.info(f"OpenAQ: {len(openaq_df)} records")
        except Exception as e:
            logger.error(f"OpenAQ ingestion failed: {e}")
            self.state.record_error("aqi_ingestion_openaq", str(e))
            self._error_count += 1

        # Fetch from CPCB
        try:
            logger.info("Fetching from CPCB...")
            cpcb_df = self.cpcb.fetch_all_cities(self.cities)
            if not cpcb_df.empty:
                cpcb_df["source"] = "cpcb"
                frames.append(cpcb_df)
                logger.info(f"CPCB: {len(cpcb_df)} records")
        except Exception as e:
            logger.error(f"CPCB ingestion failed: {e}")
            self.state.record_error("aqi_ingestion_cpcb", str(e))
            self._error_count += 1

        if not frames:
            logger.warning("No AQI data fetched from any source")
            return pd.DataFrame()

        combined = pd.concat(frames, ignore_index=True)
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filepath = f"{self.output_dir}/raw/aqi/aqi_{timestamp}.csv"
        combined.to_csv(filepath, index=False)
        logger.info(f"AQI ingestion complete: {len(combined)} records saved to {filepath}")

        # Update state
        self.state.update("last_aqi_ingestion", datetime.utcnow().isoformat())
        self.state.update("aqi_ingestion_count", self.state.state.get("aqi_ingestion_count", 0) + len(combined))

        return combined

    def run_weather_ingestion(self, hours_back: int = 24) -> pd.DataFrame:
        """
        Run weather data ingestion from Open-Meteo.

        Args:
            hours_back: How many hours of weather data to fetch

        Returns:
            Weather DataFrame
        """
        logger.info(f"Starting weather ingestion for {len(self.cities)} cities")
        date_from = datetime.utcnow() - timedelta(hours=hours_back)

        try:
            weather_df = self.openmeteo.fetch_all_cities(
                cities=self.cities,
                date_from=date_from,
                frequency="hourly",
            )
        except Exception as e:
            logger.error(f"Weather ingestion failed: {e}")
            self.state.record_error("weather_ingestion", str(e))
            self._error_count += 1
            return pd.DataFrame()

        if weather_df.empty:
            logger.warning("No weather data fetched")
            return pd.DataFrame()

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filepath = f"{self.output_dir}/raw/weather/weather_{timestamp}.csv"
        weather_df.to_csv(filepath, index=False)
        logger.info(f"Weather ingestion complete: {len(weather_df)} records saved to {filepath}")

        self.state.update("last_weather_ingestion", datetime.utcnow().isoformat())
        self.state.update("weather_ingestion_count", self.state.state.get("weather_ingestion_count", 0) + len(weather_df))

        return weather_df

    def run_cleaning_pipeline(self, aqi_df: Optional[pd.DataFrame] = None, weather_df: Optional[pd.DataFrame] = None):
        """
        Run the data cleaning pipeline on ingested data.

        Args:
            aqi_df: Raw AQI DataFrame (if None, loads from latest CSV)
            weather_df: Raw weather DataFrame (if None, loads from latest CSV)
        """
        from cleaning.clean_aqi import AQICleaner
        from cleaning.join_weather import WeatherJoiner

        logger.info("Starting data cleaning pipeline...")

        # Load data if not provided
        if aqi_df is None:
            aqi_df = self._load_latest_csv(f"{self.output_dir}/raw/aqi")
        if weather_df is None:
            weather_df = self._load_latest_csv(f"{self.output_dir}/raw/weather")

        # Clean AQI data
        if aqi_df is not None and not aqi_df.empty:
            cleaner = AQICleaner()
            cleaned_aqi = cleaner.clean(aqi_df)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            cleaned_aqi.to_csv(f"{self.output_dir}/cleaned/aqi_cleaned_{timestamp}.csv", index=False)
            logger.info(f"Cleaned AQI: {len(cleaned_aqi)} records")
        else:
            cleaned_aqi = pd.DataFrame()
            logger.warning("No AQI data to clean")

        # Join with weather
        if not cleaned_aqi.empty and weather_df is not None and not weather_df.empty:
            joiner = WeatherJoiner()
            merged = joiner.join(cleaned_aqi, weather_df)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            merged.to_csv(f"{self.output_dir}/cleaned/merged_{timestamp}.csv", index=False)
            logger.info(f"Merged AQI+Weather: {len(merged)} records")
        else:
            logger.warning("Skipping merge - missing data")

        self.state.update("last_cleaning", datetime.utcnow().isoformat())

    def run_quality_checks(self):
        """Run data quality checks and generate report."""
        from cleaning.quality_checks import QualityChecker

        logger.info("Running data quality checks...")
        try:
            checker = QualityChecker()
            aqi_df = self._load_latest_csv(f"{self.output_dir}/cleaned", prefix="aqi_cleaned")
            if aqi_df is not None and not aqi_df.empty:
                report = checker.run_all_checks(aqi_df, dataset_name="aqi")
                logger.info(f"Quality report: {report.summary()}")
                # Save report
                timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
                report.save(f"logs/quality_report_{timestamp}.json")
            else:
                logger.warning("No cleaned AQI data available for quality checks")
        except Exception as e:
            logger.error(f"Quality checks failed: {e}")
            self.state.record_error("quality_checks", str(e))

        self.state.update("last_quality_report", datetime.utcnow().isoformat())

    def run_analytics(self):
        """Run analytics pipeline."""
        logger.info("Running analytics pipeline...")
        try:
            merged_df = self._load_latest_csv(f"{self.output_dir}/cleaned", prefix="merged")
            if merged_df is None or merged_df.empty:
                logger.warning("No merged data available for analytics")
                return

            from analytics.hotspots import HotspotDetector
            from analytics.health_impact import HealthImpactAnalyzer
            from analytics.cohort_analysis import CohortAnalyzer
            from analytics.forecast_accuracy import ForecastAccuracyCalculator

            # Hotspot detection
            detector = HotspotDetector()
            hotspots = detector.detect(merged_df)
            logger.info(f"Detected {len(hotspots)} pollution hotspots")

            # Health impact analysis
            analyzer = HealthImpactAnalyzer()
            health_report = analyzer.analyze(merged_df)
            logger.info("Health impact analysis complete")

            # Cohort analysis
            cohort = CohortAnalyzer()
            cohort_report = cohort.analyze(merged_df)
            logger.info("Cohort analysis complete")

        except Exception as e:
            logger.error(f"Analytics pipeline failed: {e}")
            self.state.record_error("analytics", str(e))

        self.state.update("last_analytics", datetime.utcnow().isoformat())

    def run_full_pipeline(self, hours_back: int = 1):
        """
        Execute the full pipeline: ingest -> clean -> quality check -> analytics.

        Args:
            hours_back: Hours of data to fetch
        """
        self._start_time = datetime.utcnow()
        self._run_count += 1
        logger.info(f"{'='*60}")
        logger.info(f"Starting full pipeline run #{self._run_count}")
        logger.info(f"{'='*60}")

        # Step 1: Ingest AQI data
        aqi_df = self.run_aqi_ingestion(hours_back=hours_back)

        # Step 2: Ingest weather data
        weather_df = self.run_weather_ingestion(hours_back=max(hours_back, 24))

        # Step 3: Clean and merge
        self.run_cleaning_pipeline(aqi_df, weather_df)

        # Step 4: Quality checks
        self.run_quality_checks()

        # Step 5: Analytics
        self.run_analytics()

        # Summary
        elapsed = (datetime.utcnow() - self._start_time).total_seconds()
        logger.info(f"Pipeline run #{self._run_count} complete in {elapsed:.1f}s")
        logger.info(f"Errors this run: {self._error_count}")

    def start_scheduled(self):
        """
        Start the orchestrator with scheduled execution using APScheduler.
        
        Schedule:
        - AQI ingestion: every 30 min
        - Weather ingestion: every 1 hour
        - Cleaning: every 1 hour (after ingestion)
        - Quality report: daily at 06:00 UTC
        - Analytics: daily at 02:00 UTC
        """
        try:
            from apscheduler.schedulers.blocking import BlockingScheduler
            from apscheduler.triggers.interval import IntervalTrigger
            from apscheduler.triggers.cron import CronTrigger
        except ImportError:
            logger.error("APScheduler not installed. Install with: pip install apscheduler")
            logger.info("Falling back to single-run mode...")
            self.run_full_pipeline()
            return

        scheduler = BlockingScheduler()

        # AQI ingestion - every 30 minutes
        scheduler.add_job(
            self.run_aqi_ingestion,
            IntervalTrigger(minutes=30),
            id="aqi_ingestion",
            name="AQI Data Ingestion",
            kwargs={"hours_back": 1},
            max_instances=1,
            misfire_grace_time=300,
        )

        # Weather ingestion - every hour
        scheduler.add_job(
            self.run_weather_ingestion,
            IntervalTrigger(minutes=60),
            id="weather_ingestion",
            name="Weather Data Ingestion",
            kwargs={"hours_back": 24},
            max_instances=1,
            misfire_grace_time=300,
        )

        # Data cleaning - every hour at :15
        scheduler.add_job(
            self.run_cleaning_pipeline,
            CronTrigger(minute=15),
            id="data_cleaning",
            name="Data Cleaning Pipeline",
            max_instances=1,
            misfire_grace_time=600,
        )

        # Quality report - daily at 06:00 UTC
        scheduler.add_job(
            self.run_quality_checks,
            CronTrigger(hour=6, minute=0),
            id="quality_report",
            name="Data Quality Report",
            max_instances=1,
            misfire_grace_time=3600,
        )

        # Analytics - daily at 02:00 UTC
        scheduler.add_job(
            self.run_analytics,
            CronTrigger(hour=2, minute=0),
            id="analytics",
            name="Analytics Pipeline",
            max_instances=1,
            misfire_grace_time=3600,
        )

        logger.info("Starting VayuGuard Pipeline Scheduler...")
        logger.info("Schedule:")
        logger.info("  - AQI Ingestion: every 30 min")
        logger.info("  - Weather Ingestion: every 60 min")
        logger.info("  - Data Cleaning: hourly at :15")
        logger.info("  - Quality Report: daily 06:00 UTC")
        logger.info("  - Analytics: daily 02:00 UTC")

        try:
            scheduler.start()
        except (KeyboardInterrupt, SystemExit):
            logger.info("Scheduler shutdown requested")
            scheduler.shutdown(wait=False)
            logger.info("Scheduler stopped")

    def health_check(self) -> dict:
        """
        Return health status of the pipeline.

        Returns:
            Dict with health info: status, last runs, error counts
        """
        state = self.state.state
        now = datetime.utcnow()

        # Check freshness of last ingestion
        last_aqi = state.get("last_aqi_ingestion")
        aqi_fresh = False
        if last_aqi:
            try:
                last_dt = datetime.fromisoformat(last_aqi)
                aqi_fresh = (now - last_dt).total_seconds() < 3600  # Within 1 hour
            except ValueError:
                pass

        last_weather = state.get("last_weather_ingestion")
        weather_fresh = False
        if last_weather:
            try:
                last_dt = datetime.fromisoformat(last_weather)
                weather_fresh = (now - last_dt).total_seconds() < 7200  # Within 2 hours
            except ValueError:
                pass

        recent_errors = [
            e for e in state.get("errors", [])
            if (now - datetime.fromisoformat(e["timestamp"])).total_seconds() < 86400
        ]

        status = "healthy"
        if not aqi_fresh and not weather_fresh:
            status = "unhealthy"
        elif recent_errors:
            status = "degraded"

        return {
            "status": status,
            "aqi_ingestion_fresh": aqi_fresh,
            "weather_ingestion_fresh": weather_fresh,
            "last_aqi_ingestion": last_aqi,
            "last_weather_ingestion": last_weather,
            "total_aqi_records": state.get("aqi_ingestion_count", 0),
            "total_weather_records": state.get("weather_ingestion_count", 0),
            "recent_errors_24h": len(recent_errors),
            "total_errors": len(state.get("errors", [])),
            "pipeline_runs": self._run_count,
        }

    def _load_latest_csv(self, directory: str, prefix: str = "") -> Optional[pd.DataFrame]:
        """Load the most recent CSV from a directory."""
        import glob
        pattern = f"{directory}/{prefix}*.csv" if prefix else f"{directory}/*.csv"
        files = sorted(glob.glob(pattern))
        if files:
            try:
                return pd.read_csv(files[-1])
            except Exception as e:
                logger.error(f"Failed to load {files[-1]}: {e}")
        return None


def main():
    """CLI entry point for the orchestrator."""
    import argparse

    parser = argparse.ArgumentParser(description="VayuGuard Data Pipeline Orchestrator")
    parser.add_argument("--mode", choices=["once", "scheduled", "health"], default="once",
                        help="Run mode: once (single run), scheduled (APScheduler), health (check status)")
    parser.add_argument("--cities", nargs="+", default=None, help="Cities to track")
    parser.add_argument("--hours-back", type=int, default=1, help="Hours of data to fetch")
    parser.add_argument("--output-dir", type=str, default="data", help="Output directory")
    parser.add_argument("--save-mode", choices=["csv", "postgres", "mongo"], default="csv")
    args = parser.parse_args()

    orchestrator = IngestionOrchestrator(
        cities=args.cities,
        output_dir=args.output_dir,
        save_mode=args.save_mode,
    )

    if args.mode == "once":
        orchestrator.run_full_pipeline(hours_back=args.hours_back)
    elif args.mode == "scheduled":
        orchestrator.start_scheduled()
    elif args.mode == "health":
        import json
        health = orchestrator.health_check()
        print(json.dumps(health, indent=2))


if __name__ == "__main__":
    main()

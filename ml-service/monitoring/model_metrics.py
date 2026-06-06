"""
Prometheus Model Metrics Exporter.

Exports ML-specific metrics to Prometheus for monitoring model
performance, data quality, and service health in production.
"""

import logging
import time
from typing import Optional, Dict
from datetime import datetime

logger = logging.getLogger(__name__)

try:
    from prometheus_client import (
        Counter, Histogram, Gauge, Summary, Info,
        CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST,
    )
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    logger.warning("prometheus_client not installed. Metrics will not be exported.")


class ModelMetricsExporter:
    """
    Prometheus metrics exporter for VayuGuard ML models.

    Exports:
    - Prediction latency and throughput
    - Model accuracy metrics (MAE, RMSE)
    - Data quality metrics (missing values, drift scores)
    - Resource usage metrics
    - Model version information
    """

    def __init__(self, registry: Optional["CollectorRegistry"] = None):
        """
        Args:
            registry: Optional Prometheus registry. Uses default if None.
        """
        if not PROMETHEUS_AVAILABLE:
            self._available = False
            return
        self._available = True
        self.registry = registry or CollectorRegistry()
        self._init_metrics()

    def _init_metrics(self):
        """Initialize all Prometheus metrics."""
        # Prediction metrics
        self.prediction_latency = Histogram(
            "vayuguard_prediction_latency_seconds",
            "Time taken to generate a prediction",
            ["model_name", "city"],
            buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
            registry=self.registry,
        )

        self.prediction_total = Counter(
            "vayuguard_predictions_total",
            "Total number of predictions generated",
            ["model_name", "city", "status"],
            registry=self.registry,
        )

        self.prediction_errors = Counter(
            "vayuguard_prediction_errors_total",
            "Total number of prediction errors",
            ["model_name", "error_type"],
            registry=self.registry,
        )

        # Model accuracy metrics
        self.model_mae = Gauge(
            "vayuguard_model_mae",
            "Current model Mean Absolute Error",
            ["model_name", "city"],
            registry=self.registry,
        )

        self.model_rmse = Gauge(
            "vayuguard_model_rmse",
            "Current model Root Mean Square Error",
            ["model_name", "city"],
            registry=self.registry,
        )

        self.model_r2 = Gauge(
            "vayuguard_model_r2",
            "Current model R-squared score",
            ["model_name", "city"],
            registry=self.registry,
        )

        # Data quality metrics
        self.data_missing_ratio = Gauge(
            "vayuguard_data_missing_ratio",
            "Ratio of missing values in input data",
            ["feature"],
            registry=self.registry,
        )

        self.drift_score = Gauge(
            "vayuguard_drift_score",
            "Data drift score for monitored features",
            ["feature", "method"],
            registry=self.registry,
        )

        self.drift_detected = Gauge(
            "vayuguard_drift_detected",
            "Whether drift was detected (1=yes, 0=no)",
            ["feature"],
            registry=self.registry,
        )

        # Model lifecycle metrics
        self.model_loaded = Gauge(
            "vayuguard_model_loaded",
            "Whether the model is loaded (1=yes, 0=no)",
            ["model_name", "model_version"],
            registry=self.registry,
        )

        self.model_info = Info(
            "vayuguard_model",
            "Information about the loaded model",
            registry=self.registry,
        )

        self.last_training_timestamp = Gauge(
            "vayuguard_last_training_timestamp",
            "Unix timestamp of last model training",
            ["model_name"],
            registry=self.registry,
        )

        # Request metrics
        self.request_latency = Histogram(
            "vayuguard_request_latency_seconds",
            "HTTP request latency",
            ["method", "endpoint"],
            buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
            registry=self.registry,
        )

        self.active_requests = Gauge(
            "vayuguard_active_requests",
            "Number of active requests being processed",
            registry=self.registry,
        )

        # Feature pipeline metrics
        self.feature_build_latency = Histogram(
            "vayuguard_feature_build_latency_seconds",
            "Time taken to build features",
            registry=self.registry,
        )

        self.data_freshness_seconds = Gauge(
            "vayuguard_data_freshness_seconds",
            "Age of the most recent data point in seconds",
            ["city"],
            registry=self.registry,
        )

        logger.info("Prometheus metrics initialized")

    def record_prediction(self, model_name: str, city: str,
                           latency: float, status: str = "success") -> None:
        """Record a prediction event."""
        if not self._available:
            return
        self.prediction_latency.labels(model_name=model_name, city=city).observe(latency)
        self.prediction_total.labels(model_name=model_name, city=city, status=status).inc()

    def record_error(self, model_name: str, error_type: str) -> None:
        """Record a prediction error."""
        if not self._available:
            return
        self.prediction_errors.labels(model_name=model_name, error_type=error_type).inc()

    def update_model_metrics(self, model_name: str, city: str,
                              mae: Optional[float] = None,
                              rmse: Optional[float] = None,
                              r2: Optional[float] = None) -> None:
        """Update model accuracy gauges."""
        if not self._available:
            return
        if mae is not None:
            self.model_mae.labels(model_name=model_name, city=city).set(mae)
        if rmse is not None:
            self.model_rmse.labels(model_name=model_name, city=city).set(rmse)
        if r2 is not None:
            self.model_r2.labels(model_name=model_name, city=city).set(r2)

    def update_drift_metrics(self, feature: str, score: float,
                              drift_detected: bool, method: str = "ks") -> None:
        """Update drift detection metrics."""
        if not self._available:
            return
        self.drift_score.labels(feature=feature, method=method).set(score)
        self.drift_detected.labels(feature=feature).set(1 if drift_detected else 0)

    def update_data_quality(self, feature: str, missing_ratio: float) -> None:
        """Update data quality metrics."""
        if not self._available:
            return
        self.data_missing_ratio.labels(feature=feature).set(missing_ratio)

    def set_model_loaded(self, model_name: str, version: str, loaded: bool) -> None:
        """Update model load status."""
        if not self._available:
            return
        self.model_loaded.labels(model_name=model_name, model_version=version).set(1 if loaded else 0)
        self.model_info.info({"model_name": model_name, "version": version,
                               "loaded_at": datetime.now().isoformat()})

    def update_data_freshness(self, city: str, age_seconds: float) -> None:
        """Update data freshness metric."""
        if not self._available:
            return
        self.data_freshness_seconds.labels(city=city).set(age_seconds)

    def get_metrics(self) -> str:
        """Generate Prometheus-formatted metrics string."""
        if not self._available:
            return ""
        return generate_latest(self.registry).decode("utf-8")

    def is_available(self) -> bool:
        """Check if Prometheus is available."""
        return self._available

"""
VayuGuard ML Service - FastAPI Application.

Main FastAPI application with CORS middleware, lifespan management,
Prometheus metrics, and API route registration.
"""

import os
import sys
import time
import logging
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from inference.dependencies.model_loader import ModelLoader
from inference.routes.forecast import router as forecast_router
from inference.routes.health_risk import router as health_risk_router
from inference.routes.model_info import router as model_info_router
from inference.schemas.response import HealthResponse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("vayuguard-ml")

# Prometheus metrics
try:
    from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

    REQUEST_COUNT = Counter(
        "vayuguard_requests_total",
        "Total request count",
        ["method", "endpoint", "status"],
    )
    REQUEST_LATENCY = Histogram(
        "vayuguard_request_latency_seconds",
        "Request latency in seconds",
        ["method", "endpoint"],
        buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
    )
    PREDICTION_COUNT = Counter(
        "vayuguard_predictions_total",
        "Total number of predictions made",
        ["model", "city"],
    )
    MODEL_LOAD_STATUS = Gauge(
        "vayuguard_model_loaded",
        "Whether the ML model is loaded (1=yes, 0=no)",
    )
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    logger.warning("prometheus_client not installed. Metrics will not be available.")

# Track startup time
START_TIME = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Handles startup and shutdown events:
    - Startup: Load champion model, initialize metrics
    - Shutdown: Cleanup resources
    """
    logger.info("VayuGuard ML Service starting up...")

    # Load champion model
    artifact_dir = os.environ.get("ARTIFACT_DIR", "./artifacts")
    try:
        ModelLoader.load_champion(artifact_dir=artifact_dir)
        if PROMETHEUS_AVAILABLE:
            MODEL_LOAD_STATUS.set(1)
        logger.info("Champion model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load champion model: {e}")
        if PROMETHEUS_AVAILABLE:
            MODEL_LOAD_STATUS.set(0)

    logger.info("VayuGuard ML Service is ready")

    yield

    # Shutdown
    logger.info("VayuGuard ML Service shutting down...")
    ModelLoader.reset()
    logger.info("Cleanup complete")


# Create FastAPI app
app = FastAPI(
    title="VayuGuard ML Service",
    description=(
        "AQI Forecasting and Health Risk Assessment API for VayuGuard. "
        "Provides 72-hour AQI forecasts using ensemble ML models, "
        "health risk assessments, and model management endpoints."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request middleware for logging and metrics
@app.middleware("http")
async def request_middleware(request: Request, call_next):
    """Middleware for request logging, latency tracking, and Prometheus metrics."""
    start_time = time.time()
    method = request.method
    path = request.url.path

    # Process request
    try:
        response = await call_next(request)
        status_code = response.status_code
    except Exception as e:
        logger.error(f"Request failed: {method} {path} - {e}")
        status_code = 500
        response = JSONResponse(status_code=500, content={"error": "Internal server error"})

    # Record metrics
    duration = time.time() - start_time
    if PROMETHEUS_AVAILABLE:
        REQUEST_COUNT.labels(method=method, endpoint=path, status=status_code).inc()
        REQUEST_LATENCY.labels(method=method, endpoint=path).observe(duration)

    logger.info(f"{method} {path} - {status_code} ({duration:.3f}s)")
    return response


# Register routes
app.include_router(forecast_router)
app.include_router(health_risk_router)
app.include_router(model_info_router)


@app.get("/", tags=["root"])
async def root():
    """Root endpoint with service information."""
    return {
        "service": "VayuGuard ML Service",
        "version": "1.0.0",
        "description": "AQI Forecasting and Health Risk Assessment API",
        "docs": "/docs",
        "endpoints": {
            "forecast": "/api/forecast",
            "health_risk": "/api/health-risk",
            "model_info": "/api/model/version",
            "health": "/health",
            "metrics": "/metrics",
        },
    }


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check():
    """Health check endpoint for monitoring and load balancers."""
    model_info = ModelLoader.get_model_info()
    uptime = time.time() - START_TIME

    return HealthResponse(
        status="healthy",
        version="1.0.0",
        model_loaded=model_info.get("model_name") != "fallback_persistence",
        uptime_seconds=round(uptime, 1),
        last_prediction_at=model_info.get("last_prediction_at"),
    )


@app.get("/metrics", tags=["monitoring"])
async def metrics():
    """Prometheus metrics endpoint."""
    if not PROMETHEUS_AVAILABLE:
        return JSONResponse(
            status_code=501,
            content={"error": "Prometheus metrics not available"},
        )
    content = generate_latest()
    return Response(content=content, media_type=CONTENT_TYPE_LATEST)


@app.get("/ready", tags=["health"])
async def readiness_check():
    """Readiness check — confirms the service can serve predictions."""
    model = ModelLoader.get_model()
    if model is None:
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "reason": "No model loaded"},
        )
    return {"status": "ready"}


@app.get("/live", tags=["health"])
async def liveness_check():
    """Liveness check — confirms the service is running."""
    return {"status": "alive", "timestamp": datetime.now().isoformat()}

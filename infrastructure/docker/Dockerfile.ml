# =============================================================================
# VayuGuard ML Service - Python 3.11 Slim FastAPI
# =============================================================================
# Multi-stage build for minimal image size with ML dependencies
# =============================================================================

# ---------- Build Stage ----------
FROM python:3.11-slim AS builder

# Set working directory for build
WORKDIR /build

# Install system dependencies required for numpy/scipy/pandas compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    libffi-dev \
    libblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies first (layer caching)
COPY requirements-ml.txt .

# Create virtual environment and install dependencies
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements-ml.txt

# ---------- Runtime Stage ----------
FROM python:3.11-slim AS runtime

# Metadata labels
LABEL maintainer="VayuGuard DevOps <devops@vayuguard.com>"
LABEL service="ml-service"
LABEL version="1.0.0"
LABEL description="VayuGuard ML prediction service with FastAPI"

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r mluser \
    && useradd -r -g mluser -d /app -s /sbin/nologin mluser

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy application source code
COPY ml-service/ .

# Create directories for model artifacts and logs
RUN mkdir -p /app/models /app/logs /app/data && \
    chown -R mluser:mluser /app

# Environment variables for ML service configuration
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    MODEL_PATH=/app/models \
    LOG_LEVEL=INFO \
    WORKERS=4 \
    HOST=0.0.0.0 \
    PORT=8000

# Expose the FastAPI port
EXPOSE 8000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Switch to non-root user
USER mluser

# Run FastAPI with Uvicorn
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--loop", "uvloop", \
     "--http", "httptools", \
     "--log-level", "info", \
     "--access-log"]

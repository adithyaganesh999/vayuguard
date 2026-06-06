FROM python:3.11-slim

LABEL maintainer="VayuGuard Team"
LABEL description="VayuGuard ML Service - AQI Forecasting API"

# Working directory
WORKDIR /app

# Install system packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install CPU version of PyTorch
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Copy source code
COPY . .

# Create directories
RUN mkdir -p /app/data \
             /app/cache \
             /app/artifacts \
             /app/logs

# Environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Expose FastAPI port
EXPOSE 8000

# Health Check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
 CMD curl -f http://localhost:8000/live || exit 1

# Start FastAPI
CMD ["uvicorn", "inference.fastapi_app:app", "--host", "0.0.0.0", "--port", "8000"]
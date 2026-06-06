# VayuGuard ML Service

AQI (Air Quality Index) forecasting microservice for the VayuGuard platform. Provides 72-hour AQI forecasts using ensemble machine learning models, health risk assessments, and real-time monitoring.

## Architecture

```
ml-service/
├── models/
│   ├── baseline/          # Persistence & Moving Average
│   ├── classical/         # Prophet, ARIMA, XGBoost
│   ├── deep/              # LSTM/GRU with PyTorch
│   └── ensemble/          # Stacking/Blending ensemble
├── feature_pipeline/      # Feature engineering & scaling
├── training/              # Training scripts & pipeline
├── inference/             # FastAPI server & routes
├── monitoring/            # Drift detection & metrics
├── tests/                 # Test suite
├── config/                # Configuration files
├── scripts/               # Utility scripts
└── artifacts/             # Model registry & saved models
```

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
pip install torch --index-url https://download.pytorch.org/whl/cpu  # For LSTM
```

### 2. Download Training Data

```bash
python scripts/download_training_data.py --cities delhi mumbai bangalore --synthetic
```

### 3. Train Models

```bash
# Train baseline models
python training/train_baseline.py --city delhi

# Train XGBoost (recommended)
python training/train_xgboost.py --city delhi

# Train Prophet
python training/train_prophet.py --city delhi

# Train LSTM
python training/train_lstm.py --city delhi

# Compare all models
python training/compare_models.py --city delhi
```

### 4. Start the API Server

```bash
uvicorn inference.fastapi_app:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Docker

```bash
docker build -f Dockerfile.ml -t vayuguard-ml .
docker run -p 8000:8000 vayuguard-ml
```

## API Endpoints

### Forecast

```bash
# Get 72-hour AQI forecast
GET /api/forecast?city=delhi&hours=72

# Get forecast with confidence intervals
GET /api/forecast?city=mumbai&hours=48&include_confidence=true
```

Response:
```json
{
  "city": "delhi",
  "model_name": "xgboost_aqi",
  "forecast_horizon_hours": 72,
  "data": [
    {
      "timestamp": "2024-01-15T10:00:00",
      "aqi": 145.2,
      "aqi_lower": 125.1,
      "aqi_upper": 165.3,
      "category": "Unhealthy for Sensitive Groups",
      "category_color": "#ff7e00"
    }
  ]
}
```

### Health Risk Assessment

```bash
POST /api/health-risk
Content-Type: application/json

{
  "city": "delhi",
  "current_aqi": 200,
  "population_group": "elderly",
  "activity_level": "moderate"
}
```

### Model Info

```bash
GET /api/model/version
GET /api/model/list
```

### Health & Monitoring

```bash
GET /health          # Health check
GET /ready           # Readiness check
GET /live            # Liveness check
GET /metrics         # Prometheus metrics
```

## Models

| Model | Type | Best MAE | Use Case |
|-------|------|----------|----------|
| Persistence | Baseline | ~28 | Lower bound benchmark |
| SMA/WMA | Baseline | ~22 | Smoothed baseline |
| Prophet | Classical | ~18 | Seasonal patterns |
| ARIMA | Classical | ~20 | Auto-correlation |
| XGBoost | Classical | ~15 | Feature-rich, robust |
| LSTM/GRU | Deep Learning | ~17 | Sequence patterns |
| Ensemble | Meta | ~14 | Champion model |

## Configuration

Edit `config/config.yaml` for:
- Model hyperparameters
- Feature pipeline settings
- Monitoring thresholds
- API configuration

## Monitoring

### Drift Detection
- Kolmogorov-Smirnov test for feature drift
- Population Stability Index (PSI)
- Wasserstein distance
- Automatic retraining triggers

### Accuracy Tracking
- Rolling MAE/RMSE/bias metrics
- Per-horizon accuracy breakdown
- Degradation alerts
- Prediction audit log

### Prometheus Metrics
- `vayuguard_predictions_total` — Prediction count
- `vayuguard_prediction_latency_seconds` — Latency
- `vayuguard_model_mae` — Current model MAE
- `vayuguard_drift_score` — Data drift scores

## Retraining Pipeline

```bash
# One-time retraining
python training/retraining_pipeline.py --city delhi

# Scheduled retraining (daemon mode)
python training/retraining_pipeline.py --city delhi --schedule weekly --daemon
```

The retraining pipeline:
1. Loads fresh data from the feature store
2. Trains a candidate model
3. Validates against the champion model
4. Promotes only if performance improves (>5% MAE threshold)
5. Rolls back on degradation

## Backtesting

```bash
python scripts/backtest.py --city delhi --horizon 72 --method expanding
```

## Running Tests

```bash
pytest tests/ -v
```

## License

MIT License — VayuGuard Project

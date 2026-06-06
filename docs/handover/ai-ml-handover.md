# VayuGuard AI/ML Handover Document

> Comprehensive documentation for the AI/ML components of VayuGuard, including model cards, training procedures, and API documentation.

---

## Table of Contents

1. [Overview](#overview)
2. [Model Card](#model-card)
3. [Training Data Sources](#training-data-sources)
4. [Model Performance Metrics](#model-performance-metrics)
5. [API Documentation](#api-documentation)
6. [Retraining Schedule](#retraining-schedule)
7. [Infrastructure](#infrastructure)
8. [Known Issues & Limitations](#known-issues--limitations)

---

## Overview

The VayuGuard ML service provides two core capabilities:

1. **AQI Forecasting**: Predicts future AQI values and pollutant concentrations for 1-168 hours ahead
2. **Health Risk Assessment**: Calculates personalized health risk scores based on user profiles and current air quality conditions

The service is built on FastAPI and exposes a REST API consumed by the MERN backend.

---

## Model Card

### Ensemble AQI Forecast Model (Primary Production Model)

| Field | Value |
|-------|-------|
| **Model Name** | VayuGuard Ensemble AQI Forecaster |
| **Version** | 3.1.0 |
| **Model Type** | Weighted Ensemble (LSTM + XGBoost + Prophet) |
| **Task** | Time-series AQI forecasting |
| **Output** | Predicted AQI value, category, confidence interval, pollutant concentrations |
| **Training Date** | 2025-01-12 |
| **Training Samples** | 524,288 hourly records |
| **Status** | Production |

### Sub-Models

#### LSTM Model v2.3.1

| Field | Value |
|-------|-------|
| **Architecture** | 2-layer LSTM (128 + 64 units) + Dense(32) + Dense(1) |
| **Input Features** | 8 features (see Feature Engineering) |
| **Sequence Length** | 24 hours (lookback window) |
| **Output** | Single-step ahead prediction (iterative for multi-step) |
| **Optimizer** | Adam (lr=0.001, decay=1e-6) |
| **Loss Function** | Huber Loss |
| **Regularization** | Dropout (0.2), Early Stopping (patience=10) |
| **Batch Size** | 256 |
| **Epochs** | 50 (with early stopping) |
| **Training Time** | ~45 min on NVIDIA T4 GPU |

#### XGBoost Model v1.8.0

| Field | Value |
|-------|-------|
| **Algorithm** | XGBoost Regressor |
| **Input Features** | 8 engineered features (rolling stats + weather) |
| **n_estimators** | 500 |
| **max_depth** | 8 |
| **learning_rate** | 0.05 |
| **subsample** | 0.8 |
| **colsample_bytree** | 0.8 |
| **objective** | reg:squarederror |
| **Training Time** | ~10 min on 8-core CPU |

#### Prophet Model v1.2.0

| Field | Value |
|-------|-------|
| **Algorithm** | Facebook Prophet |
| **Input Features** | AQI time series + weather regressors |
| **Seasonality** | Daily + Weekly + Yearly |
| **Changepoint Prior** | 0.05 |
| **Seasonality Prior** | 10 |
| **Holidays** | Indian national holidays |
| **Training Time** | ~5 min on CPU |

### Health Risk Model

| Field | Value |
|-------|-------|
| **Model Name** | VayuGuard Health Risk Scorer |
| **Version** | 1.5.0 |
| **Model Type** | Rule-based expert system with weighted scoring |
| **Input** | User health profile + current AQI + pollutant concentrations |
| **Output** | Risk score (0-100), risk level, advisory, activity guidance |
| **Status** | Production |

---

## Training Data Sources

### Primary Data Sources

| Source | Description | Frequency | Records/Day | Date Range |
|--------|-------------|-----------|-------------|------------|
| **OpenAQ** | Global air quality data aggregator | Every 15 min | ~12,000 | 2020-01 to present |
| **CPCB** | Central Pollution Control Board (India) | Hourly | ~4,500 | 2019-06 to present |
| **Open-Meteo** | Weather data API | Hourly | ~4,500 | 2020-01 to present |

### Data Processing Pipeline

```
Raw Data → Quality Checks → Cleaning → Feature Engineering → Training Set
              ↓                ↓              ↓                    ↓
         Flag invalid     Impute gaps    Rolling stats      Train/Val/Test
         Remove outliers  Normalize      Lag features       70/15/15 split
         Score quality    Time align     Weather joins      Chronological
```

### Training Set Statistics

| Metric | Value |
|--------|-------|
| Total records | 524,288 hourly readings |
| Unique stations | 342 |
| Date range | 2020-01-01 to 2025-01-01 |
| Avg. readings per station | 1,533 |
| Missing data rate (after cleaning) | 3.2% |
| Train/Validation/Test split | 70% / 15% / 15% (chronological) |

### Feature Engineering

| Feature | Description | Type |
|---------|-------------|------|
| `pm25_lag_1h` | PM2.5 value 1 hour ago | Lag |
| `pm25_lag_24h` | PM2.5 value 24 hours ago | Lag |
| `pm25_rolling_mean_6h` | 6-hour rolling average | Statistical |
| `pm25_rolling_std_6h` | 6-hour rolling standard deviation | Statistical |
| `temperature` | Current temperature | Weather |
| `humidity` | Current relative humidity | Weather |
| `wind_speed` | Current wind speed | Weather |
| `wind_direction_sin` | Sin of wind direction (cyclical encoding) | Engineered |
| `wind_direction_cos` | Cos of wind direction (cyclical encoding) | Engineered |
| `hour_of_day` | Sin/Cos encoded hour | Temporal |
| `day_of_week` | Sin/Cos encoded day | Temporal |
| `month` | Sin/Cos encoded month | Temporal |
| `is_holiday` | Indian national holiday flag | Calendar |
| `pressure` | Atmospheric pressure | Weather |

---

## Model Performance Metrics

### AQI Forecasting Metrics (Test Set)

| Model | MAE ↓ | RMSE ↓ | R² ↑ | MAPE (%) ↓ |
|-------|-------|--------|------|------------|
| **Ensemble v3.1.0** | **10.2** | **15.4** | **0.92** | **6.8** |
| LSTM v2.3.1 | 12.4 | 18.7 | 0.89 | 8.2 |
| XGBoost v1.8.0 | 14.1 | 20.3 | 0.86 | 9.5 |
| Prophet v1.2.0 | 16.8 | 23.1 | 0.82 | 11.3 |
| Baseline (Persistence) | 22.5 | 31.2 | 0.71 | 15.8 |

### Metrics by Forecast Horizon (Ensemble Model)

| Horizon | MAE | RMSE | R² | MAPE (%) |
|---------|-----|------|----|----------|
| 1-6 hours | 5.8 | 9.2 | 0.96 | 3.9 |
| 7-12 hours | 8.4 | 12.8 | 0.93 | 5.6 |
| 13-24 hours | 11.2 | 16.5 | 0.90 | 7.4 |
| 25-48 hours | 14.8 | 21.3 | 0.86 | 9.8 |
| 49-72 hours | 18.5 | 26.1 | 0.82 | 12.2 |
| 73-168 hours | 24.1 | 33.8 | 0.75 | 16.5 |

### Metrics by AQI Category

| AQI Category | MAE | RMSE | Sample Count |
|-------------|-----|------|-------------|
| Good (0-50) | 6.2 | 9.8 | 45,230 |
| Moderate (51-100) | 8.5 | 13.1 | 89,450 |
| Unhealthy for SG (101-150) | 12.3 | 18.4 | 62,180 |
| Unhealthy (151-200) | 15.8 | 23.2 | 38,920 |
| Very Unhealthy (201-300) | 19.4 | 28.6 | 15,340 |
| Hazardous (301-500) | 28.7 | 39.1 | 5,168 |

### Health Risk Model Validation

| Metric | Value |
|--------|-------|
| Agreement with expert panel | 87% |
| False positive rate | 8.3% |
| False negative rate | 4.7% |
| Cohen's Kappa | 0.82 |
| Validation sample size | 500 case reviews |

---

## API Documentation

The full OpenAPI 3.0 specification is available at:
- **Local**: `http://localhost:8000/docs` (Swagger UI)
- **File**: `docs/architecture/ml-api-spec.yaml`

### Endpoints Summary

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/forecast` | Generate new AQI forecast | None |
| GET | `/api/forecast` | Get cached forecast | None |
| POST | `/api/health-risk` | Calculate health risk score | None |
| GET | `/api/model/version` | Get current model version info | None |
| POST | `/api/model/reload` | Hot-reload a model | Admin JWT |
| GET | `/health` | Service health check | None |

### Example: Generate Forecast

```bash
curl -X POST http://localhost:8000/api/forecast \
  -H "Content-Type: application/json" \
  -d '{
    "station_id": 42,
    "horizon_hours": 48,
    "model_type": "ensemble",
    "include_confidence": true,
    "confidence_level": 0.95
  }'
```

### Example: Health Risk Assessment

```bash
curl -X POST http://localhost:8000/api/health-risk \
  -H "Content-Type: application/json" \
  -d '{
    "health_profile": {
      "age": 65,
      "gender": "female",
      "conditions": ["asthma", "hypertension"],
      "sensitivity_level": "high",
      "activity_level": "light",
      "smoking_status": "never"
    },
    "aqi_value": 175,
    "primary_pollutant": "pm25",
    "pm25_concentration": 98.5,
    "include_forecast": true
  }'
```

---

## Retraining Schedule

### Automated Retraining

| Model | Schedule | Trigger | Auto-Deploy |
|-------|----------|---------|-------------|
| LSTM | Weekly (Sunday 02:00 UTC) | Scheduled + drift detection | No (requires approval) |
| XGBoost | Weekly (Sunday 03:00 UTC) | Scheduled + drift detection | No (requires approval) |
| Prophet | Monthly (1st Sunday 02:00 UTC) | Scheduled | No (requires approval) |
| Ensemble | After any sub-model update | Sub-model version change | No (requires approval) |

### Drift Detection

- **PSI (Population Stability Index)**: Calculated daily on prediction distributions
- **Threshold**: PSI > 0.2 triggers retraining pipeline
- **Feature Drift**: Kolmogorov-Smirnov test on each feature (p < 0.01)
- **Performance Degradation**: MAE increase > 15% from baseline triggers alert

### Retraining Process

```
1. Training pipeline triggered (schedule or drift)
2. Download latest 90 days of data from PostgreSQL
3. Run data quality checks (>95% completeness required)
4. Feature engineering pipeline
5. Train model with cross-validation
6. Evaluate on held-out test set
7. Compare metrics against production model
8. If improved: register in MLflow, tag as "staging"
9. Notify team for review (Slack #ml-alerts)
10. Manual approval → deploy to staging
11. Staging validation (24-hour shadow mode)
12. Manual approval → deploy to production
```

### Rollback Procedure

If a deployed model performs poorly:

1. ML service exposes `/api/model/reload` endpoint
2. Previous model versions are retained in MLflow for 90 days
3. Rollback to previous version via API call or admin dashboard
4. Target rollback time: < 5 minutes

---

## Infrastructure

| Component | Specification |
|-----------|--------------|
| **ML Service Host** | Docker container on Kubernetes |
| **CPU** | 2 vCPU (request) / 4 vCPU (limit) |
| **Memory** | 4 GiB (request) / 8 GiB (limit) |
| **GPU** | NVIDIA T4 (training only, not inference) |
| **Model Storage** | MLflow + S3-compatible object storage |
| **Model Size** | LSTM: ~45MB, XGBoost: ~12MB, Prophet: ~8MB |
| **Inference Latency** | P50: 120ms, P95: 350ms, P99: 800ms |
| **Throughput** | ~100 forecasts/second, ~200 health-risk/second |

---

## Known Issues & Limitations

1. **Extreme Events**: Model underperforms during sudden pollution spikes (e.g., Diwali fireworks, crop burning) — MAE increases by ~40%
2. **Data Gaps**: Stations with >6 hours of missing data produce lower confidence forecasts
3. **Geographic Coverage**: Model is optimized for Indian cities; international stations may have lower accuracy
4. **Health Risk Model**: Currently rule-based; ML-based model in development (v2.0, Q2 2025)
5. **Long Horizon**: Forecasts beyond 72 hours have high uncertainty — use with caution
6. **Seasonal Bias**: Model slightly underestimates winter pollution peaks in northern India
7. **Real-time Lag**: Inference uses the most recent data point available; 15-minute lag from data pipeline

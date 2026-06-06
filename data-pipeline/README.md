# VayuGuard Data Pipeline

Production-grade Python data pipeline for ingesting, cleaning, transforming, and analyzing air quality and weather data for the VayuGuard platform.

## Architecture

```
data-pipeline/
├── ingestion/          # API fetchers & orchestrator
├── cleaning/           # Data quality & transformation
├── transformation/     # Feature engineering & aggregations
├── analytics/          # Hotspot detection, health impact, forecasting
├── notebooks/          # Jupyter exploratory analysis
├── sql/                # Schema, migrations, queries
├── dashboards/         # Dashboard JSON templates
├── tests/              # Unit tests
├── Dockerfile.data     # Container image
└── requirements.txt    # Python dependencies
```

## Data Flow

```
OpenAQ / CPCB ──► Ingestion ──► Cleaning ──► Transformation ──► ML Service
Open-Meteo    ──► Ingestion ──► Cleaning ──► Analytics     ──► Dashboards
```

## Quick Start

### 1. Install Dependencies

```bash
cd data-pipeline
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys and database credentials
```

Required environment variables:
- `OPENAQ_API_KEY` - OpenAQ API key (optional for v2)
- `CPCB_BASE_URL` - CPCB data portal URL
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `MONGO_URI` - MongoDB connection string

### 3. Run the Pipeline

```bash
# Run full pipeline
python -m ingestion.orchestrator

# Run individual fetchers
python -m ingestion.openaq_fetcher
python -m ingestion.cpcb_fetcher
python -m ingestion.openmeteo_fetcher

# Run cleaning
python -m cleaning.clean_aqi
python -m cleaning.join_weather

# Run quality checks
python -m cleaning.quality_checks

# Run analytics
python -m analytics.hotspots
python -m analytics.health_impact
python -m analytics.cohort_analysis
python -m analytics.forecast_accuracy
```

### 4. Run Tests

```bash
pytest tests/ -v
```

## Schedule

| Task | Schedule | Description |
|------|----------|-------------|
| AQI Ingestion | Every 30 min | Fetch latest AQI readings |
| Weather Ingestion | Every 1 hour | Fetch weather data |
| Data Cleaning | Every 1 hour | Clean & validate raw data |
| Feature Store | Every 3 hours | Compute ML features |
| Analytics | Daily 02:00 UTC | Run analytics pipeline |
| Quality Report | Daily 06:00 UTC | Generate data quality report |

## Docker

```bash
docker build -f Dockerfile.data -t vayuguard-pipeline .
docker run --env-file .env vayuguard-pipeline
```

## API Sources

- **OpenAQ v2**: https://api.openaq.org/v2/ - Global air quality data
- **CPCB**: https://app.cpcbccr.com/ccr/ - Indian Central Pollution Control Board
- **Open-Meteo**: https://api.open-meteo.com/ - Free weather API

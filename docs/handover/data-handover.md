# VayuGuard Data Pipeline Handover Document

> Complete documentation for the data pipeline infrastructure, including sources, schedules, quality checks, and dashboard links.

---

## Table of Contents

1. [Pipeline Overview](#pipeline-overview)
2. [Data Sources](#data-sources)
3. [Ingestion Schedules](#ingestion-schedules)
4. [Data Quality](#data-quality)
5. [Transformation Pipeline](#transformation-pipeline)
6. [Analytics & Dashboards](#analytics--dashboards)
7. [Alerting & Monitoring](#alerting--monitoring)
8. [Troubleshooting](#troubleshooting)

---

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     VayuGuard Data Pipeline                         │
│                                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │ OpenAQ   │    │   CPCB   │    │Open-Meteo│    │  Manual  │      │
│  │  API     │    │   API    │    │   API    │    │  Upload  │      │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘      │
│       │               │               │               │             │
│       ▼               ▼               ▼               ▼             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Ingestion Layer                           │    │
│  │  openaq_fetcher.py  cpcb_fetcher.py  openmeteo_fetcher.py   │    │
│  │                    orchestrator.py                           │    │
│  └────────────────────────┬────────────────────────────────────┘    │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Cleaning Layer                            │    │
│  │  clean_aqi.py  join_weather.py  quality_checks.py           │    │
│  └────────────────────────┬────────────────────────────────────┘    │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                 Transformation Layer                         │    │
│  │  aggregations.py  feature_store.py  dbt models              │    │
│  └────────────────────────┬────────────────────────────────────┘    │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   Storage Layer                              │    │
│  │  PostgreSQL (aqi_readings, weather_readings, forecasts,     │    │
│  │             stations, alerts)                                │    │
│  └────────────────────────┬────────────────────────────────────┘    │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  Analytics Layer                              │    │
│  │  health_impact.py  hotspots.py  forecast_accuracy.py         │    │
│  │  cohort_analysis.py                                          │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Sources

### 1. OpenAQ

| Property | Value |
|----------|-------|
| **URL** | https://api.openaq.org/v2 |
| **API Key** | Stored in `OPENAQ_API_KEY` env var |
| **Rate Limit** | 100 requests/minute (free tier), 1000/min (paid) |
| **Data Format** | JSON |
| **Coverage** | Global (~35,000 stations) |
| **Pollutants** | PM2.5, PM10, O3, NO2, SO2, CO, BC |
| **Update Frequency** | Real-time (15-minute lag) |
| **Documentation** | https://docs.openaq.org/ |

**Key Endpoints Used:**
- `GET /v2/latest` — Latest measurements by city/coordinates
- `GET /v2/measurements` — Historical measurements with date range
- `GET /v2/stations` — Station metadata

**Fetcher**: `data-pipeline/ingestion/openaq_fetcher.py`

### 2. CPCB (Central Pollution Control Board)

| Property | Value |
|----------|-------|
| **URL** | https://app.cpcbccr.com/ccr/#/caaqm-dashboard-all/caaqm-landing |
| **Access Method** | Web scraping + API (unofficial) |
| **Rate Limit** | Respectful scraping (1 request/5 seconds) |
| **Data Format** | JSON (from API) |
| **Coverage** | India (~800 stations) |
| **Pollutants** | PM2.5, PM10, O3, NO2, SO2, CO, NH3, Pb |
| **Update Frequency** | Hourly |
| **Documentation** | Internal (reverse-engineered) |

**Fetcher**: `data-pipeline/ingestion/cpcb_fetcher.py`

**Notes:**
- CPCB does not have an official public API; data is scraped from their dashboard
- Rate limiting is critical — excessive requests may result in IP blocking
- Station codes are mapped via `data-pipeline/config/station_mapping.json`

### 3. Open-Meteo

| Property | Value |
|----------|-------|
| **URL** | https://api.open-meteo.com/v1 |
| **API Key** | Not required (free tier) |
| **Rate Limit** | 10,000 requests/day (free), 100,000/day (paid) |
| **Data Format** | JSON |
| **Coverage** | Global |
| **Variables** | Temperature, humidity, pressure, wind, precipitation, UV, cloud cover |
| **Update Frequency** | Hourly |
| **Documentation** | https://open-meteo.com/en/docs |

**Key Endpoints Used:**
- `GET /v1/forecast` — Current and forecast weather
- `GET /v1/historical` — Historical weather data

**Fetcher**: `data-pipeline/ingestion/openmeteo_fetcher.py`

---

## Ingestion Schedules

### Scheduled Jobs

| Job | Schedule | Timeout | Retry | Description |
|-----|----------|---------|-------|-------------|
| `ingest_openaq_realtime` | Every 15 minutes | 10 min | 3 | Fetch latest AQI from OpenAQ |
| `ingest_cpcb_realtime` | Every 30 minutes | 15 min | 3 | Fetch latest AQI from CPCB |
| `ingest_openmeteo_current` | Every 60 minutes | 5 min | 3 | Fetch current weather |
| `daily_aggregation` | 00:00 UTC daily | 30 min | 2 | Compute daily AQI aggregates |
| `weekly_analytics` | Sunday 02:00 UTC | 2 hours | 1 | Run weekly analytics pipeline |
| `monthly_report` | 1st of month 03:00 UTC | 4 hours | 1 | Generate monthly data report |
| `data_quality_check` | Every 6 hours | 15 min | 2 | Validate data completeness |
| `station_sync` | Daily 06:00 UTC | 20 min | 3 | Sync station metadata |

### Orchestrator

All ingestion is managed by `data-pipeline/ingestion/orchestrator.py`, which:
- Manages concurrent fetcher execution
- Handles rate limiting and backoff
- Tracks ingestion state (last successful fetch per source)
- Reports metrics to Prometheus

---

## Data Quality

### Quality Checks (`data-pipeline/cleaning/quality_checks.py`)

| Check | Description | Threshold | Action on Failure |
|-------|-------------|-----------|-------------------|
| **Completeness** | % of expected readings received | > 95% | Alert, flag readings |
| **Freshness** | Time since last reading | < 60 min | Alert, check source |
| **Range Validation** | Values within physical limits | See below | Flag as invalid |
| **Spike Detection** | Sudden value changes | > 3σ from rolling mean | Flag for review |
| **Station Consistency** | Nearby stations agree | < 30% difference | Flag for review |
| **Duplicate Detection** | Duplicate timestamp/station pairs | 0 duplicates | Deduplicate |

### Range Validation Limits

| Pollutant | Min | Max | Unit |
|-----------|-----|-----|------|
| PM2.5 | 0 | 1000 | µg/m³ |
| PM10 | 0 | 2000 | µg/m³ |
| O3 | 0 | 500 | ppb |
| NO2 | 0 | 1000 | ppb |
| SO2 | 0 | 1000 | ppb |
| CO | 0 | 100 | ppm |
| AQI | 0 | 500 | Index |
| Temperature | -40 | 60 | °C |
| Humidity | 0 | 100 | % |

### Quality Scoring

Each reading receives a quality score (0.00-1.00):
- **1.00**: All checks passed, data from primary source
- **0.80-0.99**: Minor issues (slight spike, secondary source)
- **0.50-0.79**: Notable issues (moderate spike, data gap nearby)
- **0.00-0.49**: Major issues (extreme values, failed multiple checks)

Only readings with quality_score ≥ 0.50 are used for ML training.
Only readings with quality_score ≥ 0.80 are used for public display.

---

## Transformation Pipeline

### Cleaning Steps (`data-pipeline/cleaning/`)

1. **clean_aqi.py**:
   - Remove readings outside physical range
   - Interpolate small gaps (< 3 hours) using linear interpolation
   - Flag and quarantine large gaps
   - Deduplicate readings from overlapping sources
   - Normalize units (all concentrations in µg/m³ or ppb)

2. **join_weather.py**:
   - Join AQI readings with weather data by station + timestamp
   - Forward-fill weather data (max 2 hours) for missing readings
   - Calculate derived features (wind direction encoding, dew point)

3. **quality_checks.py**:
   - Apply all quality checks described above
   - Generate data quality reports
   - Update quality_score field

### Aggregation (`data-pipeline/transformation/aggregations.py`)

| Aggregation | Granularity | Fields Computed |
|-------------|-------------|-----------------|
| Hourly | Per station per hour | mean, min, max, std of AQI and each pollutant |
| Daily | Per station per day | mean, min, max, std, percentile_10, percentile_90 |
| Weekly | Per station per week | mean, max, unhealthy_days_count, trend_direction |
| Monthly | Per station per month | mean, max, unhealthy_days_count, good_days_count |

### dbt Models (`data-pipeline/transformation/dbt/`)

| Model | Description | Materialization |
|-------|-------------|-----------------|
| `stg_aqi_readings` | Staging: cleaned, validated AQI readings | View |
| `stg_weather_readings` | Staging: cleaned weather data | View |
| `int_aqi_weather_joined` | Intermediate: AQI + weather joined | Table |
| `fct_hourly_aqi` | Fact: hourly aggregated AQI | Table |
| `fct_daily_aqi` | Fact: daily aggregated AQI | Table |
| `dim_stations` | Dimension: enriched station data | Table |
| `mart_exposure_scores` | Mart: exposure scoring per user per day | Table |
| `mart_kpi_daily` | Mart: daily KPIs for dashboards | Table |

---

## Analytics & Dashboards

### Dashboard Links

| Dashboard | URL | Description |
|-----------|-----|-------------|
| **AQI Trends** | http://grafana.vayuguard.com/d/aqi-trends | Real-time AQI trends across stations |
| **Data Quality** | http://grafana.vayuguard.com/d/data-quality | Ingestion rates, completeness, quality scores |
| **Hotspot Map** | http://grafana.vayuguard.com/d/hotspot-map | Geographic heatmap of pollution hotspots |
| **Health Impact** | http://grafana.vayuguard.com/d/health-impact | Health risk distribution across populations |
| **Pipeline Status** | http://grafana.vayuguard.com/d/pipeline | Data pipeline health and execution history |

**Dashboard JSON files**: `data-pipeline/dashboards/`

### Analytics Scripts

| Script | Purpose | Schedule |
|--------|---------|----------|
| `health_impact.py` | Calculate population exposure and health impact metrics | Daily |
| `hotspots.py` | Identify geographic pollution hotspots using clustering | Daily |
| `forecast_accuracy.py` | Compare forecasts with actuals, track model performance | Daily |
| `cohort_analysis.py` | Group users by risk profile and analyze exposure patterns | Weekly |

---

## Alerting & Monitoring

### Pipeline Alerts

| Alert | Condition | Severity | Channel |
|-------|-----------|----------|---------|
| Ingestion Failure | Fetcher fails 3 consecutive times | Critical | PagerDuty, Slack |
| Data Staleness | No new data for > 2 hours | Warning | Slack |
| Quality Degradation | Quality score drops below 0.80 average | Warning | Slack |
| Spike Detected | AQI value > 3σ from mean | Info | Slack |
| Station Offline | Station not reporting for > 24 hours | Info | Slack |
| Disk Usage | PostgreSQL > 80% capacity | Warning | PagerDuty |
| Pipeline Delay | Daily aggregation > 30 min late | Warning | Slack |

### Prometheus Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `vayuguard_ingestion_records_total` | Counter | Total records ingested by source |
| `vayuguard_ingestion_duration_seconds` | Histogram | Ingestion duration by source |
| `vayuguard_ingestion_errors_total` | Counter | Ingestion errors by source |
| `vayuguard_quality_score` | Gauge | Average data quality score |
| `vayuguard_stations_active` | Gauge | Number of active stations |
| `vayuguard_data_freshness_seconds` | Gauge | Seconds since last data point |

---

## Troubleshooting

### Common Issues

| Issue | Symptom | Resolution |
|-------|---------|------------|
| OpenAQ rate limit hit | 429 responses, missing data | Enable backoff, check API key tier |
| CPCB scraper blocked | No data from CPCB | Rotate IP, reduce request frequency |
| PostgreSQL connection pool exhausted | Timeouts on writes | Increase pool size, check for long-running queries |
| Duplicate readings | Constraint violation errors | Run deduplication job, check orchestrator |
| Weather data gap | Missing joins in forecast features | Check Open-Meteo API status, use forward-fill |
| Disk space full | Write failures | Run VACUUM, archive old data, expand volume |

### Useful Queries

```sql
-- Check data freshness by source
SELECT source, MAX(timestamp) as latest, NOW() - MAX(timestamp) as age
FROM aqi_readings GROUP BY source ORDER BY age DESC;

-- Find stations with data gaps
SELECT s.name, s.station_code,
       MAX(a.timestamp) as last_reading,
       NOW() - MAX(a.timestamp) as gap_duration
FROM stations s
LEFT JOIN aqi_readings a ON s.id = a.station_id
WHERE s.is_active = true
GROUP BY s.id
HAVING NOW() - MAX(a.timestamp) > INTERVAL '2 hours'
ORDER BY gap_duration DESC;

-- Data quality summary (last 24 hours)
SELECT source,
       COUNT(*) as total_readings,
       AVG(quality_score) as avg_quality,
       COUNT(*) FILTER (WHERE quality_score < 0.5) as low_quality_count
FROM aqi_readings
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY source;
```

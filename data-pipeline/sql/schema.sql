-- VayuGuard Database Schema
-- PostgreSQL schema for air quality, weather, forecasts, and alerts
-- ================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ================================================================
-- STATIONS TABLE
-- Monitoring station reference data
-- ================================================================
CREATE TABLE IF NOT EXISTS stations (
    station_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_code     VARCHAR(50) UNIQUE NOT NULL,
    station_name     VARCHAR(255) NOT NULL,
    city             VARCHAR(100) NOT NULL,
    state            VARCHAR(100),
    country          VARCHAR(10) DEFAULT 'IN',
    latitude         DECIMAL(10, 7),
    longitude        DECIMAL(10, 7),
    elevation_m      DECIMAL(8, 2),
    station_type     VARCHAR(50),  -- 'residential', 'industrial', 'traffic', 'background'
    authority        VARCHAR(100), -- 'CPCB', 'DPCC', 'MPCB', etc.
    is_active        BOOLEAN DEFAULT TRUE,
    installed_date   DATE,
    last_calibration DATE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_coordinates
        CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90))
        AND (longitude IS NULL OR (longitude BETWEEN -180 AND 180))
);

CREATE INDEX idx_stations_city ON stations(city);
CREATE INDEX idx_stations_active ON stations(is_active);
CREATE INDEX idx_stations_location ON stations(latitude, longitude);

-- ================================================================
-- AQI_READINGS TABLE
-- Raw and cleaned air quality measurements
-- ================================================================
CREATE TABLE IF NOT EXISTS aqi_readings (
    reading_id       BIGSERIAL PRIMARY KEY,
    station_id       UUID REFERENCES stations(station_id),
    city             VARCHAR(100) NOT NULL,
    parameter        VARCHAR(20) NOT NULL,  -- pm25, pm10, so2, no2, o3, co, nh3, aqi
    value            DECIMAL(10, 3) NOT NULL,
    unit             VARCHAR(20) DEFAULT 'µg/m³',
    aqi_category     VARCHAR(30),           -- Good, Satisfactory, Moderate, Poor, Very Poor, Severe
    timestamp_utc    TIMESTAMPTZ NOT NULL,
    timestamp_local  TIMESTAMPTZ,
    source           VARCHAR(20),           -- 'openaq', 'cpcb'
    is_cleaned       BOOLEAN DEFAULT FALSE,
    is_outlier       BOOLEAN DEFAULT FALSE,
    quality_flag     VARCHAR(10) DEFAULT 'valid',  -- 'valid', 'suspect', 'missing', 'estimated'
    created_at       TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_aqi_value CHECK (value >= 0),
    CONSTRAINT valid_parameter CHECK (parameter IN ('pm25', 'pm10', 'so2', 'no2', 'o3', 'co', 'nh3', 'aqi', 'pb'))
);

-- Indexes for common query patterns
CREATE INDEX idx_aqi_city_ts ON aqi_readings(city, timestamp_utc DESC);
CREATE INDEX idx_aqi_param_ts ON aqi_readings(parameter, timestamp_utc DESC);
CREATE INDEX idx_aqi_city_param_ts ON aqi_readings(city, parameter, timestamp_utc DESC);
CREATE INDEX idx_aqi_station_ts ON aqi_readings(station_id, timestamp_utc DESC);
CREATE INDEX idx_aqi_timestamp ON aqi_readings(timestamp_utc DESC);
CREATE INDEX idx_aqi_category ON aqi_readings(aqi_category);
CREATE INDEX idx_aqi_source ON aqi_readings(source);
CREATE INDEX idx_aqi_cleaned ON aqi_readings(is_cleaned) WHERE is_cleaned = TRUE;

-- Partition by month for performance (optional - uncomment for production)
-- CREATE TABLE aqi_readings_y2024m01 PARTITION OF aqi_readings
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- ================================================================
-- WEATHER_READINGS TABLE
-- Weather data from Open-Meteo
-- ================================================================
CREATE TABLE IF NOT EXISTS weather_readings (
    reading_id           BIGSERIAL PRIMARY KEY,
    city                 VARCHAR(100) NOT NULL,
    latitude             DECIMAL(10, 7) NOT NULL,
    longitude            DECIMAL(10, 7) NOT NULL,
    timestamp_utc        TIMESTAMPTZ NOT NULL,
    temperature_2m       DECIMAL(6, 2),          -- °C
    relative_humidity_2m DECIMAL(5, 2),           -- %
    dew_point_2m         DECIMAL(6, 2),           -- °C
    wind_speed_10m       DECIMAL(6, 2),           -- km/h
    wind_speed_100m      DECIMAL(6, 2),           -- km/h
    wind_direction_10m   DECIMAL(5, 1),           -- degrees
    wind_direction_100m  DECIMAL(5, 1),           -- degrees
    surface_pressure     DECIMAL(8, 2),           -- hPa
    precipitation        DECIMAL(8, 2),           -- mm
    rain                 DECIMAL(8, 2),           -- mm
    cloud_cover          DECIMAL(5, 2),           -- %
    cloud_cover_low      DECIMAL(5, 2),           -- %
    cloud_cover_mid      DECIMAL(5, 2),           -- %
    cloud_cover_high     DECIMAL(5, 2),           -- %
    visibility           DECIMAL(8, 2),           -- meters
    created_at           TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_temperature CHECK (temperature_2m IS NULL OR temperature_2m BETWEEN -60 AND 60),
    CONSTRAINT valid_humidity CHECK (relative_humidity_2m IS NULL OR relative_humidity_2m BETWEEN 0 AND 100)
);

CREATE INDEX idx_weather_city_ts ON weather_readings(city, timestamp_utc DESC);
CREATE INDEX idx_weather_ts ON weather_readings(timestamp_utc DESC);
CREATE INDEX idx_weather_location ON weather_readings(latitude, longitude);

-- ================================================================
-- FORECASTS TABLE
-- ML model predictions
-- ================================================================
CREATE TABLE IF NOT EXISTS forecasts (
    forecast_id           BIGSERIAL PRIMARY KEY,
    city                  VARCHAR(100) NOT NULL,
    station_id            UUID REFERENCES stations(station_id),
    parameter             VARCHAR(20) NOT NULL DEFAULT 'pm25',
    predicted_value       DECIMAL(10, 3) NOT NULL,
    predicted_category    VARCHAR(30),
    confidence_lower      DECIMAL(10, 3),
    confidence_upper      DECIMAL(10, 3),
    confidence_level      DECIMAL(3, 2) DEFAULT 0.95,
    forecast_horizon_hours INTEGER NOT NULL,      -- 1, 6, 12, 24, 48, 168
    target_timestamp_utc  TIMESTAMPTZ NOT NULL,   -- When the forecast is for
    forecast_made_at      TIMESTAMPTZ NOT NULL,   -- When the forecast was generated
    model_version         VARCHAR(50) NOT NULL,   -- e.g., 'xgboost_v2.3'
    model_type            VARCHAR(50),            -- e.g., 'xgboost', 'lstm', 'prophet'
    features_hash         VARCHAR(64),            -- SHA256 of feature vector for reproducibility
    actual_value          DECIMAL(10, 3),         -- Filled in later for accuracy tracking
    created_at            TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_predicted_value CHECK (predicted_value >= 0),
    CONSTRAINT valid_forecast_horizon CHECK (forecast_horizon_hours > 0)
);

CREATE INDEX idx_forecasts_city_target ON forecasts(city, target_timestamp_utc DESC);
CREATE INDEX idx_forecasts_made_at ON forecasts(forecast_made_at DESC);
CREATE INDEX idx_forecasts_model ON forecasts(model_version);
CREATE INDEX idx_forecasts_horizon ON forecasts(forecast_horizon_hours);
CREATE INDEX idx_forecasts_accuracy ON forecasts(actual_value) WHERE actual_value IS NOT NULL;

-- ================================================================
-- ALERTS TABLE
-- Air quality alerts and notifications
-- ================================================================
CREATE TABLE IF NOT EXISTS alerts (
    alert_id         BIGSERIAL PRIMARY KEY,
    city             VARCHAR(100) NOT NULL,
    station_id       UUID REFERENCES stations(station_id),
    alert_type       VARCHAR(50) NOT NULL,     -- 'aqi_threshold', 'trend_spike', 'forecast_warning', 'data_quality'
    severity         VARCHAR(20) NOT NULL,     -- 'info', 'warning', 'critical', 'emergency'
    parameter        VARCHAR(20),
    current_value    DECIMAL(10, 3),
    threshold_value  DECIMAL(10, 3),
    message          TEXT NOT NULL,
    aqi_category     VARCHAR(30),
    is_active        BOOLEAN DEFAULT TRUE,
    triggered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at      TIMESTAMPTZ,
    notified_channels VARCHAR(100)[],           -- ['email', 'sms', 'push', 'webhook']
    notified_count   INTEGER DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),
    CONSTRAINT valid_alert_type CHECK (alert_type IN ('aqi_threshold', 'trend_spike', 'forecast_warning', 'data_quality'))
);

CREATE INDEX idx_alerts_city ON alerts(city);
CREATE INDEX idx_alerts_active ON alerts(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_triggered ON alerts(triggered_at DESC);
CREATE INDEX idx_alerts_type ON alerts(alert_type);

-- ================================================================
-- HELPER VIEWS
-- ================================================================

-- Latest AQI per city
CREATE OR REPLACE VIEW v_latest_city_aqi AS
SELECT DISTINCT ON (city, parameter)
    city,
    parameter,
    value,
    aqi_category,
    timestamp_utc,
    source
FROM aqi_readings
WHERE is_cleaned = TRUE AND quality_flag = 'valid'
ORDER BY city, parameter, timestamp_utc DESC;

-- Daily AQI summary per city
CREATE OR REPLACE VIEW v_daily_city_aqi AS
SELECT
    city,
    parameter,
    DATE(timestamp_utc) AS reading_date,
    ROUND(AVG(value), 2) AS avg_value,
    ROUND(MIN(value), 2) AS min_value,
    ROUND(MAX(value), 2) AS max_value,
    ROUND(STDDEV(value), 2) AS std_value,
    COUNT(*) AS reading_count,
    MAX(aqi_category) AS dominant_category
FROM aqi_readings
WHERE is_cleaned = TRUE AND quality_flag = 'valid'
GROUP BY city, parameter, DATE(timestamp_utc);

-- Unhealthy hours count per city (last 24h)
CREATE OR REPLACE VIEW v_unhealthy_hours_24h AS
SELECT
    city,
    parameter,
    COUNT(*) FILTER (WHERE value > 200) AS unhealthy_hours,
    COUNT(*) FILTER (WHERE value > 300) AS very_poor_hours,
    COUNT(*) FILTER (WHERE value > 400) AS severe_hours,
    COUNT(*) AS total_hours,
    ROUND(
        COUNT(*) FILTER (WHERE value > 200)::DECIMAL / NULLIF(COUNT(*), 0) * 100,
        2
    ) AS unhealthy_pct
FROM aqi_readings
WHERE timestamp_utc >= NOW() - INTERVAL '24 hours'
  AND is_cleaned = TRUE
  AND quality_flag = 'valid'
GROUP BY city, parameter;

-- VayuGuard Migration 001: Initial Schema
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Stations table
CREATE TABLE stations (
    station_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_code     VARCHAR(50) UNIQUE NOT NULL,
    station_name     VARCHAR(255) NOT NULL,
    city             VARCHAR(100) NOT NULL,
    state            VARCHAR(100),
    country          VARCHAR(10) DEFAULT 'IN',
    latitude         DECIMAL(10, 7),
    longitude        DECIMAL(10, 7),
    elevation_m      DECIMAL(8, 2),
    station_type     VARCHAR(50),
    authority        VARCHAR(100),
    is_active        BOOLEAN DEFAULT TRUE,
    installed_date   DATE,
    last_calibration DATE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stations_city ON stations(city);
CREATE INDEX idx_stations_active ON stations(is_active);

-- AQI Readings table
CREATE TABLE aqi_readings (
    reading_id       BIGSERIAL PRIMARY KEY,
    station_id       UUID REFERENCES stations(station_id),
    city             VARCHAR(100) NOT NULL,
    parameter        VARCHAR(20) NOT NULL,
    value            DECIMAL(10, 3) NOT NULL,
    unit             VARCHAR(20) DEFAULT 'µg/m³',
    aqi_category     VARCHAR(30),
    timestamp_utc    TIMESTAMPTZ NOT NULL,
    timestamp_local  TIMESTAMPTZ,
    source           VARCHAR(20),
    is_cleaned       BOOLEAN DEFAULT FALSE,
    is_outlier       BOOLEAN DEFAULT FALSE,
    quality_flag     VARCHAR(10) DEFAULT 'valid',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_aqi_city_ts ON aqi_readings(city, timestamp_utc DESC);
CREATE INDEX idx_aqi_param_ts ON aqi_readings(parameter, timestamp_utc DESC);
CREATE INDEX idx_aqi_city_param_ts ON aqi_readings(city, parameter, timestamp_utc DESC);

-- Weather Readings table
CREATE TABLE weather_readings (
    reading_id           BIGSERIAL PRIMARY KEY,
    city                 VARCHAR(100) NOT NULL,
    latitude             DECIMAL(10, 7) NOT NULL,
    longitude            DECIMAL(10, 7) NOT NULL,
    timestamp_utc        TIMESTAMPTZ NOT NULL,
    temperature_2m       DECIMAL(6, 2),
    relative_humidity_2m DECIMAL(5, 2),
    dew_point_2m         DECIMAL(6, 2),
    wind_speed_10m       DECIMAL(6, 2),
    wind_direction_10m   DECIMAL(5, 1),
    surface_pressure     DECIMAL(8, 2),
    precipitation        DECIMAL(8, 2),
    cloud_cover          DECIMAL(5, 2),
    visibility           DECIMAL(8, 2),
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weather_city_ts ON weather_readings(city, timestamp_utc DESC);

-- Forecasts table
CREATE TABLE forecasts (
    forecast_id           BIGSERIAL PRIMARY KEY,
    city                  VARCHAR(100) NOT NULL,
    station_id            UUID REFERENCES stations(station_id),
    parameter             VARCHAR(20) NOT NULL DEFAULT 'pm25',
    predicted_value       DECIMAL(10, 3) NOT NULL,
    predicted_category    VARCHAR(30),
    confidence_lower      DECIMAL(10, 3),
    confidence_upper      DECIMAL(10, 3),
    confidence_level      DECIMAL(3, 2) DEFAULT 0.95,
    forecast_horizon_hours INTEGER NOT NULL,
    target_timestamp_utc  TIMESTAMPTZ NOT NULL,
    forecast_made_at      TIMESTAMPTZ NOT NULL,
    model_version         VARCHAR(50) NOT NULL,
    model_type            VARCHAR(50),
    actual_value          DECIMAL(10, 3),
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_forecasts_city_target ON forecasts(city, target_timestamp_utc DESC);

-- Helper views
CREATE OR REPLACE VIEW v_latest_city_aqi AS
SELECT DISTINCT ON (city, parameter)
    city, parameter, value, aqi_category, timestamp_utc, source
FROM aqi_readings
WHERE is_cleaned = TRUE AND quality_flag = 'valid'
ORDER BY city, parameter, timestamp_utc DESC;

CREATE OR REPLACE VIEW v_daily_city_aqi AS
SELECT
    city, parameter,
    DATE(timestamp_utc) AS reading_date,
    ROUND(AVG(value), 2) AS avg_value,
    ROUND(MIN(value), 2) AS min_value,
    ROUND(MAX(value), 2) AS max_value,
    COUNT(*) AS reading_count
FROM aqi_readings
WHERE is_cleaned = TRUE AND quality_flag = 'valid'
GROUP BY city, parameter, DATE(timestamp_utc);

-- VayuGuard Migration 002: Add Alerts Table
-- =============================================

-- Alerts table for air quality notifications
CREATE TABLE IF NOT EXISTS alerts (
    alert_id         BIGSERIAL PRIMARY KEY,
    city             VARCHAR(100) NOT NULL,
    station_id       UUID REFERENCES stations(station_id),
    alert_type       VARCHAR(50) NOT NULL,
    severity         VARCHAR(20) NOT NULL,
    parameter        VARCHAR(20),
    current_value    DECIMAL(10, 3),
    threshold_value  DECIMAL(10, 3),
    message          TEXT NOT NULL,
    aqi_category     VARCHAR(30),
    is_active        BOOLEAN DEFAULT TRUE,
    triggered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at      TIMESTAMPTZ,
    notified_channels VARCHAR(100)[],
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

-- Add additional weather columns that may be needed
ALTER TABLE weather_readings ADD COLUMN IF NOT EXISTS wind_speed_100m DECIMAL(6, 2);
ALTER TABLE weather_readings ADD COLUMN IF NOT EXISTS wind_direction_100m DECIMAL(5, 1);
ALTER TABLE weather_readings ADD COLUMN IF NOT EXISTS rain DECIMAL(8, 2);
ALTER TABLE weather_readings ADD COLUMN IF NOT EXISTS cloud_cover_low DECIMAL(5, 2);
ALTER TABLE weather_readings ADD COLUMN IF NOT EXISTS cloud_cover_mid DECIMAL(5, 2);
ALTER TABLE weather_readings ADD COLUMN IF NOT EXISTS cloud_cover_high DECIMAL(5, 2);

-- Add features hash to forecasts for reproducibility
ALTER TABLE forecasts ADD COLUMN IF NOT EXISTS features_hash VARCHAR(64);

-- Unhealthy hours view (last 24h)
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

-- Add updated_at trigger for stations
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_stations_updated_at ON stations;
CREATE TRIGGER update_stations_updated_at
    BEFORE UPDATE ON stations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

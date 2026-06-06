-- Daily KPI Query
-- Returns daily key performance indicators per city
-- ===================================================

SELECT
    a.city,
    DATE(a.timestamp_utc) AS reading_date,
    -- PM2.5 metrics
    ROUND(AVG(a.value) FILTER (WHERE a.parameter = 'pm25'), 2) AS pm25_avg,
    ROUND(MAX(a.value) FILTER (WHERE a.parameter = 'pm25'), 2) AS pm25_max,
    ROUND(MIN(a.value) FILTER (WHERE a.parameter = 'pm25'), 2) AS pm25_min,
    -- PM10 metrics
    ROUND(AVG(a.value) FILTER (WHERE a.parameter = 'pm10'), 2) AS pm10_avg,
    ROUND(MAX(a.value) FILTER (WHERE a.parameter = 'pm10'), 2) AS pm10_max,
    -- AQI metrics
    ROUND(AVG(a.value) FILTER (WHERE a.parameter = 'aqi'), 2) AS aqi_avg,
    ROUND(MAX(a.value) FILTER (WHERE a.parameter = 'aqi'), 2) AS aqi_peak,
    -- Health category based on avg AQI
    CASE
        WHEN AVG(a.value) FILTER (WHERE a.parameter = 'aqi') <= 50 THEN 'Good'
        WHEN AVG(a.value) FILTER (WHERE a.parameter = 'aqi') <= 100 THEN 'Satisfactory'
        WHEN AVG(a.value) FILTER (WHERE a.parameter = 'aqi') <= 200 THEN 'Moderate'
        WHEN AVG(a.value) FILTER (WHERE a.parameter = 'aqi') <= 300 THEN 'Poor'
        WHEN AVG(a.value) FILTER (WHERE a.parameter = 'aqi') <= 400 THEN 'Very Poor'
        ELSE 'Severe'
    END AS health_category,
    -- Unhealthy hours count
    COUNT(*) FILTER (WHERE a.parameter = 'pm25' AND a.value > 60) AS pm25_unhealthy_hours,
    COUNT(*) FILTER (WHERE a.parameter = 'aqi' AND a.value > 200) AS aqi_poor_hours,
    -- Data completeness
    COUNT(DISTINCT a.parameter) AS parameters_measured,
    COUNT(*) AS total_readings,
    -- Weather context
    ROUND(AVG(w.temperature_2m), 1) AS avg_temp,
    ROUND(AVG(w.wind_speed_10m), 1) AS avg_wind_speed,
    ROUND(SUM(w.precipitation), 2) AS total_precipitation
FROM aqi_readings a
LEFT JOIN weather_readings w
    ON a.city = w.city
    AND DATE(a.timestamp_utc) = DATE(w.timestamp_utc)
WHERE a.is_cleaned = TRUE
    AND a.quality_flag = 'valid'
    AND a.timestamp_utc >= '2024-01-01'
    AND a.timestamp_utc < '2024-12-31'
GROUP BY a.city, DATE(a.timestamp_utc)
ORDER BY a.city, reading_date DESC;

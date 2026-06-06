-- Exposure Score Calculation
-- Computes population-weighted pollution exposure score per city
-- ==============================================================

-- The exposure score combines:
-- 1. AQI intensity (how bad the pollution is)
-- 2. Duration (how long it persists)
-- 3. Population affected (city population)
-- 4. Peak episodes (severe spike impact)
-- 5. Time-of-day weighting (rush hours weighted higher)

WITH city_population AS (
    SELECT * FROM (VALUES
        ('Delhi', 32.0),
        ('Mumbai', 21.0),
        ('Kolkata', 15.0),
        ('Chennai', 12.0),
        ('Bangalore', 14.0),
        ('Hyderabad', 10.0),
        ('Pune', 8.0),
        ('Ahmedabad', 8.0),
        ('Lucknow', 4.0),
        ('Jaipur', 4.0)
    ) AS t(city, population_millions)
),
hourly_aqi AS (
    SELECT
        a.city,
        DATE_TRUNC('hour', a.timestamp_utc) AS hour_bin,
        AVG(a.value) AS hourly_aqi,
        -- Rush hour weight: higher during commute times
        CASE
            WHEN EXTRACT(HOUR FROM a.timestamp_utc) IN (8, 9, 10, 17, 18, 19) THEN 1.5
            WHEN EXTRACT(HOUR FROM a.timestamp_utc) BETWEEN 6 AND 22 THEN 1.0
            ELSE 0.7  -- Night time has lower exposure (people indoors)
        END AS time_weight
    FROM aqi_readings a
    WHERE a.parameter IN ('aqi', 'pm25')
        AND a.is_cleaned = TRUE
        AND a.quality_flag = 'valid'
        AND a.timestamp_utc >= NOW() - INTERVAL '30 days'
    GROUP BY a.city, DATE_TRUNC('hour', a.timestamp_utc)
),
exposure_components AS (
    SELECT
        h.city,
        p.population_millions,
        -- Component 1: Intensity score (AQI weighted by time)
        ROUND(AVG(h.hourly_aqi * h.time_weight), 2) AS intensity_score,
        -- Component 2: Duration score (% time above 200 AQI)
        ROUND(
            COUNT(*) FILTER (WHERE h.hourly_aqi > 200)::DECIMAL
            / NULLIF(COUNT(*), 0) * 100, 2
        ) AS unhealthy_duration_pct,
        -- Component 3: Peak score (95th percentile AQI)
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY h.hourly_aqi), 2) AS peak_aqi_95th,
        -- Component 4: Episode severity (max consecutive unhealthy hours)
        MAX(h.hourly_aqi) AS max_aqi,
        -- Component 5: Nighttime exposure (% of nighttime hours above 100)
        ROUND(
            COUNT(*) FILTER (WHERE h.hourly_aqi > 100 AND h.time_weight = 0.7)::DECIMAL
            / NULLIF(COUNT(*) FILTER (WHERE h.time_weight = 0.7), 0) * 100, 2
        ) AS nighttime_unhealthy_pct,
        COUNT(*) AS total_hours
    FROM hourly_aqi h
    LEFT JOIN city_population p ON h.city = p.city
    GROUP BY h.city, p.population_millions
)
SELECT
    city,
    population_millions,
    intensity_score,
    unhealthy_duration_pct,
    peak_aqi_95th,
    max_aqi,
    nighttime_unhealthy_pct,
    total_hours,
    -- Composite Exposure Score (0-100)
    ROUND(LEAST(
        -- Intensity component (40% weight)
        (intensity_score / 500 * 100) * 0.40 +
        -- Duration component (25% weight)
        (unhealthy_duration_pct) * 0.25 +
        -- Peak component (20% weight)
        (peak_aqi_95th / 500 * 100) * 0.20 +
        -- Population component (15% weight)
        COALESCE(population_millions / 30 * 100, 10) * 0.15,
    100), 2) AS exposure_score,
    -- Exposure category
    CASE
        WHEN LEAST(
            (intensity_score / 500 * 100) * 0.40 +
            (unhealthy_duration_pct) * 0.25 +
            (peak_aqi_95th / 500 * 100) * 0.20 +
            COALESCE(population_millions / 30 * 100, 10) * 0.15,
        100) <= 25 THEN 'Low'
        WHEN LEAST(
            (intensity_score / 500 * 100) * 0.40 +
            (unhealthy_duration_pct) * 0.25 +
            (peak_aqi_95th / 500 * 100) * 0.20 +
            COALESCE(population_millions / 30 * 100, 10) * 0.15,
        100) <= 50 THEN 'Moderate'
        WHEN LEAST(
            (intensity_score / 500 * 100) * 0.40 +
            (unhealthy_duration_pct) * 0.25 +
            (peak_aqi_95th / 500 * 100) * 0.20 +
            COALESCE(population_millions / 30 * 100, 10) * 0.15,
        100) <= 75 THEN 'High'
        ELSE 'Critical'
    END AS exposure_category
FROM exposure_components
ORDER BY exposure_score DESC;

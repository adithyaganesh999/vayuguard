-- Unhealthy Days Per City
-- Counts days where average AQI exceeded the unhealthy threshold
-- ================================================================

-- Parameters: threshold (default 200 = "Poor"), start_date, end_date

WITH daily_city_aqi AS (
    SELECT
        city,
        DATE(timestamp_utc) AS reading_date,
        AVG(value) AS daily_avg_aqi
    FROM aqi_readings
    WHERE parameter IN ('aqi', 'pm25')
        AND is_cleaned = TRUE
        AND quality_flag = 'valid'
        AND timestamp_utc >= '2024-01-01'
        AND timestamp_utc < '2025-01-01'
    GROUP BY city, DATE(timestamp_utc)
),
daily_classified AS (
    SELECT
        city,
        reading_date,
        daily_avg_aqi,
        CASE
            WHEN daily_avg_aqi <= 50 THEN 'Good'
            WHEN daily_avg_aqi <= 100 THEN 'Satisfactory'
            WHEN daily_avg_aqi <= 200 THEN 'Moderate'
            WHEN daily_avg_aqi <= 300 THEN 'Poor'
            WHEN daily_avg_aqi <= 400 THEN 'Very Poor'
            ELSE 'Severe'
        END AS daily_category
    FROM daily_city_aqi
)
SELECT
    city,
    COUNT(*) AS total_days_monitored,
    COUNT(*) FILTER (WHERE daily_avg_aqi > 100) AS moderate_days,
    COUNT(*) FILTER (WHERE daily_avg_aqi > 200) AS poor_days,
    COUNT(*) FILTER (WHERE daily_avg_aqi > 300) AS very_poor_days,
    COUNT(*) FILTER (WHERE daily_avg_aqi > 400) AS severe_days,
    ROUND(
        COUNT(*) FILTER (WHERE daily_avg_aqi > 200)::DECIMAL
        / NULLIF(COUNT(*), 0) * 100, 2
    ) AS unhealthy_days_pct,
    ROUND(AVG(daily_avg_aqi), 2) AS avg_daily_aqi,
    ROUND(MAX(daily_avg_aqi), 2) AS worst_day_aqi,
    MAX(reading_date) FILTER (WHERE daily_avg_aqi > 300) AS last_very_poor_day,
    -- Consecutive unhealthy days streak
    MAX(consecutive_unhealthy) AS longest_unhealthy_streak
FROM (
    SELECT
        city,
        reading_date,
        daily_avg_aqi,
        daily_category,
        -- Count consecutive unhealthy days using window function
        COUNT(*) FILTER (WHERE daily_avg_aqi > 200) OVER (
            PARTITION BY city, grp
        ) AS consecutive_unhealthy
    FROM (
        SELECT
            city,
            reading_date,
            daily_avg_aqi,
            daily_category,
            -- Group consecutive days: new group when AQI drops below threshold
            SUM(CASE WHEN daily_avg_aqi <= 200 THEN 1 ELSE 0 END)
                OVER (PARTITION BY city ORDER BY reading_date) AS grp
        FROM daily_classified
    ) grouped
) streaks
GROUP BY city
ORDER BY unhealthy_days_pct DESC;

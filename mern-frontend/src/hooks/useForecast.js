// useForecast hook - Forecast data with caching for VayuGuard
import { useState, useEffect, useCallback, useRef } from 'react';
import { forecastService } from '@/services/forecastService';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

const cache = new Map();

function getCachedData(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCachedData(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

export function useForecast(locationId, options = {}) {
  const { hours = 72, days = 7, enabled = true } = options;
  const [hourlyData, setHourlyData] = useState(null);
  const [dailyData, setDailyData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const abortControllerRef = useRef(null);

  const fetchForecast = useCallback(async () => {
    if (!locationId || !enabled) return;

    // Check cache first
    const hourlyCacheKey = `forecast-hourly-${locationId}-${hours}`;
    const dailyCacheKey = `forecast-daily-${locationId}-${days}`;

    const cachedHourly = getCachedData(hourlyCacheKey);
    const cachedDaily = getCachedData(dailyCacheKey);

    if (cachedHourly && cachedDaily) {
      setHourlyData(cachedHourly);
      setDailyData(cachedDaily);
      setLastFetched(new Date());
      return;
    }

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const [hourly, daily] = await Promise.all([
        cachedHourly ? Promise.resolve(cachedHourly) : forecastService.getHourlyForecast(locationId, hours),
        cachedDaily ? Promise.resolve(cachedDaily) : forecastService.getDailyForecast(locationId, days),
      ]);

      setCachedData(hourlyCacheKey, hourly);
      setCachedData(dailyCacheKey, daily);

      setHourlyData(hourly);
      setDailyData(daily);
      setLastFetched(new Date());
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to fetch forecast data');
      }
    } finally {
      setIsLoading(false);
    }
  }, [locationId, hours, days, enabled]);

  useEffect(() => {
    fetchForecast();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchForecast]);

  const refetch = useCallback(() => {
    // Clear cache and refetch
    const hourlyCacheKey = `forecast-hourly-${locationId}-${hours}`;
    const dailyCacheKey = `forecast-daily-${locationId}-${days}`;
    cache.delete(hourlyCacheKey);
    cache.delete(dailyCacheKey);
    return fetchForecast();
  }, [locationId, hours, days, fetchForecast]);

  return {
    hourlyData,
    dailyData,
    isLoading,
    error,
    lastFetched,
    refetch,
  };
}

export default useForecast;

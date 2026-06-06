// useGeolocation hook - Browser geolocation for VayuGuard
import { useState, useEffect, useCallback } from 'react';

export function useGeolocation(options = {}) {
  const { enableHighAccuracy = true, timeout = 10000, maximumAge = 300000, watch = false } = options;

  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSuccess = useCallback((pos) => {
    setPosition({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      altitude: pos.coords.altitude,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      timestamp: pos.timestamp,
    });
    setError(null);
    setIsLoading(false);
  }, []);

  const handleError = useCallback((err) => {
    switch (err.code) {
      case err.PERMISSION_DENIED:
        setError('Location permission denied. Please enable location access.');
        break;
      case err.POSITION_UNAVAILABLE:
        setError('Location information is unavailable.');
        break;
      case err.TIMEOUT:
        setError('Location request timed out.');
        break;
      default:
        setError('An unknown error occurred while getting location.');
    }
    setIsLoading(false);
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy,
      timeout,
      maximumAge,
    });
  }, [enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError]);

  // Watch position if requested
  useEffect(() => {
    if (!watch || !navigator.geolocation) return;

    setIsLoading(true);
    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy,
      timeout,
      maximumAge,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [watch, enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError]);

  return {
    position,
    error,
    isLoading,
    requestLocation,
  };
}

export default useGeolocation;

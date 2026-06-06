// useAlerts hook - Alerts state management for VayuGuard
import { useState, useEffect, useCallback } from 'react';
import { alertService } from '@/services/alertService';

export function useAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await alertService.getAlerts();
      setAlerts(Array.isArray(data) ? data : data?.alerts || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch alerts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const createAlert = useCallback(async (alertData) => {
    try {
      const newAlert = await alertService.createAlert(alertData);
      setAlerts((prev) => [...prev, newAlert]);
      return newAlert;
    } catch (err) {
      setError(err.message || 'Failed to create alert');
      throw err;
    }
  }, []);

  const updateAlert = useCallback(async (alertId, alertData) => {
    try {
      const updated = await alertService.updateAlert(alertId, alertData);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
      return updated;
    } catch (err) {
      setError(err.message || 'Failed to update alert');
      throw err;
    }
  }, []);

  const deleteAlert = useCallback(async (alertId) => {
    try {
      await alertService.deleteAlert(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      setError(err.message || 'Failed to delete alert');
      throw err;
    }
  }, []);

  const toggleAlert = useCallback(async (alertId, isActive) => {
    try {
      const updated = await alertService.toggleAlert(alertId, isActive);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, isActive } : a)));
      return updated;
    } catch (err) {
      setError(err.message || 'Failed to toggle alert');
      throw err;
    }
  }, []);

  return {
    alerts,
    isLoading,
    error,
    createAlert,
    updateAlert,
    deleteAlert,
    toggleAlert,
    refetch: fetchAlerts,
  };
}

export default useAlerts;

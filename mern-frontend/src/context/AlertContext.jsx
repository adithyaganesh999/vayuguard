'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { showToast } from '@/components/common/ToastNotifications';
import { getAQIColor } from '@/lib/aqi-utils';

const AlertContext = createContext(undefined);

const DEFAULT_ALERTS = [
  { id: '1', name: 'Delhi High AQI', location: 'Delhi', threshold: 200, condition: 'above', pollutant: 'aqi', isActive: true, notifyVia: ['push'] },
  { id: '2', name: 'Bangalore Moderate', location: 'Bangalore', threshold: 100, condition: 'above', pollutant: 'aqi', isActive: true, notifyVia: ['push', 'email'] },
];

export function AlertProvider({ children }) {
  const [alerts, setAlerts] = useState(DEFAULT_ALERTS);
  const [triggeredAlerts, setTriggeredAlerts] = useState([]);
  const checkIntervalRef = useRef(null);

  const addAlert = useCallback((alert) => {
    const newAlert = {
      ...alert,
      id: Date.now().toString(),
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    setAlerts((prev) => [...prev, newAlert]);
    showToast({ type: 'success', title: 'Alert Created', message: newAlert.name });
  }, []);

  const removeAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    showToast({ type: 'info', title: 'Alert Removed' });
  }, []);

  const toggleAlert = useCallback((id) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a))
    );
  }, []);

  const updateAlert = useCallback((id, updates) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }, []);

  const dismissTriggeredAlert = useCallback((id) => {
    setTriggeredAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Simulate alert checking (in production this would use WebSocket/polling)
  const checkAlerts = useCallback((currentAQIData) => {
    alerts.forEach((alert) => {
      if (!alert.isActive) return;
      const cityData = currentAQIData?.find((c) => c.city === alert.location);
      if (!cityData) return;

      const value = alert.pollutant === 'aqi' ? cityData.currentAQI : cityData[alert.pollutant];
      if (value === undefined) return;

      const triggered =
        alert.condition === 'above' ? value > alert.threshold : value < alert.threshold;

      if (triggered) {
        const alertId = `${alert.id}-${Date.now()}`;
        const color = getAQIColor(value);
        setTriggeredAlerts((prev) => {
          // Avoid duplicate triggers for same alert within 5 minutes
          const recent = prev.find((t) => t.alertId === alert.id && Date.now() - t.triggeredAt < 300000);
          if (recent) return prev;
          return [
            ...prev,
            {
              id: alertId,
              alertId: alert.id,
              name: alert.name,
              location: alert.location,
              value,
              threshold: alert.threshold,
              pollutant: alert.pollutant,
              condition: alert.condition,
              color,
              triggeredAt: Date.now(),
            },
          ];
        });

        // Show toast notification
        showToast({
          type: value > 200 ? 'error' : 'warning',
          title: `Alert: ${alert.name}`,
          message: `${alert.location} ${alert.pollutant.toUpperCase()} is ${value} (${alert.condition} ${alert.threshold})`,
          duration: 6000,
        });
      }
    });
  }, [alerts]);

  const value = {
    alerts,
    triggeredAlerts,
    addAlert,
    removeAlert,
    toggleAlert,
    updateAlert,
    dismissTriggeredAlert,
    checkAlerts,
  };

  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
}

export function useAlertContext() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlertContext must be used within AlertProvider');
  }
  return context;
}

export default AlertContext;

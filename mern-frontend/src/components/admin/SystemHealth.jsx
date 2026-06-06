'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Server, Database, Cpu, HardDrive, Wifi, Clock, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

const MOCK_SERVICES = [
  { name: 'API Server', status: 'healthy', uptime: '99.97%', responseTime: '45ms', icon: Server },
  { name: 'Database', status: 'healthy', uptime: '99.99%', responseTime: '12ms', icon: Database },
  { name: 'ML Service', status: 'degraded', uptime: '98.5%', responseTime: '230ms', icon: Cpu },
  { name: 'Data Pipeline', status: 'healthy', uptime: '99.9%', responseTime: '89ms', icon: HardDrive },
  { name: 'Notification Service', status: 'healthy', uptime: '99.95%', responseTime: '32ms', icon: Wifi },
];

const STATUS_STYLES = {
  healthy: { color: '#10b981', icon: CheckCircle, label: 'Healthy' },
  degraded: { color: '#f59e0b', icon: AlertTriangle, label: 'Degraded' },
  down: { color: '#ef4444', icon: XCircle, label: 'Down' },
};

export default function SystemHealth() {
  const [services, setServices] = useState(MOCK_SERVICES);
  const [lastChecked, setLastChecked] = useState(new Date());

  // Simulate periodic health checks
  useEffect(() => {
    const interval = setInterval(() => {
      setServices((prev) =>
        prev.map((s) => ({
          ...s,
          responseTime: `${Math.round(parseInt(s.responseTime) * (0.9 + Math.random() * 0.2))}ms`,
        }))
      );
      setLastChecked(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const healthyCount = services.filter((s) => s.status === 'healthy').length;
  const overallStatus = healthyCount === services.length ? 'healthy' : healthyCount > services.length / 2 ? 'degraded' : 'down';
  const overallStyle = STATUS_STYLES[overallStatus];
  const OverallIcon = overallStyle.icon;

  return (
    <div className="space-y-4">
      {/* Overall status */}
      <div className="p-4 rounded-xl glass-strong border" style={{ borderColor: overallStyle.color + '30' }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: overallStyle.color + '20' }}>
            <OverallIcon size={24} style={{ color: overallStyle.color }} />
          </div>
          <div>
            <div className="text-white font-bold">System Status: {overallStyle.label}</div>
            <div className="text-white/30 text-xs flex items-center gap-1">
              <Clock size={10} />
              Last checked: {lastChecked.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="space-y-2">
        {services.map((service, i) => {
          const statusStyle = STATUS_STYLES[service.status];
          const StatusIcon = statusStyle.icon;
          const ServiceIcon = service.icon;
          return (
            <motion.div
              key={service.name}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-xl glass hover:bg-white/[0.06] transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                <ServiceIcon size={14} className="text-white/40" />
              </div>
              <div className="flex-1">
                <div className="text-white text-sm">{service.name}</div>
                <div className="text-white/20 text-xs">Uptime: {service.uptime}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/30 text-xs">{service.responseTime}</span>
                <StatusIcon size={14} style={{ color: statusStyle.color }} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

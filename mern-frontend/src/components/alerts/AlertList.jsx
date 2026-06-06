'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff, Edit3, Trash2, MapPin, AlertTriangle } from 'lucide-react';
import { getAQIColor } from '@/lib/aqi-utils';

export default function AlertList({ alerts = [], onToggle, onEdit, onDelete }) {
  if (alerts.length === 0) {
    return (
      <div className="p-8 rounded-2xl glass text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
          <Bell size={28} className="text-emerald-400/40" />
        </div>
        <h3 className="text-white font-medium mb-1">No Alerts Yet</h3>
        <p className="text-white/30 text-sm">Create your first alert to get notified about air quality changes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white font-semibold text-sm">Your Alerts ({alerts.length})</h3>
      </div>
      <AnimatePresence>
        {alerts.map((alert, i) => {
          const thresholdColor = getAQIColor(alert.threshold);
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ delay: i * 0.05 }}
              className={`p-4 rounded-xl glass transition-all ${
                alert.isActive ? 'border border-emerald-500/20' : 'border border-white/5 opacity-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => onToggle?.(alert.id)}
                  className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    alert.isActive ? 'bg-emerald-500/20' : 'bg-white/5'
                  }`}
                >
                  {alert.isActive ? (
                    <Bell size={14} className="text-emerald-400" />
                  ) : (
                    <BellOff size={14} className="text-white/30" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm truncate">{alert.name}</span>
                    {alert.isActive && (
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {alert.location && (
                      <div className="flex items-center gap-1">
                        <MapPin size={10} className="text-white/20" />
                        <span className="text-white/30 text-xs">{alert.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <AlertTriangle size={10} style={{ color: thresholdColor }} />
                      <span className="text-xs" style={{ color: thresholdColor }}>
                        {alert.pollutant?.toUpperCase() || 'AQI'} {alert.condition} {alert.threshold}
                      </span>
                    </div>
                  </div>
                  {alert.notifyVia && (
                    <div className="flex gap-1 mt-2">
                      {alert.notifyVia.map((method) => (
                        <span key={method} className="px-1.5 py-0.5 rounded text-[9px] glass text-white/30">
                          {method}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEdit?.(alert)}
                    className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/20 hover:text-white/50 transition-colors"
                  >
                    <Edit3 size={12} />
                  </button>
                  <button
                    onClick={() => onDelete?.(alert.id)}
                    className="w-7 h-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center text-white/20 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

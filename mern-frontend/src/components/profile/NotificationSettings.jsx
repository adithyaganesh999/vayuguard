'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Mail, MessageSquare, Smartphone, Clock, Shield } from 'lucide-react';

const NOTIFICATION_TYPES = [
  { key: 'aqiAlert', label: 'AQI Alerts', description: 'When AQI exceeds your threshold', icon: Bell },
  { key: 'dailyReport', label: 'Daily Report', description: 'Morning AQI summary', icon: Mail },
  { key: 'forecastAlert', label: 'Forecast Alerts', description: 'Upcoming poor air quality', icon: Clock },
  { key: 'healthAdvisory', label: 'Health Advisories', description: 'Personalized health tips', icon: Shield },
];

const CHANNELS = [
  { key: 'push', label: 'Push', icon: Bell },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'sms', label: 'SMS', icon: MessageSquare },
  { key: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
];

export default function NotificationSettings({ settings = {}, onSave }) {
  const [prefs, setPrefs] = useState({
    aqiAlert: settings.aqiAlert !== undefined ? settings.aqiAlert : true,
    dailyReport: settings.dailyReport !== undefined ? settings.dailyReport : true,
    forecastAlert: settings.forecastAlert !== undefined ? settings.forecastAlert : true,
    healthAdvisory: settings.healthAdvisory !== undefined ? settings.healthAdvisory : false,
    channels: settings.channels || { push: true, email: true, sms: false, whatsapp: false },
    quietHoursStart: settings.quietHoursStart || '22:00',
    quietHoursEnd: settings.quietHoursEnd || '07:00',
    quietHoursEnabled: settings.quietHoursEnabled || false,
  });

  const toggleNotifType = (key) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleChannel = (key) => {
    setPrefs((prev) => ({
      ...prev,
      channels: { ...prev.channels, [key]: !prev.channels[key] },
    }));
  };

  const handleSave = () => {
    onSave?.(prefs);
  };

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center gap-2">
        <Bell size={16} className="text-emerald-400" />
        <h3 className="text-white font-semibold text-sm">Notification Settings</h3>
      </div>

      {/* Notification Types */}
      <div className="space-y-2">
        <label className="text-white/40 text-xs uppercase tracking-wider">Alert Types</label>
        {NOTIFICATION_TYPES.map(({ key, label, description, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between p-3 rounded-xl glass">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${prefs[key] ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
                <Icon size={14} className={prefs[key] ? 'text-emerald-400' : 'text-white/30'} />
              </div>
              <div>
                <div className="text-white text-sm">{label}</div>
                <div className="text-white/30 text-xs">{description}</div>
              </div>
            </div>
            <button
              onClick={() => toggleNotifType(key)}
              className={`w-10 h-6 rounded-full transition-all ${
                prefs[key] ? 'bg-emerald-500' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
                  prefs[key] ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {/* Delivery Channels */}
      <div className="space-y-2">
        <label className="text-white/40 text-xs uppercase tracking-wider">Delivery Channels</label>
        <div className="flex gap-2">
          {CHANNELS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => toggleChannel(key)}
              className={`flex-1 p-3 rounded-xl flex flex-col items-center gap-2 transition-all ${
                prefs.channels[key]
                  ? 'bg-emerald-500/20 border border-emerald-500/30'
                  : 'glass text-white/40'
              }`}
            >
              <Icon size={16} className={prefs.channels[key] ? 'text-emerald-400' : 'text-white/30'} />
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="p-4 rounded-xl glass space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white text-sm">Quiet Hours</div>
            <div className="text-white/30 text-xs">Mute notifications during sleep</div>
          </div>
          <button
            onClick={() => setPrefs((prev) => ({ ...prev, quietHoursEnabled: !prev.quietHoursEnabled }))}
            className={`w-10 h-6 rounded-full transition-all ${
              prefs.quietHoursEnabled ? 'bg-emerald-500' : 'bg-white/10'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
                prefs.quietHoursEnabled ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {prefs.quietHoursEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-center gap-2 text-sm"
          >
            <input
              type="time"
              value={prefs.quietHoursStart}
              onChange={(e) => setPrefs((prev) => ({ ...prev, quietHoursStart: e.target.value }))}
              className="flex-1 px-3 py-2 rounded-lg glass text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
            <span className="text-white/20">to</span>
            <input
              type="time"
              value={prefs.quietHoursEnd}
              onChange={(e) => setPrefs((prev) => ({ ...prev, quietHoursEnd: e.target.value }))}
              className="flex-1 px-3 py-2 rounded-lg glass text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
          </motion.div>
        )}
      </div>

      {/* Save */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSave}
        className="w-full py-3 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition-colors text-sm"
      >
        Save Notification Preferences
      </motion.button>
    </div>
  );
}

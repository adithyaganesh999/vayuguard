'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Plus, Trash2, Save, Settings, AlertTriangle } from 'lucide-react';

const DEFAULT_CONFIGS = [
  { id: '1', name: 'AQI Good', min: 0, max: 50, color: '#10b981', alertUsers: false, alertAdmins: false },
  { id: '2', name: 'AQI Moderate', min: 51, max: 100, color: '#f59e0b', alertUsers: false, alertAdmins: false },
  { id: '3', name: 'AQI USG', min: 101, max: 150, color: '#f97316', alertUsers: true, alertAdmins: false },
  { id: '4', name: 'AQI Unhealthy', min: 151, max: 200, color: '#ef4444', alertUsers: true, alertAdmins: true },
  { id: '5', name: 'AQI Very Unhealthy', min: 201, max: 300, color: '#a855f7', alertUsers: true, alertAdmins: true },
  { id: '6', name: 'AQI Hazardous', min: 301, max: 500, color: '#dc2626', alertUsers: true, alertAdmins: true },
];

export default function AlertConfig() {
  const [configs, setConfigs] = useState(DEFAULT_CONFIGS);
  const [hasChanges, setHasChanges] = useState(false);

  const updateConfig = (id, field, value) => {
    setConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
    setHasChanges(true);
  };

  const addConfig = () => {
    const newConfig = {
      id: Date.now().toString(),
      name: 'New Level',
      min: 0,
      max: 100,
      color: '#10b981',
      alertUsers: false,
      alertAdmins: false,
    };
    setConfigs((prev) => [...prev, newConfig]);
    setHasChanges(true);
  };

  const removeConfig = (id) => {
    setConfigs((prev) => prev.filter((c) => c.id !== id));
    setHasChanges(true);
  };

  const handleSave = () => {
    // Save logic
    setHasChanges(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">Alert Configuration</h3>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-amber-400 text-xs"
            >
              Unsaved changes
            </motion.span>
          )}
          <button
            onClick={addConfig}
            className="w-7 h-7 rounded-lg glass hover:bg-white/10 flex items-center justify-center text-emerald-400"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {configs.map((config, i) => (
          <motion.div
            key={config.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="p-3 rounded-xl glass"
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: config.color }}
              />
              <input
                type="text"
                value={config.name}
                onChange={(e) => updateConfig(config.id, 'name', e.target.value)}
                className="flex-1 bg-transparent text-white text-sm font-medium focus:outline-none"
              />
              <button
                onClick={() => removeConfig(config.id)}
                className="text-white/20 hover:text-red-400 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-white/20">Min:</span>
                <input
                  type="number"
                  value={config.min}
                  onChange={(e) => updateConfig(config.id, 'min', parseInt(e.target.value) || 0)}
                  className="w-14 px-2 py-1 rounded glass text-white/60 text-center bg-transparent focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-white/20">Max:</span>
                <input
                  type="number"
                  value={config.max}
                  onChange={(e) => updateConfig(config.id, 'max', parseInt(e.target.value) || 0)}
                  className="w-14 px-2 py-1 rounded glass text-white/60 text-center bg-transparent focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.alertUsers}
                    onChange={(e) => updateConfig(config.id, 'alertUsers', e.target.checked)}
                    className="accent-emerald-500"
                  />
                  <span className="text-white/30">Users</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.alertAdmins}
                    onChange={(e) => updateConfig(config.id, 'alertAdmins', e.target.checked)}
                    className="accent-emerald-500"
                  />
                  <span className="text-white/30">Admins</span>
                </label>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {hasChanges && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          className="w-full py-3 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 text-sm"
        >
          <Save size={14} />
          Save Configuration
        </motion.button>
      )}
    </div>
  );
}

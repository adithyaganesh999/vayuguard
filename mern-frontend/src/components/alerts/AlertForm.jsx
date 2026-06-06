'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Plus, MapPin, Save, X } from 'lucide-react';
import { getAQIColor, getAQICategory } from '@/lib/aqi-utils';
import ThresholdSlider from './ThresholdSlider';

export default function AlertForm({ onSave, onCancel, initialData = {} }) {
  const [form, setForm] = useState({
    name: initialData.name || '',
    location: initialData.location || '',
    threshold: initialData.threshold || 100,
    condition: initialData.condition || 'above',
    pollutant: initialData.pollutant || 'aqi',
    notifyVia: initialData.notifyVia || ['push'],
    isActive: initialData.isActive !== undefined ? initialData.isActive : true,
  });

  const thresholdColor = getAQIColor(form.threshold);
  const thresholdCategory = getAQICategory(form.threshold);

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave?.({
      ...form,
      id: initialData.id || Date.now().toString(),
      createdAt: initialData.createdAt || new Date().toISOString(),
    });
  };

  const toggleNotify = (method) => {
    setForm((prev) => ({
      ...prev,
      notifyVia: prev.notifyVia.includes(method)
        ? prev.notifyVia.filter((n) => n !== method)
        : [...prev.notifyVia, method],
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="p-6 rounded-2xl glass-strong border border-emerald-500/20"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Bell size={20} className="text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold text-white">
            {initialData.id ? 'Edit Alert' : 'Create Alert'}
          </h3>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="text-white/30 hover:text-white/60 transition-colors">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Alert Name */}
      <div className="mb-4">
        <label className="text-white/40 text-xs uppercase tracking-wider mb-2 block">Alert Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Delhi AQI Alert"
          className="w-full px-4 py-2.5 rounded-xl glass text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
        />
      </div>

      {/* Location */}
      <div className="mb-4">
        <label className="text-white/40 text-xs uppercase tracking-wider mb-2 block">Location</label>
        <div className="relative">
          <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
            placeholder="e.g., Delhi, Mumbai"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl glass text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
        </div>
      </div>

      {/* Pollutant */}
      <div className="mb-4">
        <label className="text-white/40 text-xs uppercase tracking-wider mb-2 block">Monitor</label>
        <div className="flex gap-2">
          {['aqi', 'pm25', 'pm10', 'no2', 'o3'].map((p) => (
            <button
              key={p}
              onClick={() => setForm((prev) => ({ ...prev, pollutant: p }))}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                form.pollutant === p
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'glass text-white/50'
              }`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Threshold Slider */}
      <div className="mb-4">
        <label className="text-white/40 text-xs uppercase tracking-wider mb-2 block">Threshold</label>
        <ThresholdSlider
          value={form.threshold}
          onChange={(val) => setForm((prev) => ({ ...prev, threshold: val }))}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-white/30 text-xs">Alert when {form.pollutant.toUpperCase()} goes {form.condition}</span>
          <span className="text-sm font-bold" style={{ color: thresholdColor }}>
            {form.threshold} ({thresholdCategory})
          </span>
        </div>
      </div>

      {/* Condition */}
      <div className="mb-4">
        <label className="text-white/40 text-xs uppercase tracking-wider mb-2 block">Condition</label>
        <div className="flex gap-2">
          {['above', 'below'].map((c) => (
            <button
              key={c}
              onClick={() => setForm((prev) => ({ ...prev, condition: c }))}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                form.condition === c
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'glass text-white/50'
              }`}
            >
              {c === 'above' ? '↑ Above' : '↓ Below'}
            </button>
          ))}
        </div>
      </div>

      {/* Notify Via */}
      <div className="mb-6">
        <label className="text-white/40 text-xs uppercase tracking-wider mb-2 block">Notify Via</label>
        <div className="flex gap-2">
          {['push', 'email', 'sms'].map((method) => (
            <button
              key={method}
              onClick={() => toggleNotify(method)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                form.notifyVia.includes(method)
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'glass text-white/50'
              }`}
            >
              {method.charAt(0).toUpperCase() + method.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSave}
        disabled={!form.name.trim()}
        className="w-full py-3 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Save size={16} />
        {initialData.id ? 'Update Alert' : 'Create Alert'}
      </motion.button>
    </motion.div>
  );
}

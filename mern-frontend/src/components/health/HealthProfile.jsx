'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Heart, Shield, Save, AlertCircle } from 'lucide-react';

const CONDITIONS = [
  'Asthma',
  'COPD',
  'Heart Disease',
  'Allergies',
  'Diabetes',
  'Hypertension',
  'None',
];

const AGE_GROUPS = [
  { value: 'child', label: '0-12 (Child)' },
  { value: 'teen', label: '13-17 (Teen)' },
  { value: 'adult', label: '18-64 (Adult)' },
  { value: 'senior', label: '65+ (Senior)' },
];

const ACTIVITY_LEVELS = [
  { value: 'low', label: 'Low (Mostly indoor)' },
  { value: 'moderate', label: 'Moderate (Mixed)' },
  { value: 'high', label: 'High (Mostly outdoor)' },
];

export default function HealthProfile({ onSave, initialData = {} }) {
  const [profile, setProfile] = useState({
    ageGroup: initialData.ageGroup || 'adult',
    conditions: initialData.conditions || [],
    activityLevel: initialData.activityLevel || 'moderate',
    isPregnant: initialData.isPregnant || false,
    isSmoker: initialData.isSmoker || false,
    livesNearHighway: initialData.livesNearHighway || false,
    usesMask: initialData.usesMask || false,
    hasAirPurifier: initialData.hasAirPurifier || false,
  });
  const [saving, setSaving] = useState(false);

  const toggleCondition = (condition) => {
    if (condition === 'None') {
      setProfile((prev) => ({ ...prev, conditions: [] }));
      return;
    }
    setProfile((prev) => ({
      ...prev,
      conditions: prev.conditions.includes(condition)
        ? prev.conditions.filter((c) => c !== condition)
        : [...prev.conditions.filter((c) => c !== 'None'), condition],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave?.(profile);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <User size={20} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Health Profile</h2>
          <p className="text-white/40 text-sm">Personalize your air quality advisories</p>
        </div>
      </div>

      {/* Age Group */}
      <div className="p-4 rounded-xl glass">
        <label className="text-white/40 text-xs uppercase tracking-wider mb-3 block">Age Group</label>
        <div className="grid grid-cols-2 gap-2">
          {AGE_GROUPS.map((group) => (
            <button
              key={group.value}
              onClick={() => setProfile((prev) => ({ ...prev, ageGroup: group.value }))}
              className={`p-2.5 rounded-lg text-sm transition-all ${
                profile.ageGroup === group.value
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'glass text-white/50 hover:text-white/70'
              }`}
            >
              {group.label}
            </button>
          ))}
        </div>
      </div>

      {/* Health Conditions */}
      <div className="p-4 rounded-xl glass">
        <label className="text-white/40 text-xs uppercase tracking-wider mb-3 block">Health Conditions</label>
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map((condition) => (
            <button
              key={condition}
              onClick={() => toggleCondition(condition)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                condition === 'None'
                  ? profile.conditions.length === 0
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'glass text-white/50'
                  : profile.conditions.includes(condition)
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'glass text-white/50'
              }`}
            >
              {condition === 'None' && <Shield size={12} className="inline mr-1" />}
              {condition}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Level */}
      <div className="p-4 rounded-xl glass">
        <label className="text-white/40 text-xs uppercase tracking-wider mb-3 block">Activity Level</label>
        <div className="space-y-2">
          {ACTIVITY_LEVELS.map((level) => (
            <button
              key={level.value}
              onClick={() => setProfile((prev) => ({ ...prev, activityLevel: level.value }))}
              className={`w-full p-3 rounded-lg text-left text-sm transition-all ${
                profile.activityLevel === level.value
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'glass text-white/50 hover:text-white/70'
              }`}
            >
              {level.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="p-4 rounded-xl glass space-y-3">
        <label className="text-white/40 text-xs uppercase tracking-wider block">Lifestyle Factors</label>
        {[
          { key: 'isPregnant', label: 'Pregnant', icon: Heart },
          { key: 'isSmoker', label: 'Smoker', icon: AlertCircle },
          { key: 'livesNearHighway', label: 'Lives near highway', icon: AlertCircle },
          { key: 'usesMask', label: 'Uses mask outdoors', icon: Shield },
          { key: 'hasAirPurifier', label: 'Has air purifier', icon: Shield },
        ].map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon size={14} className="text-white/30" />
              <span className="text-white/60 text-sm">{label}</span>
            </div>
            <button
              onClick={() => setProfile((prev) => ({ ...prev, [key]: !prev[key] }))}
              className={`w-10 h-6 rounded-full transition-all ${
                profile[key] ? 'bg-emerald-500' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
                  profile[key] ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Save size={16} />
        {saving ? 'Saving...' : 'Save Health Profile'}
      </motion.button>
    </div>
  );
}

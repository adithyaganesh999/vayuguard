'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Activity, Heart, Wind, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { getAQILevel, getAQIColor, getActivityRecommendation, getVulnerableGroupsWarning } from '@/lib/aqi-utils';

export default function PersonalAdvisory({ aqi = 100, healthProfile = {}, location = '' }) {
  const aqiLevel = getAQILevel(aqi);
  const aqiColor = getAQIColor(aqi);
  const activities = useMemo(() => getActivityRecommendation(aqi), [aqi]);
  const warnings = useMemo(() => getVulnerableGroupsWarning(aqi), [aqi]);

  const personalFactors = useMemo(() => {
    const factors = [];
    if (healthProfile.ageGroup === 'child' || healthProfile.ageGroup === 'senior') {
      factors.push({ label: `${healthProfile.ageGroup === 'child' ? 'Child' : 'Senior'} — Higher sensitivity`, severity: 'warning' });
    }
    if (healthProfile.conditions?.length > 0) {
      factors.push({ label: `Has ${healthProfile.conditions.join(', ')} — Extra caution needed`, severity: 'danger' });
    }
    if (healthProfile.isPregnant) {
      factors.push({ label: 'Pregnancy — Avoid polluted areas', severity: 'danger' });
    }
    if (healthProfile.activityLevel === 'high') {
      factors.push({ label: 'High outdoor activity — Increased exposure risk', severity: 'warning' });
    }
    if (healthProfile.usesMask) {
      factors.push({ label: 'Uses mask — Partial protection', severity: 'good' });
    }
    if (healthProfile.hasAirPurifier) {
      factors.push({ label: 'Has air purifier — Better indoor protection', severity: 'good' });
    }
    return factors;
  }, [healthProfile]);

  const severityConfig = {
    good: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    danger: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: aqiColor + '20' }}>
          <ShieldCheck size={20} style={{ color: aqiColor }} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Personal Advisory</h2>
          <p className="text-white/40 text-sm">Tailored for your health profile</p>
        </div>
      </div>

      {/* Main Advisory */}
      <div className="p-5 rounded-xl glass-strong border" style={{ borderColor: aqiColor + '30' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black" style={{ backgroundColor: aqiColor + '20', color: aqiColor }}>
            {aqi}
          </div>
          <div>
            <div className="text-white font-bold">{aqiLevel.category}</div>
            <div className="text-white/40 text-sm">{location || 'Your Location'}</div>
          </div>
        </div>
        <p className="text-white/60 text-sm">{aqiLevel.advisory}</p>
      </div>

      {/* Personal Factors */}
      {personalFactors.length > 0 && (
        <div className="p-4 rounded-xl glass">
          <h3 className="text-white/40 text-xs uppercase tracking-wider mb-3">Your Risk Factors</h3>
          <div className="space-y-2">
            {personalFactors.map((factor, i) => {
              const config = severityConfig[factor.severity];
              const Icon = config.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-2"
                >
                  <div className={`w-6 h-6 rounded-md ${config.bg} flex items-center justify-center`}>
                    <Icon size={12} className={config.color} />
                  </div>
                  <span className="text-white/60 text-sm">{factor.label}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity Recommendations */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl glass">
          <div className="flex items-center gap-2 mb-3">
            <Wind size={14} className="text-emerald-400" />
            <span className="text-white/40 text-xs uppercase tracking-wider">Outdoor</span>
          </div>
          <div className="space-y-1">
            {activities.outdoor.map((act, i) => (
              <div key={i} className="text-white/60 text-xs">{act}</div>
            ))}
          </div>
        </div>
        <div className="p-4 rounded-xl glass">
          <div className="flex items-center gap-2 mb-3">
            <Heart size={14} className="text-sky-400" />
            <span className="text-white/40 text-xs uppercase tracking-wider">Indoor</span>
          </div>
          <div className="space-y-1">
            {activities.indoor.map((act, i) => (
              <div key={i} className="text-white/60 text-xs">{act}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Vulnerable Groups Warning */}
      {warnings.length > 0 && (
        <div className="p-4 rounded-xl glass border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-amber-400 text-xs uppercase tracking-wider font-medium">Vulnerable Groups</span>
          </div>
          {warnings.map((w, i) => (
            <div key={i} className="text-white/50 text-xs mb-1">• {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}

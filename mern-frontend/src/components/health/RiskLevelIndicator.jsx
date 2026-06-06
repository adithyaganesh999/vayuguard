'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { getAQILevel, getHealthRiskScore, getHealthRiskLabel, getAQIColor } from '@/lib/aqi-utils';

const RISK_STYLES = {
  1: { gradient: 'from-emerald-500 to-emerald-600', label: 'Low', icon: ShieldCheck },
  2: { gradient: 'from-emerald-400 to-amber-500', label: 'Low-Moderate', icon: ShieldCheck },
  3: { gradient: 'from-amber-400 to-orange-500', label: 'Moderate', icon: ShieldAlert },
  4: { gradient: 'from-orange-500 to-red-500', label: 'High', icon: ShieldAlert },
  5: { gradient: 'from-red-500 to-red-700', label: 'Very High', icon: ShieldX },
  6: { gradient: 'from-red-700 to-red-900', label: 'Extreme', icon: ShieldX },
};

export default function RiskLevelIndicator({ aqi = 100, size = 'md', showDetails = true }) {
  const riskScore = getHealthRiskScore(aqi);
  const riskLabel = getHealthRiskLabel(riskScore);
  const aqiLevel = getAQILevel(aqi);
  const aqiColor = getAQIColor(aqi);
  const style = RISK_STYLES[riskScore] || RISK_STYLES[3];
  const Icon = style.icon;

  const sizeClasses = {
    sm: { wrapper: 'p-3', number: 'text-xl', icon: 16 },
    md: { wrapper: 'p-5', number: 'text-3xl', icon: 24 },
    lg: { wrapper: 'p-8', number: 'text-5xl', icon: 36 },
  };

  const s = sizeClasses[size] || sizeClasses.md;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className={`rounded-2xl glass-strong ${s.wrapper} border`}
      style={{ borderColor: aqiColor + '30' }}
    >
      <div className="flex items-center gap-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
          className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${style.gradient} flex items-center justify-center shadow-lg`}
        >
          <Icon size={s.icon} className="text-white" />
        </motion.div>
        <div>
          <div className={`${s.number} font-black text-white`}>{riskLabel}</div>
          <div className="text-white/40 text-sm">Risk Level {riskScore}/6</div>
        </div>
      </div>

      {showDetails && (
        <div className="mt-4 space-y-2">
          {/* Risk bar */}
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(riskScore / 6) * 100}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
              className={`h-full rounded-full bg-gradient-to-r ${style.gradient}`}
            />
          </div>
          <p className="text-white/40 text-xs">{aqiLevel.healthImplications}</p>
        </div>
      )}
    </motion.div>
  );
}

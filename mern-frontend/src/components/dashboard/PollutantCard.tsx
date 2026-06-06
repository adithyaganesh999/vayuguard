'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface PollutantCardProps {
  name: string;
  value: number;
  unit: string;
  limit: number;
  icon: React.ReactNode;
}

export default function PollutantCard({ name, value, unit, limit, icon }: PollutantCardProps) {
  const percentage = Math.min((value / limit) * 100, 100);
  const isHigh = percentage > 75;
  const isModerate = percentage > 50 && percentage <= 75;

  const barColor = isHigh ? 'bg-red-400' : isModerate ? 'bg-amber-400' : 'bg-emerald-400';
  const textColor = isHigh ? 'text-red-400' : isModerate ? 'text-amber-400' : 'text-emerald-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl glass hover:bg-white/[0.06] transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-white/30">{icon}</span>
          <span className="text-white/60 text-sm font-medium">{name}</span>
        </div>
        <span className={`text-lg font-bold ${textColor}`}>
          {value}
          <span className="text-white/30 text-xs ml-1">{unit}</span>
        </span>
      </div>
      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-white/20 text-xs">0</span>
        <span className="text-white/20 text-xs">{limit} {unit}</span>
      </div>
    </motion.div>
  );
}

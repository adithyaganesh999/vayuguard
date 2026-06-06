'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { getAQIColor, getAQICategory } from '@/lib/aqi-utils';

interface AQIGaugeProps {
  aqi: number;
  size?: number;
}

export default function AQIGauge({ aqi, size = 200 }: AQIGaugeProps) {
  const color = getAQIColor(aqi);
  const category = getAQICategory(aqi);
  const percentage = Math.min(aqi / 500, 1);
  const circumference = 2 * Math.PI * 80;
  const strokeDashoffset = circumference - (percentage * circumference * 0.75);
  
  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full -rotate-[135deg]"
      >
        {/* Background arc */}
        <circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
        />
        {/* Colored arc */}
        <motion.circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          initial={{ strokeDashoffset: circumference * 0.75 }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{
            filter: `drop-shadow(0 0 8px ${color}40)`,
          }}
        />
        {/* Glow effect */}
        <circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke={color}
          strokeWidth="20"
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeDashoffset={strokeDashoffset}
          opacity="0.1"
          style={{ filter: 'blur(8px)' }}
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-5xl font-black"
          style={{ color }}
        >
          {aqi}
        </motion.span>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="text-white/40 text-xs uppercase tracking-wider mt-1"
        >
          AQI
        </motion.span>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="text-sm font-medium mt-1"
          style={{ color }}
        >
          {category}
        </motion.span>
      </div>
    </div>
  );
}

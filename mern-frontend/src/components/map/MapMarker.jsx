'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { getAQIColor, getAQICategory } from '@/lib/aqi-utils';

export default function MapMarker({ city, aqi, latitude, longitude, onClick, isSelected = false }) {
  const color = getAQIColor(aqi);
  const category = getAQICategory(aqi);
  const size = isSelected ? 48 : 36;

  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      onClick={onClick}
      className="cursor-pointer"
      role="button"
      aria-label={`${city} - AQI ${aqi} - ${category}`}
    >
      {/* Outer glow pulse */}
      <motion.circle
        cx={longitude}
        cy={latitude}
        r={size * 0.6}
        fill={color}
        opacity={0.15}
        animate={{
          r: [size * 0.6, size * 0.8, size * 0.6],
          opacity: [0.15, 0.05, 0.15],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Main marker circle */}
      <circle
        cx={longitude}
        cy={latitude}
        r={size * 0.35}
        fill={color}
        opacity={0.9}
        stroke={isSelected ? '#fff' : color}
        strokeWidth={isSelected ? 2 : 1}
        strokeOpacity={0.6}
      />

      {/* AQI value text */}
      <text
        x={longitude}
        y={latitude + 1}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-white text-[8px] font-bold pointer-events-none select-none"
      >
        {aqi}
      </text>

      {/* City label */}
      <text
        x={longitude}
        y={latitude + size * 0.55}
        textAnchor="middle"
        className="fill-white/60 text-[6px] pointer-events-none select-none"
      >
        {city}
      </text>
    </motion.g>
  );
}

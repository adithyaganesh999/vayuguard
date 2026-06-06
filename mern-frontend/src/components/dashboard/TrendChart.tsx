'use client';

import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getAQIColor } from '@/lib/aqi-utils';

interface TrendChartProps {
  baseAQI: number;
  city: string;
}

// Deterministic seeded random
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (active && payload && payload.length) {
    const aqi = payload[0].value;
    return (
      <div className="glass-strong rounded-lg px-3 py-2 text-sm">
        <p className="text-white/50 text-xs mb-1">{label}</p>
        <p className="font-bold" style={{ color: getAQIColor(aqi) }}>
          AQI: {aqi}
        </p>
      </div>
    );
  }
  return null;
}

export default function TrendChart({ baseAQI, city }: TrendChartProps) {
  const data = useMemo(() => {
    const rand = seededRandom(hashString(city) + baseAQI);
    const result: { hour: string; aqi: number; pm25: number; pm10: number }[] = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 3600000);
      const hourStr = hour.getHours().toString().padStart(2, '0') + ':00';
      const variation = Math.sin(i * 0.3) * 20 + (rand() - 0.5) * 15;
      const aqi = Math.round(Math.max(0, baseAQI + variation));
      result.push({
        hour: hourStr,
        aqi,
        pm25: Math.round((aqi * 0.45 + rand() * 10) * 10) / 10,
        pm10: Math.round((aqi * 0.85 + rand() * 20) * 10) / 10,
      });
    }
    return result;
  }, [baseAQI, city]);

  return (
    <div className="w-full h-64">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white/60 text-sm font-medium">24-Hour AQI Trend — {city}</h3>
        <span className="text-white/30 text-xs">Updated every hour</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="aqiGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
          <XAxis
            dataKey="hour"
            stroke="rgba(255,255,255,0.2)"
            tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }}
            interval={3}
          />
          <YAxis
            stroke="rgba(255,255,255,0.2)"
            tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }}
          />
          <Tooltip content={<TrendTooltip />} />
          <Area
            type="monotone"
            dataKey="aqi"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#aqiGradient)"
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

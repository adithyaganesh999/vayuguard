'use client';

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getAQIColor } from '@/lib/aqi-utils';
import { generateHourlyAQI } from '@/lib/mock-data';

function ConfidenceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="glass-strong rounded-xl p-3 border border-white/10 shadow-xl">
      <div className="text-white/40 text-xs mb-1">{label}</div>
      <div className="text-white text-sm font-bold">AQI: {d?.aqi}</div>
      <div className="text-emerald-400/60 text-xs">Upper: {d?.upper}</div>
      <div className="text-emerald-400/60 text-xs">Lower: {d?.lower}</div>
    </div>
  );
}

export default function ConfidenceInterval({ baseAQI = 100, data, confidence = 0.95, height = 200 }) {
  const chartData = useMemo(() => {
    const source = data || generateHourlyAQI(baseAQI);
    // Calculate confidence interval based on AQI variability
    const margin = confidence === 0.95 ? 0.25 : 0.15;
    return source.map((d) => ({
      ...d,
      upper: Math.round(d.aqi * (1 + margin) + Math.random() * 10),
      lower: Math.max(0, Math.round(d.aqi * (1 - margin) - Math.random() * 10)),
    }));
  }, [data, baseAQI, confidence]);

  const avgColor = getAQIColor(baseAQI);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">Confidence Interval ({Math.round(confidence * 100)}%)</h3>
        <div className="flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500/30" />
            <span className="text-white/30">Range</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: avgColor }} />
            <span className="text-white/30">Forecast</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="confGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="hour"
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
          />
          <Tooltip content={<ConfidenceTooltip />} />
          <Area
            type="monotone"
            dataKey="upper"
            stroke="transparent"
            fill="url(#confGradient)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="lower"
            stroke="transparent"
            fill="rgba(7,7,7,0.8)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="aqi"
            stroke={avgColor}
            strokeWidth={2}
            fill="none"
            dot={false}
            activeDot={{ r: 3, fill: avgColor }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

'use client';

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { getAQIColor } from '@/lib/aqi-utils';
import { generateHourlyAQI } from '@/lib/mock-data';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  return (
    <div className="glass-strong rounded-xl p-3 border border-white/10 shadow-xl">
      <div className="text-white/40 text-xs mb-2">{label}</div>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getAQIColor(data?.aqi || 0) }} />
        <span className="text-white text-sm font-bold">AQI: {data?.aqi}</span>
      </div>
      {data?.pm25 && <div className="text-white/40 text-xs">PM2.5: {data.pm25} µg/m³</div>}
      {data?.pm10 && <div className="text-white/40 text-xs">PM10: {data.pm10} µg/m³</div>}
    </div>
  );
}

export default function ForecastChart({ baseAQI = 100, data, height = 300 }) {
  const chartData = useMemo(() => {
    if (data) return data;
    return generateHourlyAQI(baseAQI);
  }, [data, baseAQI]);

  const avgAQI = useMemo(() => {
    const sum = chartData.reduce((acc, d) => acc + d.aqi, 0);
    return Math.round(sum / chartData.length);
  }, [chartData]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-sm">AQI Forecast</h3>
        <div className="flex items-center gap-2">
          <span className="text-white/30 text-xs">Avg:</span>
          <span className="text-sm font-bold" style={{ color: getAQIColor(avgAQI) }}>
            {avgAQI}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="aqiGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
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
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={100} stroke="rgba(245,158,11,0.3)" strokeDasharray="5 5" />
          <ReferenceLine y={200} stroke="rgba(239,68,68,0.3)" strokeDasharray="5 5" />
          <Area
            type="monotone"
            dataKey="aqi"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#aqiGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

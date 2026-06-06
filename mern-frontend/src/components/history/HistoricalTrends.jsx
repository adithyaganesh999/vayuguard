'use client';

import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, Calendar, Filter } from 'lucide-react';
import { getAQIColor } from '@/lib/aqi-utils';
import { generateHistoricalData } from '@/lib/mock-data';

function HistoricalTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="glass-strong rounded-xl p-3 border border-white/10 shadow-xl">
      <div className="text-white/40 text-xs mb-2">{label}</div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getAQIColor(d?.aqi || 0) }} />
          <span className="text-white text-sm font-bold">AQI: {d?.aqi}</span>
        </div>
        {d?.pm25 && <div className="text-white/40 text-xs">PM2.5: {d.pm25} µg/m³</div>}
        {d?.pm10 && <div className="text-white/40 text-xs">PM10: {d.pm10} µg/m³</div>}
      </div>
    </div>
  );
}

const CHART_MODES = [
  { id: 'area', label: 'Area' },
  { id: 'line', label: 'Line' },
];

export default function HistoricalTrends({ baseAQI = 100, data, days = 30, height = 300 }) {
  const [chartMode, setChartMode] = useState('area');
  const [showPM25, setShowPM25] = useState(true);
  const [showPM10, setShowPM10] = useState(false);

  const chartData = useMemo(() => {
    if (data) return data;
    return generateHistoricalData(baseAQI, days);
  }, [data, baseAQI, days]);

  const stats = useMemo(() => {
    const aqis = chartData.map((d) => d.aqi);
    return {
      avg: Math.round(aqis.reduce((a, b) => a + b, 0) / aqis.length),
      min: Math.min(...aqis),
      max: Math.max(...aqis),
      trend: aqis[aqis.length - 1] - aqis[0],
    };
  }, [chartData]);

  const ChartComponent = chartMode === 'area' ? AreaChart : LineChart;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-400" />
          <h3 className="text-white font-semibold text-sm">Historical Trends</h3>
          <span className="text-white/20 text-xs">({days} days)</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 glass rounded-lg p-0.5">
            {CHART_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setChartMode(mode.id)}
                className={`px-2 py-1 rounded-md text-[10px] transition-all ${
                  chartMode === mode.id
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-white/30 hover:text-white/50'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Avg', value: stats.avg, color: getAQIColor(stats.avg) },
          { label: 'Min', value: stats.min, color: getAQIColor(stats.min) },
          { label: 'Max', value: stats.max, color: getAQIColor(stats.max) },
          { label: 'Trend', value: stats.trend > 0 ? `+${stats.trend}` : stats.trend, color: stats.trend > 0 ? '#ef4444' : '#10b981' },
        ].map((stat) => (
          <div key={stat.label} className="p-2 rounded-lg glass text-center">
            <div className="text-sm font-bold" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-white/20 text-[9px]">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="histGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
          />
          <Tooltip content={<HistoricalTooltip />} />
          <ReferenceLine y={100} stroke="rgba(245,158,11,0.2)" strokeDasharray="5 5" />
          <ReferenceLine y={200} stroke="rgba(239,68,68,0.2)" strokeDasharray="5 5" />

          {chartMode === 'area' ? (
            <Area
              type="monotone"
              dataKey="aqi"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#histGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
            />
          ) : (
            <Line
              type="monotone"
              dataKey="aqi"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
            />
          )}

          {showPM25 && chartMode === 'line' && (
            <Line type="monotone" dataKey="pm25" stroke="#0ea5e9" strokeWidth={1} dot={false} strokeDasharray="3 3" />
          )}
          {showPM10 && chartMode === 'line' && (
            <Line type="monotone" dataKey="pm10" stroke="#f59e0b" strokeWidth={1} dot={false} strokeDasharray="3 3" />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import Marquee from '@/components/ui/marquee';
import ParallaxSection from '@/components/ui/parallax-section';
import { useApp } from '@/context/AppContext';

// Deterministic seeded random for stable data
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

function generateStableHistoricalData(cityName: string, baseAQI: number, days: number) {
  const rand = seededRandom(hashString(cityName) + baseAQI + days);
  const data: { date: string; aqi: number; pm25: number; pm10: number }[] = [];
  const today = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 86400000);
    const seasonalVar = Math.sin(i * 0.1) * 40;
    const randomVar = (rand() - 0.5) * 50;
    const aqi = Math.round(Math.max(10, Math.min(500, baseAQI + seasonalVar + randomVar)));
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      aqi,
      pm25: Math.round((aqi * 0.45 + rand() * 15) * 10) / 10,
      pm10: Math.round((aqi * 0.85 + rand() * 25) * 10) / 10,
    });
  }
  return data;
}

function AnalyticsTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="glass-strong rounded-lg px-3 py-2 text-sm">
        <p className="text-white/50 text-xs mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.dataKey} className="text-emerald-400 font-medium">
            {p.dataKey}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export default function AnalyticsView() {
  const { selectedCity } = useApp();
  const [timeRange, setTimeRange] = useState(30);

  // Memoize data generation with stable dependencies
  const data = useMemo(
    () => generateStableHistoricalData(selectedCity.city, selectedCity.currentAQI, timeRange),
    [selectedCity.city, selectedCity.currentAQI, timeRange]
  );

  const exposureData = useMemo(
    () => data.slice(-7).map((d) => ({
      date: d.date,
      hours: Math.round(Math.max(1, 8 - (d.aqi / 80))),
    })),
    [data]
  );

  const monthlyAvg = useMemo(
    () => data.reduce((sum, d) => sum + d.aqi, 0) / data.length,
    [data]
  );

  return (
    <div className="min-h-screen">
      <Marquee
        items={['DEEP ANALYTICS', 'HISTORICAL TRENDS', 'EXPOSURE TRACKING', 'DATA INSIGHTS']}
        variant="gradient"
        className="mb-8"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
        <ParallaxSection speed={0.2} direction="up">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8"
          >
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">Analytics</h1>
              <p className="text-white/40 mt-1">Historical data for {selectedCity.city}</p>
            </div>
            <div className="flex gap-2">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimeRange(days)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors
                    ${timeRange === days ? 'bg-emerald-500 text-black font-medium' : 'glass text-white/60'}`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </motion.div>
        </ParallaxSection>

        {/* Summary cards */}
        <ParallaxSection speed={0.15} direction="up">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Average AQI', value: Math.round(monthlyAvg), color: '#10b981' },
              { label: 'Highest AQI', value: Math.max(...data.map(d => d.aqi)), color: '#ef4444' },
              { label: 'Lowest AQI', value: Math.min(...data.map(d => d.aqi)), color: '#0ea5e9' },
              { label: 'Good Days', value: data.filter(d => d.aqi <= 50).length, color: '#10b981' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-5 rounded-2xl glass"
              >
                <div className="text-white/40 text-sm">{stat.label}</div>
                <div className="text-3xl font-bold mt-2" style={{ color: stat.color }}>{stat.value}</div>
              </motion.div>
            ))}
          </div>
        </ParallaxSection>

        {/* AQI Trend chart */}
        <ParallaxSection speed={0.2} direction="up">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-2xl glass mb-6"
          >
            <h3 className="text-white/60 text-sm uppercase tracking-wider mb-4">AQI Trend</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} interval={Math.floor(data.length / 6)} />
                  <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} />
                  <Tooltip content={<AnalyticsTooltip />} />
                  <Area type="monotone" dataKey="aqi" stroke="#10b981" strokeWidth={2} fill="url(#trendGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </ParallaxSection>

        {/* PM2.5 and PM10 chart */}
        <ParallaxSection speed={0.15} direction="up">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="p-6 rounded-2xl glass mb-6"
          >
            <h3 className="text-white/60 text-sm uppercase tracking-wider mb-4">Pollutant Levels</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} interval={Math.floor(data.length / 6)} />
                  <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} />
                  <Tooltip content={<AnalyticsTooltip />} />
                  <Line type="monotone" dataKey="pm25" stroke="#10b981" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="pm10" stroke="#0ea5e9" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </ParallaxSection>

        {/* Exposure tracking */}
        <ParallaxSection speed={0.1} direction="up">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="p-6 rounded-2xl glass"
          >
            <h3 className="text-white/60 text-sm uppercase tracking-wider mb-4">Safe Outdoor Hours (Last 7 Days)</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={exposureData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} />
                  <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} />
                  <Tooltip content={<AnalyticsTooltip />} />
                  <Bar dataKey="hours" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </ParallaxSection>
      </div>
    </div>
  );
}

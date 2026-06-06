'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Marquee from '@/components/ui/marquee';
import ParallaxSection from '@/components/ui/parallax-section';
import { useApp } from '@/context/AppContext';
import { getAQIColor } from '@/lib/aqi-utils';

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

function ForecastTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="glass-strong rounded-lg px-3 py-2 text-sm">
        <p className="text-white/50 text-xs mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.dataKey} className="font-medium" style={{ color: p.dataKey === 'avg' ? '#10b981' : p.dataKey === 'max' ? '#ef4444' : '#0ea5e9' }}>
            {p.dataKey.charAt(0).toUpperCase() + p.dataKey.slice(1)}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export default function ForecastView() {
  const { selectedCity } = useApp();

  // Memoize forecast data generation with deterministic random
  const forecast = useMemo(() => {
    const rand = seededRandom(hashString(selectedCity.city) + selectedCity.currentAQI);
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data: { day: string; date: string; minAQI: number; maxAQI: number; avgAQI: number; category: string; dominant: string }[] = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today.getTime() + i * 86400000);
      const variation = Math.sin(i * 0.5) * 30 + (rand() - 0.5) * 20;
      const avgAQI = Math.round(Math.max(0, selectedCity.currentAQI + variation));
      const minAQI = Math.round(avgAQI * 0.7 + rand() * 10);
      const maxAQI = Math.round(avgAQI * 1.3 + rand() * 15);
      let category = 'Good';
      if (avgAQI > 50) category = 'Moderate';
      if (avgAQI > 100) category = 'Unhealthy for Sensitive Groups';
      if (avgAQI > 150) category = 'Unhealthy';
      if (avgAQI > 200) category = 'Very Unhealthy';
      if (avgAQI > 300) category = 'Hazardous';

      const dominants = ['PM2.5', 'PM10', 'NO2', 'O3'];
      data.push({
        day: days[(today.getDay() + i) % 7],
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        minAQI,
        maxAQI,
        avgAQI,
        category,
        dominant: dominants[Math.floor(rand() * dominants.length)]
      });
    }
    return data;
  }, [selectedCity.city, selectedCity.currentAQI]);

  const chartData = useMemo(() => forecast.map((d) => ({
    day: d.day,
    min: d.minAQI,
    max: d.maxAQI,
    avg: d.avgAQI,
  })), [forecast]);

  return (
    <div className="min-h-screen">
      <Marquee
        items={['72-HOUR FORECAST', 'AI-POWERED PREDICTIONS', '94% ACCURACY', 'DAILY TRENDS']}
        variant="police"
        className="mb-8"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
        <ParallaxSection speed={0.2} direction="up">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl sm:text-4xl font-bold text-white">Forecast</h1>
            <p className="text-white/40 mt-1">72-hour air quality prediction for {selectedCity.city}</p>
          </motion.div>
        </ParallaxSection>

        {/* Chart */}
        <ParallaxSection speed={0.25} direction="up">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-2xl glass mb-6"
          >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                  <defs>
                    <linearGradient id="maxGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="day" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }} />
                  <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }} />
                  <Tooltip content={<ForecastTooltip />} />
                  <Area type="monotone" dataKey="max" stroke="#ef4444" strokeWidth={1.5} fill="url(#maxGrad)" />
                  <Area type="monotone" dataKey="avg" stroke="#10b981" strokeWidth={2} fill="url(#avgGrad)" />
                  <Area type="monotone" dataKey="min" stroke="#0ea5e9" strokeWidth={1.5} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </ParallaxSection>

        {/* Daily forecast cards */}
        <ParallaxSection speed={0.15} direction="up">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {forecast.map((day, i) => (
              <motion.div
                key={day.day + day.date}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="p-5 rounded-2xl glass hover:bg-white/[0.06] transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-white font-semibold">{day.day}</div>
                    <div className="text-white/30 text-sm">{day.date}</div>
                  </div>
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                    style={{
                      backgroundColor: getAQIColor(day.avgAQI) + '20',
                      color: getAQIColor(day.avgAQI),
                    }}
                  >
                    {day.avgAQI}
                  </div>
                </div>
                <div className="text-sm" style={{ color: getAQIColor(day.avgAQI) }}>
                  {day.category}
                </div>
                <div className="flex items-center gap-4 mt-3 text-white/30 text-xs">
                  <span>Min: {day.minAQI}</span>
                  <span>Max: {day.maxAQI}</span>
                  <span>Dominant: {day.dominant}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </ParallaxSection>
      </div>
    </div>
  );
}

'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Droplets, Wind } from 'lucide-react';
import { getAQIColor, getAQICategory } from '@/lib/aqi-utils';
import { generateDailyForecast } from '@/lib/mock-data';

export default function DailyForecast({ baseAQI = 100, data }) {
  const dailyData = useMemo(() => {
    if (data) return data;
    return generateDailyForecast(baseAQI);
  }, [data, baseAQI]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={16} className="text-emerald-400" />
        <h3 className="text-white font-semibold text-sm">7-Day Forecast</h3>
      </div>
      <div className="grid gap-3">
        {dailyData.map((day, i) => {
          const color = getAQIColor(day.avgAQI);
          const category = getAQICategory(day.avgAQI);
          return (
            <motion.div
              key={day.day + day.date}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-3 rounded-xl glass hover:bg-white/[0.06] transition-colors"
            >
              <div className="min-w-[60px]">
                <div className="text-white font-medium text-sm">{day.day}</div>
                <div className="text-white/30 text-xs">{day.date}</div>
              </div>

              <div className="flex-1">
                <div className="h-2 rounded-full bg-white/5 overflow-hidden relative">
                  <div
                    className="absolute top-0 left-0 h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (day.avgAQI / 500) * 100)}%`,
                      backgroundColor: color,
                      opacity: 0.8,
                    }}
                  />
                  <div
                    className="absolute top-0 h-full w-1 rounded-full"
                    style={{
                      left: `${Math.min(100, (day.minAQI / 500) * 100)}%`,
                      backgroundColor: '#fff',
                      opacity: 0.4,
                    }}
                  />
                  <div
                    className="absolute top-0 h-full w-1 rounded-full"
                    style={{
                      left: `${Math.min(100, (day.maxAQI / 500) * 100)}%`,
                      backgroundColor: '#fff',
                      opacity: 0.4,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 min-w-[80px] justify-end">
                <span
                  className="text-sm font-bold"
                  style={{ color }}
                >
                  {day.avgAQI}
                </span>
                <span className="text-white/20 text-xs">{day.minAQI}-{day.maxAQI}</span>
              </div>

              <div className="min-w-[80px] text-right">
                <div className="text-[10px] font-medium" style={{ color }}>
                  {category.length > 12 ? category.substring(0, 12) + '.' : category}
                </div>
                <div className="text-white/20 text-[10px] flex items-center gap-1 justify-end">
                  <Wind size={8} /> {day.dominant}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { getAQIColor, getAQICategory } from '@/lib/aqi-utils';
import { generateHourlyAQI } from '@/lib/mock-data';

export default function HourlyForecast({ baseAQI = 100, data, hours = 24 }) {
  const hourlyData = useMemo(() => {
    if (data) return data.slice(0, hours);
    return generateHourlyAQI(baseAQI).slice(0, hours);
  }, [data, baseAQI, hours]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={16} className="text-emerald-400" />
        <h3 className="text-white font-semibold text-sm">Hourly Forecast</h3>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {hourlyData.map((hour, i) => (
          <motion.div
            key={hour.hour}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex flex-col items-center gap-2 min-w-[56px] p-2 rounded-xl glass hover:bg-white/[0.06] transition-colors cursor-default"
          >
            <span className="text-white/30 text-[10px]">{hour.hour}</span>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{
                backgroundColor: getAQIColor(hour.aqi) + '20',
                color: getAQIColor(hour.aqi),
              }}
            >
              {hour.aqi}
            </div>
            <span className="text-white/20 text-[9px]">{hour.pm25}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

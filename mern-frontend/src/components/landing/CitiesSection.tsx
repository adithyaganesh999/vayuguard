'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import { CITIES_AQI } from '@/lib/mock-data';
import { getAQIColor, getAQICategory } from '@/lib/aqi-utils';
import { useApp } from '@/context/AppContext';
import ParallaxSection from '@/components/ui/parallax-section';

export default function CitiesSection() {
  const { setView, setSelectedCity } = useApp();

  const handleCityClick = (city: typeof CITIES_AQI[0]) => {
    setSelectedCity(city);
    setView('dashboard');
  };

  return (
    <section className="relative py-24 overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section header */}
        <ParallaxSection speed={0.3} direction="up">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="text-sky-400 text-sm uppercase tracking-[0.3em] mb-4 block">Featured Cities</span>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold">
              Live <span className="text-gradient">AQI Data</span>
            </h2>
            <p className="text-white/40 text-lg mt-4 max-w-2xl mx-auto">
              Real-time air quality data from major Indian cities. Click any city to explore detailed analytics.
            </p>
          </motion.div>
        </ParallaxSection>

        {/* Cities grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {CITIES_AQI.map((city, i) => (
            <ParallaxSection key={city.city} speed={0.1 + i * 0.02} direction="up">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                whileHover={{ scale: 1.03 }}
                onClick={() => handleCityClick(city)}
                className="group cursor-pointer p-5 rounded-2xl glass hover:bg-white/[0.06] transition-all duration-300"
              >
                {/* City header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{city.city}</h3>
                    <p className="text-white/30 text-sm">{city.state}</p>
                  </div>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{
                      backgroundColor: getAQIColor(city.currentAQI) + '20',
                      color: getAQIColor(city.currentAQI),
                    }}
                  >
                    {city.currentAQI}
                  </div>
                </div>

                {/* Category */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getAQIColor(city.currentAQI) }}
                  />
                  <span className="text-sm" style={{ color: getAQIColor(city.currentAQI) }}>
                    {city.category}
                  </span>
                </div>

                {/* Trend */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm">
                    {city.trend === 'up' && <TrendingUp size={14} className="text-red-400" />}
                    {city.trend === 'down' && <TrendingDown size={14} className="text-emerald-400" />}
                    {city.trend === 'stable' && <Minus size={14} className="text-white/30" />}
                    <span className={city.trend === 'up' ? 'text-red-400' : city.trend === 'down' ? 'text-emerald-400' : 'text-white/30'}>
                      {city.trendValue > 0 ? '+' : ''}{city.trendValue}
                    </span>
                  </div>
                  <ArrowRight size={14} className="text-white/20 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                </div>
              </motion.div>
            </ParallaxSection>
          ))}
        </div>
      </div>
    </section>
  );
}

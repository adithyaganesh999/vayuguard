'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Marquee from '@/components/ui/marquee';
import WorldMap from '@/components/ui/world-map';
import ParallaxSection from '@/components/ui/parallax-section';
import { useApp } from '@/context/AppContext';
import { getAQIColor } from '@/lib/aqi-utils';

export default function MapView() {
  const { selectedCity } = useApp();

  return (
    <div className="min-h-screen">
      <Marquee
        items={['GLOBAL MONITORING NETWORK', '500+ STATIONS', 'REAL-TIME UPDATES', 'AQI TRACKING']}
        variant="gradient"
        className="mb-8"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
        <ParallaxSection speed={0.2} direction="up">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl sm:text-4xl font-bold text-white">Air Quality Map</h1>
            <p className="text-white/40 mt-1">
              Search any city worldwide to locate it on the map — India focused with global coverage
            </p>
          </motion.div>
        </ParallaxSection>

        <ParallaxSection speed={0.15} direction="up">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl glass p-6 overflow-hidden"
          >
            <WorldMap className="h-[60vh]" />
          </motion.div>
        </ParallaxSection>

        {/* Current city info card */}
        <ParallaxSection speed={0.1} direction="up">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div className="p-5 rounded-2xl glass">
              <div className="text-white/40 text-sm">Current City</div>
              <div className="text-2xl font-bold text-white mt-2">{selectedCity.city}</div>
              <div className="text-white/30 text-sm">{selectedCity.state}</div>
            </div>
            <div className="p-5 rounded-2xl glass">
              <div className="text-white/40 text-sm">AQI Level</div>
              <div className="text-2xl font-bold mt-2" style={{ color: getAQIColor(selectedCity.currentAQI) }}>
                {selectedCity.currentAQI}
              </div>
              <div className="text-white/30 text-sm">{selectedCity.category}</div>
            </div>
            <div className="p-5 rounded-2xl glass">
              <div className="text-white/40 text-sm">PM2.5 / PM10</div>
              <div className="text-2xl font-bold text-white mt-2">
                {selectedCity.pm25} <span className="text-white/30 text-sm">ug/m3</span>
              </div>
              <div className="text-white/30 text-sm">{selectedCity.pm10} ug/m3</div>
            </div>
          </motion.div>
        </ParallaxSection>

        {/* Legend */}
        <ParallaxSection speed={0.1} direction="up">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-6 p-6 rounded-2xl glass"
          >
            <h3 className="text-white/60 text-sm uppercase tracking-wider mb-4">AQI Legend</h3>
            <div className="flex flex-wrap gap-4">
              {[
                { label: 'Good (0-50)', color: '#10b981' },
                { label: 'Moderate (51-100)', color: '#f59e0b' },
                { label: 'USG (101-150)', color: '#f97316' },
                { label: 'Unhealthy (151-200)', color: '#ef4444' },
                { label: 'Very Unhealthy (201-300)', color: '#a855f7' },
                { label: 'Hazardous (301-500)', color: '#dc2626' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-white/40 text-sm">{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </ParallaxSection>
      </div>
    </div>
  );
}

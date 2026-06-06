'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Heart, TreePine, ShieldCheck, AlertTriangle, Footprints, Baby, Users, HardHat } from 'lucide-react';
import Marquee from '@/components/ui/marquee';
import ParallaxSection from '@/components/ui/parallax-section';
import { useApp } from '@/context/AppContext';
import { 
  getAQILevel, 
  getActivityRecommendation, 
  getVulnerableGroupsWarning,
  AQI_LEVELS
} from '@/lib/aqi-utils';

export default function AdvisoryView() {
  const { selectedCity } = useApp();
  const aqiLevel = getAQILevel(selectedCity.currentAQI);
  const activities = getActivityRecommendation(selectedCity.currentAQI);
  const warnings = getVulnerableGroupsWarning(selectedCity.currentAQI);

  return (
    <div className="min-h-screen">
      <Marquee
        items={['HEALTH ADVISORY', 'ACTIVITY RECOMMENDATIONS', 'VULNERABLE GROUPS', 'STAY SAFE']}
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
            <h1 className="text-3xl sm:text-4xl font-bold text-white">Health Advisory</h1>
            <p className="text-white/40 mt-1">Personalized recommendations for {selectedCity.city}</p>
          </motion.div>
        </ParallaxSection>

        {/* Current AQI status */}
        <ParallaxSection speed={0.25} direction="up">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-2xl glass mb-6"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: aqiLevel.color + '20' }}
              >
                <Heart size={28} style={{ color: aqiLevel.color }} />
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold" style={{ color: aqiLevel.color }}>
                  {aqiLevel.category}
                </div>
                <p className="text-white/50 mt-1">{aqiLevel.description}</p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-black" style={{ color: aqiLevel.color }}>
                  {selectedCity.currentAQI}
                </div>
                <div className="text-white/30 text-sm">AQI</div>
              </div>
            </div>
          </motion.div>
        </ParallaxSection>

        {/* Activity Recommendations */}
        <ParallaxSection speed={0.2} direction="up">
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Outdoor */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="p-6 rounded-2xl glass"
            >
              <div className="flex items-center gap-3 mb-5">
                <TreePine size={24} className="text-emerald-400" />
                <h2 className="text-xl font-semibold text-white">Outdoor Activities</h2>
              </div>
              <div className="space-y-3">
                {activities.outdoor.map((activity, i) => (
                  <motion.div
                    key={activity}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5"
                  >
                    <Footprints size={16} className="text-emerald-400 shrink-0" />
                    <span className="text-white/70 text-sm">{activity}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Indoor */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="p-6 rounded-2xl glass"
            >
              <div className="flex items-center gap-3 mb-5">
                <ShieldCheck size={24} className="text-sky-400" />
                <h2 className="text-xl font-semibold text-white">Indoor Activities</h2>
              </div>
              <div className="space-y-3">
                {activities.indoor.map((activity, i) => (
                  <motion.div
                    key={activity}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-sky-500/5"
                  >
                    <Footprints size={16} className="text-sky-400 shrink-0" />
                    <span className="text-white/70 text-sm">{activity}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </ParallaxSection>

        {/* Vulnerable Groups */}
        {warnings.length > 0 && (
          <ParallaxSection speed={0.15} direction="up">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-6 rounded-2xl glass mb-6 border border-amber-500/20"
            >
              <div className="flex items-center gap-3 mb-5">
                <AlertTriangle size={24} className="text-amber-400" />
                <h2 className="text-xl font-semibold text-white">Vulnerable Groups Warning</h2>
              </div>
              <div className="space-y-3">
                {warnings.map((warning, i) => (
                  <motion.div
                    key={warning}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5"
                  >
                    <Baby size={16} className="text-amber-400 shrink-0" />
                    <span className="text-white/70 text-sm">{warning}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </ParallaxSection>
        )}

        {/* AQI Categories Reference */}
        <ParallaxSection speed={0.1} direction="up">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-6 rounded-2xl glass"
          >
            <h2 className="text-xl font-semibold text-white mb-5">AQI Categories Reference</h2>
            <div className="space-y-3">
              {AQI_LEVELS.map((level, i) => (
                <motion.div
                  key={level.category}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.05 }}
                  className="flex items-center gap-4 p-4 rounded-xl hover:bg-white/[0.03] transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ backgroundColor: level.color + '20', color: level.color }}
                  >
                    {level.min}-{level.max}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium" style={{ color: level.color }}>{level.category}</div>
                    <div className="text-white/30 text-sm">{level.description}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </ParallaxSection>
      </div>
    </div>
  );
}

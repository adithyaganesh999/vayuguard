'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, Heart, Activity, Thermometer, Droplets, Eye, ArrowRight, ChevronRight } from 'lucide-react';

type ShowcaseSide = 'air' | 'health';

interface FeatureMetric {
  label: string;
  value: string;
  change: string;
  positive: boolean;
}

const airMetrics: FeatureMetric[] = [
  { label: 'PM2.5', value: '35.2 μg/m³', change: '-12%', positive: true },
  { label: 'PM10', value: '68.4 μg/m³', change: '-8%', positive: true },
  { label: 'NO₂', value: '28.6 ppb', change: '+3%', positive: false },
  { label: 'O₃', value: '42.1 ppb', change: '-5%', positive: true },
];

const healthMetrics: FeatureMetric[] = [
  { label: 'Risk Score', value: '2/6', change: 'Low', positive: true },
  { label: 'Lung Impact', value: 'Minimal', change: 'Good', positive: true },
  { label: 'Eye Irritation', value: 'Low', change: 'Normal', positive: true },
  { label: 'Cardio Risk', value: 'Low', change: 'Normal', positive: true },
];

export default function AQIShowcase() {
  const [activeSide, setActiveSide] = useState<ShowcaseSide>('air');

  const metrics = activeSide === 'air' ? airMetrics : healthMetrics;

  return (
    <section className="relative py-20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
            Monitor. <span className="text-gradient">Protect.</span> Thrive.
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            Two perspectives, one mission — keeping you informed about the air you breathe and its impact on your health.
          </p>
        </motion.div>

        {/* Side toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex p-1 rounded-full glass">
            <button
              onClick={() => setActiveSide('air')}
              className={`relative px-8 py-3 rounded-full text-sm font-medium transition-colors duration-300
                ${activeSide === 'air' ? 'text-black' : 'text-white/60 hover:text-white'}`}
            >
              {activeSide === 'air' && (
                <motion.div
                  layoutId="showcase-toggle"
                  className="absolute inset-0 bg-emerald-400 rounded-full"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Wind size={16} /> Air Quality
              </span>
            </button>
            <button
              onClick={() => setActiveSide('health')}
              className={`relative px-8 py-3 rounded-full text-sm font-medium transition-colors duration-300
                ${activeSide === 'health' ? 'text-black' : 'text-white/60 hover:text-white'}`}
            >
              {activeSide === 'health' && (
                <motion.div
                  layoutId="showcase-toggle"
                  className="absolute inset-0 bg-sky-400 rounded-full"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Heart size={16} /> Health Impact
              </span>
            </button>
          </div>
        </div>

        {/* Main showcase area */}
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Visual side */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSide}
              initial={{ opacity: 0, x: -50, rotateY: 15 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{ opacity: 0, x: 50, rotateY: -15 }}
              transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              className="relative aspect-square max-w-md mx-auto"
            >
              {/* Circular visual */}
              <div className="absolute inset-0 flex items-center justify-center">
                {/* Outer ring */}
                <motion.div
                  className="absolute w-80 h-80 rounded-full border border-white/10"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                  className="absolute w-64 h-64 rounded-full border border-white/5"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                />

                {/* Glow */}
                <div
                  className={`absolute w-48 h-48 rounded-full blur-3xl ${
                    activeSide === 'air' ? 'bg-emerald-500/20' : 'bg-sky-500/20'
                  }`}
                />

                {/* Center content */}
                <div className="relative text-center z-10">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                  >
                    {activeSide === 'air' ? (
                      <>
                        <Activity className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                        <div className="text-6xl font-black text-emerald-400">82</div>
                        <div className="text-white/50 text-sm mt-2">AQI Index</div>
                        <div className="text-emerald-400/80 text-lg font-medium mt-1">Moderate</div>
                      </>
                    ) : (
                      <>
                        <Heart className="w-16 h-16 text-sky-400 mx-auto mb-4" />
                        <div className="text-6xl font-black text-sky-400">Low</div>
                        <div className="text-white/50 text-sm mt-2">Health Risk</div>
                        <div className="text-sky-400/80 text-lg font-medium mt-1">Safe for most</div>
                      </>
                    )}
                  </motion.div>
                </div>

                {/* Orbiting dots */}
                {[0, 1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className={`absolute w-3 h-3 rounded-full ${
                      activeSide === 'air' ? 'bg-emerald-400/60' : 'bg-sky-400/60'
                    }`}
                    animate={{
                      x: [0, Math.cos(i * Math.PI / 2) * 140],
                      y: [0, Math.sin(i * Math.PI / 2) * 140],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      repeatType: 'reverse',
                      delay: i * 0.5,
                      ease: 'easeInOut',
                    }}
                    style={{
                      left: '50%',
                      top: '50%',
                      marginLeft: '-6px',
                      marginTop: '-6px',
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Metrics side */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSide + '-metrics'}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              {metrics.map((metric, i) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="flex items-center justify-between p-4 rounded-xl glass hover:bg-white/[0.06] transition-colors group"
                >
                  <div>
                    <div className="text-white/40 text-xs uppercase tracking-wider mb-1">{metric.label}</div>
                    <div className="text-white text-lg font-semibold">{metric.value}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm ${metric.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {metric.change}
                    </span>
                    <ChevronRight size={16} className="text-white/20 group-hover:text-white/60 transition-colors" />
                  </div>
                </motion.div>
              ))}

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl glass text-white/60 hover:text-emerald-400 hover:bg-emerald-500/5 transition-all group"
              >
                View detailed analysis
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Activity, TrendingUp, HeartPulse, Bell, BarChart3, Code, Lock } from 'lucide-react';
import { FEATURED_SERVICES } from '@/lib/mock-data';
import ParallaxSection from '@/components/ui/parallax-section';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';

const iconMap: Record<string, React.ReactNode> = {
  'activity': <Activity size={28} />,
  'trending-up': <TrendingUp size={28} />,
  'heart-pulse': <HeartPulse size={28} />,
  'bell': <Bell size={28} />,
  'bar-chart-3': <BarChart3 size={28} />,
  'code': <Code size={28} />,
};

// Map service IDs to views
const serviceToView: Record<string, string> = {
  'real-time': 'dashboard',
  'forecast': 'forecast',
  'health': 'advisory',
  'alerts': 'alerts',
  'analytics': 'analytics',
  'api': 'analytics',
};

export default function ServicesSection() {
  const { setView } = useApp();
  const { isAuthenticated } = useAuth();

  const handleServiceClick = (serviceId: string) => {
    const targetView = serviceToView[serviceId] || 'dashboard';
    if (isAuthenticated) {
      setView(targetView as any);
    } else {
      setView('login');
    }
  };

  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-10" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <ParallaxSection speed={0.3} direction="up">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="text-emerald-400 text-sm uppercase tracking-[0.3em] mb-4 block">What We Do</span>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold">
              Powerful <span className="text-gradient">Features</span>
            </h2>
            <p className="text-white/40 text-lg mt-4 max-w-2xl mx-auto">
              Everything you need to monitor, understand, and protect yourself from air pollution.
            </p>
          </motion.div>
        </ParallaxSection>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURED_SERVICES.map((service, i) => (
            <ParallaxSection key={service.id} speed={0.15 + i * 0.03} direction="up">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ y: -5, scale: 1.02 }}
                onClick={() => handleServiceClick(service.id)}
                className="group relative p-6 rounded-2xl glass hover:bg-white/[0.06] transition-all duration-300 cursor-pointer"
              >
                <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-5 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                  {iconMap[service.icon]}
                  {!isAuthenticated && (
                    <Lock size={12} className="absolute top-2 right-2 text-white/20" />
                  )}
                </div>

                <h3 className="text-xl font-semibold text-white mb-3">{service.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed mb-5">{service.description}</p>

                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-emerald-400">{service.metric}</span>
                  <span className="text-white/30 text-sm">{service.metricLabel}</span>
                </div>

                {/* Auth hint for unauthenticated users */}
                {!isAuthenticated && (
                  <div className="mt-3 text-emerald-400/50 text-xs flex items-center gap-1">
                    <Lock size={10} />
                    Sign in to access
                  </div>
                )}

                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: 'radial-gradient(circle at 50% 0%, rgba(16,185,129,0.05), transparent 70%)' }}
                />
              </motion.div>
            </ParallaxSection>
          ))}
        </div>
      </div>
    </section>
  );
}

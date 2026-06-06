'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, Droplets, CloudRain, Sun, Factory, Flame, LogOut, User, ChevronDown, Settings, Map, CloudSun, ShieldAlert, BarChart3, Bell } from 'lucide-react';
import Marquee from '@/components/ui/marquee';
import AQIGauge from '@/components/dashboard/AQIGauge';
import PollutantCard from '@/components/dashboard/PollutantCard';
import TrendChart from '@/components/dashboard/TrendChart';
import LocationSelector from '@/components/dashboard/LocationSelector';
import ParallaxSection from '@/components/ui/parallax-section';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { getAQILevel, getHealthRiskScore, getHealthRiskLabel, getAQIColor } from '@/lib/aqi-utils';

export default function DashboardView() {
  const { selectedCity, setView } = useApp();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutToast, setShowLogoutToast] = useState(false);

  const aqiLevel = getAQILevel(selectedCity.currentAQI);
  const riskScore = getHealthRiskScore(selectedCity.currentAQI);
  const riskLabel = getHealthRiskLabel(riskScore);

  const handleLogout = () => {
    setShowUserMenu(false);
    setShowLogoutToast(true);
    setTimeout(() => {
      logout();
      setView('landing');
      setShowLogoutToast(false);
    }, 1500);
  };

  const pollutants = [
    { name: 'PM2.5', value: selectedCity.pm25, unit: 'ug/m3', limit: 60, icon: <Wind size={16} /> },
    { name: 'PM10', value: selectedCity.pm10, unit: 'ug/m3', limit: 150, icon: <CloudRain size={16} /> },
    { name: 'NO2', value: selectedCity.no2, unit: 'ppb', limit: 100, icon: <Factory size={16} /> },
    { name: 'O3', value: selectedCity.o3, unit: 'ppb', limit: 70, icon: <Sun size={16} /> },
    { name: 'SO2', value: selectedCity.so2 || 0, unit: 'ppb', limit: 75, icon: <Flame size={16} /> },
    { name: 'CO', value: selectedCity.co || 0, unit: 'ppm', limit: 9, icon: <Droplets size={16} /> },
  ];

  const navCards = [
    { id: 'map' as const, label: 'Global Map', desc: 'Monitoring stations worldwide', icon: <Map size={24} />, color: '#0ea5e9' },
    { id: 'forecast' as const, label: 'Forecast', desc: '72-hour AQI predictions', icon: <CloudSun size={24} />, color: '#f59e0b' },
    { id: 'advisory' as const, label: 'Advisory', desc: 'Health recommendations', icon: <ShieldAlert size={24} />, color: '#ef4444' },
    { id: 'analytics' as const, label: 'Analytics', desc: 'Historical data insights', icon: <BarChart3 size={24} />, color: '#10b981' },
    { id: 'alerts' as const, label: 'Alerts', desc: 'Smart notifications', icon: <Bell size={24} />, color: '#a855f7' },
    { id: 'profile' as const, label: 'Profile', desc: 'Your health settings', icon: <User size={24} />, color: '#f97316' },
  ];

  return (
    <div className="min-h-screen">
      <Marquee
        items={[`${selectedCity.city.toUpperCase()} AQI: ${selectedCity.currentAQI}`, 'AIR QUALITY MONITORING', 'REAL-TIME DATA', 'HEALTH ADVISORY', 'SMART ALERTS']}
        variant="police"
        className="mb-8"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
        <ParallaxSection speed={0.2} direction="up">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">Dashboard</h1>
              <p className="text-white/40 mt-1">{user ? `Welcome back, ${user.name}` : 'Real-time air quality monitoring'}</p>
            </div>

            <div className="flex items-center gap-3">
              <LocationSelector />

              {/* User Menu */}
              <div className="relative">
                <motion.button onClick={() => setShowUserMenu(!showUserMenu)} whileTap={{ scale: 0.95 }} className="flex items-center gap-2 px-3 py-2 rounded-xl glass hover:bg-white/10 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <span className="text-emerald-400 font-bold text-sm">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                  </div>
                  <span className="text-white/70 text-sm hidden sm:block max-w-[100px] truncate">{user?.name || 'User'}</span>
                  <ChevronDown size={14} className={`text-white/40 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </motion.button>
                <AnimatePresence>
                  {showUserMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                      <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ duration: 0.15 }} className="absolute right-0 top-full mt-2 w-56 rounded-xl glass-strong overflow-hidden z-50">
                        <div className="p-4 border-b border-white/10">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center"><span className="text-emerald-400 font-bold">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span></div>
                            <div className="min-w-0"><div className="text-white text-sm font-medium truncate">{user?.name}</div><div className="text-white/30 text-xs truncate">{user?.email}</div></div>
                          </div>
                        </div>
                        <div className="p-2">
                          <button onClick={() => { setView('profile'); setShowUserMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm"><User size={16} />Profile & Settings</button>
                          <button onClick={() => { setView('alerts'); setShowUserMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm"><Settings size={16} />Alert Preferences</button>
                        </div>
                        <div className="p-2 border-t border-white/10">
                          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm"><LogOut size={16} />Sign Out</button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </ParallaxSection>

        <div className="grid lg:grid-cols-3 gap-6">
          <ParallaxSection speed={0.3} direction="up">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="flex flex-col items-center p-8 rounded-2xl glass">
              <AQIGauge aqi={selectedCity.currentAQI} size={220} />
              <div className="mt-6 text-center"><p className="text-white/40 text-sm">{aqiLevel.description}</p></div>
            </motion.div>
          </ParallaxSection>

          <ParallaxSection speed={0.25} direction="up">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-4">
              <div className="p-6 rounded-2xl glass">
                <h3 className="text-white/40 text-sm uppercase tracking-wider mb-4">Health Risk Level</h3>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black" style={{ backgroundColor: aqiLevel.color + '20', color: aqiLevel.color }}>{riskScore}</div>
                  <div><div className="text-xl font-bold text-white">{riskLabel}</div><div className="text-white/40 text-sm">{aqiLevel.healthImplications}</div></div>
                </div>
              </div>
              <div className="p-6 rounded-2xl glass">
                <h3 className="text-white/40 text-sm uppercase tracking-wider mb-3">Advisory</h3>
                <p className="text-white/70 text-sm">{aqiLevel.advisory}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl glass text-center"><div className="text-2xl font-bold" style={{ color: aqiLevel.color }}>{selectedCity.currentAQI}</div><div className="text-white/30 text-xs mt-1">Current AQI</div></div>
                <div className="p-4 rounded-xl glass text-center"><div className="text-2xl font-bold text-sky-400">{selectedCity.pm25}</div><div className="text-white/30 text-xs mt-1">PM2.5 ug/m3</div></div>
              </div>
            </motion.div>
          </ParallaxSection>

          <ParallaxSection speed={0.2} direction="up">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="p-6 rounded-2xl glass">
              <TrendChart baseAQI={selectedCity.currentAQI} city={selectedCity.city} />
            </motion.div>
          </ParallaxSection>
        </div>

        <ParallaxSection speed={0.15} direction="up">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-6">
            <h2 className="text-xl font-semibold text-white mb-4">Pollutant Breakdown</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pollutants.map((pollutant, i) => (
                <motion.div key={pollutant.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.05 }}>
                  <PollutantCard {...pollutant} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </ParallaxSection>

        {/* Quick Navigation Cards */}
        <ParallaxSection speed={0.1} direction="up">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-6">
            <h2 className="text-xl font-semibold text-white mb-4">Quick Access</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {navCards.map((card, i) => (
                <motion.button
                  key={card.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65 + i * 0.05 }}
                  onClick={() => setView(card.id)}
                  className="p-5 rounded-2xl glass hover:bg-white/[0.06] transition-all text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                      style={{ backgroundColor: card.color + '15', color: card.color }}
                    >
                      {card.icon}
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium group-hover:text-white transition-colors">{card.label}</div>
                      <div className="text-white/30 text-sm">{card.desc}</div>
                    </div>
                    <ChevronDown size={16} className="text-white/20 -rotate-90 group-hover:text-white/40 transition-colors" />
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </ParallaxSection>
      </div>

      {/* Logout Success Toast */}
      <AnimatePresence>
        {showLogoutToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 rounded-2xl glass-strong border border-emerald-500/20 flex items-center gap-3 shadow-2xl"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </motion.div>
            </div>
            <div>
              <div className="text-white font-medium text-sm">Signed out successfully</div>
              <div className="text-white/40 text-xs">Redirecting to home page...</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

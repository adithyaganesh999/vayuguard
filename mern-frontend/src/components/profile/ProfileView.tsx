'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, MapPin, Bell, Heart, Save, Check, LogOut } from 'lucide-react';
import Marquee from '@/components/ui/marquee';
import ParallaxSection from '@/components/ui/parallax-section';
import { CITIES_AQI } from '@/lib/mock-data';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';

export default function ProfileView() {
  const { user, updateUser, logout } = useAuth();
  const { setView } = useApp();
  const [saved, setSaved] = useState(false);
  const [showLogoutToast, setShowLogoutToast] = useState(false);
  const [profile, setProfile] = useState({
    name: user?.name || 'User',
    email: user?.email || 'user@vayuguard.com',
    phone: user?.phone || '',
    location: user?.location || 'Bangalore',
    asthmaPatient: false,
    ageGroup: 'adult',
    respiratoryConditions: false,
    outdoorWorker: false,
    emailAlerts: true,
    pushAlerts: true,
    smsAlerts: false,
    alertThreshold: 100,
  });

  const handleSave = () => {
    updateUser({
      name: profile.name,
      phone: profile.phone,
      location: profile.location,
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setView('dashboard');
    }, 1500);
  };

  const handleLogout = () => {
    setShowLogoutToast(true);
    setTimeout(() => {
      logout();
      setView('landing');
      setShowLogoutToast(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen">
      <Marquee
        items={['YOUR PROFILE', 'HEALTH SETTINGS', 'NOTIFICATIONS', 'PREFERENCES']}
        variant="police"
        className="mb-8"
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-24">
        <ParallaxSection speed={0.2} direction="up">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">Profile</h1>
              <p className="text-white/40 mt-1">Manage your health profile and preferences</p>
            </div>

            {/* Logout button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign Out</span>
            </motion.button>
          </motion.div>
        </ParallaxSection>

        {/* User Card */}
        <ParallaxSection speed={0.15} direction="up">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="p-6 rounded-2xl glass mb-6 flex items-center gap-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
              <span className="text-emerald-400 font-bold text-2xl">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white">{user?.name || 'User'}</h2>
              <p className="text-white/40 text-sm">{user?.email}</p>
              {user?.location && (
                <div className="flex items-center gap-1 mt-1">
                  <MapPin size={12} className="text-emerald-400/60" />
                  <span className="text-white/30 text-xs">{user.location}</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-white/20 text-xs">Member since</div>
              <div className="text-white/40 text-sm">{new Date().getFullYear()}</div>
            </div>
          </motion.div>
        </ParallaxSection>

        {/* Personal Info */}
        <ParallaxSection speed={0.12} direction="up">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-2xl glass mb-6"
          >
            <div className="flex items-center gap-3 mb-5">
              <User size={20} className="text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Personal Information</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-white/40 text-sm mb-2 block">Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="text-white/40 text-sm mb-2 block">Email</label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="text-white/40 text-sm mb-2 block">Phone</label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50 placeholder:text-white/20"
                />
              </div>
              <div>
                <label className="text-white/40 text-sm mb-2 block">Primary Location</label>
                <select
                  value={profile.location}
                  onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                >
                  {CITIES_AQI.map((city) => (
                    <option key={city.city} value={city.city}>{city.city}</option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        </ParallaxSection>

        {/* Health Profile */}
        <ParallaxSection speed={0.1} direction="up">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-2xl glass mb-6"
          >
            <div className="flex items-center gap-3 mb-5">
              <Heart size={20} className="text-red-400" />
              <h2 className="text-lg font-semibold text-white">Health Profile</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-white/40 text-sm mb-2 block">Age Group</label>
                <div className="flex gap-3">
                  {['child', 'adult', 'senior'].map((group) => (
                    <button
                      key={group}
                      onClick={() => setProfile({ ...profile, ageGroup: group })}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors capitalize
                        ${profile.ageGroup === group ? 'bg-emerald-500 text-black font-medium' : 'glass text-white/60'}`}
                    >
                      {group}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { key: 'asthmaPatient' as const, label: 'Asthma Patient', desc: 'I have asthma' },
                  { key: 'respiratoryConditions' as const, label: 'Respiratory Issues', desc: 'I have respiratory conditions' },
                  { key: 'outdoorWorker' as const, label: 'Outdoor Worker', desc: 'I work outdoors' },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setProfile({ ...profile, [item.key]: !profile[item.key] })}
                    className={`p-4 rounded-xl text-left transition-all
                      ${profile[item.key] ? 'glass border border-emerald-500/30' : 'glass opacity-60'}`}
                  >
                    <div className="text-white text-sm font-medium">{item.label}</div>
                    <div className="text-white/30 text-xs mt-1">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </ParallaxSection>

        {/* Notification Preferences */}
        <ParallaxSection speed={0.08} direction="up">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-6 rounded-2xl glass mb-6"
          >
            <div className="flex items-center gap-3 mb-5">
              <Bell size={20} className="text-sky-400" />
              <h2 className="text-lg font-semibold text-white">Notification Preferences</h2>
            </div>
            <div className="space-y-4">
              {[
                { key: 'emailAlerts' as const, label: 'Email Alerts', desc: 'Receive AQI alerts via email' },
                { key: 'pushAlerts' as const, label: 'Push Notifications', desc: 'Browser push notifications' },
                { key: 'smsAlerts' as const, label: 'SMS Alerts', desc: 'Text message alerts' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-3 rounded-xl glass">
                  <div>
                    <div className="text-white text-sm font-medium">{item.label}</div>
                    <div className="text-white/30 text-xs">{item.desc}</div>
                  </div>
                  <button
                    onClick={() => setProfile({ ...profile, [item.key]: !profile[item.key] })}
                    className={`w-12 h-6 rounded-full transition-colors relative ${profile[item.key] ? 'bg-emerald-500' : 'bg-white/10'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${profile[item.key] ? 'left-6' : 'left-0.5'}`} />
                  </button>
                </div>
              ))}

              <div>
                <label className="text-white/40 text-sm mb-2 block">Alert Threshold (AQI)</label>
                <input
                  type="range"
                  min="50"
                  max="300"
                  value={profile.alertThreshold}
                  onChange={(e) => setProfile({ ...profile, alertThreshold: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-white/30 text-xs mt-1">
                  <span>50</span>
                  <span className="text-emerald-400 font-medium">{profile.alertThreshold}</span>
                  <span>300</span>
                </div>
              </div>
            </div>
          </motion.div>
        </ParallaxSection>

        {/* Save button */}
        <ParallaxSection speed={0.05} direction="up">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            onClick={handleSave}
            className="w-full py-4 rounded-xl bg-emerald-500 text-black font-semibold text-lg hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2"
          >
            {saved ? <Check size={20} /> : <Save size={20} />}
            {saved ? 'Saved! Redirecting to Dashboard...' : 'Save Profile & Continue'}
          </motion.button>
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

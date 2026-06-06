'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Plus, Trash2, Clock, MapPin, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import Marquee from '@/components/ui/marquee';
import ParallaxSection from '@/components/ui/parallax-section';
import { useApp } from '@/context/AppContext';
import { CITIES_AQI } from '@/lib/mock-data';

interface AlertItem {
  id: string;
  condition: string;
  location: string;
  frequency: string;
  status: 'active' | 'triggered' | 'inactive';
  createdAt: string;
}

const MOCK_ALERTS: AlertItem[] = [
  { id: '1', condition: 'AQI > 150', location: 'Delhi', frequency: 'daily', status: 'active', createdAt: '2024-01-15' },
  { id: '2', condition: 'PM2.5 > 60', location: 'Bangalore', frequency: 'real-time', status: 'triggered', createdAt: '2024-01-14' },
  { id: '3', condition: 'AQI > 100', location: 'Mumbai', frequency: 'daily', status: 'active', createdAt: '2024-01-13' },
  { id: '4', condition: 'AQI > 200', location: 'Lucknow', frequency: 'real-time', status: 'triggered', createdAt: '2024-01-12' },
  { id: '5', condition: 'O3 > 70', location: 'Chennai', frequency: 'weekly', status: 'inactive', createdAt: '2024-01-10' },
];

export default function AlertsView() {
  const { selectedCity } = useApp();
  const [alerts, setAlerts] = useState<AlertItem[]>(MOCK_ALERTS);
  const [showForm, setShowForm] = useState(false);
  const [newAlert, setNewAlert] = useState({
    condition: 'AQI > 100',
    location: selectedCity.city,
    frequency: 'daily',
  });

  const handleCreateAlert = () => {
    const alert: AlertItem = {
      id: Date.now().toString(),
      condition: newAlert.condition,
      location: newAlert.location,
      frequency: newAlert.frequency,
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setAlerts([alert, ...alerts]);
    setShowForm(false);
  };

  const handleDeleteAlert = (id: string) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  const statusConfig = {
    active: { icon: <CheckCircle size={14} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    triggered: { icon: <AlertTriangle size={14} />, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    inactive: { icon: <XCircle size={14} />, color: 'text-white/30', bg: 'bg-white/5' },
  };

  return (
    <div className="min-h-screen">
      <Marquee
        items={['SMART ALERTS', 'CUSTOM THRESHOLDS', 'INSTANT NOTIFICATIONS', 'STAY PROTECTED']}
        variant="police"
        className="mb-8"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-24">
        <ParallaxSection speed={0.2} direction="up">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">Alerts</h1>
              <p className="text-white/40 mt-1">Manage your air quality alerts</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-black font-medium hover:bg-emerald-400 transition-colors"
            >
              <Plus size={16} />
              New Alert
            </button>
          </motion.div>
        </ParallaxSection>

        {/* Create alert form */}
        {showForm && (
          <ParallaxSection speed={0.15} direction="up">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-2xl glass mb-6 border border-emerald-500/20"
            >
              <h3 className="text-lg font-semibold text-white mb-4">Create New Alert</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-white/40 text-sm mb-2 block">Condition</label>
                  <select
                    value={newAlert.condition}
                    onChange={(e) => setNewAlert({ ...newAlert, condition: e.target.value })}
                    className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="AQI > 50">AQI &gt; 50</option>
                    <option value="AQI > 100">AQI &gt; 100</option>
                    <option value="AQI > 150">AQI &gt; 150</option>
                    <option value="AQI > 200">AQI &gt; 200</option>
                    <option value="PM2.5 > 35">PM2.5 &gt; 35</option>
                    <option value="PM2.5 > 60">PM2.5 &gt; 60</option>
                    <option value="PM10 > 100">PM10 &gt; 100</option>
                  </select>
                </div>
                <div>
                  <label className="text-white/40 text-sm mb-2 block">Location</label>
                  <select
                    value={newAlert.location}
                    onChange={(e) => setNewAlert({ ...newAlert, location: e.target.value })}
                    className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  >
                    {CITIES_AQI.map((city) => (
                      <option key={city.city} value={city.city}>{city.city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-white/40 text-sm mb-2 block">Frequency</label>
                  <div className="flex gap-3">
                    {['real-time', 'daily', 'weekly'].map((freq) => (
                      <button
                        key={freq}
                        onClick={() => setNewAlert({ ...newAlert, frequency: freq })}
                        className={`px-4 py-2 rounded-lg text-sm transition-colors
                          ${newAlert.frequency === freq ? 'bg-emerald-500 text-black font-medium' : 'glass text-white/60'}`}
                      >
                        {freq.charAt(0).toUpperCase() + freq.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleCreateAlert}
                  className="w-full py-3 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition-colors"
                >
                  Create Alert
                </button>
              </div>
            </motion.div>
          </ParallaxSection>
        )}

        {/* Active Alerts */}
        <ParallaxSection speed={0.1} direction="up">
          <div className="space-y-3">
            <h2 className="text-white/60 text-sm uppercase tracking-wider mb-3">Your Alerts</h2>
            {alerts.map((alert, i) => {
              const status = statusConfig[alert.status];
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-xl glass hover:bg-white/[0.06] transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${status.bg}`}>
                      <Bell size={16} className={status.color} />
                    </div>
                    <div>
                      <div className="text-white font-medium">{alert.condition}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <MapPin size={12} className="text-white/30" />
                        <span className="text-white/30 text-sm">{alert.location}</span>
                        <Clock size={12} className="text-white/30 ml-1" />
                        <span className="text-white/30 text-sm">{alert.frequency}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center gap-1 text-xs ${status.color}`}>
                      {status.icon}
                      {alert.status}
                    </span>
                    <button
                      onClick={() => handleDeleteAlert(alert.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ParallaxSection>
      </div>
    </div>
  );
}

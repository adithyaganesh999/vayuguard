'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Users, Activity, Bell, BarChart3, Database, Shield, Globe } from 'lucide-react';
import UserManagement from './UserManagement';
import SystemHealth from './SystemHealth';
import AlertConfig from './AlertConfig';

const TABS = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'health', label: 'System', icon: Activity },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('users');

  const renderContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagement />;
      case 'health':
        return <SystemHealth />;
      case 'alerts':
        return <AlertConfig />;
      case 'stats':
        return (
          <div className="space-y-4">
            <h3 className="text-white font-semibold">Platform Statistics</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Users', value: '12,847', icon: Users, color: '#10b981' },
                { label: 'Active Stations', value: '524', icon: Globe, color: '#0ea5e9' },
                { label: 'Data Points', value: '50M+', icon: Database, color: '#f59e0b' },
                { label: 'Alerts Sent', value: '89,342', icon: Bell, color: '#a855f7' },
              ].map((stat) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl glass"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: stat.color + '15', color: stat.color }}
                    >
                      <stat.icon size={18} />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-white">{stat.value}</div>
                      <div className="text-white/30 text-xs">{stat.label}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <Shield size={20} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Admin Panel</h2>
          <p className="text-white/40 text-sm">Manage VayuGuard platform</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'glass text-white/50 hover:text-white/70'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  );
}

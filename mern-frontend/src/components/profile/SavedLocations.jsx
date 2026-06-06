'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Plus, Trash2, Star, Navigation } from 'lucide-react';
import { getAQIColor } from '@/lib/aqi-utils';

export default function SavedLocations({ locations = [], onAdd, onRemove, onSetPrimary, onSelect }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newLocation, setNewLocation] = useState('');

  const handleAdd = () => {
    if (!newLocation.trim()) return;
    onAdd?.({
      id: Date.now().toString(),
      name: newLocation,
      isPrimary: locations.length === 0,
      addedAt: new Date().toISOString(),
    });
    setNewLocation('');
    setShowAdd(false);
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-emerald-400" />
          <h3 className="text-white font-semibold text-sm">Saved Locations</h3>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="w-7 h-7 rounded-lg glass hover:bg-white/10 flex items-center justify-center text-emerald-400 transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Add location */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="Enter city name..."
                className="flex-1 px-3 py-2 rounded-lg glass text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                autoFocus
              />
              <button
                onClick={handleAdd}
                disabled={!newLocation.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-black text-sm font-medium hover:bg-emerald-400 disabled:opacity-50 transition-colors"
              >
                Add
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location list */}
      <div className="space-y-2">
        {locations.length === 0 ? (
          <div className="p-6 rounded-xl glass text-center">
            <Navigation size={24} className="text-white/20 mx-auto mb-2" />
            <p className="text-white/30 text-sm">No saved locations yet</p>
            <p className="text-white/20 text-xs mt-1">Add cities you want to monitor</p>
          </div>
        ) : (
          locations.map((location, i) => (
            <motion.div
              key={location.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-xl glass hover:bg-white/[0.06] transition-colors group"
            >
              <button
                onClick={() => onSelect?.(location)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  location.isPrimary ? 'bg-emerald-500/20' : 'bg-white/5'
                }`}
              >
                <MapPin size={14} className={location.isPrimary ? 'text-emerald-400' : 'text-white/30'} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate">{location.name}</div>
                {location.aqi !== undefined && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: getAQIColor(location.aqi) }}>
                      AQI: {location.aqi}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onSetPrimary?.(location.id)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                    location.isPrimary ? 'text-amber-400' : 'text-white/10 hover:text-amber-400/50'
                  }`}
                  title="Set as primary"
                >
                  <Star size={12} fill={location.isPrimary ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={() => onRemove?.(location.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/10 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, X, Loader2 } from 'lucide-react';

export default function LocationSearch({ onSelectLocation, placeholder = 'Search location...' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchLocations = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/aqi/current?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(Array.isArray(data) ? data : data.results || []);
        setShowDropdown(true);
      }
    } catch {
      // Fallback: use mock data for demo
      const mockResults = [
        { city: 'Delhi', state: 'Delhi', latitude: 28.6139, longitude: 77.209, aqi: 248 },
        { city: 'Mumbai', state: 'Maharashtra', latitude: 19.076, longitude: 72.8777, aqi: 112 },
        { city: 'Bangalore', state: 'Karnataka', latitude: 12.9716, longitude: 77.5946, aqi: 82 },
        { city: 'Chennai', state: 'Tamil Nadu', latitude: 13.0827, longitude: 80.2707, aqi: 68 },
      ].filter((c) => c.city.toLowerCase().includes(searchQuery.toLowerCase()));
      setResults(mockResults);
      setShowDropdown(true);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchLocations(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchLocations]);

  const handleSelect = useCallback((location) => {
    onSelectLocation?.(location);
    setQuery(location.city);
    setShowDropdown(false);
  }, [onSelectLocation]);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  }, []);

  return (
    <div className="relative w-full max-w-xs">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2.5 rounded-xl glass text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
          aria-label="Search for a location"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {showDropdown && results.length > 0 && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 rounded-xl glass-strong border border-white/10 overflow-hidden z-50 max-h-64 overflow-y-auto"
          >
            {results.map((location) => (
              <button
                key={`${location.city}-${location.state}`}
                onClick={() => handleSelect(location)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
              >
                <MapPin size={16} className="text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-white text-sm font-medium truncate">{location.city}</div>
                  <div className="text-white/30 text-xs">{location.state}</div>
                </div>
                {location.aqi !== undefined && (
                  <div
                    className="ml-auto shrink-0 px-2 py-0.5 rounded-md text-xs font-bold"
                    style={{
                      backgroundColor: `rgba(${location.aqi > 150 ? '239,68,68' : location.aqi > 100 ? '249,115,22' : location.aqi > 50 ? '245,158,11' : '16,185,129'},0.15)`,
                      color: location.aqi > 150 ? '#ef4444' : location.aqi > 100 ? '#f97316' : location.aqi > 50 ? '#f59e0b' : '#10b981',
                    }}
                  >
                    {location.aqi}
                  </div>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

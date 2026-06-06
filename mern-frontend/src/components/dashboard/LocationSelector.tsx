'use client';

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, Globe, MapPin, Loader2 } from 'lucide-react';
import { CITIES_AQI, GLOBAL_STATIONS, type CityAQI } from '@/lib/mock-data';
import { getAQIColor } from '@/lib/aqi-utils';
import { useApp } from '@/context/AppContext';

interface SearchResult {
  city: string;
  region: string;
  aqi: number;
  country: string;
  isGlobal: boolean;
  cityData?: CityAQI;
  latitude: number;
  longitude: number;
}

interface GeoResult {
  name: string;
  country: string;
  state?: string;
  lat: string;
  lon: string;
}

// Deterministic mock AQI based on city name hash
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function generateMockAQI(cityName: string, lat: number = 0, lng: number = 0): CityAQI {
  const hash = hashCode(cityName);
  const aqi = 30 + (hash % 220);
  return {
    city: cityName,
    state: 'Unknown',
    latitude: lat,
    longitude: lng,
    currentAQI: aqi,
    category: aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : aqi <= 150 ? 'Unhealthy for Sensitive Groups' : aqi <= 200 ? 'Unhealthy' : aqi <= 300 ? 'Very Unhealthy' : 'Hazardous',
    pm25: Math.round(aqi * 0.45 * 10) / 10,
    pm10: Math.round(aqi * 0.85 * 10) / 10,
    no2: Math.round(aqi * 0.3 * 10) / 10,
    o3: Math.round(aqi * 0.4 * 10) / 10,
    so2: Math.round(aqi * 0.1 * 10) / 10,
    co: Math.round(aqi * 0.01 * 10) / 10,
    trend: 'stable',
    trendValue: 0,
  };
}

export default function LocationSelector() {
  const { selectedCity, setSelectedCity } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isSearchingAPI, setIsSearchingAPI] = useState(false);
  const [apiResults, setApiResults] = useState<GeoResult[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search through local mock data using useMemo
  const localSearchResults = useMemo<SearchResult[]>(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    const results: SearchResult[] = [];

    CITIES_AQI.forEach((city) => {
      if (city.city.toLowerCase().includes(query) || city.state.toLowerCase().includes(query)) {
        results.push({
          city: city.city,
          region: city.state,
          aqi: city.currentAQI,
          country: 'India',
          isGlobal: false,
          cityData: city,
          latitude: city.latitude,
          longitude: city.longitude,
        });
      }
    });

    GLOBAL_STATIONS.forEach((station) => {
      const alreadyInResults = results.some(r => r.city === station.city && r.country === 'India');
      if (alreadyInResults) return;
      if (station.city.toLowerCase().includes(query) || station.country.toLowerCase().includes(query)) {
        results.push({
          city: station.city,
          region: station.country,
          aqi: station.aqi,
          country: station.country,
          isGlobal: true,
          latitude: station.latitude,
          longitude: station.longitude,
        });
      }
    });

    return results.slice(0, 8);
  }, [searchQuery]);

  // Track local results count with a ref to avoid effect dependency on array
  const localCountRef = useRef(0);
  localCountRef.current = localSearchResults.length;

  // Combine local + API results
  const searchResults = useMemo(() => {
    const local = localSearchResults;
    if (apiResults.length === 0) return local;

    const apiSearchResults: SearchResult[] = apiResults
      .filter((geo) => {
        const alreadyFound = local.some(
          (r) => r.city.toLowerCase() === geo.name.toLowerCase()
        );
        return !alreadyFound;
      })
      .map((geo) => ({
        city: geo.name,
        region: geo.state || geo.country,
        aqi: 30 + (hashCode(geo.name) % 150),
        country: geo.country,
        isGlobal: true,
        latitude: parseFloat(geo.lat),
        longitude: parseFloat(geo.lon),
      }));

    return [...local, ...apiSearchResults].slice(0, 12);
  }, [localSearchResults, apiResults]);

  // Real-time API search with debounce — only depends on searchQuery string
  useEffect(() => {
    if (!searchQuery.trim()) {
      setApiResults([]);
      return;
    }

    // Only search API if local results are insufficient
    if (localCountRef.current >= 3) {
      setApiResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingAPI(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery.trim())}&format=json&limit=6&addressdetails=1`,
          {
            headers: {
              'Accept-Language': 'en',
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          const geoResults: GeoResult[] = data
            .filter((item: { type: string; class: string }) =>
              item.type === 'city' || item.type === 'town' || item.type === 'village' ||
              item.class === 'place' || item.type === 'administrative'
            )
            .map((item: { display_name: string; lat: string; lon: string; address?: { city?: string; town?: string; state?: string; country?: string } }) => ({
              name: item.address?.city || item.address?.town || item.display_name?.split(',')[0] || 'Unknown',
              country: item.address?.country || 'Unknown',
              state: item.address?.state,
              lat: item.lat,
              lon: item.lon,
            }));
          setApiResults(geoResults);
        }
      } catch {
        setApiResults([]);
      } finally {
        setIsSearchingAPI(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowSearch(false);
        setSearchQuery('');
        setApiResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectResult = useCallback((result: SearchResult) => {
    if (result.cityData) {
      setSelectedCity(result.cityData);
    } else if (result.isGlobal) {
      const station = GLOBAL_STATIONS.find(s => s.city === result.city && s.country === result.country);
      if (station) {
        const aqi = station.aqi;
        const cityData: CityAQI = {
          city: station.city,
          state: station.country,
          latitude: station.latitude,
          longitude: station.longitude,
          currentAQI: aqi,
          category: aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : aqi <= 150 ? 'Unhealthy for Sensitive Groups' : aqi <= 200 ? 'Unhealthy' : aqi <= 300 ? 'Very Unhealthy' : 'Hazardous',
          pm25: Math.round(aqi * 0.45 * 10) / 10,
          pm10: Math.round(aqi * 0.85 * 10) / 10,
          no2: Math.round(aqi * 0.3 * 10) / 10,
          o3: Math.round(aqi * 0.4 * 10) / 10,
          so2: Math.round(aqi * 0.1 * 10) / 10,
          co: Math.round(aqi * 0.01 * 10) / 10,
          trend: 'stable',
          trendValue: 0,
        };
        setSelectedCity(cityData);
      } else {
        setSelectedCity(generateMockAQI(result.city, result.latitude, result.longitude));
      }
    } else {
      setSelectedCity(generateMockAQI(result.city, result.latitude, result.longitude));
    }
    setIsOpen(false);
    setShowSearch(false);
    setSearchQuery('');
    setApiResults([]);
  }, [setSelectedCity]);

  const handleSearchWorldwide = useCallback(() => {
    setSelectedCity(generateMockAQI(searchQuery.trim()));
    setIsOpen(false);
    setShowSearch(false);
    setSearchQuery('');
    setApiResults([]);
  }, [searchQuery, setSelectedCity]);

  return (
    <div ref={dropdownRef} className="relative flex items-center gap-2">
      {/* Search input */}
      <div className="relative">
        <motion.div
          initial={false}
          animate={{ width: showSearch ? 260 : 40 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="relative overflow-hidden rounded-xl"
        >
          <button
            onClick={() => {
              setShowSearch(!showSearch);
              if (!showSearch) {
                setTimeout(() => searchInputRef.current?.focus(), 300);
              } else {
                setSearchQuery('');
                setApiResults([]);
              }
            }}
            className="absolute left-0 top-0 w-10 h-10 flex items-center justify-center z-10 text-white/50 hover:text-white/80 transition-colors"
          >
            <Search size={16} />
          </button>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search any city worldwide..."
            className={`w-full h-10 pl-10 pr-8 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-all ${
              showSearch ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          />
          {showSearch && isSearchingAPI && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 size={14} className="animate-spin text-emerald-400" />
            </div>
          )}
        </motion.div>

        {/* Search results dropdown */}
        <AnimatePresence>
          {showSearch && searchQuery.trim() && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute top-full left-0 mt-2 w-80 rounded-xl glass-strong overflow-hidden z-50 max-h-80 overflow-y-auto"
            >
              {searchResults.length > 0 ? (
                searchResults.map((result, i) => (
                  <button
                    key={`${result.city}-${result.country}-${i}`}
                    onClick={() => handleSelectResult(result)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: getAQIColor(result.aqi) }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium">{result.city}</div>
                      <div className="text-white/30 text-xs flex items-center gap-1">
                        {result.isGlobal ? <Globe size={10} /> : <MapPin size={10} />}
                        {result.region}, {result.country}
                      </div>
                    </div>
                    <div className="text-white/50 text-sm font-mono">{result.aqi}</div>
                  </button>
                ))
              ) : isSearchingAPI ? (
                <div className="p-4 flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin text-emerald-400" />
                  <span className="text-white/30 text-sm">Searching worldwide...</span>
                </div>
              ) : (
                <div className="p-3">
                  <p className="text-white/30 text-sm mb-2">No cities found in local data</p>
                  <p className="text-white/20 text-xs">Try searching with different keywords</p>
                </div>
              )}
              {/* Search worldwide option */}
              {searchQuery.trim() && (
                <button
                  onClick={handleSearchWorldwide}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-t border-white/5"
                >
                  <Globe size={16} className="text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-emerald-400 text-sm font-medium">
                      Search worldwide for: {searchQuery.trim()}
                    </div>
                    <div className="text-white/30 text-xs">Generate AQI data for this location</div>
                  </div>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Existing dropdown selector */}
      <div className="relative">
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            setShowSearch(false);
            setSearchQuery('');
            setApiResults([]);
          }}
          className="flex items-center gap-3 px-4 py-2 rounded-xl glass hover:bg-white/[0.06] transition-colors"
        >
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getAQIColor(selectedCity.currentAQI) }}
          />
          <span className="text-white font-medium">{selectedCity.city}</span>
          <span className="text-white/30 text-sm hidden sm:inline">{selectedCity.state}</span>
          <ChevronDown size={16} className={`text-white/30 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute top-full right-0 mt-2 w-72 rounded-xl glass-strong overflow-hidden z-50 max-h-80 overflow-y-auto"
          >
            <div className="p-2 border-b border-white/5">
              <div className="text-white/20 text-[10px] uppercase tracking-wider px-3 py-1">Indian Cities</div>
            </div>
            {CITIES_AQI.map((city) => (
              <button
                key={city.city}
                onClick={() => {
                  setSelectedCity(city);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left
                  ${selectedCity.city === city.city ? 'bg-white/5' : ''}`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: getAQIColor(city.currentAQI) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium">{city.city}</div>
                  <div className="text-white/30 text-xs">{city.state}</div>
                </div>
                <div className="text-white/50 text-sm font-mono">{city.currentAQI}</div>
              </button>
            ))}
            <div className="p-2 border-b border-t border-white/5">
              <div className="text-white/20 text-[10px] uppercase tracking-wider px-3 py-1">Global Stations</div>
            </div>
            {GLOBAL_STATIONS.slice(0, 10).map((station) => (
              <button
                key={`${station.city}-${station.country}`}
                onClick={() => {
                  const aqi = station.aqi;
                  setSelectedCity({
                    city: station.city,
                    state: station.country,
                    latitude: station.latitude,
                    longitude: station.longitude,
                    currentAQI: aqi,
                    category: aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : aqi <= 150 ? 'Unhealthy for Sensitive Groups' : aqi <= 200 ? 'Unhealthy' : aqi <= 300 ? 'Very Unhealthy' : 'Hazardous',
                    pm25: Math.round(aqi * 0.45 * 10) / 10,
                    pm10: Math.round(aqi * 0.85 * 10) / 10,
                    no2: Math.round(aqi * 0.3 * 10) / 10,
                    o3: Math.round(aqi * 0.4 * 10) / 10,
                    so2: Math.round(aqi * 0.1 * 10) / 10,
                    co: Math.round(aqi * 0.01 * 10) / 10,
                    trend: 'stable',
                    trendValue: 0,
                  });
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: getAQIColor(station.aqi) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium">{station.city}</div>
                  <div className="text-white/30 text-xs">{station.country}</div>
                </div>
                <div className="text-white/50 text-sm font-mono">{station.aqi}</div>
              </button>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

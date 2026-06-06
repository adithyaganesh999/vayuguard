'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DottedMap from 'dotted-map';
import { GLOBAL_STATIONS, CITIES_AQI } from '@/lib/mock-data';
import { getAQIColor } from '@/lib/aqi-utils';
import { useApp } from '@/context/AppContext';
import { Search, MapPin, Globe, Loader2, X, Navigation } from 'lucide-react';

interface GeoResult {
  name: string;
  country: string;
  state?: string;
  lat: string;
  lon: string;
}

export default function WorldMap({ className = '' }: { className?: string }) {
  const { selectedCity, setSelectedCity } = useApp();
  const [mapSearch, setMapSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeoResult[]>([]);
  const [highlightedCity, setHighlightedCity] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const mapSVG = useMemo(() => {
    try {
      const map = new DottedMap({ height: 60, grid: 'diagonal' });
      return map.getSVG({
        radius: 0.22,
        color: '#1a1a2e',
        shape: 'circle',
        backgroundColor: 'transparent',
      });
    } catch {
      return '';
    }
  }, []);

  // Combine all stations for display
  const allStations = useMemo(() => {
    const stations = [...GLOBAL_STATIONS];
    // Add Indian cities that aren't already in GLOBAL_STATIONS
    CITIES_AQI.forEach(city => {
      if (!stations.some(s => s.city === city.city)) {
        stations.push({
          city: city.city,
          country: 'India',
          latitude: city.latitude,
          longitude: city.longitude,
          aqi: city.currentAQI,
        });
      }
    });
    return stations;
  }, []);

  const flightPaths = useMemo(() => {
    const paths: { from: typeof GLOBAL_STATIONS[0]; to: typeof GLOBAL_STATIONS[0] }[] = [];
    const connections = [
      [0, 11], [1, 9], [2, 17], [3, 11], [4, 11],
      [5, 14], [6, 12], [7, 17], [8, 2], [10, 3],
    ];
    connections.forEach(([from, to]) => {
      if (GLOBAL_STATIONS[from] && GLOBAL_STATIONS[to]) {
        paths.push({ from: GLOBAL_STATIONS[from], to: GLOBAL_STATIONS[to] });
      }
    });
    return paths;
  }, []);

  // Convert lat/lng to approximate SVG positions (India-centered view)
  const toSVGCoords = useCallback((lat: number, lng: number) => {
    const x = ((lng + 180) / 360) * 900;
    const y = ((90 - lat) / 180) * 400;
    return { x, y };
  }, []);

  // Search with debounce — searches local data + Nominatim API
  useEffect(() => {
    if (!mapSearch.trim()) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(mapSearch.trim())}&format=json&limit=8&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        if (response.ok) {
          const data = await response.json();
          const results: GeoResult[] = data
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
          setSearchResults(results);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [mapSearch]);

  // Locate a city on the map
  const locateOnMap = useCallback((geo: GeoResult) => {
    const lat = parseFloat(geo.lat);
    const lng = parseFloat(geo.lon);
    setHighlightedCity({ lat, lng, name: geo.name });
    setMapSearch('');
    setSearchResults([]);

    // Also update the selected city in AppContext
    const existingCity = CITIES_AQI.find(c =>
      c.city.toLowerCase() === geo.name.toLowerCase()
    );
    if (existingCity) {
      setSelectedCity(existingCity);
    } else {
      const hash = geo.name.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
      const aqi = 30 + (Math.abs(hash) % 220);
      setSelectedCity({
        city: geo.name,
        state: geo.state || geo.country,
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
      });
    }
  }, [setSelectedCity]);

  // Also locate selected city from dashboard
  useEffect(() => {
    setHighlightedCity({ lat: selectedCity.latitude, lng: selectedCity.longitude, name: selectedCity.city });
  }, [selectedCity]);

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      {/* Search bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-strong">
            <Search size={16} className="text-white/40 shrink-0" />
            <input
              type="text"
              value={mapSearch}
              onChange={(e) => setMapSearch(e.target.value)}
              placeholder="Search city to locate on map..."
              className="flex-1 bg-transparent text-white text-sm placeholder:text-white/30 focus:outline-none"
            />
            {isSearching && <Loader2 size={14} className="animate-spin text-emerald-400 shrink-0" />}
            {mapSearch && (
              <button onClick={() => { setMapSearch(''); setSearchResults([]); }} className="text-white/30 hover:text-white/60">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Search results dropdown */}
          <AnimatePresence>
            {mapSearch.trim() && searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute top-full left-0 right-0 mt-2 rounded-xl glass-strong overflow-hidden max-h-64 overflow-y-auto"
              >
                {searchResults.map((result, i) => (
                  <button
                    key={`${result.name}-${result.country}-${i}`}
                    onClick={() => locateOnMap(result)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                  >
                    <Navigation size={14} className="text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium">{result.name}</div>
                      <div className="text-white/30 text-xs flex items-center gap-1">
                        <MapPin size={10} />
                        {result.state && `${result.state}, `}{result.country}
                      </div>
                    </div>
                    <Globe size={12} className="text-white/20" />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Current city indicator */}
        <div className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl glass-strong">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getAQIColor(selectedCity.currentAQI) }} />
          <span className="text-white text-sm font-medium">{selectedCity.city}</span>
          <span className="text-white/30 text-xs">AQI {selectedCity.currentAQI}</span>
        </div>
      </div>

      <div className="relative w-full" style={{ paddingBottom: '44%' }}>
        {/* Dotted map background */}
        <div
          className="absolute inset-0 opacity-40"
          dangerouslySetInnerHTML={{ __html: mapSVG }}
          style={{ filter: 'brightness(2)' }}
        />

        {/* SVG overlay for stations and flight paths */}
        <svg
          ref={svgContainerRef}
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 900 400"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Flight paths */}
          {flightPaths.map((path, i) => {
            const from = toSVGCoords(path.from.latitude, path.from.longitude);
            const to = toSVGCoords(path.to.latitude, path.to.longitude);
            const midX = (from.x + to.x) / 2;
            const midY = Math.min(from.y, to.y) - 30;
            return (
              <g key={`path-${i}`}>
                <path
                  d={`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`}
                  fill="none"
                  stroke="rgba(16,185,129,0.2)"
                  strokeWidth="1"
                  className="flight-path"
                />
                <circle r="2" fill="#10b981">
                  <animateMotion
                    dur={`${3 + i * 0.5}s`}
                    repeatCount="indefinite"
                    path={`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`}
                  />
                </circle>
              </g>
            );
          })}

          {/* Station dots */}
          {allStations.map((station, i) => {
            const coords = toSVGCoords(station.latitude, station.longitude);
            const color = getAQIColor(station.aqi);
            const isHighlighted = highlightedCity &&
              Math.abs(highlightedCity.lat - station.latitude) < 0.5 &&
              Math.abs(highlightedCity.lng - station.longitude) < 0.5;

            return (
              <g key={`station-${i}`}>
                {/* Pulse ring */}
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={isHighlighted ? "8" : "6"}
                  fill="none"
                  stroke={color}
                  strokeWidth={isHighlighted ? "1" : "0.5"}
                  opacity={isHighlighted ? "0.6" : "0.3"}
                >
                  <animate
                    attributeName="r"
                    from={isHighlighted ? "4" : "3"}
                    to={isHighlighted ? "14" : "10"}
                    dur={isHighlighted ? "1s" : "2s"}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    from="0.5"
                    to="0"
                    dur={isHighlighted ? "1s" : "2s"}
                    repeatCount="indefinite"
                  />
                </circle>
                {/* Station dot */}
                <motion.circle
                  cx={coords.x}
                  cy={coords.y}
                  r={isHighlighted ? "4" : "2.5"}
                  fill={color}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.02, duration: 0.4 }}
                />
                {/* City label */}
                <text
                  x={coords.x}
                  y={coords.y - (isHighlighted ? 12 : 8)}
                  textAnchor="middle"
                  fill={isHighlighted ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)"}
                  fontSize={isHighlighted ? "7" : "5"}
                  fontFamily="monospace"
                  fontWeight={isHighlighted ? "bold" : "normal"}
                >
                  {station.aqi}
                </text>
                {/* City name for highlighted */}
                {isHighlighted && (
                  <text
                    x={coords.x}
                    y={coords.y - 18}
                    textAnchor="middle"
                    fill="#10b981"
                    fontSize="6"
                    fontFamily="sans-serif"
                    fontWeight="bold"
                  >
                    {station.city}
                  </text>
                )}
              </g>
            );
          })}

          {/* Highlighted city crosshair */}
          {highlightedCity && (() => {
            const coords = toSVGCoords(highlightedCity.lat, highlightedCity.lng);
            return (
              <g className="highlighted-city">
                {/* Vertical line */}
                <line x1={coords.x} y1="0" x2={coords.x} y2="400" stroke="rgba(16,185,129,0.15)" strokeWidth="0.5" strokeDasharray="4,4" />
                {/* Horizontal line */}
                <line x1="0" y1={coords.y} x2="900" y2={coords.y} stroke="rgba(16,185,129,0.15)" strokeWidth="0.5" strokeDasharray="4,4" />
                {/* Target circle */}
                <circle cx={coords.x} cy={coords.y} r="12" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.5">
                  <animate attributeName="r" from="8" to="18" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite" />
                </circle>
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}

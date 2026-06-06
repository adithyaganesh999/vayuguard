'use client';

import { useQuery } from '@tanstack/react-query';
import { CITIES_AQI, generateHourlyAQI, generateDailyForecast, generateHistoricalData } from '@/lib/mock-data';

export function useAQIData(city: string) {
  return useQuery({
    queryKey: ['aqi', 'current', city],
    queryFn: async () => {
      const response = await fetch(`/api/aqi/current?city=${encodeURIComponent(city)}`);
      if (!response.ok) {
        return CITIES_AQI.find(c => c.city.toLowerCase() === city.toLowerCase()) || CITIES_AQI[0];
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useHourlyAQI(baseAQI: number) {
  return useQuery({
    queryKey: ['aqi', 'hourly', baseAQI],
    queryFn: async () => {
      return generateHourlyAQI(baseAQI);
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useForecast(city: string, baseAQI: number) {
  return useQuery({
    queryKey: ['aqi', 'forecast', city],
    queryFn: async () => {
      const response = await fetch(`/api/aqi/forecast?city=${encodeURIComponent(city)}&hours=72`);
      if (!response.ok) {
        return generateDailyForecast(baseAQI);
      }
      return response.json();
    },
    staleTime: 30 * 60 * 1000,
  });
}

export function useHistorical(city: string, baseAQI: number, days: number = 30) {
  return useQuery({
    queryKey: ['aqi', 'historical', city, days],
    queryFn: async () => {
      const response = await fetch(`/api/aqi/historical?city=${encodeURIComponent(city)}&days=${days}`);
      if (!response.ok) {
        return generateHistoricalData(baseAQI, days);
      }
      return response.json();
    },
    staleTime: 60 * 60 * 1000,
  });
}

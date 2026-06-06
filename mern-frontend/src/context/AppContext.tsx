'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CITIES_AQI, type CityAQI } from '@/lib/mock-data';

export type ViewType = 'landing' | 'login' | 'signup' | 'dashboard' | 'map' | 'forecast' | 'advisory' | 'alerts' | 'analytics' | 'profile';

interface AppState {
  currentView: ViewType;
  selectedCity: CityAQI;
  cities: CityAQI[];
  isNavVisible: boolean;
  showPreloader: boolean;
}

interface AppContextType extends AppState {
  setView: (view: ViewType) => void;
  setSelectedCity: (city: CityAQI) => void;
  toggleNav: () => void;
  triggerPreloader: () => void;
  dismissPreloader: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    currentView: 'landing',
    selectedCity: CITIES_AQI[0],
    cities: CITIES_AQI,
    isNavVisible: true,
    showPreloader: false,
  });

  const setView = useCallback((view: ViewType) => {
    setState(prev => ({ ...prev, currentView: view }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const setSelectedCity = useCallback((city: CityAQI) => {
    setState(prev => ({ ...prev, selectedCity: city }));
  }, []);

  const toggleNav = useCallback(() => {
    setState(prev => ({ ...prev, isNavVisible: !prev.isNavVisible }));
  }, []);

  const triggerPreloader = useCallback(() => {
    setState(prev => ({ ...prev, showPreloader: true }));
  }, []);

  const dismissPreloader = useCallback(() => {
    setState(prev => ({ ...prev, showPreloader: false }));
  }, []);

  return (
    <AppContext.Provider value={{ ...state, setView, setSelectedCity, toggleNav, triggerPreloader, dismissPreloader }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

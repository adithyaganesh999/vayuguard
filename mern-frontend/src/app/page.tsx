'use client';

import React, { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider, useApp } from '@/context/AppContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import LimelightNav from '@/components/ui/limelight-nav';
import Marquee from '@/components/ui/marquee';
import CinematicFooter from '@/components/ui/cinematic-footer';
import AQIShowcase from '@/components/ui/aqi-showcase';
import HeroSection from '@/components/landing/HeroSection';
import ServicesSection from '@/components/landing/ServicesSection';
import CitiesSection from '@/components/landing/CitiesSection';
import StatsSection from '@/components/landing/StatsSection';
import ContactSection from '@/components/landing/ContactSection';
import DashboardView from '@/components/dashboard/DashboardView';
import MapView from '@/components/map/MapView';
import ForecastView from '@/components/forecast/ForecastView';
import AdvisoryView from '@/components/advisory/AdvisoryView';
import AlertsView from '@/components/alerts/AlertsView';
import AnalyticsView from '@/components/analytics/AnalyticsView';
import ProfileView from '@/components/profile/ProfileView';
import LoginView from '@/components/auth/LoginView';
import SignupView from '@/components/auth/SignupView';
import Preloader from '@/components/ui/preloader';
import { Loader2, Lock } from 'lucide-react';

// Views that require authentication
const PROTECTED_VIEWS = ['dashboard', 'map', 'forecast', 'advisory', 'alerts', 'analytics', 'profile'];
// Views that show the bottom nav
const NAV_VIEWS = ['dashboard', 'map', 'forecast', 'advisory', 'alerts', 'analytics', 'profile'];

// Login required popup component
function LoginRequiredPopup({ show, onClose, onLogin }: { show: boolean; onClose: () => void; onLogin: () => void }) {
  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-sm p-8 rounded-2xl glass-strong border border-emerald-500/20"
          >
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">
                <Lock size={28} className="text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Login Required</h3>
              <p className="text-white/40 text-sm mb-6">
                Please sign in to access detailed analytics and personalized air quality insights.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl glass text-white/60 font-medium hover:text-white transition-colors"
                >
                  Maybe Later
                </button>
                <button
                  onClick={onLogin}
                  className="flex-1 py-3 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition-colors"
                >
                  Sign In
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function AppContent() {
  const { currentView, setView, showPreloader, dismissPreloader } = useApp();
  const { isAuthenticated, isLoading } = useAuth();
  const [showLoginPopup, setShowLoginPopup] = useState(false);

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  const handlePreloaderComplete = useCallback(() => {
    dismissPreloader();
  }, [dismissPreloader]);

  const handleProtectedViewClick = useCallback((view: string) => {
    if (!isAuthenticated) {
      setShowLoginPopup(true);
    }
  }, [isAuthenticated]);

  // Loading screen while checking session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-emerald-400 mx-auto mb-4" />
          <p className="text-white/40 text-sm">Loading VayuGuard...</p>
        </div>
      </div>
    );
  }

  // If trying to access a protected view without auth, redirect to login
  const effectiveView: typeof currentView = (() => {
    if (PROTECTED_VIEWS.includes(currentView) && !isAuthenticated) {
      return 'login';
    }
    return currentView;
  })();

  const showNav = NAV_VIEWS.includes(effectiveView) && isAuthenticated;

  const renderView = () => {
    switch (effectiveView) {
      case 'landing':
        return (
          <motion.div key="landing" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.5 }}>
            <Marquee
              items={['AIR QUALITY MONITORING', 'REAL-TIME DATA', 'HEALTH ADVISORY', 'SMART ALERTS', '500+ STATIONS', '94% ACCURACY']}
              variant="police"
            />
            <HeroSection />
            <AQIShowcase />
            <ServicesSection />
            <CitiesSection />
            <StatsSection />
            <ContactSection />
            <CinematicFooter />
          </motion.div>
        );
      case 'login':
        return (
          <motion.div key="login" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.5 }}>
            <LoginView />
          </motion.div>
        );
      case 'signup':
        return (
          <motion.div key="signup" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.5 }}>
            <SignupView />
          </motion.div>
        );
      case 'dashboard':
        return (
          <motion.div key="dashboard" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.5 }}>
            <DashboardView />
          </motion.div>
        );
      case 'map':
        return (
          <motion.div key="map" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.5 }}>
            <MapView />
          </motion.div>
        );
      case 'forecast':
        return (
          <motion.div key="forecast" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.5 }}>
            <ForecastView />
          </motion.div>
        );
      case 'advisory':
        return (
          <motion.div key="advisory" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.5 }}>
            <AdvisoryView />
          </motion.div>
        );
      case 'alerts':
        return (
          <motion.div key="alerts" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.5 }}>
            <AlertsView />
          </motion.div>
        );
      case 'analytics':
        return (
          <motion.div key="analytics" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.5 }}>
            <AnalyticsView />
          </motion.div>
        );
      case 'profile':
        return (
          <motion.div key="profile" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.5 }}>
            <ProfileView />
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <Preloader show={showPreloader} onComplete={handlePreloaderComplete} />

      <AnimatePresence mode="wait">
        {renderView()}
      </AnimatePresence>

      {/* Footer on all views except login/signup */}
      {effectiveView !== 'login' && effectiveView !== 'signup' && effectiveView !== 'landing' && (
        <CinematicFooter />
      )}

      {showNav && <LimelightNav />}

      {/* Login required popup */}
      <LoginRequiredPopup
        show={showLoginPopup}
        onClose={() => setShowLoginPopup(false)}
        onLogin={() => {
          setShowLoginPopup(false);
          setView('login');
        }}
      />
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}

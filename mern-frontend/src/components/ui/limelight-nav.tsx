'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, LayoutDashboard, Map, CloudSun, ShieldAlert, Bell, User, LogOut, BarChart3, LogIn } from 'lucide-react';
import { useApp, type ViewType } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
  requiresAuth?: boolean;
}

const allNavItems: NavItem[] = [
  { id: 'landing', label: 'Home', icon: <Home size={20} /> },
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, requiresAuth: true },
  { id: 'map', label: 'Map', icon: <Map size={20} />, requiresAuth: true },
  { id: 'forecast', label: 'Forecast', icon: <CloudSun size={20} />, requiresAuth: true },
  { id: 'advisory', label: 'Advisory', icon: <ShieldAlert size={20} />, requiresAuth: true },
  { id: 'alerts', label: 'Alerts', icon: <Bell size={20} />, requiresAuth: true },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={20} />, requiresAuth: true },
  { id: 'profile', label: 'Profile', icon: <User size={20} />, requiresAuth: true },
];

export default function LimelightNav() {
  const { currentView, setView } = useApp();
  const { isAuthenticated, user, logout } = useAuth();
  const [hoveredItem, setHoveredItem] = useState<ViewType | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLogoutToast, setShowLogoutToast] = useState(false);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const navRef = useRef<HTMLDivElement>(null);

  // Memoize navItems to prevent infinite re-renders
  const navItems = useMemo(() => allNavItems.filter(item => {
    if (item.requiresAuth && !isAuthenticated) return false;
    return true;
  }), [isAuthenticated]);

  // Update indicator position
  useEffect(() => {
    const target = hoveredItem || currentView;
    const idx = navItems.findIndex(item => item.id === target);
    if (idx !== -1 && navRef.current) {
      const btn = navRef.current.children[idx] as HTMLElement;
      if (btn) {
        const newLeft = btn.offsetLeft;
        const newWidth = btn.offsetWidth;
        // Only update if values actually changed
        if (indicatorStyle.left !== newLeft || indicatorStyle.width !== newWidth) {
          setIndicatorStyle({ left: newLeft, width: newWidth });
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredItem, currentView, navItems.length]);

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    setShowLogoutToast(true);
    setTimeout(() => {
      logout();
      setView('landing');
      setShowLogoutToast(false);
    }, 1500);
  };

  const handleNavClick = (id: ViewType) => {
    if (id === 'landing' && isAuthenticated) {
      setView('dashboard');
      return;
    }
    if (allNavItems.find(item => item.id === id)?.requiresAuth && !isAuthenticated) {
      setView('login');
      return;
    }
    setView(id);
  };

  return (
    <>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      >
        <nav
          ref={navRef}
          className="relative flex items-center gap-1 px-2 py-2 rounded-2xl glass-strong"
        >
          {/* Limelight indicator */}
          <motion.div
            className="absolute top-0 h-full rounded-2xl bg-white/10"
            animate={{
              left: indicatorStyle.left,
              width: indicatorStyle.width,
            }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 30,
            }}
            style={{ padding: '4px' }}
          />
          {/* Glow behind indicator */}
          <motion.div
            className="absolute top-0 h-full rounded-2xl blur-xl"
            animate={{
              left: indicatorStyle.left,
              width: indicatorStyle.width,
            }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 30,
            }}
            style={{ background: 'rgba(16,185,129,0.2)', padding: '4px' }}
          />

          {navItems.map((item) => {
            const isActive = currentView === item.id;
            const isHovered = hoveredItem === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`relative z-10 flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors duration-200 sm:px-4
                  ${isActive ? 'text-emerald-400' : 'text-white/50 hover:text-white/80'}`}
              >
                <span className={`transition-transform duration-200 ${(isActive || isHovered) ? 'scale-110' : ''}`}>
                  {item.id === 'landing' && isAuthenticated ? <LayoutDashboard size={20} /> : item.icon}
                </span>
                <span className="text-[10px] font-medium tracking-wide hidden sm:block">
                  {item.id === 'landing' && isAuthenticated ? 'Dashboard' : item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="nav-dot"
                    className="w-1 h-1 rounded-full bg-emerald-400"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}

          {/* Logout / Login button */}
          {isAuthenticated ? (
            <button
              onClick={() => setShowLogoutConfirm(true)}
              onMouseEnter={() => setHoveredItem(null)}
              className="relative z-10 flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-white/50 hover:text-red-400 transition-colors duration-200 sm:px-4"
            >
              <LogOut size={20} />
              <span className="text-[10px] font-medium tracking-wide hidden sm:block">Logout</span>
            </button>
          ) : (
            <button
              onClick={() => setView('login')}
              onMouseEnter={() => setHoveredItem(null)}
              className="relative z-10 flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-white/50 hover:text-emerald-400 transition-colors duration-200 sm:px-4"
            >
              <LogIn size={20} />
              <span className="text-[10px] font-medium tracking-wide hidden sm:block">Login</span>
            </button>
          )}
        </nav>

        {/* Logout confirmation popup */}
        <AnimatePresence>
          {showLogoutConfirm && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowLogoutConfirm(false)} />
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-64 p-4 rounded-xl glass-strong z-50"
              >
                <div className="text-center mb-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                    <LogOut size={20} className="text-red-400" />
                  </div>
                  <h3 className="text-white font-semibold text-sm">Sign Out?</h3>
                  <p className="text-white/30 text-xs mt-1">You&apos;ll need to sign in again to access your dashboard</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-2 rounded-lg glass text-white/60 text-sm hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* User badge */}
        {isAuthenticated && user && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-black"
          >
            {user.name.charAt(0).toUpperCase()}
          </motion.div>
        )}
      </motion.div>

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
    </>
  );
}

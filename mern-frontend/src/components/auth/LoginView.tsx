'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Wind, ArrowRight, Loader2 } from 'lucide-react';
import Marquee from '@/components/ui/marquee';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';

export default function LoginView() {
  const { login, isLoading, error, clearError } = useAuth();
  const { setView } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      setView('dashboard');
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Marquee
        items={['VAYUGUARD', 'AIR QUALITY MONITORING', 'BREATHE SMARTER', 'LIVE HEALTHIER', 'REAL-TIME AQI', 'HEALTH ADVISORY']}
        variant="police"
        className="mb-0"
      />

      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/3 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-48px)] px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="w-full max-w-md"
        >
          {/* Logo / Brand */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl glass mb-6 relative">
              <Wind size={36} className="text-emerald-400" />
              <div className="absolute inset-0 rounded-2xl bg-emerald-500/10 blur-xl" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight">
              Vayu<span className="text-gradient">Guard</span>
            </h1>
            <p className="text-white/40 mt-2 text-sm">Welcome back. Monitor your air quality.</p>
          </motion.div>

          {/* Login Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onSubmit={handleSubmit}
            className="p-8 rounded-3xl glass-strong relative overflow-hidden"
          >
            {/* Subtle grid */}
            <div className="absolute inset-0 grid-bg opacity-30" />

            <div className="relative z-10 space-y-5">
              {/* Error message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email field */}
              <div className="space-y-2">
                <label className="text-white/40 text-xs uppercase tracking-wider font-medium">Email</label>
                <div className={`relative flex items-center rounded-xl transition-all duration-300 ${focused === 'email' ? 'ring-2 ring-emerald-500/50' : ''}`}>
                  <Mail size={18} className="absolute left-4 text-white/30" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError(); }}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                    placeholder="you@example.com"
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 focus:outline-none transition-all"
                    required
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <label className="text-white/40 text-xs uppercase tracking-wider font-medium">Password</label>
                <div className={`relative flex items-center rounded-xl transition-all duration-300 ${focused === 'password' ? 'ring-2 ring-emerald-500/50' : ''}`}>
                  <Lock size={18} className="absolute left-4 text-white/30" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearError(); }}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    placeholder="Enter your password"
                    className="w-full pl-12 pr-12 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 focus:outline-none transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Forgot password link */}
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-emerald-400/60 hover:text-emerald-400 text-xs transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit button */}
              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 rounded-xl bg-emerald-500 text-black font-semibold text-base hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                {isLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight size={18} />
                  </>
                )}
              </motion.button>
            </div>
          </motion.form>

          {/* Switch to signup */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center mt-6"
          >
            <p className="text-white/30 text-sm">
              Don&apos;t have an account?{' '}
              <button
                onClick={() => setView('signup')}
                className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                Create one
              </button>
            </p>
          </motion.div>

          {/* Back to landing */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center mt-4"
          >
            <button
              onClick={() => setView('landing')}
              className="text-white/20 hover:text-white/40 text-xs transition-colors"
            >
              ← Back to home
            </button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

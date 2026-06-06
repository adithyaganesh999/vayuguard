'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import Marquee from '@/components/ui/marquee';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { CITIES_AQI } from '@/lib/mock-data';
import { ArrowRight, Loader2 } from 'lucide-react';

const BottomGradient = () => {
  return (
    <>
      <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
      <span className="absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
    </>
  );
};

const LabelInputContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("flex w-full flex-col space-y-2", className)}>
      {children}
    </div>
  );
};

// Typing cursor effect component
function TypingText({ text, className = '', speed = 50 }: { text: string; className?: string; speed?: number }) {
  const [displayed, setDisplayed] = useState('');
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  // Blink cursor
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, []);

  return (
    <span className={className}>
      {displayed}
      <span className={`${showCursor ? 'opacity-100' : 'opacity-0'} text-emerald-400 transition-opacity`}>|</span>
    </span>
  );
}

export default function SignupView() {
  const { signup, isLoading, error, clearError } = useAuth();
  const { setView } = useApp();
  const [step, setStep] = useState(1);
  const [localError, setLocalError] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    location: 'Bangalore',
    ageGroup: 'adult',
    asthmaPatient: false,
    respiratoryConditions: false,
    outdoorWorker: false,
  });

  const handleNext = () => {
    if (!form.firstName.trim()) { setLocalError('First name is required'); return; }
    if (!form.email.trim()) { setLocalError('Email is required'); return; }
    if (form.password.length < 6) { setLocalError('Password must be at least 6 characters'); return; }
    setLocalError(null);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = `${form.firstName} ${form.lastName}`.trim();
    const success = await signup(name, form.email, form.password, form.phone, form.location);
    if (success) {
      setView('profile');
    }
  };

  const updateForm = (key: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setLocalError(null);
    clearError();
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Marquee
        items={['JOIN VAYUGUARD', 'CREATE YOUR ACCOUNT', 'PROTECT YOUR HEALTH', 'SMART MONITORING', 'REAL-TIME ALERTS', 'BREATHE SAFER']}
        variant="police"
        className="mb-0"
      />

      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-48px)] px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="w-full max-w-md"
        >
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl font-bold text-white">
              <TypingText text="Welcome to VayuGuard" speed={40} />
            </h1>
            <p className="text-white/40 mt-3 text-sm max-w-sm mx-auto">
              {step === 1
                ? 'Create your account to start monitoring air quality in your city'
                : 'Set up your health profile for personalized advisories'}
            </p>
          </motion.div>

          {/* Step indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-3 mb-8"
          >
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500
                    ${step >= s ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/30'}`}
                >
                  {step > s ? 'OK' : s}
                </div>
                <span className={`text-xs transition-colors ${step >= s ? 'text-emerald-400' : 'text-white/20'}`}>
                  {s === 1 ? 'Account' : 'Health'}
                </span>
                {s === 1 && <div className={`w-12 h-0.5 ${step > 1 ? 'bg-emerald-500' : 'bg-white/10'} transition-colors`} />}
              </div>
            ))}
          </motion.div>

          {/* Form */}
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl p-8 bg-black border border-white/10 relative overflow-hidden"
              >
                <div className="absolute inset-0 grid-bg opacity-20" />

                <div className="relative z-10 space-y-5">
                  {/* Error */}
                  <AnimatePresence>
                    {(error || localError) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                      >
                        {localError || error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Name fields */}
                  <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-2">
                    <LabelInputContainer>
                      <Label htmlFor="firstname" className="text-white/40 text-xs uppercase tracking-wider">First name</Label>
                      <Input
                        id="firstname"
                        placeholder="First"
                        type="text"
                        value={form.firstName}
                        onChange={(e) => updateForm('firstName', e.target.value)}
                      />
                    </LabelInputContainer>
                    <LabelInputContainer>
                      <Label htmlFor="lastname" className="text-white/40 text-xs uppercase tracking-wider">Last name</Label>
                      <Input
                        id="lastname"
                        placeholder="Last"
                        type="text"
                        value={form.lastName}
                        onChange={(e) => updateForm('lastName', e.target.value)}
                      />
                    </LabelInputContainer>
                  </div>

                  {/* Email */}
                  <LabelInputContainer>
                    <Label htmlFor="email" className="text-white/40 text-xs uppercase tracking-wider">Email Address</Label>
                    <Input
                      id="email"
                      placeholder="you@example.com"
                      type="email"
                      value={form.email}
                      onChange={(e) => updateForm('email', e.target.value)}
                    />
                  </LabelInputContainer>

                  {/* Password */}
                  <LabelInputContainer>
                    <Label htmlFor="password" className="text-white/40 text-xs uppercase tracking-wider">Password</Label>
                    <Input
                      id="password"
                      placeholder="At least 6 characters"
                      type="password"
                      value={form.password}
                      onChange={(e) => updateForm('password', e.target.value)}
                    />
                  </LabelInputContainer>

                  {/* Continue button */}
                  <button
                    onClick={handleNext}
                    className="group/btn relative block h-10 w-full rounded-md bg-gradient-to-br from-emerald-500 to-emerald-600 font-medium text-black shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] hover:from-emerald-400 hover:to-emerald-500 transition-all"
                  >
                    Continue
                    <BottomGradient />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleSubmit}
                className="rounded-2xl p-8 bg-black border border-white/10 relative overflow-hidden"
              >
                <div className="absolute inset-0 grid-bg opacity-20" />

                <div className="relative z-10 space-y-5">
                  {/* Phone */}
                  <LabelInputContainer>
                    <Label htmlFor="phone" className="text-white/40 text-xs uppercase tracking-wider">Phone (optional)</Label>
                    <Input
                      id="phone"
                      placeholder="+91 XXXXX XXXXX"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => updateForm('phone', e.target.value)}
                    />
                  </LabelInputContainer>

                  {/* Location */}
                  <LabelInputContainer>
                    <Label htmlFor="location" className="text-white/40 text-xs uppercase tracking-wider">Primary Location</Label>
                    <select
                      id="location"
                      value={form.location}
                      onChange={(e) => updateForm('location', e.target.value)}
                      className="flex h-10 w-full rounded-md border-none bg-white/5 px-3 py-2 text-sm text-white focus-visible:ring-[2px] focus-visible:ring-emerald-500/50 focus-visible:outline-none"
                    >
                      {CITIES_AQI.map((city) => (
                        <option key={city.city} value={city.city} className="bg-zinc-900 text-white">
                          {city.city}
                        </option>
                      ))}
                    </select>
                  </LabelInputContainer>

                  {/* Age Group */}
                  <LabelInputContainer>
                    <Label className="text-white/40 text-xs uppercase tracking-wider">Age Group</Label>
                    <div className="flex gap-3">
                      {(['child', 'adult', 'senior'] as const).map((group) => (
                        <button
                          key={group}
                          type="button"
                          onClick={() => updateForm('ageGroup', group)}
                          className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all capitalize
                            ${form.ageGroup === group ? 'bg-emerald-500 text-black' : 'bg-white/5 text-white/50 hover:text-white/80 border border-white/10'}`}
                        >
                          {group}
                        </button>
                      ))}
                    </div>
                  </LabelInputContainer>

                  {/* Health conditions */}
                  <LabelInputContainer>
                    <Label className="text-white/40 text-xs uppercase tracking-wider">Health Conditions</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { key: 'asthmaPatient', label: 'Asthma' },
                        { key: 'respiratoryConditions', label: 'Respiratory' },
                        { key: 'outdoorWorker', label: 'Outdoor Worker' },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => updateForm(item.key, !form[item.key as keyof typeof form])}
                          className={`p-3 rounded-xl text-xs font-medium text-center transition-all
                            ${form[item.key as keyof typeof form]
                              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                              : 'bg-white/5 text-white/40 hover:text-white/70 border border-white/10'}`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </LabelInputContainer>

                  {/* Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 h-10 rounded-md bg-white/5 text-white/60 font-medium hover:text-white hover:bg-white/10 transition-colors border border-white/10"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="group/btn relative flex-[2] h-10 rounded-md bg-gradient-to-br from-emerald-500 to-emerald-600 font-medium text-black shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] hover:from-emerald-400 hover:to-emerald-500 transition-all disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 size={18} className="animate-spin mx-auto" />
                      ) : (
                        <>
                          Create Account
                          <ArrowRight size={16} className="inline ml-2" />
                        </>
                      )}
                      <BottomGradient />
                    </button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Switch to login */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center mt-6"
          >
            <p className="text-white/30 text-sm">
              Already have an account?{' '}
              <button
                onClick={() => setView('login')}
                className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                Sign in
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
              Back to home
            </button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

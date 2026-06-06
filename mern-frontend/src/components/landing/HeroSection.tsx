'use client';

import React, { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { gsap } from 'gsap';
import { ArrowDown, Sparkles } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import ScrollVelocityText from '@/components/ui/scroll-velocity-text';
import ParallaxSection from '@/components/ui/parallax-section';

export default function HeroSection() {
  const { setView } = useApp();
  const { isAuthenticated } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);
  const giantTextRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.8], [1, 0.9]);

  useEffect(() => {
    if (!giantTextRef.current) return;
    gsap.fromTo(
      giantTextRef.current,
      { clipPath: 'inset(0 100% 0 0)' },
      {
        clipPath: 'inset(0 0% 0 0)',
        duration: 2,
        ease: 'power4.out',
        delay: 0.5,
      }
    );
  }, []);

  return (
    <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/5 rounded-full blur-[120px]" />

      <motion.div style={{ y, opacity, scale }} className="relative z-10 text-center px-4">
        {/* Animated SVG Star/Sun Logo */}
        <ParallaxSection speed={0.2} direction="up">
          <motion.div
            className="mx-auto mb-8 w-24 h-24 relative"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {/* Outer star */}
              <path
                d="M50 5 L61 35 L95 35 L68 57 L79 90 L50 70 L21 90 L32 57 L5 35 L39 35 Z"
                fill="none"
                stroke="#10b981"
                strokeWidth="1"
                opacity="0.6"
              />
              {/* Inner star */}
              <path
                d="M50 20 L57 38 L76 38 L61 49 L67 68 L50 57 L33 68 L39 49 L24 38 L43 38 Z"
                fill="none"
                stroke="#10b981"
                strokeWidth="0.8"
                opacity="0.4"
              />
              {/* Center dot */}
              <circle cx="50" cy="50" r="4" fill="#10b981" opacity="0.8" />
            </svg>
          </motion.div>
        </ParallaxSection>

        {/* Pre-heading */}
        <ParallaxSection speed={0.15} direction="up">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="flex items-center justify-center gap-2 mb-6"
          >
            <Sparkles size={14} className="text-emerald-400" />
            <span className="text-white/40 text-sm uppercase tracking-[0.3em]">Air Quality Intelligence</span>
            <Sparkles size={14} className="text-emerald-400" />
          </motion.div>
        </ParallaxSection>

        {/* Giant VAYUGUARD text */}
        <div ref={giantTextRef} className="overflow-hidden mb-4">
          <h1 className="text-7xl sm:text-8xl md:text-9xl lg:text-[10rem] font-black tracking-tighter leading-none">
            <span className="text-gradient">VAYU</span>
            <span className="text-white">GUARD</span>
          </h1>
        </div>

        {/* Tagline with scroll velocity effect */}
        <ParallaxSection speed={0.3} direction="up">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="mb-8"
          >
            <ScrollVelocityText
              text="Breathe Smarter. Live Healthier."
              baseFontSize={24}
              className="text-white/60 font-light sm:text-2xl lg:text-3xl max-w-3xl mx-auto inline-block"
            />
          </motion.div>
        </ParallaxSection>

        {/* Subtitle */}
        <ParallaxSection speed={0.35} direction="up">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.8 }}
            className="text-white/30 text-base max-w-xl mx-auto mb-12"
          >
            Real-time air quality monitoring, AI-powered forecasts, and personalized health advisories — 
            all in one platform.
          </motion.p>
        </ParallaxSection>

        {/* CTA Buttons */}
        <ParallaxSection speed={0.4} direction="up">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <button
              onClick={() => setView(isAuthenticated ? 'dashboard' : 'signup')}
              className="px-8 py-4 rounded-full bg-emerald-500 text-black font-semibold text-lg hover:bg-emerald-400 transition-all hover:scale-105 active:scale-95"
            >
              {isAuthenticated ? 'Enter Dashboard' : 'Get Started Free'}
            </button>
            <button
              onClick={() => setView(isAuthenticated ? 'map' : 'login')}
              className="px-8 py-4 rounded-full glass text-white/80 font-medium text-lg hover:bg-white/10 transition-all hover:scale-105 active:scale-95"
            >
              {isAuthenticated ? 'View Global Map' : 'Sign In'}
            </button>
          </motion.div>
        </ParallaxSection>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5, duration: 0.6 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex flex-col items-center gap-2 text-white/20"
        >
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <ArrowDown size={16} />
        </motion.div>
      </motion.div>
    </section>
  );
}

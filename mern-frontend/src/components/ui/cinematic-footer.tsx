'use client';

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import { Mail, MapPin, ArrowUpRight, Github, Twitter, Linkedin } from 'lucide-react';

export default function CinematicFooter() {
  const footerRef = useRef<HTMLElement>(null);
  const giantTextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const footer = footerRef.current;
    const giantText = giantTextRef.current;
    if (!footer || !giantText) return;

    const handleScroll = () => {
      const rect = footer.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      if (rect.top < windowHeight) {
        const progress = (windowHeight - rect.top) / (windowHeight + rect.height);
        gsap.set(giantText, {
          y: progress * -80,
          opacity: Math.min(1, progress * 2),
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const magneticHover = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    gsap.to(btn, {
      x: x * 0.3,
      y: y * 0.3,
      duration: 0.3,
      ease: 'power2.out',
    });
  };

  const magneticLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    gsap.to(e.currentTarget, {
      x: 0,
      y: 0,
      duration: 0.5,
      ease: 'elastic.out(1, 0.3)',
    });
  };

  const footerLinks = [
    { label: 'Real-Time Data', href: '#' },
    { label: 'API Documentation', href: '#' },
    { label: 'Health Advisory', href: '#' },
    { label: 'Forecast Engine', href: '#' },
    { label: 'Smart Alerts', href: '#' },
    { label: 'Developer Tools', href: '#' },
  ];

  const socialLinks = [
    { icon: <Github size={18} />, label: 'GitHub', href: '#' },
    { icon: <Twitter size={18} />, label: 'Twitter', href: '#' },
    { icon: <Linkedin size={18} />, label: 'LinkedIn', href: '#' },
  ];

  const marqueeText = 'VAYUGUARD -- BREATHE SMARTER -- LIVE HEALTHIER -- AIR QUALITY INTELLIGENCE -- VAYUGUARD -- BREATHE SMARTER -- LIVE HEALTHIER -- AIR QUALITY INTELLIGENCE';

  return (
    <footer ref={footerRef} className="relative overflow-hidden pt-0 pb-8">
      {/* Air flow marquee at top */}
      <div className="relative w-full overflow-hidden py-3">
        {/* Flowing wind streams */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          {/* Wind stream lines at different speeds */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.line
              key={`wind-${i}`}
              x1="-200"
              y1={`${15 + i * 14}%`}
              x2="-50"
              y2={`${15 + i * 14}%`}
              stroke={i % 2 === 0 ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)'}
              strokeWidth={i % 3 === 0 ? 1.5 : 0.5}
              animate={{
                x1: ['-200', '120%'],
                x2: ['-50', '130%'],
              }}
              transition={{
                duration: 4 + i * 0.8,
                repeat: Infinity,
                ease: 'linear',
                delay: i * 0.5,
              }}
            />
          ))}
          {/* Additional thin flowing lines */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <motion.line
              key={`thin-wind-${i}`}
              x1="-100"
              y1={`${8 + i * 11}%`}
              x2="0"
              y2={`${8 + i * 11}%`}
              stroke="rgba(16,185,129,0.08)"
              strokeWidth={0.5}
              animate={{
                x1: ['-100', '110%'],
                x2: ['0', '120%'],
              }}
              transition={{
                duration: 3 + i * 0.6,
                repeat: Infinity,
                ease: 'linear',
                delay: i * 0.3,
              }}
            />
          ))}
        </svg>

        {/* 3D depth scrolling text */}
        <div className="relative">
          <motion.div
            className="flex whitespace-nowrap"
            animate={{ x: ['0%', '-50%'] }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{
              perspective: '400px',
            }}
          >
            {[marqueeText, marqueeText].map((text, i) => (
              <span
                key={i}
                className="inline-block text-2xl sm:text-3xl font-black uppercase tracking-[0.3em] px-4"
                style={{
                  color: 'rgba(16, 185, 129, 0.15)',
                  textShadow: '0 0 30px rgba(16,185,129,0.1), 0 0 60px rgba(14,165,233,0.05), 0 4px 8px rgba(0,0,0,0.3)',
                  transform: 'perspective(400px) rotateX(5deg)',
                  transformOrigin: 'center bottom',
                }}
              >
                {text}
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Aurora glow */}
      <div className="absolute inset-0 aurora-glow" />

      {/* Grid background */}
      <div className="absolute inset-0 grid-bg opacity-30" />

      {/* Giant background text */}
      <div
        ref={giantTextRef}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-none select-none"
      >
        <span className="text-[15vw] font-black text-white/[0.03] tracking-tighter whitespace-nowrap">
          VAYUGUARD
        </span>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-20">
        {/* Contact section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            Let&apos;s do something
            <br />
            <span className="text-gradient">awesome together</span>
          </h2>
          <p className="text-white/50 text-lg mb-8 max-w-xl mx-auto">
            Join the mission to make air quality data accessible to everyone.
          </p>

          {/* Glass pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <a
              href="mailto:hello@vayuguard.com"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <Mail size={16} />
              hello@vayuguard.com
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass text-sky-400 hover:bg-sky-500/10 transition-colors"
            >
              <MapPin size={16} />
              Bangalore, India
            </a>
          </div>

          {/* Magnetic CTA */}
          <button
            onMouseMove={magneticHover}
            onMouseLeave={magneticLeave}
            className="magnetic-btn inline-flex items-center gap-3 px-8 py-4 rounded-full bg-emerald-500 text-black font-semibold text-lg hover:bg-emerald-400 transition-colors"
          >
            Get Started
            <ArrowUpRight size={20} />
          </button>
        </motion.div>

        {/* Links grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 mb-16">
          {footerLinks.map((link, i) => (
            <motion.a
              key={link.label}
              href={link.href}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              className="text-white/40 hover:text-emerald-400 transition-colors text-sm"
            >
              {link.label}
            </motion.a>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
              <span className="text-black text-xs font-bold">V</span>
            </div>
            <span className="text-white/30 text-sm">&copy; 2026 VayuGuard. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-4">
            {socialLinks.map((link) => (
              <button
                key={link.label}
                onMouseMove={magneticHover}
                onMouseLeave={magneticLeave}
                className="magnetic-btn w-10 h-10 rounded-full glass flex items-center justify-center text-white/40 hover:text-emerald-400 transition-colors"
                aria-label={link.label}
              >
                {link.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom marquee - same style as top */}
      <div className="relative w-full overflow-hidden py-3 mt-12">
        {/* Flowing wind streams */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.line
              key={`bottom-wind-${i}`}
              x1="-200"
              y1={`${15 + i * 14}%`}
              x2="-50"
              y2={`${15 + i * 14}%`}
              stroke={i % 2 === 0 ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)'}
              strokeWidth={i % 3 === 0 ? 1.5 : 0.5}
              animate={{
                x1: ['-200', '120%'],
                x2: ['-50', '130%'],
              }}
              transition={{
                duration: 4 + i * 0.8,
                repeat: Infinity,
                ease: 'linear',
                delay: i * 0.5,
              }}
            />
          ))}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <motion.line
              key={`bottom-thin-wind-${i}`}
              x1="-100"
              y1={`${8 + i * 11}%`}
              x2="0"
              y2={`${8 + i * 11}%`}
              stroke="rgba(16,185,129,0.08)"
              strokeWidth={0.5}
              animate={{
                x1: ['-100', '110%'],
                x2: ['0', '120%'],
              }}
              transition={{
                duration: 3 + i * 0.6,
                repeat: Infinity,
                ease: 'linear',
                delay: i * 0.3,
              }}
            />
          ))}
        </svg>

        {/* 3D depth scrolling text */}
        <div className="relative">
          <motion.div
            className="flex whitespace-nowrap"
            animate={{ x: ['-50%', '0%'] }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{
              perspective: '400px',
            }}
          >
            {[marqueeText, marqueeText].map((text, i) => (
              <span
                key={`bottom-marquee-${i}`}
                className="inline-block text-2xl sm:text-3xl font-black uppercase tracking-[0.3em] px-4"
                style={{
                  color: 'rgba(16, 185, 129, 0.15)',
                  textShadow: '0 0 30px rgba(16,185,129,0.1), 0 0 60px rgba(14,165,233,0.05), 0 4px 8px rgba(0,0,0,0.3)',
                  transform: 'perspective(400px) rotateX(5deg)',
                  transformOrigin: 'center bottom',
                }}
              >
                {text}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </footer>
  );
}

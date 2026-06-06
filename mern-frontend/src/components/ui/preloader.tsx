'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';
import { Wind } from 'lucide-react';

interface PreloaderProps {
  show: boolean;
  onComplete?: () => void;
}

export default function Preloader({ show, onComplete }: PreloaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [letterStates, setLetterStates] = useState<boolean[]>(Array(9).fill(false));

  const letters = 'VAYUGUARD'.split('');

  useEffect(() => {
    if (!show) return;

    setProgress(0);
    setLetterStates(Array(9).fill(false));

    const tl = gsap.timeline();

    // Animate icon
    if (iconRef.current) {
      tl.fromTo(
        iconRef.current,
        { scale: 0, rotation: -180, opacity: 0 },
        { scale: 1, rotation: 0, opacity: 1, duration: 0.8, ease: 'back.out(1.7)' }
      );

      // Spinning morph
      tl.to(iconRef.current, {
        rotation: 360,
        duration: 1.5,
        ease: 'power2.inOut',
        repeat: -1,
      });
    }

    // Animate letters one by one
    letters.forEach((_, i) => {
      tl.add(() => {
        setLetterStates(prev => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, 0.6 + i * 0.1);
    });

    // Progress bar
    const progressObj = { val: 0 };
    gsap.to(progressObj, {
      val: 100,
      duration: 1.8,
      ease: 'power2.inOut',
      delay: 0.3,
      onUpdate: () => {
        setProgress(Math.round(progressObj.val));
      },
      onComplete: () => {
        // Wait a moment then call onComplete
        setTimeout(() => {
          onComplete?.();
        }, 300);
      },
    });

    return () => {
      tl.kill();
    };
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050505]"
        >
          {/* Background glow */}
          <div className="absolute inset-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px]" />
            <div className="absolute top-1/3 left-1/3 w-64 h-64 bg-sky-500/5 rounded-full blur-[80px]" />
          </div>

          <div className="relative z-10 flex flex-col items-center">
            {/* Wind icon */}
            <div ref={iconRef} className="mb-8 text-emerald-400" style={{ opacity: 0 }}>
              <Wind size={56} strokeWidth={1.5} />
            </div>

            {/* VAYUGUARD text with letter reveal */}
            <div ref={textRef} className="flex items-center gap-0.5 mb-8">
              {letters.map((letter, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 20, clipPath: 'inset(100% 0 0 0)' }}
                  animate={
                    letterStates[i]
                      ? { opacity: 1, y: 0, clipPath: 'inset(0% 0 0 0)' }
                      : { opacity: 0, y: 20, clipPath: 'inset(100% 0 0 0)' }
                  }
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className={`text-3xl sm:text-4xl font-black tracking-[0.2em] ${
                    i < 4 ? 'text-emerald-400' : 'text-white'
                  }`}
                >
                  {letter}
                </motion.span>
              ))}
            </div>

            {/* Progress bar */}
            <div className="w-48 h-1 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                ref={progressRef}
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-400"
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>

            {/* Progress text */}
            <div className="mt-3 text-white/30 text-xs tracking-widest font-mono">
              {progress}%
            </div>
          </div>

          {/* Subtle grid */}
          <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

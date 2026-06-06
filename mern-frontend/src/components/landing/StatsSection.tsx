'use client';

import React, { useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { gsap } from 'gsap';
import { STATS } from '@/lib/mock-data';
import ParallaxSection from '@/components/ui/parallax-section';

function AnimatedCounter({ value, suffix = '' }: { value: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView || !ref.current) return;
    const numericPart = value.replace(/[^0-9]/g, '');
    const prefix = value.match(/^[^0-9]*/)?.[0] || '';
    const num = parseInt(numericPart);
    if (isNaN(num)) return;

    const obj = { val: 0 };
    gsap.to(obj, {
      val: num,
      duration: 2,
      ease: 'power2.out',
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent = prefix + Math.round(obj.val) + suffix;
        }
      },
    });
  }, [isInView, value, suffix]);

  return <span ref={ref}>0</span>;
}

export default function StatsSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 aurora-glow opacity-30" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section header - NO "Trusted By" */}
        <ParallaxSection speed={0.3} direction="up">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold">
              Numbers That <span className="text-gradient">Matter</span>
            </h2>
          </motion.div>
        </ParallaxSection>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {STATS.map((stat, i) => (
            <ParallaxSection key={stat.label} speed={0.15 + i * 0.02} direction="up">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="text-center p-6 rounded-2xl glass"
              >
                <div className="text-3xl sm:text-4xl font-black text-emerald-400 mb-2">
                  <AnimatedCounter value={stat.value} />
                </div>
                <div className="text-white/40 text-sm">{stat.label}</div>
              </motion.div>
            </ParallaxSection>
          ))}
        </div>
      </div>
    </section>
  );
}

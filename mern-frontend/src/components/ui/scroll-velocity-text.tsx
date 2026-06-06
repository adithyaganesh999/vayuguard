'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useVelocity, useTransform, useSpring } from 'framer-motion';

interface ScrollVelocityTextProps {
  text: string;
  baseFontSize?: number;
  className?: string;
}

export default function ScrollVelocityText({
  text,
  baseFontSize = 24,
  className = '',
}: ScrollVelocityTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, {
    damping: 50,
    stiffness: 400,
  });

  const velocityFactor = useTransform(smoothVelocity, [-1000, 0, 1000], [-1, 0, 1]);

  const scale = useTransform(smoothVelocity, [0, 500, 1000], [1, 1.15, 1.3]);
  const smoothScale = useSpring(scale, { damping: 30, stiffness: 200 });

  const opacity = useTransform(smoothVelocity, [0, 300, 600], [0.6, 0.85, 1]);
  const smoothOpacity = useSpring(opacity, { damping: 30, stiffness: 200 });

  const skewX = useTransform(smoothVelocity, [-1000, 0, 1000], [-3, 0, 3]);
  const smoothSkewX = useSpring(skewX, { damping: 30, stiffness: 200 });

  const speedLineOpacity = useTransform(smoothVelocity, [0, 400, 800], [0, 0.4, 0.8]);

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      {/* Speed lines behind the text */}
      <motion.div
        className="absolute inset-0 flex flex-col justify-center gap-1 pointer-events-none overflow-hidden"
        style={{ opacity: speedLineOpacity }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.div
            key={i}
            className="h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent"
            style={{
              marginLeft: `${10 + i * 8}%`,
              marginRight: `${10 + (4 - i) * 8}%`,
            }}
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 0.8 + i * 0.15,
              repeat: Infinity,
              ease: 'linear',
              delay: i * 0.1,
            }}
          />
        ))}
      </motion.div>

      <motion.span
        className="relative z-10 block whitespace-nowrap"
        style={{
          fontSize: baseFontSize,
          scale: smoothScale,
          opacity: smoothOpacity,
          skewX: smoothSkewX,
        }}
      >
        {text}
      </motion.span>
    </div>
  );
}

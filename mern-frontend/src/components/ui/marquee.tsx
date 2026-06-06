'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface MarqueeProps {
  items: string[];
  speed?: number;
  reverse?: boolean;
  className?: string;
  variant?: 'default' | 'police' | 'gradient';
}

export default function Marquee({
  items,
  speed = 20,
  reverse = false,
  className = '',
  variant = 'police',
}: MarqueeProps) {
  const doubledItems = [...items, ...items, ...items, ...items];

  const getColors = () => {
    switch (variant) {
      case 'police':
        return {
          barBg: 'bg-black',
          textColor: 'text-white',
          accentColor: '#10b981',
          lineColor: 'rgba(16,185,129,0.25)',
          crossLineColor: 'rgba(16,185,129,0.08)',
        };
      case 'gradient':
        return {
          barBg: 'bg-black',
          textColor: 'text-white',
          accentColor: '#0ea5e9',
          lineColor: 'rgba(14,165,233,0.25)',
          crossLineColor: 'rgba(14,165,233,0.08)',
        };
      default:
        return {
          barBg: 'bg-white/[0.02]',
          textColor: 'text-white/60',
          accentColor: '#ffffff',
          lineColor: 'rgba(255,255,255,0.08)',
          crossLineColor: 'rgba(255,255,255,0.03)',
        };
    }
  };

  const colors = getColors();

  return (
    <div className={`relative overflow-hidden ${colors.barBg} ${className}`}>
      {/* Top horizontal line */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{ background: `linear-gradient(90deg, transparent, ${colors.lineColor}, transparent)` }}
      />

      {/* Bottom horizontal line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[1px]"
        style={{ background: `linear-gradient(90deg, transparent, ${colors.lineColor}, transparent)` }}
      />

      {/* Cross-line pattern overlay - diagonal lines going one direction */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 40px,
            ${colors.crossLineColor} 40px,
            ${colors.crossLineColor} 41px
          )`,
        }}
      />

      {/* Cross-line pattern overlay - diagonal lines going other direction */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 40px,
            ${colors.crossLineColor} 40px,
            ${colors.crossLineColor} 41px
          )`,
        }}
      />

      {/* BREAKING NEWS badge */}
      {variant === 'police' && (
        <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center">
          <div
            className="px-4 py-2 text-[10px] font-black tracking-[0.25em] uppercase"
            style={{ backgroundColor: colors.accentColor, color: '#000' }}
          >
            LIVE
          </div>
          {/* Fade edge */}
          <div
            className="w-12 h-full"
            style={{
              background: `linear-gradient(to right, ${colors.accentColor}40, transparent)`,
            }}
          />
        </div>
      )}

      {/* Left fade */}
      <div
        className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
        style={{ background: `linear-gradient(to right, ${colors.barBg === 'bg-black' ? '#000' : 'rgba(0,0,0,0.9)'}, transparent)` }}
      />

      {/* Right fade */}
      <div
        className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
        style={{ background: `linear-gradient(to left, ${colors.barBg === 'bg-black' ? '#000' : 'rgba(0,0,0,0.9)'}, transparent)` }}
      />

      {/* Scrolling content */}
      <motion.div
        className="flex whitespace-nowrap py-3"
        animate={{
          x: reverse ? [0, -50 * items.length] : [-50 * items.length, 0],
        }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: 'loop',
            duration: speed,
            ease: 'linear',
          },
        }}
      >
        {doubledItems.map((item, index) => (
          <span
            key={index}
            className={`inline-flex items-center gap-4 px-6 ${colors.textColor} text-xs uppercase tracking-[0.2em] font-medium`}
          >
            {/* Small accent dot */}
            <span
              className="w-1 h-1 rounded-full shrink-0"
              style={{ backgroundColor: colors.accentColor }}
            />
            <span>{item}</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

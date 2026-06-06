'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const sizes = {
  sm: { spinner: 16, wrapper: 'w-8 h-8' },
  md: { spinner: 24, wrapper: 'w-12 h-12' },
  lg: { spinner: 32, wrapper: 'w-16 h-16' },
  xl: { spinner: 48, wrapper: 'w-24 h-24' },
};

export default function LoadingSpinner({
  size = 'md',
  text = '',
  fullScreen = false,
  color = 'text-emerald-400',
}) {
  const sizeConfig = sizes[size] || sizes.md;

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={`${sizeConfig.wrapper} flex items-center justify-center`}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 size={sizeConfig.spinner} className={color} />
        </motion.div>
      </div>
      {text && <p className="text-white/40 text-sm">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}

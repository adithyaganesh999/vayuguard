'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

interface ParallaxSectionProps {
  children: React.ReactNode;
  speed?: number;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
}

export default function ParallaxSection({
  children,
  speed = 0.5,
  className = '',
  direction = 'up',
}: ParallaxSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const distance = speed * 100;

  const yUp = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  const yDown = useTransform(scrollYProgress, [0, 1], [-distance, distance]);
  const xLeft = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  const xRight = useTransform(scrollYProgress, [0, 1], [-distance, distance]);

  let style: React.CSSProperties = {};
  switch (direction) {
    case 'up':
      style = { y: yUp };
      break;
    case 'down':
      style = { y: yDown };
      break;
    case 'left':
      style = { x: xLeft };
      break;
    case 'right':
      style = { x: xRight };
      break;
  }

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.div style={style}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}

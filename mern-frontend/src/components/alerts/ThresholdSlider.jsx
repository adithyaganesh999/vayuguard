'use client';

import React, { useState, useRef, useCallback } from 'react';
import { getAQIColor, getAQICategory, AQI_LEVELS } from '@/lib/aqi-utils';

export default function ThresholdSlider({ value = 100, onChange, min = 0, max = 500 }) {
  const sliderRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const color = getAQIColor(value);
  const category = getAQICategory(value);

  const calculateValue = useCallback((clientX) => {
    if (!sliderRef.current) return value;
    const rect = sliderRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(min + percent * (max - min));
  }, [value, min, max]);

  const handleMouseDown = useCallback((e) => {
    setIsDragging(true);
    const newVal = calculateValue(e.clientX);
    onChange?.(newVal);

    const handleMouseMove = (moveEvent) => {
      const val = calculateValue(moveEvent.clientX);
      onChange?.(val);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [calculateValue, onChange]);

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="w-full">
      {/* AQI Level segments */}
      <div className="flex mb-2 h-1.5 rounded-full overflow-hidden">
        {AQI_LEVELS.map((level, i) => {
          const segWidth = ((level.max - level.min) / (max - min)) * 100;
          return (
            <div
              key={i}
              style={{ width: `${segWidth}%`, backgroundColor: level.color + '40' }}
            />
          );
        })}
      </div>

      {/* Slider track */}
      <div
        ref={sliderRef}
        className="relative h-3 rounded-full cursor-pointer select-none"
        onMouseDown={handleMouseDown}
        role="slider"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label={`AQI threshold: ${value}`}
      >
        {/* Background track */}
        <div className="absolute inset-0 rounded-full bg-white/5" />

        {/* Filled track */}
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-colors"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
            opacity: 0.4,
          }}
        />

        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full shadow-lg transition-all"
          style={{
            left: `calc(${percentage}% - 10px)`,
            backgroundColor: color,
            transform: `translateY(-50%) scale(${isDragging ? 1.2 : 1})`,
          }}
        >
          <div className="absolute inset-0.5 rounded-full bg-white/30" />
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-1">
        <span className="text-white/20 text-[9px]">{min}</span>
        <span className="text-white/20 text-[9px]">{max}</span>
      </div>
    </div>
  );
}

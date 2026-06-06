'use client';

import React, { useMemo } from 'react';
import { getAQIColor } from '@/lib/aqi-utils';

export default function HeatmapLayer({ stations, intensity = 0.5, radius = 30 }) {
  const heatmapPoints = useMemo(() => {
    return stations.map((station) => {
      const color = getAQIColor(station.aqi);
      const opacity = Math.min(0.6, (station.aqi / 500) * intensity);
      return {
        key: `${station.city}-heat`,
        cx: station.longitude,
        cy: station.latitude,
        r: radius,
        color,
        opacity,
      };
    });
  }, [stations, intensity, radius]);

  return (
    <g className="heatmap-layer" aria-label="Pollution heatmap layer">
      <defs>
        {heatmapPoints.map((point) => (
          <radialGradient key={`grad-${point.key}`} id={`grad-${point.key}`}>
            <stop offset="0%" stopColor={point.color} stopOpacity={point.opacity} />
            <stop offset="100%" stopColor={point.color} stopOpacity={0} />
          </radialGradient>
        ))}
      </defs>
      {heatmapPoints.map((point) => (
        <circle
          key={point.key}
          cx={point.cx}
          cy={point.cy}
          r={point.r}
          fill={`url(#grad-${point.key})`}
          className="pointer-events-none"
        />
      ))}
    </g>
  );
}

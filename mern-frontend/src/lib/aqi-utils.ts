// AQI utility functions for VayuGuard

export type AQICategory = 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';

export interface AQILevel {
  min: number;
  max: number;
  category: AQICategory;
  color: string;
  bgColor: string;
  textColor: string;
  description: string;
  healthImplications: string;
  advisory: string;
}

export const AQI_LEVELS: AQILevel[] = [
  {
    min: 0, max: 50,
    category: 'Good',
    color: '#10b981',
    bgColor: 'rgba(16,185,129,0.15)',
    textColor: '#10b981',
    description: 'Air quality is satisfactory, and air pollution poses little or no risk.',
    healthImplications: 'Air quality is considered satisfactory, and air pollution poses little or no risk.',
    advisory: 'Great day for outdoor activities! Enjoy the fresh air.'
  },
  {
    min: 51, max: 100,
    category: 'Moderate',
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.15)',
    textColor: '#f59e0b',
    description: 'Air quality is acceptable. However, there may be a risk for some people.',
    healthImplications: 'Air quality is acceptable; however, for some pollutants there may be a moderate health concern for a very small number of people.',
    advisory: 'Unusually sensitive people should consider reducing prolonged outdoor exertion.'
  },
  {
    min: 101, max: 150,
    category: 'Unhealthy for Sensitive Groups',
    color: '#f97316',
    bgColor: 'rgba(249,115,22,0.15)',
    textColor: '#f97316',
    description: 'Members of sensitive groups may experience health effects.',
    healthImplications: 'Members of sensitive groups may experience health effects. The general public is not likely to be affected.',
    advisory: 'People with respiratory disease, children, and elderly should limit prolonged outdoor exertion.'
  },
  {
    min: 151, max: 200,
    category: 'Unhealthy',
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.15)',
    textColor: '#ef4444',
    description: 'Everyone may begin to experience health effects.',
    healthImplications: 'Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.',
    advisory: 'Avoid prolonged outdoor exertion. Use masks when going outside.'
  },
  {
    min: 201, max: 300,
    category: 'Very Unhealthy',
    color: '#a855f7',
    bgColor: 'rgba(168,85,247,0.15)',
    textColor: '#a855f7',
    description: 'Health alert: everyone may experience more serious health effects.',
    healthImplications: 'Health warnings of emergency conditions. The entire population is more likely to be affected.',
    advisory: 'Stay indoors. Avoid all outdoor physical activities.'
  },
  {
    min: 301, max: 500,
    category: 'Hazardous',
    color: '#dc2626',
    bgColor: 'rgba(220,38,38,0.15)',
    textColor: '#dc2626',
    description: 'Health warning of emergency conditions.',
    healthImplications: 'Health alert: everyone may experience more serious health effects.',
    advisory: 'Emergency conditions! Everyone should avoid all outdoor exertion.'
  }
];

export function getAQILevel(aqi: number): AQILevel {
  return AQI_LEVELS.find(l => aqi >= l.min && aqi <= l.max) || AQI_LEVELS[AQI_LEVELS.length - 1];
}

export function getAQIColor(aqi: number): string {
  return getAQILevel(aqi).color;
}

export function getAQICategory(aqi: number): string {
  return getAQILevel(aqi).category;
}

export function getAQIAdvisory(aqi: number): string {
  return getAQILevel(aqi).advisory;
}

export function getHealthRiskScore(aqi: number): number {
  if (aqi <= 50) return 1;
  if (aqi <= 100) return 2;
  if (aqi <= 150) return 3;
  if (aqi <= 200) return 4;
  if (aqi <= 300) return 5;
  return 6;
}

export function getHealthRiskLabel(score: number): string {
  const labels = ['', 'Low', 'Low-Moderate', 'Moderate', 'High', 'Very High', 'Extreme'];
  return labels[score] || 'Unknown';
}

export function formatAQI(aqi: number): string {
  return aqi.toString().padStart(3, '0');
}

export function getRelativeAQIDescription(aqi: number): string {
  if (aqi <= 50) return 'Air quality is excellent right now. Perfect conditions for outdoor activities.';
  if (aqi <= 100) return 'Air quality is acceptable. Sensitive individuals should be cautious.';
  if (aqi <= 150) return 'Sensitive groups may experience health effects. Consider limiting outdoor time.';
  if (aqi <= 200) return 'Everyone may begin to experience health effects. Limit outdoor exposure.';
  if (aqi <= 300) return 'Health alert! The risk of health effects is increased for everyone.';
  return 'Health warning of emergency conditions! Avoid all outdoor activities.';
}

export function getActivityRecommendation(aqi: number): { outdoor: string[]; indoor: string[] } {
  if (aqi <= 50) {
    return {
      outdoor: ['Running', 'Cycling', 'Hiking', 'Playground', 'Yoga in the park'],
      indoor: ['Any indoor activity is fine', 'Consider outdoor activities today!']
    };
  }
  if (aqi <= 100) {
    return {
      outdoor: ['Light jogging', 'Walking', 'Cycling (moderate)', 'Gardening'],
      indoor: ['Gym workout', 'Swimming', 'Yoga', 'Indoor sports']
    };
  }
  if (aqi <= 150) {
    return {
      outdoor: ['Short walks only', 'Light activities for short periods'],
      indoor: ['Gym workout', 'Swimming', 'Yoga', 'Home exercises', 'Indoor sports']
    };
  }
  if (aqi <= 200) {
    return {
      outdoor: ['Avoid outdoor activities', 'Use N95 mask if going outside'],
      indoor: ['Home exercises', 'Yoga', 'Meditation', 'Indoor hobbies']
    };
  }
  return {
    outdoor: ['Stay inside!', 'Seal windows and doors', 'Use air purifiers'],
    indoor: ['Home exercises only', 'Use air purifiers', 'Meditation', 'Read and relax']
  };
}

export function getVulnerableGroupsWarning(aqi: number): string[] {
  const warnings: string[] = [];
  if (aqi > 50) warnings.push('Children should limit prolonged outdoor exertion');
  if (aqi > 100) {
    warnings.push('Elderly individuals should stay indoors');
    warnings.push('People with asthma should carry inhalers');
  }
  if (aqi > 150) {
    warnings.push('People with heart or lung disease should avoid outdoor activity');
    warnings.push('Outdoor workers should use protective equipment');
  }
  if (aqi > 200) {
    warnings.push('Everyone should avoid outdoor physical activities');
    warnings.push('Pregnant women should stay indoors');
  }
  if (aqi > 300) {
    warnings.push('EMERGENCY: Everyone should remain indoors');
    warnings.push('Keep windows and doors closed');
  }
  return warnings;
}

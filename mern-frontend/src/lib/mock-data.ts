// Mock data for VayuGuard AQI monitoring

export interface CityAQI {
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  currentAQI: number;
  category: string;
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
  so2: number;
  co: number;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

export interface HourlyAQI {
  hour: string;
  aqi: number;
  pm25: number;
  pm10: number;
}

export interface DailyForecast {
  day: string;
  date: string;
  minAQI: number;
  maxAQI: number;
  avgAQI: number;
  category: string;
  dominant: string;
}

export const CITIES_AQI: CityAQI[] = [
  {
    city: 'Bangalore', state: 'Karnataka', latitude: 12.9716, longitude: 77.5946,
    currentAQI: 82, category: 'Moderate', pm25: 35.2, pm10: 68.4, no2: 28.6, o3: 42.1, so2: 8.3, co: 0.6,
    trend: 'down', trendValue: -5
  },
  {
    city: 'Delhi', state: 'Delhi', latitude: 28.6139, longitude: 77.2090,
    currentAQI: 248, category: 'Very Unhealthy', pm25: 156.8, pm10: 284.2, no2: 78.4, o3: 38.2, so2: 28.6, co: 2.1,
    trend: 'up', trendValue: 12
  },
  {
    city: 'Mumbai', state: 'Maharashtra', latitude: 19.0760, longitude: 72.8777,
    currentAQI: 112, category: 'Unhealthy for Sensitive Groups', pm25: 48.6, pm10: 96.2, no2: 52.8, o3: 56.4, so2: 14.2, co: 1.2,
    trend: 'stable', trendValue: 0
  },
  {
    city: 'Chennai', state: 'Tamil Nadu', latitude: 13.0827, longitude: 80.2707,
    currentAQI: 68, category: 'Moderate', pm25: 28.4, pm10: 54.6, no2: 22.8, o3: 48.6, so2: 6.8, co: 0.4,
    trend: 'down', trendValue: -3
  },
  {
    city: 'Kolkata', state: 'West Bengal', latitude: 22.5726, longitude: 88.3639,
    currentAQI: 178, category: 'Unhealthy', pm25: 98.2, pm10: 186.4, no2: 64.8, o3: 34.6, so2: 22.4, co: 1.8,
    trend: 'up', trendValue: 8
  },
  {
    city: 'Hyderabad', state: 'Telangana', latitude: 17.3850, longitude: 78.4867,
    currentAQI: 92, category: 'Moderate', pm25: 38.6, pm10: 74.2, no2: 32.4, o3: 44.8, so2: 10.6, co: 0.7,
    trend: 'down', trendValue: -2
  },
  {
    city: 'Pune', state: 'Maharashtra', latitude: 18.5204, longitude: 73.8567,
    currentAQI: 76, category: 'Moderate', pm25: 32.4, pm10: 62.8, no2: 26.2, o3: 46.2, so2: 8.8, co: 0.5,
    trend: 'stable', trendValue: 1
  },
  {
    city: 'Jaipur', state: 'Rajasthan', latitude: 26.9124, longitude: 75.7873,
    currentAQI: 198, category: 'Unhealthy', pm25: 118.6, pm10: 224.8, no2: 58.4, o3: 36.2, so2: 18.6, co: 1.6,
    trend: 'up', trendValue: 6
  },
  {
    city: 'Lucknow', state: 'Uttar Pradesh', latitude: 26.8467, longitude: 80.9462,
    currentAQI: 268, category: 'Very Unhealthy', pm25: 168.4, pm10: 298.6, no2: 82.6, o3: 32.8, so2: 32.4, co: 2.4,
    trend: 'up', trendValue: 15
  },
  {
    city: 'Ahmedabad', state: 'Gujarat', latitude: 23.0225, longitude: 72.5714,
    currentAQI: 142, category: 'Unhealthy for Sensitive Groups', pm25: 62.8, pm10: 124.6, no2: 44.2, o3: 52.4, so2: 16.8, co: 1.1,
    trend: 'stable', trendValue: -1
  },
  {
    city: 'Chandigarh', state: 'Chandigarh', latitude: 30.7333, longitude: 76.7794,
    currentAQI: 128, category: 'Unhealthy for Sensitive Groups', pm25: 54.2, pm10: 108.4, no2: 38.6, o3: 48.8, so2: 12.4, co: 0.9,
    trend: 'down', trendValue: -4
  },
  {
    city: 'Bhopal', state: 'Madhya Pradesh', latitude: 23.2599, longitude: 77.4126,
    currentAQI: 96, category: 'Moderate', pm25: 42.8, pm10: 82.6, no2: 34.2, o3: 42.6, so2: 11.4, co: 0.8,
    trend: 'stable', trendValue: 2
  }
];

export function generateHourlyAQI(baseAQI: number): HourlyAQI[] {
  const data: HourlyAQI[] = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 3600000);
    const hourStr = hour.getHours().toString().padStart(2, '0') + ':00';
    const variation = Math.sin(i * 0.3) * 20 + (Math.random() - 0.5) * 15;
    const aqi = Math.round(Math.max(0, baseAQI + variation));
    data.push({
      hour: hourStr,
      aqi,
      pm25: Math.round((aqi * 0.45 + Math.random() * 10) * 10) / 10,
      pm10: Math.round((aqi * 0.85 + Math.random() * 20) * 10) / 10,
    });
  }
  return data;
}

export function generateDailyForecast(baseAQI: number): DailyForecast[] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data: DailyForecast[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today.getTime() + i * 86400000);
    const variation = Math.sin(i * 0.5) * 30 + (Math.random() - 0.5) * 20;
    const avgAQI = Math.round(Math.max(0, baseAQI + variation));
    const minAQI = Math.round(avgAQI * 0.7 + Math.random() * 10);
    const maxAQI = Math.round(avgAQI * 1.3 + Math.random() * 15);
    let category = 'Good';
    if (avgAQI > 50) category = 'Moderate';
    if (avgAQI > 100) category = 'Unhealthy for Sensitive Groups';
    if (avgAQI > 150) category = 'Unhealthy';
    if (avgAQI > 200) category = 'Very Unhealthy';
    if (avgAQI > 300) category = 'Hazardous';

    const dominants = ['PM2.5', 'PM10', 'NO2', 'O3'];
    data.push({
      day: days[(today.getDay() + i) % 7],
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      minAQI,
      maxAQI,
      avgAQI,
      category,
      dominant: dominants[Math.floor(Math.random() * dominants.length)]
    });
  }
  return data;
}

export function generateHistoricalData(baseAQI: number, days: number = 30): { date: string; aqi: number; pm25: number; pm10: number }[] {
  const data: { date: string; aqi: number; pm25: number; pm10: number }[] = [];
  const today = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 86400000);
    const seasonalVar = Math.sin(i * 0.1) * 40;
    const randomVar = (Math.random() - 0.5) * 50;
    const aqi = Math.round(Math.max(10, Math.min(500, baseAQI + seasonalVar + randomVar)));
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      aqi,
      pm25: Math.round((aqi * 0.45 + Math.random() * 15) * 10) / 10,
      pm10: Math.round((aqi * 0.85 + Math.random() * 25) * 10) / 10,
    });
  }
  return data;
}

export const GLOBAL_STATIONS = [
  { city: 'New York', country: 'USA', latitude: 40.7128, longitude: -74.006, aqi: 42 },
  { city: 'London', country: 'UK', latitude: 51.5074, longitude: -0.1278, aqi: 38 },
  { city: 'Tokyo', country: 'Japan', latitude: 35.6762, longitude: 139.6503, aqi: 55 },
  { city: 'Beijing', country: 'China', latitude: 39.9042, longitude: 116.4074, aqi: 165 },
  { city: 'Sydney', country: 'Australia', latitude: -33.8688, longitude: 151.2093, aqi: 28 },
  { city: 'Paris', country: 'France', latitude: 48.8566, longitude: 2.3522, aqi: 45 },
  { city: 'Dubai', country: 'UAE', latitude: 25.2048, longitude: 55.2708, aqi: 88 },
  { city: 'Singapore', country: 'Singapore', latitude: 1.3521, longitude: 103.8198, aqi: 52 },
  { city: 'Seoul', country: 'South Korea', latitude: 37.5665, longitude: 126.978, aqi: 72 },
  { city: 'Cairo', country: 'Egypt', latitude: 30.0444, longitude: 31.2357, aqi: 138 },
  { city: 'Delhi', country: 'India', latitude: 28.6139, longitude: 77.209, aqi: 248 },
  { city: 'Mumbai', country: 'India', latitude: 19.076, longitude: 72.8777, aqi: 112 },
  { city: 'Bangalore', country: 'India', latitude: 12.9716, longitude: 77.5946, aqi: 82 },
  { city: 'São Paulo', country: 'Brazil', latitude: -23.5505, longitude: -46.6333, aqi: 62 },
  { city: 'Mexico City', country: 'Mexico', latitude: 19.4326, longitude: -99.1332, aqi: 95 },
  { city: 'Lagos', country: 'Nigeria', latitude: 6.5244, longitude: 3.3792, aqi: 118 },
  { city: 'Jakarta', country: 'Indonesia', latitude: -6.2088, longitude: 106.8456, aqi: 108 },
  { city: 'Bangkok', country: 'Thailand', latitude: 13.7563, longitude: 100.5018, aqi: 78 },
  { city: 'Moscow', country: 'Russia', latitude: 55.7558, longitude: 37.6173, aqi: 68 },
  { city: 'Istanbul', country: 'Turkey', latitude: 41.0082, longitude: 28.9784, aqi: 74 },
];

export const FEATURED_SERVICES = [
  {
    id: 'real-time',
    title: 'Real-Time Monitoring',
    description: 'Live AQI data from 500+ monitoring stations across India. Updated every 15 minutes with precision sensors.',
    icon: 'activity',
    metric: '500+',
    metricLabel: 'Stations'
  },
  {
    id: 'forecast',
    title: '72-Hour Forecast',
    description: 'AI-powered air quality predictions up to 72 hours in advance with 94% accuracy rate.',
    icon: 'trending-up',
    metric: '94%',
    metricLabel: 'Accuracy'
  },
  {
    id: 'health',
    title: 'Health Advisory',
    description: 'Personalized health recommendations based on your profile and local air quality conditions.',
    icon: 'heart-pulse',
    metric: '12M+',
    metricLabel: 'Users Protected'
  },
  {
    id: 'alerts',
    title: 'Smart Alerts',
    description: 'Instant notifications when air quality drops below your customized threshold levels.',
    icon: 'bell',
    metric: '<30s',
    metricLabel: 'Alert Speed'
  },
  {
    id: 'analytics',
    title: 'Deep Analytics',
    description: 'Comprehensive historical data analysis with trend identification and exposure tracking.',
    icon: 'bar-chart-3',
    metric: '5yr',
    metricLabel: 'Historical Data'
  },
  {
    id: 'api',
    title: 'Developer API',
    description: 'RESTful API with real-time and historical data access. 10M+ calls served monthly.',
    icon: 'code',
    metric: '10M+',
    metricLabel: 'API Calls/mo'
  }
];

export const STATS = [
  { value: '500+', label: 'Monitoring Stations', prefix: '' },
  { value: '50M+', label: 'Data Points Daily', prefix: '' },
  { value: '12M+', label: 'Active Users', prefix: '' },
  { value: '94%', label: 'Forecast Accuracy', prefix: '' },
  { value: '200+', label: 'Cities Covered', prefix: '' },
  { value: '<30s', label: 'Alert Response', prefix: '' }
];

import { NextRequest, NextResponse } from 'next/server';
import { CITIES_AQI } from '@/lib/mock-data';
import { getAQILevel, getHealthRiskScore, getHealthRiskLabel, getActivityRecommendation, getVulnerableGroupsWarning } from '@/lib/aqi-utils';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const city = searchParams.get('city')?.toLowerCase();

  if (!city) {
    return NextResponse.json({ error: 'City parameter is required' }, { status: 400 });
  }

  const cityData = CITIES_AQI.find(c => c.city.toLowerCase() === city);
  if (!cityData) {
    return NextResponse.json({ error: 'City not found' }, { status: 404 });
  }

  const aqiLevel = getAQILevel(cityData.currentAQI);
  const riskScore = getHealthRiskScore(cityData.currentAQI);
  const riskLabel = getHealthRiskLabel(riskScore);
  const activities = getActivityRecommendation(cityData.currentAQI);
  const warnings = getVulnerableGroupsWarning(cityData.currentAQI);

  return NextResponse.json({
    city: cityData.city,
    currentAQI: cityData.currentAQI,
    category: aqiLevel.category,
    riskScore,
    riskLabel,
    healthImplications: aqiLevel.healthImplications,
    advisory: aqiLevel.advisory,
    activities,
    warnings,
  });
}

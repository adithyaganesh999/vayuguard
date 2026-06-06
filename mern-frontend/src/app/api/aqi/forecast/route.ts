import { NextRequest, NextResponse } from 'next/server';
import { CITIES_AQI, generateDailyForecast } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const city = searchParams.get('city')?.toLowerCase();
  const hours = parseInt(searchParams.get('hours') || '72');

  if (!city) {
    return NextResponse.json({ error: 'City parameter is required' }, { status: 400 });
  }

  const cityData = CITIES_AQI.find(c => c.city.toLowerCase() === city);
  if (!cityData) {
    return NextResponse.json({ error: 'City not found' }, { status: 404 });
  }

  const forecast = generateDailyForecast(cityData.currentAQI);
  return NextResponse.json({ city: cityData.city, hours, forecast });
}

import { NextRequest, NextResponse } from 'next/server';
import { CITIES_AQI } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const city = searchParams.get('city')?.toLowerCase();

  if (!city) {
    return NextResponse.json({ error: 'City parameter is required' }, { status: 400 });
  }

  const cityData = CITIES_AQI.find(c => c.city.toLowerCase() === city);

  if (!cityData) {
    return NextResponse.json({ error: 'City not found', availableCities: CITIES_AQI.map(c => c.city) }, { status: 404 });
  }

  return NextResponse.json(cityData);
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

const alertSchema = z.object({
  userId: z.string(),
  condition: z.string(),
  location: z.string(),
  frequency: z.string().default('daily'),
});

export async function GET() {
  try {
    const alerts = await db.alert.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json(alerts);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = alertSchema.parse(body);

    const alert = await db.alert.create({
      data: {
        userId: data.userId,
        condition: data.condition,
        location: data.location,
        frequency: data.frequency,
        status: 'active',
      },
    });

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

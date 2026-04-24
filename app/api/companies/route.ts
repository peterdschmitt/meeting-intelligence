import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { companies } from '@/lib/schema';

export async function GET(_request: NextRequest) {
  try {
    const rows = await db.select().from(companies);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('[GET /api/companies]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      name: string;
      type?: string;
      notes?: string;
    };

    const { name, type, notes } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const [created] = await db
      .insert(companies)
      .values({
        id: crypto.randomUUID(),
        name,
        type: type ?? null,
        notes: notes ?? null,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[POST /api/companies]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

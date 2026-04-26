import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { opportunities, meetings, companies } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(_request: NextRequest) {
  try {
    const rows = await db
      .select({
        id: opportunities.id,
        opportunity: opportunities.opportunity,
        nextStep: opportunities.nextStep,
        status: opportunities.status,
        meetingId: opportunities.meetingId,
        meetingTitle: meetings.title,
        meetingDate: meetings.meetingDate,
        companyId: meetings.companyId,
        companyName: companies.name,
        createdAt: opportunities.createdAt,
        updatedAt: opportunities.updatedAt,
      })
      .from(opportunities)
      .leftJoin(meetings, eq(opportunities.meetingId, meetings.id))
      .leftJoin(companies, eq(meetings.companyId, companies.id));

    return NextResponse.json(rows);
  } catch (error) {
    console.error('[GET /api/opportunities]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

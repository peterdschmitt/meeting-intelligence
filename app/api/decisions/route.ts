import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decisions, meetings, companies } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(_request: NextRequest) {
  try {
    const rows = await db
      .select({
        id: decisions.id,
        decision: decisions.decision,
        owner: decisions.owner,
        contactId: decisions.contactId,
        implication: decisions.implication,
        meetingId: decisions.meetingId,
        meetingTitle: meetings.title,
        meetingDate: meetings.meetingDate,
        companyId: meetings.companyId,
        companyName: companies.name,
        createdAt: decisions.createdAt,
        updatedAt: decisions.updatedAt,
      })
      .from(decisions)
      .leftJoin(meetings, eq(decisions.meetingId, meetings.id))
      .leftJoin(companies, eq(meetings.companyId, companies.id));

    return NextResponse.json(rows);
  } catch (error) {
    console.error('[GET /api/decisions]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

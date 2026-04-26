import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { risks, meetings, companies } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(_request: NextRequest) {
  try {
    const rows = await db
      .select({
        id: risks.id,
        risk: risks.risk,
        whyItMatters: risks.whyItMatters,
        mitigation: risks.mitigation,
        severity: risks.severity,
        status: risks.status,
        meetingId: risks.meetingId,
        meetingTitle: meetings.title,
        meetingDate: meetings.meetingDate,
        companyId: meetings.companyId,
        companyName: companies.name,
        createdAt: risks.createdAt,
        updatedAt: risks.updatedAt,
      })
      .from(risks)
      .leftJoin(meetings, eq(risks.meetingId, meetings.id))
      .leftJoin(companies, eq(meetings.companyId, companies.id));

    return NextResponse.json(rows);
  } catch (error) {
    console.error('[GET /api/risks]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

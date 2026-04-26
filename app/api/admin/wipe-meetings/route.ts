import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetings, actionItems } from '@/lib/schema';

// One-shot destructive endpoint: wipes every meeting and action item plus all
// FK-cascaded children (status_history, outreach_log, meeting_attendees,
// meeting_topics, decisions, risks, opportunities, meeting_prep_items).
// Gated by SEED_TOKEN exactly like /api/admin/migrate. Safe to remove after use.

function authorize(request: NextRequest): NextResponse | null {
  const expected = process.env.SEED_TOKEN;
  if (!expected) return NextResponse.json({ error: 'SEED_TOKEN not configured' }, { status: 503 });
  const url = new URL(request.url);
  const provided =
    url.searchParams.get('token') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (provided !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}

export async function POST(request: NextRequest) {
  const blocked = authorize(request);
  if (blocked) return blocked;

  try {
    // action_items has FK to meetings without CASCADE — must delete explicitly first.
    // status_history & outreach_log cascade off action_items, so they go with it.
    const ai = await db.delete(actionItems).returning({ id: actionItems.id });
    // Cascades handle the recap-detail children.
    const m = await db.delete(meetings).returning({ id: meetings.id });

    return NextResponse.json({
      deletedActionItems: ai.length,
      deletedMeetings: m.length,
    });
  } catch (error) {
    console.error('[POST /api/admin/wipe-meetings]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

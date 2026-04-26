import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetingAttendees } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

const VALID_ENGAGEMENT = ['dominant', 'active', 'quiet'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    const body = (await request.json()) as {
      name: string;
      roleAtMeeting?: string | null;
      engagement?: string | null;
      contactId?: string | null;
    };

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (body.engagement && !VALID_ENGAGEMENT.includes(body.engagement)) {
      return NextResponse.json({ error: 'invalid engagement' }, { status: 400 });
    }

    const [{ maxPos }] = await db
      .select({ maxPos: sql<number>`COALESCE(MAX(${meetingAttendees.position}), -1)` })
      .from(meetingAttendees)
      .where(eq(meetingAttendees.meetingId, meetingId));

    const [created] = await db
      .insert(meetingAttendees)
      .values({
        meetingId,
        name: body.name.trim(),
        roleAtMeeting: body.roleAtMeeting ?? null,
        engagement: body.engagement ?? null,
        contactId: body.contactId ?? null,
        position: (Number(maxPos) ?? -1) + 1,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[POST /api/meetings/[id]/attendees]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

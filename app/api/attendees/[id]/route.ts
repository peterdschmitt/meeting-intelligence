import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetingAttendees } from '@/lib/schema';
import { eq } from 'drizzle-orm';

const VALID_ENGAGEMENT = ['dominant', 'active', 'quiet'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      name?: string;
      roleAtMeeting?: string | null;
      engagement?: string | null;
      contactId?: string | null;
    };

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.roleAtMeeting !== undefined) updates.roleAtMeeting = body.roleAtMeeting;
    if (body.contactId !== undefined) updates.contactId = body.contactId;
    if (body.engagement !== undefined) {
      if (body.engagement !== null && !VALID_ENGAGEMENT.includes(body.engagement)) {
        return NextResponse.json({ error: 'invalid engagement' }, { status: 400 });
      }
      updates.engagement = body.engagement;
    }
    updates.updatedAt = new Date();

    const [updated] = await db.update(meetingAttendees).set(updates).where(eq(meetingAttendees.id, id)).returning();
    if (!updated) {
      return NextResponse.json({ error: 'Attendee not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/attendees/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db.delete(meetingAttendees).where(eq(meetingAttendees.id, id)).returning();
    if (!deleted) {
      return NextResponse.json({ error: 'Attendee not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/attendees/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetings, actionItems } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, id))
      .limit(1);

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const items = await db
      .select()
      .from(actionItems)
      .where(eq(actionItems.meetingId, id));

    return NextResponse.json({ ...meeting, actionItems: items });
  } catch (error) {
    console.error('[GET /api/meetings/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      title?: string;
      rawNotes?: string;
      aiSummary?: string;
      participants?: string[];
      meetingDate?: string;
    };

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.rawNotes !== undefined) updates.rawNotes = body.rawNotes;
    if (body.aiSummary !== undefined) updates.aiSummary = body.aiSummary;
    if (body.participants !== undefined) updates.participants = body.participants;
    if (body.meetingDate !== undefined) updates.meetingDate = new Date(body.meetingDate);
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(meetings)
      .set(updates)
      .where(eq(meetings.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/meetings/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Cascade delete action items first
    await db.delete(actionItems).where(eq(actionItems.meetingId, id));

    const [deleted] = await db
      .delete(meetings)
      .where(eq(meetings.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/meetings/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

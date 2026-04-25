import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetings, companies, actionItems } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await db
      .select({
        id: meetings.id,
        title: meetings.title,
        meetingDate: meetings.meetingDate,
        meetingTime: meetings.meetingTime,
        platform: meetings.platform,
        participants: meetings.participants,
        rawNotes: meetings.rawNotes,
        aiSummary: meetings.aiSummary,
        transcript: meetings.transcript,
        chapters: meetings.chapters,
        keyQuestions: meetings.keyQuestions,
        source: meetings.source,
        gdriveFileId: meetings.gdriveFileId,
        companyId: meetings.companyId,
        companyName: companies.name,
        createdAt: meetings.createdAt,
        updatedAt: meetings.updatedAt,
      })
      .from(meetings)
      .leftJoin(companies, eq(meetings.companyId, companies.id))
      .where(eq(meetings.id, id))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
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

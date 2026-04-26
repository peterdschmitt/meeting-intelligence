import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  meetings,
  companies,
  actionItems,
  meetingAttendees,
  meetingTopics,
  decisions,
  risks,
  opportunities,
  meetingPrepItems,
} from '@/lib/schema';
import { asc, eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [meeting] = await db
      .select({
        id: meetings.id,
        title: meetings.title,
        meetingDate: meetings.meetingDate,
        meetingTime: meetings.meetingTime,
        platform: meetings.platform,
        rawNotes: meetings.rawNotes,
        executiveSummary: meetings.executiveSummary,
        transcript: meetings.transcript,
        chapters: meetings.chapters,
        keyQuestions: meetings.keyQuestions,
        source: meetings.source,
        gdriveFileId: meetings.gdriveFileId,
        companyId: meetings.companyId,
        companyName: companies.name,
        durationMinutes: meetings.durationMinutes,
        productiveMinutes: meetings.productiveMinutes,
        asyncableMinutes: meetings.asyncableMinutes,
        tangentMinutes: meetings.tangentMinutes,
        improvementNote: meetings.improvementNote,
        createdAt: meetings.createdAt,
        updatedAt: meetings.updatedAt,
      })
      .from(meetings)
      .leftJoin(companies, eq(meetings.companyId, companies.id))
      .where(eq(meetings.id, id))
      .limit(1);

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const [attendeeRows, topicRows, decisionRows, actionRows, riskRows, oppRows, prepRows] = await Promise.all([
      db.select().from(meetingAttendees).where(eq(meetingAttendees.meetingId, id)).orderBy(asc(meetingAttendees.position)),
      db.select().from(meetingTopics).where(eq(meetingTopics.meetingId, id)).orderBy(asc(meetingTopics.position)),
      db.select().from(decisions).where(eq(decisions.meetingId, id)).orderBy(asc(decisions.createdAt)),
      db.select().from(actionItems).where(eq(actionItems.meetingId, id)).orderBy(asc(actionItems.createdAt)),
      db.select().from(risks).where(eq(risks.meetingId, id)).orderBy(asc(risks.createdAt)),
      db.select().from(opportunities).where(eq(opportunities.meetingId, id)).orderBy(asc(opportunities.createdAt)),
      db.select().from(meetingPrepItems).where(eq(meetingPrepItems.meetingId, id)).orderBy(asc(meetingPrepItems.position)),
    ]);

    return NextResponse.json({
      ...meeting,
      attendees: attendeeRows,
      topics: topicRows,
      decisions: decisionRows,
      actionItems: actionRows,
      risks: riskRows,
      opportunities: oppRows,
      prepItems: prepRows,
    });
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
      executiveSummary?: string | null;
      meetingDate?: string;
      durationMinutes?: number | null;
      productiveMinutes?: number | null;
      asyncableMinutes?: number | null;
      tangentMinutes?: number | null;
      improvementNote?: string | null;
    };

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.rawNotes !== undefined) updates.rawNotes = body.rawNotes;
    if (body.executiveSummary !== undefined) updates.executiveSummary = body.executiveSummary;
    if (body.meetingDate !== undefined) updates.meetingDate = new Date(body.meetingDate);
    if (body.durationMinutes !== undefined) updates.durationMinutes = body.durationMinutes;
    if (body.productiveMinutes !== undefined) updates.productiveMinutes = body.productiveMinutes;
    if (body.asyncableMinutes !== undefined) updates.asyncableMinutes = body.asyncableMinutes;
    if (body.tangentMinutes !== undefined) updates.tangentMinutes = body.tangentMinutes;
    if (body.improvementNote !== undefined) updates.improvementNote = body.improvementNote;
    updates.updatedAt = new Date();

    const [updated] = await db.update(meetings).set(updates).where(eq(meetings.id, id)).returning();
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
    await db.delete(actionItems).where(eq(actionItems.meetingId, id));
    const [deleted] = await db.delete(meetings).where(eq(meetings.id, id)).returning();
    if (!deleted) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/meetings/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

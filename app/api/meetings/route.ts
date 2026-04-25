import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetings, companies } from '@/lib/schema';
import { eq, desc, gte, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const filter = searchParams.get('filter');

    let query = db
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
      .orderBy(desc(meetings.meetingDate));

    const fullSelect = {
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
    };

    if (filter === 'week') {
      return NextResponse.json(
        await db
          .select(fullSelect)
          .from(meetings)
          .leftJoin(companies, eq(meetings.companyId, companies.id))
          .where(gte(meetings.meetingDate, sql`date_trunc('week', now())`))
          .orderBy(desc(meetings.meetingDate))
      );
    }

    if (filter === 'month') {
      return NextResponse.json(
        await db
          .select(fullSelect)
          .from(meetings)
          .leftJoin(companies, eq(meetings.companyId, companies.id))
          .where(gte(meetings.meetingDate, sql`date_trunc('month', now())`))
          .orderBy(desc(meetings.meetingDate))
      );
    }

    const result = await query;
    return NextResponse.json(result);
  } catch (error) {
    console.error('[GET /api/meetings]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      title: string;
      meetingDate?: string;
      participants?: string[];
      rawNotes?: string;
      source?: string;
      companyId?: string;
    };

    const { title, meetingDate, participants, rawNotes, source, companyId } = body;

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const [created] = await db
      .insert(meetings)
      .values({
        title,
        meetingDate: meetingDate ? new Date(meetingDate) : null,
        participants: participants ?? [],
        rawNotes: rawNotes ?? null,
        source: source ?? 'manual',
        companyId: companyId ?? null,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[POST /api/meetings]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

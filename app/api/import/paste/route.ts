import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetings } from '@/lib/schema';
import { extractAndSave } from '@/lib/extract';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      title: string;
      rawNotes: string;
      meetingDate?: string;
      participants?: string[];
    };

    const { title, rawNotes, meetingDate, participants } = body;

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    if (!rawNotes) {
      return NextResponse.json({ error: 'rawNotes is required' }, { status: 400 });
    }

    const [meeting] = await db
      .insert(meetings)
      .values({
        title,
        rawNotes,
        meetingDate: meetingDate ? new Date(meetingDate) : null,
        participants: participants ?? [],
        source: 'manual',
      })
      .returning();

    await extractAndSave(meeting.id, rawNotes, { title, attendees: participants ?? [] });

    return NextResponse.json({ meetingId: meeting.id }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/import/paste]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

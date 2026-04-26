import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetings } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { reExtractAndSave } from '@/lib/extract';

export async function POST(
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
    if (!meeting.rawNotes) {
      return NextResponse.json({ error: 'Meeting has no raw notes to extract from' }, { status: 400 });
    }

    await reExtractAndSave(id, meeting.rawNotes);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/meetings/[id]/extract]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetingPrepItems } from '@/lib/schema';
import { and, eq, sql } from 'drizzle-orm';

const VALID_KIND = ['agenda', 'question', 'outcome'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    const body = (await request.json()) as {
      kind: string;
      text: string;
      rationale?: string | null;
    };

    if (!body.text || !body.text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    if (!VALID_KIND.includes(body.kind)) {
      return NextResponse.json({ error: 'invalid kind' }, { status: 400 });
    }

    const [{ maxPos }] = await db
      .select({ maxPos: sql<number>`COALESCE(MAX(${meetingPrepItems.position}), -1)` })
      .from(meetingPrepItems)
      .where(and(eq(meetingPrepItems.meetingId, meetingId), eq(meetingPrepItems.kind, body.kind)));

    const [created] = await db
      .insert(meetingPrepItems)
      .values({
        meetingId,
        kind: body.kind,
        text: body.text.trim(),
        rationale: body.kind === 'agenda' ? (body.rationale ?? null) : null,
        completed: false,
        position: (Number(maxPos) ?? -1) + 1,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[POST /api/meetings/[id]/prep-items]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

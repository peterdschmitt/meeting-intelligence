import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetingTopics } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    const body = (await request.json()) as {
      title: string;
      content?: string | null;
    };

    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const [{ maxPos }] = await db
      .select({ maxPos: sql<number>`COALESCE(MAX(${meetingTopics.position}), -1)` })
      .from(meetingTopics)
      .where(eq(meetingTopics.meetingId, meetingId));

    const [created] = await db
      .insert(meetingTopics)
      .values({
        meetingId,
        title: body.title.trim(),
        content: body.content ?? null,
        position: (Number(maxPos) ?? -1) + 1,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[POST /api/meetings/[id]/topics]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

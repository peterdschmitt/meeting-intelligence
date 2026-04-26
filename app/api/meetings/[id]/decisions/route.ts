import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decisions } from '@/lib/schema';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    const body = (await request.json()) as {
      decision: string;
      owner?: string | null;
      contactId?: string | null;
      implication?: string | null;
    };

    if (!body.decision || !body.decision.trim()) {
      return NextResponse.json({ error: 'decision is required' }, { status: 400 });
    }

    const [created] = await db
      .insert(decisions)
      .values({
        meetingId,
        decision: body.decision.trim(),
        owner: body.owner ?? null,
        contactId: body.contactId ?? null,
        implication: body.implication ?? null,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[POST /api/meetings/[id]/decisions]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

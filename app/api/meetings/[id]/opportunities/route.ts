import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { opportunities } from '@/lib/schema';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    const body = (await request.json()) as {
      opportunity: string;
      nextStep?: string | null;
    };

    if (!body.opportunity || !body.opportunity.trim()) {
      return NextResponse.json({ error: 'opportunity is required' }, { status: 400 });
    }

    const [created] = await db
      .insert(opportunities)
      .values({
        meetingId,
        opportunity: body.opportunity.trim(),
        nextStep: body.nextStep ?? null,
        status: 'open',
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[POST /api/meetings/[id]/opportunities]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

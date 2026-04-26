import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetingPrepItems } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      text?: string;
      rationale?: string | null;
      completed?: boolean;
    };

    const updates: Record<string, unknown> = {};
    if (body.text !== undefined) updates.text = body.text;
    if (body.rationale !== undefined) updates.rationale = body.rationale;
    if (body.completed !== undefined) updates.completed = body.completed;
    updates.updatedAt = new Date();

    const [updated] = await db.update(meetingPrepItems).set(updates).where(eq(meetingPrepItems.id, id)).returning();
    if (!updated) {
      return NextResponse.json({ error: 'Prep item not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/prep-items/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db.delete(meetingPrepItems).where(eq(meetingPrepItems.id, id)).returning();
    if (!deleted) {
      return NextResponse.json({ error: 'Prep item not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/prep-items/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

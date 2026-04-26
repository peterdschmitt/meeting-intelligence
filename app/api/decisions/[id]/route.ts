import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decisions } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      decision?: string;
      owner?: string | null;
      contactId?: string | null;
      implication?: string | null;
    };

    const updates: Record<string, unknown> = {};
    if (body.decision !== undefined) updates.decision = body.decision;
    if (body.owner !== undefined) updates.owner = body.owner;
    if (body.contactId !== undefined) updates.contactId = body.contactId;
    if (body.implication !== undefined) updates.implication = body.implication;
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(decisions)
      .set(updates)
      .where(eq(decisions.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/decisions/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db.delete(decisions).where(eq(decisions.id, id)).returning();
    if (!deleted) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/decisions/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { opportunities } from '@/lib/schema';
import { eq } from 'drizzle-orm';

const VALID_STATUS = ['open', 'pursuing', 'won', 'dropped'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      opportunity?: string;
      nextStep?: string | null;
      status?: string;
    };

    const updates: Record<string, unknown> = {};
    if (body.opportunity !== undefined) updates.opportunity = body.opportunity;
    if (body.nextStep !== undefined) updates.nextStep = body.nextStep;
    if (body.status !== undefined) {
      if (!VALID_STATUS.includes(body.status)) {
        return NextResponse.json({ error: 'invalid status' }, { status: 400 });
      }
      updates.status = body.status;
    }
    updates.updatedAt = new Date();

    const [updated] = await db.update(opportunities).set(updates).where(eq(opportunities.id, id)).returning();
    if (!updated) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/opportunities/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db.delete(opportunities).where(eq(opportunities.id, id)).returning();
    if (!deleted) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/opportunities/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

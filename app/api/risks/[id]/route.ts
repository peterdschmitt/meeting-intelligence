import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { risks } from '@/lib/schema';
import { eq } from 'drizzle-orm';

const VALID_SEVERITY = ['low', 'medium', 'high'];
const VALID_STATUS = ['open', 'mitigated', 'accepted'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      risk?: string;
      whyItMatters?: string | null;
      mitigation?: string | null;
      severity?: string;
      status?: string;
    };

    const updates: Record<string, unknown> = {};
    if (body.risk !== undefined) updates.risk = body.risk;
    if (body.whyItMatters !== undefined) updates.whyItMatters = body.whyItMatters;
    if (body.mitigation !== undefined) updates.mitigation = body.mitigation;
    if (body.severity !== undefined) {
      if (!VALID_SEVERITY.includes(body.severity)) {
        return NextResponse.json({ error: 'invalid severity' }, { status: 400 });
      }
      updates.severity = body.severity;
    }
    if (body.status !== undefined) {
      if (!VALID_STATUS.includes(body.status)) {
        return NextResponse.json({ error: 'invalid status' }, { status: 400 });
      }
      updates.status = body.status;
    }
    updates.updatedAt = new Date();

    const [updated] = await db.update(risks).set(updates).where(eq(risks.id, id)).returning();
    if (!updated) {
      return NextResponse.json({ error: 'Risk not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/risks/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db.delete(risks).where(eq(risks.id, id)).returning();
    if (!deleted) {
      return NextResponse.json({ error: 'Risk not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/risks/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { actionItems } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      status?: string;
      title?: string;
      assignee?: string | null;
      dueDate?: string | null;
      priority?: string;
      description?: string | null;
    };

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.assignee !== undefined) updates.assignee = body.assignee;
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined) {
      updates.status = body.status;
      if (body.status === 'done') {
        updates.completedAt = new Date();
      }
    }
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(actionItems)
      .set(updates)
      .where(eq(actionItems.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Action item not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/action-items/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [deleted] = await db
      .delete(actionItems)
      .where(eq(actionItems.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Action item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/action-items/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { statusHistory, actionItems } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const history = await db
      .select()
      .from(statusHistory)
      .where(eq(statusHistory.actionItemId, id))
      .orderBy(desc(statusHistory.changedAt));
    return NextResponse.json(history);
  } catch (error: unknown) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { newStatus, oldStatus, note } = await request.json();

    // Insert history row
    const [entry] = await db.insert(statusHistory).values({
      actionItemId: id,
      oldStatus: oldStatus ?? null,
      newStatus,
      note: note ?? null,
    }).returning();

    // Update the action item status + append note
    const existing = await db.select().from(actionItems).where(eq(actionItems.id, id)).limit(1);
    const currentNotes = existing[0]?.notes ?? '';
    const newNotes = note
      ? currentNotes
        ? `${currentNotes}\n\n[${new Date().toLocaleString()}] ${note}`
        : `[${new Date().toLocaleString()}] ${note}`
      : currentNotes;

    await db.update(actionItems)
      .set({
        status: newStatus,
        notes: newNotes || null,
        completedAt: newStatus === 'done' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(actionItems.id, id));

    return NextResponse.json(entry, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

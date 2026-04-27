import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { contacts, meetings } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, id))
      .limit(1);

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Find meetings where participants array contains this contact's name
    const contactMeetings = await db
      .select()
      .from(meetings)
      .where(sql`${contact.fullName} = ANY(${meetings.participants})`);

    return NextResponse.json({ ...contact, meetings: contactMeetings });
  } catch (error) {
    console.error('[GET /api/contacts/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      fullName?: string;
      email?: string | null;
      role?: string | null;
      companyId?: string | null;
      notes?: string | null;
      kind?: string | null;
      excludeFromTasks?: boolean;
    };

    const updates: Record<string, unknown> = {};
    if (body.fullName !== undefined) updates.fullName = body.fullName;
    if (body.email !== undefined) updates.email = body.email;
    if (body.role !== undefined) updates.role = body.role;
    if (body.companyId !== undefined) updates.companyId = body.companyId;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.kind !== undefined) {
      if (body.kind !== null && !['team', 'partner', 'external'].includes(body.kind)) {
        return NextResponse.json({ error: 'invalid kind' }, { status: 400 });
      }
      updates.kind = body.kind;
    }
    if (body.excludeFromTasks !== undefined) updates.excludeFromTasks = body.excludeFromTasks;
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(contacts)
      .set(updates)
      .where(eq(contacts.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/contacts/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

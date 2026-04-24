import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { actionItems, meetings } from '@/lib/schema';
import { eq, and, lt, gte, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const filter = searchParams.get('filter');

    const conditions = [];

    if (status && ['open', 'done', 'in_progress'].includes(status)) {
      conditions.push(eq(actionItems.status, status));
    }

    if (filter === 'overdue') {
      conditions.push(
        lt(actionItems.dueDate, sql`CURRENT_DATE::text`)
      );
      conditions.push(sql`${actionItems.status} != 'done'`);
    } else if (filter === 'week') {
      conditions.push(
        gte(actionItems.dueDate, sql`date_trunc('week', now())::date::text`)
      );
    }

    const rows = await db
      .select({
        id: actionItems.id,
        title: actionItems.title,
        description: actionItems.description,
        assignee: actionItems.assignee,
        dueDate: actionItems.dueDate,
        status: actionItems.status,
        priority: actionItems.priority,
        meetingId: actionItems.meetingId,
        contactId: actionItems.contactId,
        doneToken: actionItems.doneToken,
        completedAt: actionItems.completedAt,
        createdAt: actionItems.createdAt,
        updatedAt: actionItems.updatedAt,
        meetingTitle: meetings.title,
      })
      .from(actionItems)
      .leftJoin(meetings, eq(actionItems.meetingId, meetings.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return NextResponse.json(rows);
  } catch (error) {
    console.error('[GET /api/action-items]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      title: string;
      assignee?: string;
      dueDate?: string;
      priority?: string;
      meetingId?: string;
      description?: string;
    };

    const { title, assignee, dueDate, priority, meetingId, description } = body;

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const [created] = await db
      .insert(actionItems)
      .values({
        title,
        assignee: assignee ?? null,
        dueDate: dueDate ?? null,
        priority: priority ?? 'medium',
        status: 'open',
        meetingId: meetingId ?? null,
        description: description ?? null,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[POST /api/action-items]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

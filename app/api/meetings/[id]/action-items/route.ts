import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { actionItems } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const items = await db
      .select()
      .from(actionItems)
      .where(eq(actionItems.meetingId, id));

    return NextResponse.json(items);
  } catch (error) {
    console.error('[GET /api/meetings/[id]/action-items]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

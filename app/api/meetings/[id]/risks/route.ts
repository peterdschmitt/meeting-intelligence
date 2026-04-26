import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { risks } from '@/lib/schema';

const VALID_SEVERITY = ['low', 'medium', 'high'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    const body = (await request.json()) as {
      risk: string;
      whyItMatters?: string | null;
      mitigation?: string | null;
      severity?: string;
    };

    if (!body.risk || !body.risk.trim()) {
      return NextResponse.json({ error: 'risk is required' }, { status: 400 });
    }
    const severity = body.severity && VALID_SEVERITY.includes(body.severity) ? body.severity : 'medium';

    const [created] = await db
      .insert(risks)
      .values({
        meetingId,
        risk: body.risk.trim(),
        whyItMatters: body.whyItMatters ?? null,
        mitigation: body.mitigation ?? null,
        severity,
        status: 'open',
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[POST /api/meetings/[id]/risks]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

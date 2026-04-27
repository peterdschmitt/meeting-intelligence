import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetings, meetingPrepGuides } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { generatePrep } from '@/lib/generate-prep';

export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const [exists] = await db.select({ id: meetings.id }).from(meetings).where(eq(meetings.id, id)).limit(1);
  if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const result = await generatePrep(id, { force: true });
  if (result.status === 'error') {
    return NextResponse.json({ error: result.error ?? 'Generation failed' }, { status: 502 });
  }

  // Return the freshly-inserted guide
  const [latest] = await db
    .select({
      guide: meetingPrepGuides.guide,
      generatedAt: meetingPrepGuides.generatedAt,
      model: meetingPrepGuides.model,
    })
    .from(meetingPrepGuides)
    .where(eq(meetingPrepGuides.meetingId, id))
    .orderBy(desc(meetingPrepGuides.generatedAt))
    .limit(1);

  // jsonb column comes back already-parsed
  const prepGuide: unknown = latest?.guide ?? null;

  return NextResponse.json({
    prepGuide,
    prepGuideGeneratedAt: latest?.generatedAt ? new Date(latest.generatedAt).toISOString() : null,
    prepGuideModel: latest?.model ?? null,
  });
}

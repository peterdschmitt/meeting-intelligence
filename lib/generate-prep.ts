import { db } from '@/lib/db';
import { meetingPrepGuides, meetingAttendees, meetings } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { getOpenAI } from '@/lib/openai';
import { classifyMeeting, type MeetingType } from '@/lib/classify-meeting';
import { systemPromptFor } from '@/lib/prep-prompts';
import { gatherPrepContext, renderContext, type PrepContext } from '@/lib/prep-context';
import { hashPrepContext } from '@/lib/prep-hash';

const MODEL = 'gpt-4o';
const TEMPERATURE = 0.3;
const CACHE_TTL_HOURS = 12;

export interface GeneratePrepResult {
  meetingId: string;
  status: 'generated' | 'skipped_cache' | 'error';
  error?: string;
  guideId?: string;
}

export interface GeneratePrepOptions {
  force?: boolean; // if true, ignore the input-hash cache (manual regenerate)
}

async function classifyForMeeting(meetingId: string): Promise<MeetingType> {
  const [m] = await db
    .select({ title: meetings.title, companyId: meetings.companyId })
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);
  if (!m) throw new Error(`classifyForMeeting: meeting ${meetingId} not found`);

  const attendees = await db
    .select({ email: meetingAttendees.email, name: meetingAttendees.name })
    .from(meetingAttendees)
    .where(eq(meetingAttendees.meetingId, meetingId));

  // hasPriorOccurrence is computed by gatherPrepContext; we approximate here
  // with a quick fuzzy lookup. Cheap because gatherPrepContext is about to do
  // the same lookup. For correctness, classifyMeeting is called once with
  // hasPriorOccurrence=false and we re-classify to 'recurring' below if a
  // prior was actually found.
  return classifyMeeting({
    title: m.title.replace(/^\s*(FW:|Re:|Invitation:)\s*/i, '').trim(),
    attendees: attendees.map((a) => ({ email: a.email ?? '', name: a.name ?? '' })),
    companyId: m.companyId,
    hasPriorOccurrence: false,
  });
}

export async function generatePrep(
  meetingId: string,
  opts: GeneratePrepOptions = {},
): Promise<GeneratePrepResult> {
  const initialType = await classifyForMeeting(meetingId);
  let ctx: PrepContext = await gatherPrepContext(meetingId, initialType);

  // Re-classify if we discovered a prior occurrence (recurring overrides others)
  if (ctx.priorOccurrence && ctx.type !== 'interview') {
    ctx = { ...ctx, type: 'recurring' };
  }

  const inputHash = hashPrepContext(ctx);

  // Cache check
  if (!opts.force) {
    const [latest] = await db
      .select({ inputHash: meetingPrepGuides.inputHash, generatedAt: meetingPrepGuides.generatedAt })
      .from(meetingPrepGuides)
      .where(eq(meetingPrepGuides.meetingId, meetingId))
      .orderBy(desc(meetingPrepGuides.generatedAt))
      .limit(1);

    if (latest && latest.inputHash === inputHash) {
      const ageMs = Date.now() - new Date(latest.generatedAt).getTime();
      if (ageMs < CACHE_TTL_HOURS * 60 * 60 * 1000) {
        return { meetingId, status: 'skipped_cache' };
      }
    }
  }

  // Call OpenAI
  const systemPrompt = systemPromptFor(ctx.type);
  const userMessage = renderContext(ctx);

  let guideJson: unknown;
  try {
    const completion = await getOpenAI().chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: TEMPERATURE,
    });
    const raw = completion.choices[0]?.message?.content ?? '{}';
    guideJson = JSON.parse(raw);
  } catch (err) {
    return {
      meetingId,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const [inserted] = await db
    .insert(meetingPrepGuides)
    .values({
      meetingId,
      guide: JSON.stringify(guideJson),
      inputHash,
      model: MODEL,
    })
    .returning({ id: meetingPrepGuides.id });

  return { meetingId, status: 'generated', guideId: inserted.id };
}

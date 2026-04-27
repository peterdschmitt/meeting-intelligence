import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetings, meetingAttendees, contacts } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { fetchAllFeedsForDay, type ParsedIcsEvent } from '@/lib/ics';
import { dedupeEvents } from '@/lib/dedupe';
import { generatePrep } from '@/lib/generate-prep';

// Each prep guide LLM call takes ~5-15s; with up to ~10 meetings/day this
// can approach 60s. Use the same maxDuration as import-drive.
export const maxDuration = 300;

function authorize(request: NextRequest): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  const auth = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const tokenParam = new URL(request.url).searchParams.get('token');
  if (auth === expected || tokenParam === expected) return null;
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

interface UpsertResult {
  meetingId: string;
  isNew: boolean;
}

async function upsertMeetingFromIcs(ev: ParsedIcsEvent): Promise<UpsertResult> {
  const [existing] = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(eq(meetings.icsUid, ev.uid))
    .limit(1);

  if (existing) {
    await db
      .update(meetings)
      .set({
        title: ev.summary,
        startAt: ev.startAt,
        endAt: ev.endAt,
        calendarSource: ev.calendarSource,
        joinUrl: ev.joinUrl,
        platform: ev.platform,
        meetingDate: ev.startAt,
      })
      .where(eq(meetings.id, existing.id));
    return { meetingId: existing.id, isNew: false };
  }

  const [inserted] = await db
    .insert(meetings)
    .values({
      title: ev.summary,
      icsUid: ev.uid,
      startAt: ev.startAt,
      endAt: ev.endAt,
      calendarSource: ev.calendarSource,
      joinUrl: ev.joinUrl,
      platform: ev.platform,
      meetingDate: ev.startAt,
      source: 'ics',
    })
    .returning({ id: meetings.id });

  return { meetingId: inserted.id, isNew: true };
}

async function syncAttendees(meetingId: string, ev: ParsedIcsEvent): Promise<void> {
  // Wipe + recreate (simple, idempotent for re-runs)
  await db.delete(meetingAttendees).where(eq(meetingAttendees.meetingId, meetingId));

  for (const a of ev.attendees) {
    if (!a.email) continue;
    const [existingContact] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(sql`lower(${contacts.email}) = lower(${a.email})`)
      .limit(1);

    let contactId = existingContact?.id;
    if (!contactId) {
      const [stub] = await db
        .insert(contacts)
        .values({
          fullName: a.name || a.email,
          email: a.email,
        })
        .returning({ id: contacts.id });
      contactId = stub.id;
    }

    await db.insert(meetingAttendees).values({
      meetingId,
      contactId,
      name: a.name || a.email,
      email: a.email,
    });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = authorize(request);
  if (denied) return denied;

  const startedAt = new Date();
  const feeds = [
    { source: 'conversely', url: process.env.ICS_FEED_CONVERSELY },
    { source: 'pine-lake',  url: process.env.ICS_FEED_PINE_LAKE },
    { source: 'cranbrook',  url: process.env.ICS_FEED_CRANBROOK },
  ];

  const { events, perFeed } = await fetchAllFeedsForDay(feeds);
  const survivors = dedupeEvents(events);

  const upsertResults: { meetingId: string; isNew: boolean }[] = [];
  for (const ev of survivors) {
    try {
      const r = await upsertMeetingFromIcs(ev);
      await syncAttendees(r.meetingId, ev);
      upsertResults.push(r);
    } catch (err) {
      console.error(`[sync-calendar] upsert failed for ${ev.uid}:`, err);
    }
  }

  // Generate prep guides (sequential to avoid OpenAI rate limits + Vercel timeout pressure)
  const prepResults: Awaited<ReturnType<typeof generatePrep>>[] = [];
  for (const r of upsertResults) {
    try {
      const result = await generatePrep(r.meetingId);
      prepResults.push(result);
    } catch (err) {
      console.error(`[sync-calendar] generatePrep failed for ${r.meetingId}:`, err);
      prepResults.push({ meetingId: r.meetingId, status: 'error', error: String(err) });
    }
  }

  return NextResponse.json({
    ok: true,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    feeds: perFeed,
    eventsFetched: events.length,
    eventsAfterDedupe: survivors.length,
    inserted: upsertResults.filter((r) => r.isNew).length,
    updated: upsertResults.filter((r) => !r.isNew).length,
    prep: {
      generated: prepResults.filter((r) => r.status === 'generated').length,
      skippedCache: prepResults.filter((r) => r.status === 'skipped_cache').length,
      errored: prepResults.filter((r) => r.status === 'error').length,
    },
  });
}

// Allow GET for easy manual testing; same handler.
export const GET = POST;

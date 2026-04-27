# Today's Meetings Prep Guide — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an end-to-end pipeline that ingests Peter's three ICS calendar feeds three times a day, dedupes events across feeds, generates type-aware AI prep guides via GPT-4o, and surfaces today's meetings + briefs on the Inbox dashboard and a dedicated `/today` route — with zero clicks at read time.

**Architecture:** Three Vercel cron triggers (5 AM, 9 AM, 1 PM ET) hit `POST /api/cron/sync-calendar`, which calls a chain of pure library modules (`lib/ics.ts` → `lib/dedupe.ts` → `lib/classify-meeting.ts` → `lib/generate-prep.ts`) and persists results into `meetings` + a new `meeting_prep_guides` table. The UI reads pre-baked data from `GET /api/meetings/today` (DB-only) and renders it via a single `<TodayMeetingsPanel>` component mounted both on the Inbox and on `/today`.

**Tech Stack:** Next.js 16.2.4 App Router, TypeScript, Drizzle ORM, Neon Postgres, OpenAI SDK 6.x (`gpt-4o`), `node-ical` (new dep), Vercel Cron.

---

## Reference design

This plan implements the design in [docs/superpowers/specs/2026-04-27-todays-meetings-prep-guide-design.md](../specs/2026-04-27-todays-meetings-prep-guide-design.md). When this plan and the design disagree, the design wins — flag the conflict and stop.

## Conventions used by this codebase (read first if unfamiliar)

- **No test runner is set up.** Verification in this plan uses TypeScript type checking (`npx tsc --noEmit`), ESLint (`npm run lint`), `curl` against `localhost:3000`, and small standalone verification scripts in `scripts/verify-*.ts` runnable via `npx tsx`.
- **Lib files are kebab-case** (`lib/format-date.ts`, `lib/google-auth.ts`).
- **Components are PascalCase** (`components/TodayMeetingsPanel.tsx`).
- **Route handlers** use `{ params: Promise<{ id: string }> }` for dynamic segments — follow [app/api/action-items/[id]/outreach/route.ts:8](../../../app/api/action-items/[id]/outreach/route.ts).
- **Cron auth pattern** is already established — copy the `authorize()` helper from [app/api/cron/import-drive/route.ts:15](../../../app/api/cron/import-drive/route.ts).
- **Schema migrations** are additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements appended to [app/api/admin/migrate/route.ts](../../../app/api/admin/migrate/route.ts). After deploy, hit `POST /api/admin/migrate?token=$SEED_TOKEN`.
- **AI calls** go through `getOpenAI()` from [lib/openai.ts](../../../lib/openai.ts). Use `model: 'gpt-4o'`, `response_format: { type: 'json_object' }`, `temperature: 0.3` (matches [lib/extract.ts:117](../../../lib/extract.ts)).
- **Commit per task** at minimum, sometimes per logical step. Keep history readable.

## File structure

### Will create

| Path | Purpose |
|---|---|
| `lib/exclusions.ts` | Server-side reusable filter for `excludeFromTasks` contacts. |
| `lib/ics.ts` | Fetch + parse + expand ICS feeds to today's events. |
| `lib/dedupe.ts` | Match events across feeds (by UID, then fuzzy title + time). |
| `lib/classify-meeting.ts` | Classify a meeting into `recurring | interview | one_on_one | external_meeting | general`. |
| `lib/prep-prompts.ts` | Per-type system prompts for GPT-4o. |
| `lib/prep-context.ts` | Gather DB context per meeting type. |
| `lib/prep-hash.ts` | Stable input hashing for cache-skip logic. |
| `lib/generate-prep.ts` | Orchestrator: classify → context → hash → cache → AI call → persist. |
| `app/api/cron/sync-calendar/route.ts` | The scheduled endpoint. Vercel cron hits this 3×/day. |
| `app/api/meetings/today/route.ts` | DB-only read endpoint for the panel. |
| `app/api/meetings/[id]/regenerate-prep/route.ts` | Manual force-regen endpoint. |
| `components/TodayMeetingsPanel.tsx` | The panel component (mounts in two places). |
| `app/today/page.tsx` | Dedicated route. |
| `scripts/verify-dedupe.ts` | Standalone runnable verification of dedupe edge cases. |
| `scripts/verify-classify.ts` | Standalone runnable verification of classifier. |
| `scripts/verify-prep-hash.ts` | Standalone runnable verification of hash stability. |

### Will modify

| Path | Why |
|---|---|
| `lib/schema.ts` | Add new columns + new `meeting_prep_guides` table. |
| `app/api/admin/migrate/route.ts` | Append new migration statements. |
| `components/DashboardClient.tsx` | Mount `<TodayMeetingsPanel>` and add "Today" stat-strip cell. |
| `components/Sidebar.tsx` | Add `/today` nav entry with count badge. |
| `vercel.json` | Add three cron entries. |
| `package.json` | Add `node-ical` (and `tsx` as a dev dep so verification scripts run). |
| `.env.local` (manually by Peter) | Add `ICS_FEED_CONVERSELY`, `ICS_FEED_PINE_LAKE`, `ICS_FEED_CRANBROOK`. |

---

## Task 1: Add dependencies and env-var documentation

**Files:**
- Modify: `package.json`
- Modify: `README.md` (or create `docs/setup.md` if README doesn't have an env section)

**What:** Install `node-ical` (ICS parsing) and `tsx` (run TS verification scripts without a build step).

- [ ] **Step 1.1: Install `node-ical` and `tsx`**

```bash
npm install node-ical
npm install --save-dev tsx
```

Run: `npm ls node-ical tsx`
Expected: both listed at non-error versions.

- [ ] **Step 1.2: Document env vars**

Add a section to README (or `docs/setup.md`):

```markdown
## Calendar feeds (today's meetings prep)

The "Today's Meetings" panel and `/today` route are populated by a 3×/day cron
that ingests three ICS calendar feeds. Set these env vars (in `.env.local`
locally and in Vercel project settings for prod):

- `ICS_FEED_CONVERSELY` — ICS URL for the Conversely calendar
- `ICS_FEED_PINE_LAKE` — ICS URL for the Pine Lake Capital calendar
- `ICS_FEED_CRANBROOK` — ICS URL for the Cranbrook Analytics calendar

The cron job is gated by the existing `CRON_SECRET`. If any feed is unset, the
cron logs a warning and skips it; the others still run.
```

- [ ] **Step 1.3: Commit**

```bash
git add package.json package-lock.json README.md
git commit -m "$(cat <<'EOF'
chore: add node-ical + tsx deps for today's meetings prep pipeline

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Schema additions

**Files:**
- Modify: `lib/schema.ts`
- Modify: `app/api/admin/migrate/route.ts`

**What:** Add new columns to `meetings` and create the new `meeting_prep_guides` table. Keep both Drizzle schema and the migration runner in sync.

- [ ] **Step 2.1: Add columns + new table to Drizzle schema**

Edit [lib/schema.ts](../../../lib/schema.ts).

Inside the existing `meetings` table definition, add (after `improvementNote: text('improvement_note')`):

```typescript
  // ICS-sourced upcoming meetings
  icsUid: text('ics_uid').unique(),
  startAt: timestamp('start_at', { withTimezone: true }),
  endAt: timestamp('end_at', { withTimezone: true }),
  calendarSource: text('calendar_source'),
  joinUrl: text('join_url'),
```

Below the `actionItems` table (or in any logical position before the type exports at the bottom), add:

```typescript
export const meetingPrepGuides = pgTable('meeting_prep_guides', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  guide: text('guide').notNull(), // JSON-encoded; jsonb-typed in Postgres via migration
  inputHash: text('input_hash').notNull(),
  model: text('model').notNull(),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
});
```

> **Note:** Drizzle's `pg-core` doesn't have a built-in `jsonb` helper imported here, so we store the guide as `text` in the schema definition and rely on the migration to declare the actual Postgres column type as `jsonb`. App code parses/stringifies. Alternatively, import `jsonb` from `drizzle-orm/pg-core` and use it directly — pick whichever you've used elsewhere; if there's no precedent, the `text` approach above is safer.

Then add the type export at the bottom (alongside the other `typeof X.$inferSelect` lines):

```typescript
export type MeetingPrepGuide = typeof meetingPrepGuides.$inferSelect;
export type NewMeetingPrepGuide = typeof meetingPrepGuides.$inferInsert;
```

- [ ] **Step 2.2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors related to the schema changes. If `text` import is missing somewhere, fix the import.

- [ ] **Step 2.3: Append migration statements**

Edit [app/api/admin/migrate/route.ts](../../../app/api/admin/migrate/route.ts).

Append to the `STATEMENTS` array (just before the closing `]`):

```typescript
  // Today's meetings prep (2026-04-27)
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS ics_uid TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS meetings_ics_uid_unique ON meetings (ics_uid) WHERE ics_uid IS NOT NULL`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS calendar_source TEXT`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS join_url TEXT`,
  `CREATE TABLE IF NOT EXISTS meeting_prep_guides (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
     guide JSONB NOT NULL,
     input_hash TEXT NOT NULL,
     model TEXT NOT NULL,
     generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS meeting_prep_guides_meeting_idx ON meeting_prep_guides (meeting_id, generated_at DESC)`,
```

The unique index is partial (`WHERE ics_uid IS NOT NULL`) so legacy rows with null `ics_uid` don't conflict.

- [ ] **Step 2.4: Run migration locally**

Make sure `SEED_TOKEN` is set in `.env.local`. Then with the dev server running:

```bash
curl -X POST "http://localhost:3000/api/admin/migrate?token=$SEED_TOKEN"
```

Expected: a JSON response listing the executed statements with `ok: true` for each new one.

Verify in your DB client:

```sql
\d meetings   -- should show the new 5 columns
\d meeting_prep_guides   -- table should exist
```

- [ ] **Step 2.5: Commit**

```bash
git add lib/schema.ts app/api/admin/migrate/route.ts
git commit -m "$(cat <<'EOF'
feat: schema for ICS-sourced meetings + prep guide history

Adds ics_uid/start_at/end_at/calendar_source/join_url columns to meetings
and a new meeting_prep_guides table for AI-generated prep brief versions.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Reusable `excludeFromTasks` server-side filter

**Files:**
- Create: `lib/exclusions.ts`

**What:** Refactor the existing client-side filter logic from [components/DashboardClient.tsx:138-156](../../../components/DashboardClient.tsx) into a reusable server-side library so the cron + APIs can apply the same rules.

- [ ] **Step 3.1: Write the lib**

Create `lib/exclusions.ts`:

```typescript
import { db } from '@/lib/db';
import { contacts } from '@/lib/schema';
import { eq } from 'drizzle-orm';

/**
 * Build the set of normalized assignee tokens to exclude.
 * Includes both the full lowercased name AND the first-name token, so an
 * action item with assignee = "Jon" matches a contact "Jon Maso" marked
 * excludeFromTasks. Mirrors the client-side rule in DashboardClient.
 */
export async function loadExcludedAssignees(): Promise<Set<string>> {
  const rows = await db
    .select({ fullName: contacts.fullName, exclude: contacts.excludeFromTasks })
    .from(contacts)
    .where(eq(contacts.excludeFromTasks, true));

  const set = new Set<string>();
  for (const row of rows) {
    if (!row.fullName) continue;
    const full = row.fullName.toLowerCase().trim();
    if (full) set.add(full);
    const first = full.split(/\s+/)[0];
    if (first) set.add(first);
  }
  return set;
}

/**
 * Returns true if the assignee string should be excluded from task-style
 * displays / prep contexts. Match logic: lowercase + trim, then check both the
 * full string and the first-name token.
 */
export function isExcludedAssignee(
  assignee: string | null | undefined,
  excluded: Set<string>,
): boolean {
  if (!assignee) return false;
  const a = assignee.toLowerCase().trim();
  if (excluded.has(a)) return true;
  const first = a.split(/\s+/)[0];
  return !!first && excluded.has(first);
}
```

- [ ] **Step 3.2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3.3: Commit**

```bash
git add lib/exclusions.ts
git commit -m "$(cat <<'EOF'
feat: server-side excludeFromTasks filter library

Mirrors the client-side rule in DashboardClient so the cron + new APIs apply
identical filtering. First-name + full-name token, case-insensitive.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: ICS fetch + parse library

**Files:**
- Create: `lib/ics.ts`

**What:** Fetch an ICS feed, parse it with `node-ical`, expand RRULEs to today's events only, and normalize each event to a typed shape.

- [ ] **Step 4.1: Write the lib**

Create `lib/ics.ts`:

```typescript
import ical from 'node-ical';

export interface ParsedIcsEvent {
  uid: string;
  summary: string;          // raw title
  cleanedSummary: string;   // prefixes stripped
  description: string;
  location: string;
  startAt: Date;
  endAt: Date;
  attendees: { email: string; name: string }[];
  joinUrl: string | null;
  platform: 'teams' | 'zoom' | 'meet' | null;
  calendarSource: string;   // identifies which feed (e.g. 'conversely')
}

const PREFIX_RE = /^\s*(FW:|Re:|Invitation:|Updated invitation:|Accepted:)\s*/i;

const JOIN_PATTERNS: { regex: RegExp; platform: 'teams' | 'zoom' | 'meet' }[] = [
  { regex: /https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"'<>)]+/i, platform: 'teams' },
  { regex: /https?:\/\/[^\s"'<>)]*zoom\.us\/[^\s"'<>)]+/i, platform: 'zoom' },
  { regex: /https?:\/\/meet\.google\.com\/[^\s"'<>)]+/i, platform: 'meet' },
];

export function cleanTitle(raw: string): string {
  let t = raw ?? '';
  // Strip up to 3 nested prefixes (e.g. "FW: Re: Invitation: foo")
  for (let i = 0; i < 3; i++) {
    const m = t.match(PREFIX_RE);
    if (!m) break;
    t = t.slice(m[0].length);
  }
  return t.trim();
}

export function extractJoinUrl(
  description: string,
  location: string,
): { url: string | null; platform: 'teams' | 'zoom' | 'meet' | null } {
  const haystack = `${location ?? ''}\n${description ?? ''}`;
  for (const { regex, platform } of JOIN_PATTERNS) {
    const m = haystack.match(regex);
    if (m) return { url: m[0], platform };
  }
  return { url: null, platform: null };
}

function isSameDayInTimezone(a: Date, b: Date, timeZone: string): boolean {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(a) === fmt.format(b);
}

/**
 * Fetch a single ICS feed and return all events whose start_at falls "today"
 * in the given timezone. Expands RRULEs by walking node-ical's recurrences map.
 *
 * On error (network, parse) returns an empty array and logs to console.
 */
export async function fetchIcsForDay(
  feedUrl: string,
  calendarSource: string,
  todayInTz: Date = new Date(),
  timeZone = 'America/New_York',
): Promise<ParsedIcsEvent[]> {
  let parsed: Record<string, ical.CalendarComponent>;
  try {
    parsed = await ical.async.fromURL(feedUrl);
  } catch (err) {
    console.error(`[ics] failed to fetch ${calendarSource}:`, err);
    return [];
  }

  const out: ParsedIcsEvent[] = [];

  for (const key of Object.keys(parsed)) {
    const ev = parsed[key];
    if (!ev || ev.type !== 'VEVENT') continue;

    // Build the list of concrete instances for "today":
    // - one-off events: just the event itself if it falls today
    // - recurring events: walk node-ical's recurrence rule for today
    const candidates: { start: Date; end: Date; uidSuffix: string }[] = [];

    if (ev.rrule) {
      const startOfDay = new Date(todayInTz);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(todayInTz);
      endOfDay.setHours(23, 59, 59, 999);
      const dates = ev.rrule.between(startOfDay, endOfDay, true);
      const durationMs = (ev.end as Date).getTime() - (ev.start as Date).getTime();
      for (const d of dates) {
        candidates.push({
          start: d,
          end: new Date(d.getTime() + durationMs),
          uidSuffix: `_${d.toISOString().split('T')[0]}`,
        });
      }
    } else if (ev.start && isSameDayInTimezone(ev.start as Date, todayInTz, timeZone)) {
      candidates.push({
        start: ev.start as Date,
        end: (ev.end as Date) ?? (ev.start as Date),
        uidSuffix: '',
      });
    }

    if (candidates.length === 0) continue;

    // Pull attendees off the parent event (recurring instances share attendees)
    const attendees: { email: string; name: string }[] = [];
    const att = (ev as unknown as { attendee?: unknown }).attendee;
    const list = Array.isArray(att) ? att : att ? [att] : [];
    for (const a of list) {
      if (typeof a === 'string') {
        const m = a.match(/mailto:([^>"\s]+)/i);
        if (m) attendees.push({ email: m[1], name: m[1] });
      } else if (a && typeof a === 'object') {
        const obj = a as { val?: string; params?: { CN?: string } };
        const email = obj.val?.replace(/^mailto:/i, '') ?? '';
        const name = obj.params?.CN ?? email;
        if (email) attendees.push({ email, name });
      }
    }

    const summaryRaw = (ev.summary ?? '') as string;
    const description = (ev.description ?? '') as string;
    const location = (ev.location ?? '') as string;
    const { url: joinUrl, platform } = extractJoinUrl(description, location);

    for (const inst of candidates) {
      out.push({
        uid: `${(ev.uid ?? key) as string}${inst.uidSuffix}`,
        summary: summaryRaw,
        cleanedSummary: cleanTitle(summaryRaw),
        description,
        location,
        startAt: inst.start,
        endAt: inst.end,
        attendees,
        joinUrl,
        platform,
        calendarSource,
      });
    }
  }

  return out;
}

export interface MultiFeedResult {
  events: ParsedIcsEvent[];
  perFeed: { source: string; count: number; ok: boolean }[];
}

export async function fetchAllFeedsForDay(
  feeds: { source: string; url: string | undefined }[],
  todayInTz: Date = new Date(),
  timeZone = 'America/New_York',
): Promise<MultiFeedResult> {
  const results = await Promise.all(
    feeds.map(async (f) => {
      if (!f.url) {
        console.warn(`[ics] feed not configured: ${f.source}`);
        return { source: f.source, events: [] as ParsedIcsEvent[], ok: false };
      }
      const events = await fetchIcsForDay(f.url, f.source, todayInTz, timeZone);
      return { source: f.source, events, ok: events.length >= 0 };
    })
  );
  return {
    events: results.flatMap((r) => r.events),
    perFeed: results.map((r) => ({ source: r.source, count: r.events.length, ok: r.ok })),
  };
}
```

- [ ] **Step 4.2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If `node-ical` types are missing, run `npm i --save-dev @types/node-ical` (the package may bundle its own types; check first with `ls node_modules/node-ical/*.d.ts`).

- [ ] **Step 4.3: Commit**

```bash
git add lib/ics.ts package.json package-lock.json
git commit -m "$(cat <<'EOF'
feat: ICS feed fetching and per-event normalization

Parses an ICS URL via node-ical, expands RRULEs to today's instances,
extracts attendees + join URL + platform, returns typed ParsedIcsEvent[].

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Cross-feed dedupe library

**Files:**
- Create: `lib/dedupe.ts`
- Create: `scripts/verify-dedupe.ts`

**What:** Dedupe a list of `ParsedIcsEvent`s by UID first, then by `(start_at within ±5 min, fuzzy title match)`. Calendar priority decides which copy wins for fuzzy duplicates.

- [ ] **Step 5.1: Write the lib**

Create `lib/dedupe.ts`:

```typescript
import type { ParsedIcsEvent } from '@/lib/ics';

export const CALENDAR_PRIORITY: Record<string, number> = {
  conversely: 0,
  'pine-lake': 1,
  cranbrook: 2,
};

const DEDUPE_WINDOW_MS = 5 * 60 * 1000; // ±5 minutes

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'with', 'for', 'in', 'on', 'at',
  'meeting', 'call', 'sync', 'huddle', 'discussion',
]);

function normalize(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

export function fuzzyTitleMatch(a: string, b: string): boolean {
  const aw = new Set(normalize(a));
  const bw = new Set(normalize(b));
  if (aw.size === 0 || bw.size === 0) return false;
  let shared = 0;
  for (const w of aw) if (bw.has(w)) shared++;
  // Both: at least 3 shared significant tokens, OR 80% of the smaller side overlaps
  const smaller = Math.min(aw.size, bw.size);
  return shared >= 3 || shared / smaller >= 0.8;
}

export function isLikelyDuplicate(a: ParsedIcsEvent, b: ParsedIcsEvent): boolean {
  if (a.uid === b.uid) return true;
  const dt = Math.abs(a.startAt.getTime() - b.startAt.getTime());
  if (dt > DEDUPE_WINDOW_MS) return false;
  return fuzzyTitleMatch(a.cleanedSummary, b.cleanedSummary);
}

/**
 * Reduce a list of cross-feed events to a deduped list. When two events match,
 * the one whose calendar_source has the lower priority number wins. Returns
 * the survivors in start_at-ascending order.
 */
export function dedupeEvents(events: ParsedIcsEvent[]): ParsedIcsEvent[] {
  const survivors: ParsedIcsEvent[] = [];

  for (const ev of events) {
    const dupIdx = survivors.findIndex((s) => isLikelyDuplicate(s, ev));
    if (dupIdx === -1) {
      survivors.push(ev);
      continue;
    }
    const incumbent = survivors[dupIdx];
    const incumbentPri = CALENDAR_PRIORITY[incumbent.calendarSource] ?? 99;
    const challengerPri = CALENDAR_PRIORITY[ev.calendarSource] ?? 99;
    if (challengerPri < incumbentPri) {
      survivors[dupIdx] = ev;
    }
    // else: drop the challenger
  }

  return survivors.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}
```

- [ ] **Step 5.2: Write a standalone verification script**

Create `scripts/verify-dedupe.ts`:

```typescript
import { dedupeEvents, fuzzyTitleMatch, isLikelyDuplicate } from '@/lib/dedupe';
import type { ParsedIcsEvent } from '@/lib/ics';

function ev(partial: Partial<ParsedIcsEvent>): ParsedIcsEvent {
  return {
    uid: 'u',
    summary: '',
    cleanedSummary: '',
    description: '',
    location: '',
    startAt: new Date('2026-04-27T15:00:00Z'),
    endAt: new Date('2026-04-27T15:30:00Z'),
    attendees: [],
    joinUrl: null,
    platform: null,
    calendarSource: 'conversely',
    ...partial,
  };
}

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
}

console.log('fuzzyTitleMatch:');
check('fw stripped vs original', fuzzyTitleMatch('True Choice Morning Huddle', 'True Choice Morning Huddle'));
check('partial token overlap > 80%', fuzzyTitleMatch('Operations Officer Interview Kirk', 'Operations Officer Interview Richard'));
check('empty title returns false', !fuzzyTitleMatch('', 'foo'));
check('different meetings dont match', !fuzzyTitleMatch('Pipeline review', 'Engineering retro'));

console.log('isLikelyDuplicate:');
check('same UID', isLikelyDuplicate(ev({ uid: 'a' }), ev({ uid: 'a' })));
check('different UID + same time + fuzzy title', isLikelyDuplicate(
  ev({ uid: 'a', cleanedSummary: 'True Choice Morning Huddle' }),
  ev({ uid: 'b', cleanedSummary: 'True Choice Morning Huddle' }),
));
check('different UID + 30 min apart not dup', !isLikelyDuplicate(
  ev({ uid: 'a', startAt: new Date('2026-04-27T15:00:00Z') }),
  ev({ uid: 'b', startAt: new Date('2026-04-27T15:30:00Z') }),
));

console.log('dedupeEvents priority:');
const result = dedupeEvents([
  ev({ uid: 'cb', cleanedSummary: 'True Choice Morning Huddle', calendarSource: 'cranbrook' }),
  ev({ uid: 'cv', cleanedSummary: 'True Choice Morning Huddle', calendarSource: 'conversely' }),
]);
check('only one survivor', result.length === 1);
check('conversely wins over cranbrook', result[0]?.calendarSource === 'conversely');

console.log('dedupeEvents ordering:');
const ordered = dedupeEvents([
  ev({ uid: 'late', startAt: new Date('2026-04-27T17:00:00Z') }),
  ev({ uid: 'early', startAt: new Date('2026-04-27T09:00:00Z') }),
]);
check('sorted ascending by startAt', ordered[0].uid === 'early');

console.log(failures === 0 ? '\nALL OK' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 5.3: Run the verification**

Run: `npx tsx scripts/verify-dedupe.ts`
Expected: all checks ok, exit 0.

If any FAIL — fix the lib (not the script) and re-run.

- [ ] **Step 5.4: Commit**

```bash
git add lib/dedupe.ts scripts/verify-dedupe.ts
git commit -m "$(cat <<'EOF'
feat: cross-feed event dedupe

UID-first match, then ±5min + fuzzy title fallback. Calendar priority
conversely > pine-lake > cranbrook decides which copy wins.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Meeting classifier

**Files:**
- Create: `lib/classify-meeting.ts`
- Create: `scripts/verify-classify.ts`

**What:** Pure function that maps a meeting's title + attendees + companyId + prior-meeting presence to one of `recurring | interview | one_on_one | external_meeting | general`.

- [ ] **Step 6.1: Write the lib**

Create `lib/classify-meeting.ts`:

```typescript
export type MeetingType = 'recurring' | 'interview' | 'one_on_one' | 'external_meeting' | 'general';

export interface ClassifierInput {
  title: string;             // cleaned (prefixes stripped)
  attendees: { email: string; name: string }[];
  companyId: string | null;
  hasPriorOccurrence: boolean;
}

export function classifyMeeting(input: ClassifierInput): MeetingType {
  const lower = input.title.toLowerCase();

  if (/\binterview\b/.test(lower)) return 'interview';

  if (input.hasPriorOccurrence) return 'recurring';

  // 1:1 detection: explicit "1:1", or " / " between two names, or exactly 2 attendees
  if (/\b1\s*[:x/]\s*1\b/.test(lower) || /\s\/\s/.test(input.title)) return 'one_on_one';
  if (input.attendees.length === 2) return 'one_on_one';

  if (input.companyId) return 'external_meeting';

  return 'general';
}
```

- [ ] **Step 6.2: Write a verification script**

Create `scripts/verify-classify.ts`:

```typescript
import { classifyMeeting } from '@/lib/classify-meeting';

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
}

check('interview title', classifyMeeting({
  title: 'Kirk Byrens — Operations Officer 2nd Interview',
  attendees: [{ email: 'kirk@example.com', name: 'Kirk' }, { email: 'peter@example.com', name: 'Peter' }],
  companyId: null,
  hasPriorOccurrence: false,
}) === 'interview');

check('recurring (has prior)', classifyMeeting({
  title: 'Daily Pipeline Updates',
  attendees: [],
  companyId: null,
  hasPriorOccurrence: true,
}) === 'recurring');

check('1:1 by colon notation', classifyMeeting({
  title: 'Peter 1:1 with Jon',
  attendees: [],
  companyId: null,
  hasPriorOccurrence: false,
}) === 'one_on_one');

check('1:1 by slash and 2 attendees', classifyMeeting({
  title: 'Peter / Jon',
  attendees: [{ email: 'p@x', name: 'P' }, { email: 'j@x', name: 'J' }],
  companyId: null,
  hasPriorOccurrence: false,
}) === 'one_on_one');

check('external_meeting (companyId set, no other signal)', classifyMeeting({
  title: 'TCC Marketing/Lead Gen Discussion',
  attendees: [],
  companyId: 'abc-123',
  hasPriorOccurrence: false,
}) === 'external_meeting');

check('general fallback', classifyMeeting({
  title: 'Random thing',
  attendees: [],
  companyId: null,
  hasPriorOccurrence: false,
}) === 'general');

console.log(failures === 0 ? '\nALL OK' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 6.3: Run verification**

Run: `npx tsx scripts/verify-classify.ts`
Expected: all checks ok.

- [ ] **Step 6.4: Commit**

```bash
git add lib/classify-meeting.ts scripts/verify-classify.ts
git commit -m "$(cat <<'EOF'
feat: meeting classifier (interview/recurring/1:1/external/general)

Pure rule-based dispatcher. Drives type-specific prep prompt selection.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Per-type prep prompts

**Files:**
- Create: `lib/prep-prompts.ts`

**What:** Per-meeting-type system prompts for GPT-4o, all returning the same JSON shape so the UI is uniform.

- [ ] **Step 7.1: Write the lib**

Create `lib/prep-prompts.ts`:

```typescript
import type { MeetingType } from '@/lib/classify-meeting';

const SHARED_OUTPUT_CONTRACT = `
Respond ONLY with valid JSON — no markdown fences, no explanation. Use exactly
these top-level keys: "background", "updates_to_request", "your_prep",
"suggested_agenda", "desired_outcomes", "watch_out_for".

- "background": array of 3-5 strings. Narrative bullets summarizing what this
  meeting is about and where things stand. Reference specific people, deals,
  or issues by name. No generic filler.

- "updates_to_request": array of objects { "person": string, "item": string,
  "question_to_ask": string }. Concrete updates Peter should seek from
  external owners. Each entry maps to an open external action item. If no
  external action items, return [].

- "your_prep": array of strings. Things Peter should be ready to speak to or
  report on (from his own open action items and the prior meeting's desired
  outcomes).

- "suggested_agenda": array of objects { "topic": string,
  "talking_points": string[], "time_estimate_min": number }. Sum of
  time_estimate_min should roughly match a typical meeting length.

- "desired_outcomes": array of strings. Specific. "Agree on X" or "Confirm Y
  by Z" — not "discuss progress."

- "watch_out_for": array of strings. Risks, tensions, potential surprises,
  topics that may derail.

Be concrete and specific. Use names. Reference actual tasks. Do not pad. If
a key has no content, return an empty array — never invent content.`.trim();

const RECURRING = `You are a senior executive assistant preparing Peter Schmitt for the next
occurrence of a recurring meeting. You will be given the prior occurrence's
executive summary, prep items generated after the last meeting, and open
action items tied to this meeting series. Anchor "background" in what
happened last time and the deltas since. Make "updates_to_request" concrete
references to specific open action items and their owners.

${SHARED_OUTPUT_CONTRACT}`;

const INTERVIEW = `You are a senior executive assistant preparing Peter Schmitt for an
interview. You will be given the candidate's contact record (role, notes,
prior round notes if any) and the role context. For an interview:

- "background" should describe the candidate, their relevant experience, and
  what stage of the process this is.
- "updates_to_request" should usually be [] unless there is a specific
  follow-up from a prior round.
- "your_prep" should be probing questions tailored to the candidate's
  background and the role.
- "suggested_agenda" should be a 30-min interview structure (intro, deeper
  dive, candidate questions, wrap).
- "watch_out_for" should call out red flags or unresolved concerns from
  prior rounds.

${SHARED_OUTPUT_CONTRACT}`;

const ONE_ON_ONE = `You are a senior executive assistant preparing Peter Schmitt for a 1:1 with
a specific person. You will be given prior 1:1 notes (if any) and open action
items in both directions (Peter owes them; they owe Peter). Lean heavy on
"updates_to_request" (asks for them) and "your_prep" (commitments to follow
up on). Keep "suggested_agenda" tight — 30 minutes max.

${SHARED_OUTPUT_CONTRACT}`;

const EXTERNAL_MEETING = `You are a senior executive assistant preparing Peter Schmitt for a meeting
with an external company. You will be given the company record, prior
meetings with this company, open opportunities, and risks. Anchor
"background" in the company relationship and current open threads.
"updates_to_request" should target open external action items.

${SHARED_OUTPUT_CONTRACT}`;

const GENERAL = `You are a senior executive assistant preparing Peter Schmitt for an
upcoming meeting. You will be given attendees and any prior meeting that
shares this title. Build the best prep brief you can from what you have.
If context is thin, say so concisely in "background" rather than padding.

${SHARED_OUTPUT_CONTRACT}`;

export function systemPromptFor(type: MeetingType): string {
  switch (type) {
    case 'recurring':         return RECURRING;
    case 'interview':         return INTERVIEW;
    case 'one_on_one':        return ONE_ON_ONE;
    case 'external_meeting':  return EXTERNAL_MEETING;
    case 'general':           return GENERAL;
  }
}
```

- [ ] **Step 7.2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7.3: Commit**

```bash
git add lib/prep-prompts.ts
git commit -m "$(cat <<'EOF'
feat: per-type prep guide system prompts

Shared JSON output contract, type-specific framing for recurring / interview
/ 1:1 / external / general meetings.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Context gathering per meeting type

**Files:**
- Create: `lib/prep-context.ts`

**What:** For a given meeting + type, fetch all the DB data the prompt needs, with `excludeFromTasks` already applied to action items. Returns a structured `PrepContext` object that the orchestrator turns into a user-message string.

- [ ] **Step 8.1: Write the lib**

Create `lib/prep-context.ts`:

```typescript
import { db } from '@/lib/db';
import {
  meetings, meetingPrepItems, meetingAttendees, actionItems, contacts, companies,
  decisions, risks, opportunities,
} from '@/lib/schema';
import { eq, and, ne, desc, sql } from 'drizzle-orm';
import { loadExcludedAssignees, isExcludedAssignee } from '@/lib/exclusions';
import type { MeetingType } from '@/lib/classify-meeting';

export interface PrepContext {
  type: MeetingType;
  meeting: {
    id: string;
    title: string;
    cleanedTitle: string;
    startAt: Date | null;
    endAt: Date | null;
  };
  attendees: { name: string; email: string | null; roleAtMeeting: string | null }[];
  attendeeContacts: { fullName: string; email: string | null; role: string | null; notes: string | null; kind: string | null }[];
  priorOccurrence: {
    id: string;
    title: string;
    meetingDate: Date | null;
    executiveSummary: string | null;
    prepItems: { kind: string; text: string }[];
    decisions: { decision: string; owner: string | null }[];
    risks: { risk: string; severity: string | null }[];
    opportunities: { opportunity: string; nextStep: string | null }[];
  } | null;
  openActions: {
    peter: { title: string; assignee: string | null; dueDate: string | null; urgencyTier: string | null }[];
    external: { title: string; assignee: string | null; dueDate: string | null; urgencyTier: string | null }[];
  };
  company: { name: string; type: string | null; notes: string | null } | null;
  priorMeetings: { id: string; title: string; meetingDate: Date | null; executiveSummary: string | null }[];
}

/**
 * Find the most recent prior occurrence of this meeting (recurring match).
 * Strategy: same companyId AND fuzzy title match. Returns the latest by
 * meetingDate/startAt. Excludes the meeting itself.
 */
async function findPriorOccurrence(
  meetingId: string,
  cleanedTitle: string,
  companyId: string | null,
): Promise<{ id: string; title: string; meetingDate: Date | null; executiveSummary: string | null } | null> {
  // Pull a candidate set scoped by company (if any) and ordered by date desc.
  // Then filter in JS by fuzzy title match (importing fuzzyTitleMatch).
  const { fuzzyTitleMatch } = await import('@/lib/dedupe');

  const where = companyId
    ? and(eq(meetings.companyId, companyId), ne(meetings.id, meetingId))
    : ne(meetings.id, meetingId);

  const candidates = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      meetingDate: meetings.meetingDate,
      startAt: meetings.startAt,
      executiveSummary: meetings.executiveSummary,
    })
    .from(meetings)
    .where(where)
    .orderBy(desc(sql`coalesce(${meetings.startAt}, ${meetings.meetingDate})`))
    .limit(50);

  for (const c of candidates) {
    if (fuzzyTitleMatch(c.title, cleanedTitle)) {
      return {
        id: c.id,
        title: c.title,
        meetingDate: (c.startAt as Date | null) ?? (c.meetingDate as Date | null) ?? null,
        executiveSummary: c.executiveSummary ?? null,
      };
    }
  }
  return null;
}

export async function gatherPrepContext(
  meetingId: string,
  type: MeetingType,
): Promise<PrepContext> {
  const [m] = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      startAt: meetings.startAt,
      endAt: meetings.endAt,
      meetingDate: meetings.meetingDate,
      companyId: meetings.companyId,
    })
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);

  if (!m) throw new Error(`gatherPrepContext: meeting ${meetingId} not found`);

  const cleanedTitle = m.title.replace(/^\s*(FW:|Re:|Invitation:)\s*/i, '').trim();

  // Attendees
  const attRows = await db
    .select({
      name: meetingAttendees.name,
      email: meetingAttendees.email,
      roleAtMeeting: meetingAttendees.roleAtMeeting,
      contactId: meetingAttendees.contactId,
    })
    .from(meetingAttendees)
    .where(eq(meetingAttendees.meetingId, meetingId));

  const attendees = attRows.map((a) => ({
    name: a.name,
    email: a.email,
    roleAtMeeting: a.roleAtMeeting,
  }));

  // Attendee contact records (for richer prep — esp. interviews)
  const contactIds = attRows.map((a) => a.contactId).filter((x): x is string => !!x);
  const attendeeContacts = contactIds.length
    ? await db
        .select({
          fullName: contacts.fullName,
          email: contacts.email,
          role: contacts.role,
          notes: contacts.notes,
          kind: contacts.kind,
        })
        .from(contacts)
        .where(sql`${contacts.id} = ANY(${contactIds})`)
    : [];

  // Prior occurrence
  const prior = await findPriorOccurrence(meetingId, cleanedTitle, m.companyId);
  let priorOccurrence: PrepContext['priorOccurrence'] = null;
  if (prior) {
    const [priorPrep, priorDecisions, priorRisks, priorOpps] = await Promise.all([
      db.select({ kind: meetingPrepItems.kind, text: meetingPrepItems.text })
        .from(meetingPrepItems)
        .where(eq(meetingPrepItems.meetingId, prior.id))
        .orderBy(meetingPrepItems.position),
      db.select({ decision: decisions.decision, owner: decisions.owner })
        .from(decisions)
        .where(eq(decisions.meetingId, prior.id)),
      db.select({ risk: risks.risk, severity: risks.severity })
        .from(risks)
        .where(eq(risks.meetingId, prior.id)),
      db.select({ opportunity: opportunities.opportunity, nextStep: opportunities.nextStep })
        .from(opportunities)
        .where(eq(opportunities.meetingId, prior.id)),
    ]);
    priorOccurrence = {
      id: prior.id,
      title: prior.title,
      meetingDate: prior.meetingDate,
      executiveSummary: prior.executiveSummary,
      prepItems: priorPrep,
      decisions: priorDecisions,
      risks: priorRisks,
      opportunities: priorOpps,
    };
  }

  // Open actions (this meeting OR any prior occurrence)
  const meetingIdsForActions = prior ? [meetingId, prior.id] : [meetingId];
  const allActions = await db
    .select({
      title: actionItems.title,
      assignee: actionItems.assignee,
      dueDate: actionItems.dueDate,
      urgencyTier: actionItems.urgencyTier,
      ownerSide: actionItems.ownerSide,
      status: actionItems.status,
    })
    .from(actionItems)
    .where(sql`${actionItems.meetingId} = ANY(${meetingIdsForActions})`);

  const excluded = await loadExcludedAssignees();
  const openOnly = allActions.filter(
    (a) => a.status !== 'done' && a.status !== 'cancelled' && !isExcludedAssignee(a.assignee, excluded),
  );

  const openActions = {
    peter: openOnly.filter((a) => a.ownerSide === 'peter').map(({ title, assignee, dueDate, urgencyTier }) => ({ title, assignee, dueDate, urgencyTier })),
    external: openOnly.filter((a) => a.ownerSide === 'external').map(({ title, assignee, dueDate, urgencyTier }) => ({ title, assignee, dueDate, urgencyTier })),
  };

  // Company
  let company: PrepContext['company'] = null;
  if (m.companyId) {
    const [c] = await db
      .select({ name: companies.name, type: companies.type, notes: companies.notes })
      .from(companies)
      .where(eq(companies.id, m.companyId))
      .limit(1);
    if (c) company = c;
  }

  // Prior meetings with the same company (for external_meeting type, gives broader history)
  const priorMeetings = m.companyId
    ? await db
        .select({
          id: meetings.id,
          title: meetings.title,
          meetingDate: meetings.meetingDate,
          executiveSummary: meetings.executiveSummary,
        })
        .from(meetings)
        .where(and(eq(meetings.companyId, m.companyId), ne(meetings.id, meetingId)))
        .orderBy(desc(sql`coalesce(${meetings.startAt}, ${meetings.meetingDate})`))
        .limit(5)
    : [];

  return {
    type,
    meeting: {
      id: m.id,
      title: m.title,
      cleanedTitle,
      startAt: m.startAt as Date | null,
      endAt: m.endAt as Date | null,
    },
    attendees,
    attendeeContacts,
    priorOccurrence,
    openActions,
    company,
    priorMeetings,
  };
}

/**
 * Render the gathered context into a single user-message string for GPT-4o.
 * Type-aware (omits irrelevant sections).
 */
export function renderContext(ctx: PrepContext): string {
  const lines: string[] = [];
  lines.push(`MEETING: ${ctx.meeting.title}`);
  lines.push(`TYPE: ${ctx.type}`);
  if (ctx.meeting.startAt) lines.push(`TIME: ${ctx.meeting.startAt.toISOString()}`);

  lines.push('');
  lines.push('ATTENDEES:');
  if (ctx.attendees.length === 0) lines.push('  (not specified)');
  for (const a of ctx.attendees) {
    lines.push(`  - ${a.name}${a.email ? ` <${a.email}>` : ''}${a.roleAtMeeting ? ` (${a.roleAtMeeting})` : ''}`);
  }

  if (ctx.type === 'interview' && ctx.attendeeContacts.length > 0) {
    lines.push('');
    lines.push('CANDIDATE / ATTENDEE NOTES:');
    for (const c of ctx.attendeeContacts) {
      lines.push(`  - ${c.fullName}${c.role ? ` — ${c.role}` : ''}${c.kind ? ` [${c.kind}]` : ''}`);
      if (c.notes) lines.push(`    notes: ${c.notes}`);
    }
  }

  if (ctx.priorOccurrence) {
    lines.push('');
    lines.push('PRIOR OCCURRENCE:');
    lines.push(`  Title: ${ctx.priorOccurrence.title}`);
    if (ctx.priorOccurrence.meetingDate) lines.push(`  Date: ${ctx.priorOccurrence.meetingDate.toISOString().split('T')[0]}`);
    if (ctx.priorOccurrence.executiveSummary) {
      lines.push('  Executive summary:');
      lines.push('    ' + ctx.priorOccurrence.executiveSummary.replace(/\n/g, '\n    '));
    }
    if (ctx.priorOccurrence.prepItems.length > 0) {
      lines.push('  Prep items from last meeting:');
      const grouped: Record<string, string[]> = {};
      for (const p of ctx.priorOccurrence.prepItems) {
        (grouped[p.kind] = grouped[p.kind] || []).push(p.text);
      }
      for (const [kind, texts] of Object.entries(grouped)) {
        lines.push(`    ${kind}: ${texts.join(' | ')}`);
      }
    }
    if (ctx.priorOccurrence.decisions.length > 0) {
      lines.push('  Prior decisions:');
      for (const d of ctx.priorOccurrence.decisions) lines.push(`    - ${d.decision}${d.owner ? ` (${d.owner})` : ''}`);
    }
    if (ctx.priorOccurrence.risks.length > 0) {
      lines.push('  Prior risks:');
      for (const r of ctx.priorOccurrence.risks) lines.push(`    - [${r.severity ?? 'medium'}] ${r.risk}`);
    }
    if (ctx.priorOccurrence.opportunities.length > 0) {
      lines.push('  Prior opportunities:');
      for (const o of ctx.priorOccurrence.opportunities) lines.push(`    - ${o.opportunity}${o.nextStep ? ` (next: ${o.nextStep})` : ''}`);
    }
  }

  lines.push('');
  lines.push('PETER\'S OPEN ACTION ITEMS (be ready to report on these):');
  if (ctx.openActions.peter.length === 0) lines.push('  (none)');
  for (const a of ctx.openActions.peter) {
    lines.push(`  - ${a.title} (due: ${a.dueDate ?? 'no date'}, urgency: ${a.urgencyTier ?? 'none'})`);
  }

  lines.push('');
  lines.push('EXTERNAL OPEN ACTION ITEMS (Peter should ask for updates on these):');
  if (ctx.openActions.external.length === 0) lines.push('  (none)');
  for (const a of ctx.openActions.external) {
    lines.push(`  - [${a.assignee ?? 'Unknown'}] ${a.title} (due: ${a.dueDate ?? 'no date'}, urgency: ${a.urgencyTier ?? 'none'})`);
  }

  if (ctx.company) {
    lines.push('');
    lines.push(`COMPANY: ${ctx.company.name}${ctx.company.type ? ` (${ctx.company.type})` : ''}`);
    if (ctx.company.notes) lines.push(`  notes: ${ctx.company.notes}`);
  }

  if (ctx.type === 'external_meeting' && ctx.priorMeetings.length > 0) {
    lines.push('');
    lines.push('PRIOR MEETINGS WITH THIS COMPANY:');
    for (const pm of ctx.priorMeetings) {
      const dateStr = pm.meetingDate ? pm.meetingDate.toISOString().split('T')[0] : '?';
      lines.push(`  - [${dateStr}] ${pm.title}`);
      if (pm.executiveSummary) lines.push(`    ${pm.executiveSummary.split('\n')[0]}`);
    }
  }

  return lines.join('\n');
}
```

- [ ] **Step 8.2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8.3: Commit**

```bash
git add lib/prep-context.ts
git commit -m "$(cat <<'EOF'
feat: type-aware prep context gathering

Pulls attendees, prior occurrence (decisions/risks/opportunities), open
actions filtered by excludeFromTasks, company info. Renders to a
user-message string for GPT-4o.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Stable input hashing

**Files:**
- Create: `lib/prep-hash.ts`
- Create: `scripts/verify-prep-hash.ts`

**What:** Build a SHA-256 hash from the prep context that's stable across runs when nothing meaningful changed. Used to skip redundant OpenAI calls on the 9 AM and 1 PM crons.

- [ ] **Step 9.1: Write the lib**

Create `lib/prep-hash.ts`:

```typescript
import { createHash } from 'crypto';
import type { PrepContext } from '@/lib/prep-context';

/**
 * Build a canonical-form string from a PrepContext such that identical
 * inputs always produce the identical string. Sorts arrays whose order
 * doesn't carry meaning (attendees, action items).
 */
function canonicalize(ctx: PrepContext): string {
  const sortedAttendees = [...ctx.attendees].sort((a, b) =>
    (a.email ?? a.name).localeCompare(b.email ?? b.name)
  );

  const sortedActions = (arr: typeof ctx.openActions.peter) =>
    [...arr].sort((a, b) => a.title.localeCompare(b.title));

  const obj = {
    type: ctx.type,
    meeting: {
      id: ctx.meeting.id,
      title: ctx.meeting.cleanedTitle,
      startAt: ctx.meeting.startAt?.toISOString() ?? null,
    },
    attendees: sortedAttendees.map((a) => ({ email: a.email, name: a.name })),
    priorId: ctx.priorOccurrence?.id ?? null,
    priorSummary: ctx.priorOccurrence?.executiveSummary ?? null,
    actions: {
      peter: sortedActions(ctx.openActions.peter),
      external: sortedActions(ctx.openActions.external),
    },
  };
  return JSON.stringify(obj);
}

export function hashPrepContext(ctx: PrepContext): string {
  return createHash('sha256').update(canonicalize(ctx)).digest('hex');
}
```

- [ ] **Step 9.2: Write a verification script**

Create `scripts/verify-prep-hash.ts`:

```typescript
import { hashPrepContext } from '@/lib/prep-hash';
import type { PrepContext } from '@/lib/prep-context';

function ctx(overrides: Partial<PrepContext> = {}): PrepContext {
  return {
    type: 'recurring',
    meeting: { id: 'm1', title: 'Daily Sync', cleanedTitle: 'Daily Sync', startAt: new Date('2026-04-27T15:00:00Z'), endAt: null },
    attendees: [{ name: 'Alice', email: 'alice@x.com', roleAtMeeting: null }, { name: 'Bob', email: 'bob@x.com', roleAtMeeting: null }],
    attendeeContacts: [],
    priorOccurrence: null,
    openActions: { peter: [], external: [] },
    company: null,
    priorMeetings: [],
    ...overrides,
  };
}

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
}

const a = ctx();
const b = ctx();
check('identical contexts → identical hash', hashPrepContext(a) === hashPrepContext(b));

const reorderedAttendees = ctx({
  attendees: [{ name: 'Bob', email: 'bob@x.com', roleAtMeeting: null }, { name: 'Alice', email: 'alice@x.com', roleAtMeeting: null }],
});
check('reordered attendees → identical hash', hashPrepContext(a) === hashPrepContext(reorderedAttendees));

const newAttendee = ctx({
  attendees: [...a.attendees, { name: 'Carol', email: 'carol@x.com', roleAtMeeting: null }],
});
check('added attendee → different hash', hashPrepContext(a) !== hashPrepContext(newAttendee));

const newAction = ctx({
  openActions: { peter: [{ title: 'follow up', assignee: 'peter', dueDate: null, urgencyTier: 'none' }], external: [] },
});
check('added action item → different hash', hashPrepContext(a) !== hashPrepContext(newAction));

console.log(failures === 0 ? '\nALL OK' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 9.3: Run verification**

Run: `npx tsx scripts/verify-prep-hash.ts`
Expected: all checks ok.

- [ ] **Step 9.4: Commit**

```bash
git add lib/prep-hash.ts scripts/verify-prep-hash.ts
git commit -m "$(cat <<'EOF'
feat: stable prep-context hashing for cron-cache skip

Canonicalizes the inputs (sorts attendees + actions) so identical days hash
identically and we don't burn OpenAI calls on no-op refreshes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Prep generation orchestrator

**Files:**
- Create: `lib/generate-prep.ts`

**What:** Tie it all together. Given a meeting ID, classify → gather context → hash → cache-check (unless `force`) → call OpenAI → insert a `meeting_prep_guides` row.

- [ ] **Step 10.1: Write the orchestrator**

Create `lib/generate-prep.ts`:

```typescript
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
```

- [ ] **Step 10.2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 10.3: Commit**

```bash
git add lib/generate-prep.ts
git commit -m "$(cat <<'EOF'
feat: prep guide orchestrator with input-hash cache skip

Wires classify → context → hash → OpenAI → meeting_prep_guides insert.
Skips OpenAI call when input hash matches latest cached row < 12h old,
unless force=true (manual regenerate).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Cron endpoint — `POST /api/cron/sync-calendar`

**Files:**
- Create: `app/api/cron/sync-calendar/route.ts`

**What:** The 3×/day endpoint. Fetches all 3 ICS feeds, dedupes, upserts `meetings` rows, links attendees to contacts (creating stubs as needed), then runs `generatePrep` for each.

- [ ] **Step 11.1: Write the route**

Create `app/api/cron/sync-calendar/route.ts`:

```typescript
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
```

- [ ] **Step 11.2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 11.3: Manual smoke test**

With dev server running and ICS feeds + `CRON_SECRET` + `OPENAI_API_KEY` configured:

```bash
curl "http://localhost:3000/api/cron/sync-calendar?token=$CRON_SECRET" | jq .
```

Expected: a JSON body like

```json
{
  "ok": true,
  "feeds": [
    { "source": "conversely", "count": 3, "ok": true },
    { "source": "pine-lake",  "count": 0, "ok": true },
    { "source": "cranbrook",  "count": 5, "ok": true }
  ],
  "eventsFetched": 8,
  "eventsAfterDedupe": 7,
  "inserted": 7,
  "updated": 0,
  "prep": { "generated": 7, "skippedCache": 0, "errored": 0 }
}
```

Verify in the DB: `SELECT id, title, ics_uid, start_at, calendar_source FROM meetings WHERE ics_uid IS NOT NULL ORDER BY start_at;`

Verify prep guides: `SELECT meeting_id, model, generated_at FROM meeting_prep_guides ORDER BY generated_at DESC LIMIT 10;`

Re-run the same curl. Expected: all `prep.skippedCache` (or close) — input hashes match.

- [ ] **Step 11.4: Commit**

```bash
git add app/api/cron/sync-calendar/route.ts
git commit -m "$(cat <<'EOF'
feat: cron endpoint — fetch ICS feeds, dedupe, upsert, generate prep

Authorized by CRON_SECRET. Idempotent: re-running with no calendar changes
hits the input-hash cache and skips OpenAI calls.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Read endpoint — `GET /api/meetings/today`

**Files:**
- Create: `app/api/meetings/today/route.ts`

**What:** DB-only read. Returns today's meetings (in EST) joined with their latest prep guide, attendees, and open action items (filtered).

- [ ] **Step 12.1: Write the route**

Create `app/api/meetings/today/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  meetings, meetingAttendees, actionItems, companies, meetingPrepGuides, contacts,
} from '@/lib/schema';
import { eq, and, ne, sql, desc } from 'drizzle-orm';
import { loadExcludedAssignees, isExcludedAssignee } from '@/lib/exclusions';

export async function GET(): Promise<NextResponse> {
  const todayEst = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  // Today's meetings: any row whose start_at falls today in ET.
  const rows = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      startAt: meetings.startAt,
      endAt: meetings.endAt,
      calendarSource: meetings.calendarSource,
      joinUrl: meetings.joinUrl,
      platform: meetings.platform,
      executiveSummary: meetings.executiveSummary,
      companyId: meetings.companyId,
      companyName: companies.name,
    })
    .from(meetings)
    .leftJoin(companies, eq(meetings.companyId, companies.id))
    .where(sql`(${meetings.startAt} AT TIME ZONE 'America/New_York')::date = ${todayEst}::date`)
    .orderBy(meetings.startAt);

  const excluded = await loadExcludedAssignees();

  const enriched = await Promise.all(
    rows.map(async (m) => {
      const [attendees, actions, latestGuide] = await Promise.all([
        db
          .select({
            name: meetingAttendees.name,
            email: meetingAttendees.email,
            roleAtMeeting: meetingAttendees.roleAtMeeting,
            contactId: meetingAttendees.contactId,
            contactKind: contacts.kind,
          })
          .from(meetingAttendees)
          .leftJoin(contacts, eq(meetingAttendees.contactId, contacts.id))
          .where(eq(meetingAttendees.meetingId, m.id)),
        db
          .select({
            id: actionItems.id,
            title: actionItems.title,
            assignee: actionItems.assignee,
            ownerSide: actionItems.ownerSide,
            dueDate: actionItems.dueDate,
            status: actionItems.status,
            urgencyTier: actionItems.urgencyTier,
          })
          .from(actionItems)
          .where(and(
            eq(actionItems.meetingId, m.id),
            ne(actionItems.status, 'done'),
            ne(actionItems.status, 'cancelled'),
          )),
        db
          .select({
            guide: meetingPrepGuides.guide,
            generatedAt: meetingPrepGuides.generatedAt,
            model: meetingPrepGuides.model,
          })
          .from(meetingPrepGuides)
          .where(eq(meetingPrepGuides.meetingId, m.id))
          .orderBy(desc(meetingPrepGuides.generatedAt))
          .limit(1),
      ]);

      const filteredActions = actions.filter((a) => !isExcludedAssignee(a.assignee, excluded));
      const externalActions = filteredActions.filter((a) => a.ownerSide === 'external');
      const peterActions = filteredActions.filter((a) => a.ownerSide === 'peter');

      let prepGuide: unknown = null;
      let prepGuideGeneratedAt: string | null = null;
      let prepGuideModel: string | null = null;
      if (latestGuide.length > 0) {
        try {
          prepGuide = JSON.parse(latestGuide[0].guide as unknown as string);
        } catch {
          prepGuide = null;
        }
        prepGuideGeneratedAt = latestGuide[0].generatedAt
          ? new Date(latestGuide[0].generatedAt).toISOString()
          : null;
        prepGuideModel = latestGuide[0].model;
      }

      return {
        id: m.id,
        title: m.title,
        startAt: m.startAt ? new Date(m.startAt).toISOString() : null,
        endAt: m.endAt ? new Date(m.endAt).toISOString() : null,
        calendarSource: m.calendarSource,
        joinUrl: m.joinUrl,
        platform: m.platform,
        companyName: m.companyName,
        attendees,
        openActions: filteredActions,
        externalActions,
        peterActions,
        prepGuide,
        prepGuideGeneratedAt,
        prepGuideModel,
      };
    })
  );

  return NextResponse.json(enriched);
}
```

- [ ] **Step 12.2: Type-check + smoke test**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
curl http://localhost:3000/api/meetings/today | jq .
```
Expected: an array of meeting objects, each containing a `prepGuide` (the parsed JSON from GPT-4o), attendees, action items.

- [ ] **Step 12.3: Commit**

```bash
git add app/api/meetings/today/route.ts
git commit -m "$(cat <<'EOF'
feat: GET /api/meetings/today — DB-only enriched read

Returns today's meetings (ET) with latest prep guide, attendees, and open
action items filtered by excludeFromTasks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Manual regenerate endpoint — `POST /api/meetings/[id]/regenerate-prep`

**Files:**
- Create: `app/api/meetings/[id]/regenerate-prep/route.ts`

**What:** Force a fresh prep guide for a meeting, ignoring the input-hash cache. Returns the new guide.

- [ ] **Step 13.1: Write the route**

Create `app/api/meetings/[id]/regenerate-prep/route.ts`:

```typescript
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

  let prepGuide: unknown = null;
  if (latest) {
    try { prepGuide = JSON.parse(latest.guide as unknown as string); } catch { prepGuide = null; }
  }

  return NextResponse.json({
    prepGuide,
    prepGuideGeneratedAt: latest?.generatedAt ? new Date(latest.generatedAt).toISOString() : null,
    prepGuideModel: latest?.model ?? null,
  });
}
```

- [ ] **Step 13.2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 13.3: Smoke test**

Pick a known meeting ID from `/api/meetings/today`, then:

```bash
curl -X POST "http://localhost:3000/api/meetings/<id>/regenerate-prep" | jq .
```

Expected: a JSON object with `prepGuide`, `prepGuideGeneratedAt`, `prepGuideModel`. The `generatedAt` should be newer than what `today` previously returned. Verify a new row appears in `meeting_prep_guides`.

- [ ] **Step 13.4: Commit**

```bash
git add "app/api/meetings/[id]/regenerate-prep/route.ts"
git commit -m "$(cat <<'EOF'
feat: POST /api/meetings/[id]/regenerate-prep — manual force regen

Ignores the cron's input-hash cache. Returns the fresh guide.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: `<TodayMeetingsPanel>` component

**Files:**
- Create: `components/TodayMeetingsPanel.tsx`

**What:** The single component used by both the Inbox and `/today`. Self-fetches `/api/meetings/today`, renders cards, handles expand/collapse, manual regenerate.

- [ ] **Step 14.1: Write the component**

Create `components/TodayMeetingsPanel.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

interface PrepGuide {
  background: string[];
  updates_to_request: { person: string; item: string; question_to_ask: string }[];
  your_prep: string[];
  suggested_agenda: { topic: string; talking_points: string[]; time_estimate_min: number }[];
  desired_outcomes: string[];
  watch_out_for: string[];
}

interface TodayMeeting {
  id: string;
  title: string;
  startAt: string | null;
  endAt: string | null;
  calendarSource: string | null;
  joinUrl: string | null;
  platform: string | null;
  companyName: string | null;
  attendees: { name: string; email: string | null; roleAtMeeting: string | null }[];
  openActions: { id: string; title: string }[];
  externalActions: { id: string; title: string; assignee: string | null }[];
  peterActions: { id: string; title: string }[];
  prepGuide: PrepGuide | null;
  prepGuideGeneratedAt: string | null;
  prepGuideModel: string | null;
}

function fmtTimeRange(startISO: string | null, endISO: string | null): string {
  if (!startISO) return 'Time TBD';
  const start = new Date(startISO);
  const end = endISO ? new Date(endISO) : null;
  const opt: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' };
  const fmt = new Intl.DateTimeFormat('en-US', opt);
  return end ? `${fmt.format(start)} – ${fmt.format(end)}` : fmt.format(start);
}

function fmtGeneratedAt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  });
  return `Generated ${fmt.format(d)} ET`;
}

export default function TodayMeetingsPanel({ initialMeetings }: { initialMeetings?: TodayMeeting[] } = {}) {
  const [meetings, setMeetings] = useState<TodayMeeting[]>(initialMeetings ?? []);
  const [loading, setLoading] = useState(initialMeetings === undefined);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (initialMeetings !== undefined) return;
    fetch('/api/meetings/today')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: TodayMeeting[]) => {
        setMeetings(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [initialMeetings]);

  // Default-expand if 1-2 meetings; collapse if 3+
  useEffect(() => {
    if (meetings.length === 0 || meetings.length > 2) return;
    setExpanded(new Set(meetings.map((m) => m.id)));
  }, [meetings]);

  const toggle = (id: string) => {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const regenerate = async (id: string) => {
    setRegenerating((s) => new Set(s).add(id));
    try {
      const res = await fetch(`/api/meetings/${id}/regenerate-prep`, { method: 'POST' });
      if (res.ok) {
        const fresh = await res.json();
        setMeetings((prev) =>
          prev.map((m) =>
            m.id === id
              ? {
                  ...m,
                  prepGuide: fresh.prepGuide,
                  prepGuideGeneratedAt: fresh.prepGuideGeneratedAt,
                  prepGuideModel: fresh.prepGuideModel,
                }
              : m
          )
        );
      }
    } finally {
      setRegenerating((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  };

  const sortedMeetings = useMemo(
    () =>
      [...meetings].sort((a, b) => {
        const at = a.startAt ? new Date(a.startAt).getTime() : Infinity;
        const bt = b.startAt ? new Date(b.startAt).getTime() : Infinity;
        return at - bt;
      }),
    [meetings]
  );

  if (loading) return null;
  if (sortedMeetings.length === 0) return null;

  return (
    <section
      style={{
        background: 'var(--apex-panel)',
        border: '1px solid var(--apex-border)',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--apex-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--apex-primary-bright)' }}>
          today
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--apex-text)' }}>
          Today
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--apex-text-muted)' }}>
          {sortedMeetings.length} meeting{sortedMeetings.length === 1 ? '' : 's'}
        </span>
      </header>

      {sortedMeetings.map((m) => {
        const isOpen = expanded.has(m.id);
        const isRegen = regenerating.has(m.id);
        return (
          <div key={m.id} style={{ borderBottom: '1px solid var(--apex-border)' }}>
            <button
              onClick={() => toggle(m.id)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                color: 'var(--apex-text)',
                textAlign: 'left',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--apex-text-muted)', minWidth: 130 }}>
                {fmtTimeRange(m.startAt, m.endAt)}
              </span>
              <span style={{ flex: 1, fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.title}
              </span>
              <span style={{ fontSize: 11, color: 'var(--apex-text-muted)' }}>
                {m.attendees.length} att · {m.openActions.length} act
              </span>
              {m.joinUrl && (
                <a
                  href={m.joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="btn btn-primary"
                  style={{ height: 24, fontSize: 11, padding: '0 10px' }}
                >
                  Join
                </a>
              )}
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--apex-text-muted)' }}>
                {isOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {isOpen && (
              <div style={{ padding: '0 16px 14px', fontSize: 12, color: 'var(--apex-text)' }}>
                {m.prepGuide ? (
                  <PrepSections guide={m.prepGuide} />
                ) : (
                  <div style={{ padding: '12px 0', color: 'var(--apex-text-muted)' }}>
                    No prep guide yet.{' '}
                    <button
                      onClick={() => regenerate(m.id)}
                      disabled={isRegen}
                      className="btn btn-ghost"
                      style={{ height: 22, fontSize: 11 }}
                    >
                      {isRegen ? 'Generating…' : 'Generate guide'}
                    </button>
                  </div>
                )}
                {m.prepGuide && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 10.5, color: 'var(--apex-text-faint)' }}>
                    <button
                      onClick={() => regenerate(m.id)}
                      disabled={isRegen}
                      className="btn btn-ghost"
                      style={{ height: 22, fontSize: 11 }}
                    >
                      {isRegen ? 'Regenerating…' : '↻ Regenerate'}
                    </button>
                    <span>{fmtGeneratedAt(m.prepGuideGeneratedAt)}{m.prepGuideModel ? ` · ${m.prepGuideModel}` : ''}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'var(--apex-text-muted)',
        marginTop: 12,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function PrepSections({ guide }: { guide: PrepGuide }) {
  return (
    <>
      {guide.background?.length > 0 && (
        <>
          <SectionLabel>Background</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {guide.background.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </>
      )}
      {guide.updates_to_request?.length > 0 && (
        <>
          <SectionLabel>Updates to Request</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {guide.updates_to_request.map((u, i) => (
              <li key={i}>
                <strong>{u.person}</strong> — {u.item}
                <div style={{ color: 'var(--apex-text-muted)', fontStyle: 'italic' }}>"{u.question_to_ask}"</div>
              </li>
            ))}
          </ul>
        </>
      )}
      {guide.your_prep?.length > 0 && (
        <>
          <SectionLabel>Your Prep</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {guide.your_prep.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </>
      )}
      {guide.suggested_agenda?.length > 0 && (
        <>
          <SectionLabel>Suggested Agenda</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {guide.suggested_agenda.map((a, i) => (
              <li key={i}>
                <strong>{a.topic}</strong> ({a.time_estimate_min} min)
                {a.talking_points?.length > 0 && (
                  <ul style={{ marginTop: 2, paddingLeft: 18 }}>
                    {a.talking_points.map((tp, j) => <li key={j}>{tp}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {guide.desired_outcomes?.length > 0 && (
        <>
          <SectionLabel>Desired Outcomes</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {guide.desired_outcomes.map((o, i) => <li key={i}>{o}</li>)}
          </ul>
        </>
      )}
      {guide.watch_out_for?.length > 0 && (
        <>
          <SectionLabel>Watch Out For</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {guide.watch_out_for.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 14.2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 14.3: Commit**

```bash
git add components/TodayMeetingsPanel.tsx
git commit -m "$(cat <<'EOF'
feat: TodayMeetingsPanel component

Self-fetches /api/meetings/today, renders expand/collapse cards with
prep-guide sections, manual regenerate button per card.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Dedicated `/today` page

**Files:**
- Create: `app/today/page.tsx`

**What:** Full-page wrapper around `<TodayMeetingsPanel>`.

- [ ] **Step 15.1: Write the page**

Create `app/today/page.tsx`:

```tsx
import TodayMeetingsPanel from '@/components/TodayMeetingsPanel';

export const metadata = { title: 'Today — Meeting Intelligence' };

export default function TodayPage() {
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  }).format(new Date());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--apex-bg)' }}>
      <div className="apex-page-header" style={{ borderBottom: '1px solid var(--apex-border)' }}>
        <span className="apex-page-title">Today</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--apex-text-muted)', fontFamily: 'var(--font-mono)' }}>
          {dateLabel}
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <TodayMeetingsPanel />
      </div>
    </div>
  );
}
```

- [ ] **Step 15.2: Smoke test**

Run dev server. Navigate to `http://localhost:3000/today`. Expected: page renders, panel populates from API, cards are clickable, regenerate works.

- [ ] **Step 15.3: Commit**

```bash
git add app/today/page.tsx
git commit -m "$(cat <<'EOF'
feat: /today route

Dedicated full-page view of today's meetings + prep guides.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Mount panel in `DashboardClient`

**Files:**
- Modify: `components/DashboardClient.tsx`

**What:** Insert `<TodayMeetingsPanel />` between the stat strip and the `ResizableSplit`. Add a "Today" stat-strip cell with the day's count.

- [ ] **Step 16.1: Add import + state**

Edit [components/DashboardClient.tsx](../../../components/DashboardClient.tsx).

After the existing imports at the top of the file, add:

```typescript
import TodayMeetingsPanel from '@/components/TodayMeetingsPanel';
```

Inside the component, add state for the count after the existing `useState` declarations (around line 108):

```typescript
const [todayCount, setTodayCount] = useState(0);
```

Add a fetch for the count alongside the existing dashboard fetch. In the existing `useEffect` block at line 113, replace:

```typescript
  useEffect(() => {
    Promise.all([
      fetch('/api/meetings').then((r) => r.ok ? r.json() : []),
      fetch('/api/action-items').then((r) => r.ok ? r.json() : []),
      fetch('/api/contacts').then((r) => r.ok ? r.json() : []),
    ]).then(([m, a, c]) => {
      setMeetings(Array.isArray(m) ? m as Meeting[] : []);
      setActionItems(Array.isArray(a) ? a as ActionItem[] : []);
      setContacts(Array.isArray(c) ? c as Contact[] : []);
    }).catch(() => {});
  }, []);
```

with:

```typescript
  useEffect(() => {
    Promise.all([
      fetch('/api/meetings').then((r) => r.ok ? r.json() : []),
      fetch('/api/action-items').then((r) => r.ok ? r.json() : []),
      fetch('/api/contacts').then((r) => r.ok ? r.json() : []),
      fetch('/api/meetings/today').then((r) => r.ok ? r.json() : []),
    ]).then(([m, a, c, t]) => {
      setMeetings(Array.isArray(m) ? m as Meeting[] : []);
      setActionItems(Array.isArray(a) ? a as ActionItem[] : []);
      setContacts(Array.isArray(c) ? c as Contact[] : []);
      setTodayCount(Array.isArray(t) ? t.length : 0);
    }).catch(() => {});
  }, []);
```

- [ ] **Step 16.2: Add stat-strip cell**

Find the stat strip block at line 508. Insert a new stat between "This Month" and "Open" (so it lands after `</div>` of the This Month stat):

```tsx
        <div className="apex-stat">
          <span className={`apex-stat-value${todayCount > 0 ? ' accent' : ''}`}>{todayCount}</span>
          <span className="apex-stat-label">Today</span>
        </div>
```

- [ ] **Step 16.3: Mount the panel**

Find the return block at line 506. Below the stat strip's closing `</div>` (around line 533) and before the "Two panes" div, insert:

```tsx
      {todayCount > 0 && (
        <div style={{ flexShrink: 0, padding: '0 16px 12px' }}>
          <TodayMeetingsPanel />
        </div>
      )}
```

- [ ] **Step 16.4: Type-check + smoke test**

Run: `npx tsc --noEmit`
Expected: no errors.

Open `/` in the browser. Expected: stat strip shows the today count; if non-zero, the panel renders below.

- [ ] **Step 16.5: Commit**

```bash
git add components/DashboardClient.tsx
git commit -m "$(cat <<'EOF'
feat: mount TodayMeetingsPanel on Inbox + add Today stat-strip cell

Panel auto-hides when no meetings today.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Sidebar nav entry + count badge

**Files:**
- Modify: `components/Sidebar.tsx`

**What:** Add a "Today" entry at the top of `primaryNav` with a live count badge.

- [ ] **Step 17.1: Add the nav entry + fetch state**

Edit [components/Sidebar.tsx](../../../components/Sidebar.tsx).

In the `primaryNav` array (line 7), insert as the FIRST element:

```typescript
  { href: '/today',         icon: 'today',           label: 'Today' },
```

Inside the `Sidebar()` function body, add a state for the count (right after the other `useState` block, around line 35):

```typescript
const [todayCount, setTodayCount] = useState(0);

useEffect(() => {
  fetch('/api/meetings/today')
    .then((r) => r.ok ? r.json() : [])
    .then((d) => setTodayCount(Array.isArray(d) ? d.length : 0))
    .catch(() => {});
}, []);
```

In the `primaryNav.map(...)` block (around line 134), modify the `Link` to render a badge for the Today entry:

```tsx
        {primaryNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`apex-nav-item${isActive(item.href) ? ' active' : ''}`}
            title={item.label}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{item.label}</span>
            {item.href === '/today' && todayCount > 0 && (
              <span
                className="nav-badge accent"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 8,
                  background: 'var(--apex-primary)',
                  color: '#fff',
                }}
              >
                {todayCount}
              </span>
            )}
          </Link>
        ))}
```

- [ ] **Step 17.2: Type-check + smoke test**

Run: `npx tsc --noEmit`
Expected: no errors.

Reload. Expected: "Today" appears at the top of the sidebar; if there are meetings, a small numeric badge appears next to it. Clicking navigates to `/today` and the entry highlights as active.

- [ ] **Step 17.3: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "$(cat <<'EOF'
feat: Sidebar Today nav entry with live count badge

Sidebar self-fetches /api/meetings/today on mount; badge shows the day's
meeting count.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Wire the cron schedule

**Files:**
- Modify: `vercel.json`

**What:** Add three cron entries — 5 AM, 9 AM, 1 PM ET (`09:00`, `13:00`, `17:00` UTC).

- [ ] **Step 18.1: Update `vercel.json`**

Replace the contents of [vercel.json](../../../vercel.json) with:

```json
{
  "crons": [
    {
      "path": "/api/cron/import-drive",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/sync-calendar",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/sync-calendar",
      "schedule": "0 13 * * *"
    },
    {
      "path": "/api/cron/sync-calendar",
      "schedule": "0 17 * * *"
    }
  ]
}
```

- [ ] **Step 18.2: Commit**

```bash
git add vercel.json
git commit -m "$(cat <<'EOF'
chore: schedule sync-calendar cron at 5/9/1 ET (09/13/17 UTC)

Three triggers per day cover morning baseline, mid-morning refresh, and
afternoon catch for late-added events.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: End-to-end verification + cleanup

**Files:** none (no code changes)

**What:** Final integration smoke test against a live dev server with all three ICS feeds, OpenAI key, and CRON_SECRET set.

- [ ] **Step 19.1: Reset relevant DB state (optional)**

If you want a clean run, delete previously-inserted ICS meetings:

```sql
DELETE FROM meetings WHERE source = 'ics';
```

(Cascades to `meeting_attendees` and `meeting_prep_guides` via FK.)

- [ ] **Step 19.2: Run the cron once, end-to-end**

```bash
curl "http://localhost:3000/api/cron/sync-calendar?token=$CRON_SECRET" | jq .
```

Verify:
- All three feeds report `ok: true`.
- `eventsAfterDedupe ≤ eventsFetched`.
- `prep.generated > 0` on first run.

- [ ] **Step 19.3: Visit `/today`**

Expected: panel populated with all of today's events. Each card expands to show prep-guide sections. Click "↻ Regenerate" — a new prep guide is generated and the timestamp updates.

- [ ] **Step 19.4: Visit `/` (Inbox)**

Expected: "Today" stat shows the count, and the panel renders above the existing split.

- [ ] **Step 19.5: Re-run the cron**

```bash
curl "http://localhost:3000/api/cron/sync-calendar?token=$CRON_SECRET" | jq .
```

Expected: `prep.skippedCache` is roughly equal to the number of meetings (input hashes match → cache hit).

- [ ] **Step 19.6: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 19.7: Build**

Run: `npm run build`
Expected: success. If the build fails on `OPENAI_API_KEY` lookup, that's because [lib/openai.ts](../../../lib/openai.ts) defers initialization on purpose — re-read its doc-comment to confirm. Build should not actually call OpenAI.

- [ ] **Step 19.8: Final commit (only if anything was tweaked)**

If you needed to fix anything in this task, commit it now. Otherwise, no commit — verification only.

---

## Open follow-ons (out of scope, captured for later)

These are noted in the design and should NOT be implemented as part of this plan:

1. **Group consecutive same-context meetings (interview bloc).** The design's "Step 4" calls for detecting 3+ back-to-back meetings sharing a normalized title stem (e.g. today's three "Operations Officer Interview" slots) and generating a shared context block once instead of repeating role-level context across each prep guide. v1 generates each independently — the briefs will cover overlapping ground for back-to-back same-role interviews. Add this once we see real-world output and decide the redundancy is worth deduplicating.
2. **Read.ai recap → ICS meeting linking.** When the post-meeting recap import lands later in the day, link it to the existing `meetings` row created by the cron (so prep + recap stay tied).
3. **Multi-day view.** Same panel, broader date range filter.
4. **Email digest.** Pipe `/api/meetings/today` output through `lib/mail.ts` at 6 AM ET.
5. **Editable prep.** Inline editing of agenda items, persisted to `meeting_prep_items`.
6. **Snooze-aware updates.** Filter `snoozedUntil` action items out of the prep context.
7. **`cron_runs` audit table.** Currently we just `console.error` failures.

---

## Self-review checklist

Before kicking off implementation, confirm:

- [ ] Every task's "What" matches a section in the design.
- [ ] Every task has at least one verification step (type-check, lint, curl, or `npx tsx`).
- [ ] No "TBD"/"TODO"/"add error handling" placeholders.
- [ ] Type names match across tasks: `PrepGuide`, `PrepContext`, `ParsedIcsEvent`, `MeetingType`.
- [ ] File paths are exact and consistent (`lib/`, `app/api/`, `components/`).
- [ ] Cron schedule in Task 18 matches the design (3× daily ET).
- [ ] `excludeFromTasks` filter applied in both `lib/prep-context.ts` (Task 8) and `app/api/meetings/today/route.ts` (Task 12).
- [ ] Dedupe priority order matches design: `conversely > pine-lake > cranbrook` (Task 5).
- [ ] Cache TTL matches design (12h, Task 10).

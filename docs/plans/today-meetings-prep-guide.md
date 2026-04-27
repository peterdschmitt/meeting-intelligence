# Today's Meetings Prep Guide — Implementation Plan

> **For Hermes:** Use `subagent-driven-development` skill to implement this plan task-by-task.

**Goal:** Add a "Today's Meetings" section to the Inbox dashboard that shows meetings scheduled for today, with AI-generated background context, outstanding items to ask about, and a suggested run-of-show.

**Architecture:** New `GET /api/meetings/today` endpoint fetches today's meetings enriched with attendees, open action items, and prior-occurrence context. A `POST /api/meetings/[id]/prep-guide` endpoint calls GPT-4o to synthesize all of that into a structured prep brief. A new `TodayMeetingsPanel` client component renders the section above the existing split panes in `DashboardClient`.

**Tech Stack:** Next.js 14 App Router, Drizzle ORM, Neon Postgres, GPT-4o (`gpt-4o`), TypeScript

---

## Background & Context

### Existing data the feature draws on

| Table | Relevant fields |
|---|---|
| `meetings` | `id`, `title`, `meeting_date`, `meeting_time`, `executive_summary`, `transcript` |
| `meeting_prep_items` | `meeting_id`, `kind` (`agenda`/`question`/`outcome`), `text`, `rationale`, `completed`, `position` |
| `action_items` | `meeting_id`, `title`, `assignee`, `due_date`, `status`, `urgency_tier`, `owner_side` (`peter`/`external`) |
| `meeting_attendees` | `meeting_id`, `name`, `role_at_meeting`, `engagement` |

### Key insight — recurring meeting prep chain

Every time a meeting is extracted, the AI generates `meeting_prep_items` scoped to *the next occurrence* of that meeting. Today's meetings page closes the loop: it surfaces those prep items right before the meeting happens. For recurring meetings (e.g. "Daily Pipeline Updates"), the system finds the most recent prior occurrence by title-matching and pulls its exec summary + prep items as the background context.

### What "today's meetings" means

A meeting is "today" when `DATE(meeting_date AT TIME ZONE 'America/New_York') = today`. Meetings with no date, or dated in the past/future, are excluded. The section auto-hides when the count is zero.

> **Note on data entry:** Meetings currently enter the system after the fact via Read.ai import. For today's meetings to appear, they need to be manually created with today's date, or Google Calendar integration needs to be added (tracked separately as a follow-on).

---

## Task 1: New API route — `GET /api/meetings/today`

**Objective:** Fetch all meetings scheduled today, enriched with attendees, open external action items, and context from the most recent prior occurrence.

**Files:**
- Create: `app/api/meetings/today/route.ts`

**Implementation:**

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  meetings, meetingPrepItems, meetingAttendees, actionItems, companies,
} from '@/lib/schema';
import { eq, and, ne, desc, ilike, sql } from 'drizzle-orm';

export async function GET() {
  // Get today's date in EST (YYYY-MM-DD)
  const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  // Fetch meetings scheduled today
  const todayMeetings = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      meetingDate: meetings.meetingDate,
      meetingTime: meetings.meetingTime,
      executiveSummary: meetings.executiveSummary,
      companyName: companies.name,
    })
    .from(meetings)
    .leftJoin(companies, eq(meetings.companyId, companies.id))
    .where(
      sql`DATE(${meetings.meetingDate} AT TIME ZONE 'America/New_York') = ${todayEST}::date`
    )
    .orderBy(meetings.meetingTime);

  // Enrich each meeting with related data
  const enriched = await Promise.all(
    todayMeetings.map(async (m) => {
      const [prepItems, attendees, openActions] = await Promise.all([
        db.select().from(meetingPrepItems)
          .where(eq(meetingPrepItems.meetingId, m.id))
          .orderBy(meetingPrepItems.position),
        db.select().from(meetingAttendees)
          .where(eq(meetingAttendees.meetingId, m.id)),
        db.select().from(actionItems)
          .where(and(
            eq(actionItems.meetingId, m.id),
            ne(actionItems.status, 'done'),
            ne(actionItems.status, 'cancelled'),
          )),
      ]);

      // Find most recent prior occurrence (recurring meeting — title match)
      // Strip date prefix (e.g. "2026-04-24 - ") if present before matching
      const titleCore = m.title.replace(/^\d{4}-\d{2}-\d{2}\s*-\s*/, '').trim();
      const [lastOccurrence] = await db
        .select({
          id: meetings.id,
          title: meetings.title,
          executiveSummary: meetings.executiveSummary,
          meetingDate: meetings.meetingDate,
        })
        .from(meetings)
        .where(and(
          ilike(meetings.title, `%${titleCore}%`),
          ne(meetings.id, m.id),
          sql`${meetings.meetingDate} < NOW()`,
        ))
        .orderBy(desc(meetings.meetingDate))
        .limit(1);

      const priorPrepItems = lastOccurrence
        ? await db.select().from(meetingPrepItems)
            .where(eq(meetingPrepItems.meetingId, lastOccurrence.id))
            .orderBy(meetingPrepItems.position)
        : [];

      return {
        ...m,
        prepItems,
        attendees,
        openActions,        // all open actions (both peter + external)
        externalActions: openActions.filter(a => a.ownerSide === 'external'),
        peterActions: openActions.filter(a => a.ownerSide === 'peter'),
        lastOccurrence: lastOccurrence ?? null,
        priorPrepItems,
      };
    })
  );

  return NextResponse.json(enriched);
}
```

**Verification:** `curl http://localhost:3000/api/meetings/today` returns `[]` on a day with no meetings, or an array of enriched meeting objects on a day that has them.

---

## Task 2: New API route — `POST /api/meetings/[id]/prep-guide`

**Objective:** Accept meeting context, call GPT-4o, and return a structured prep brief.

**Files:**
- Create: `app/api/meetings/[id]/prep-guide/route.ts`

**The AI system prompt** (also documented in [AI Prompts](#ai-prompts) section below):

```typescript
const PREP_GUIDE_SYSTEM_PROMPT = `You are a senior executive assistant preparing Peter Schmitt for an upcoming meeting.

You will be given:
- Meeting title, time, and attendees
- Executive summary from the most recent prior occurrence of this meeting
- Prep items (agenda, questions, desired outcomes) generated after the last meeting
- Open action items: tasks Peter owns that he should be ready to report on, and tasks owned by external parties that he should seek updates on

Your job: produce a concise, high-signal prep brief in JSON with exactly these keys:

- "background": array of 3-5 strings — narrative bullets summarizing what this meeting is about and where things stand. Reference specific people, deals, or issues by name. No generic filler.

- "updates_to_request": array of objects { "person": string, "item": string, "question_to_ask": string } — concrete updates Peter should seek from external owners. Each entry maps directly to an open action item. If there are no external action items, return [].

- "peters_prep": array of strings — things Peter should be ready to speak to or report on (from his own open action items and the prior meeting's desired outcomes).

- "suggested_agenda": array of objects { "topic": string, "talking_points": string[], "time_estimate_min": number } — a practical agenda that covers the updates, decisions, and open items. Sum of time_estimate_min should roughly match a typical meeting length.

- "desired_outcomes": array of strings — what a successful meeting achieves. Be specific. "Agree on X" or "Confirm Y by Z" not "discuss progress."

- "watch_out_for": array of strings — risks, tensions, potential surprises, or topics that may derail the meeting. Include anything flagged as a risk in the prior meeting.

Respond ONLY with valid JSON — no markdown fences, no explanation. Be concrete and specific. Use names. Reference actual tasks. Do not pad.`;
```

**Full route implementation:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetings, meetingPrepItems, meetingAttendees, actionItems } from '@/lib/schema';
import { eq, and, ne, desc, ilike, sql } from 'drizzle-orm';
import { getOpenAI } from '@/lib/openai';

// System prompt — see PREP_GUIDE_SYSTEM_PROMPT above

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [prepItems, attendees, openActions] = await Promise.all([
    db.select().from(meetingPrepItems).where(eq(meetingPrepItems.meetingId, id))
      .orderBy(meetingPrepItems.position),
    db.select().from(meetingAttendees).where(eq(meetingAttendees.meetingId, id)),
    db.select().from(actionItems).where(and(
      eq(actionItems.meetingId, id),
      ne(actionItems.status, 'done'),
      ne(actionItems.status, 'cancelled'),
    )),
  ]);

  // Find most recent prior occurrence for additional context
  const titleCore = meeting.title.replace(/^\d{4}-\d{2}-\d{2}\s*-\s*/, '').trim();
  const [lastOccurrence] = await db
    .select({ executiveSummary: meetings.executiveSummary, meetingDate: meetings.meetingDate })
    .from(meetings)
    .where(and(
      ilike(meetings.title, `%${titleCore}%`),
      ne(meetings.id, id),
      sql`${meetings.meetingDate} < NOW()`,
    ))
    .orderBy(desc(meetings.meetingDate))
    .limit(1);

  const externalActions = openActions.filter(a => a.ownerSide === 'external');
  const peterActions = openActions.filter(a => a.ownerSide === 'peter');

  // Build the user message context block
  const contextBlock = `
MEETING: ${meeting.title}
TIME: ${meeting.meetingTime ?? 'Not specified'}

ATTENDEES:
${attendees.map(a => `- ${a.name}${a.roleAtMeeting ? ` (${a.roleAtMeeting})` : ''}`).join('\n') || 'Not specified'}

PRIOR MEETING SUMMARY (most recent occurrence):
${lastOccurrence?.executiveSummary ?? meeting.executiveSummary ?? 'No prior summary available.'}

PREP ITEMS FROM LAST MEETING:
Agenda items: ${prepItems.filter(p => p.kind === 'agenda').map(p => p.text).join(' | ') || 'None'}
Questions to ask: ${prepItems.filter(p => p.kind === 'question').map(p => p.text).join(' | ') || 'None'}
Desired outcomes: ${prepItems.filter(p => p.kind === 'outcome').map(p => p.text).join(' | ') || 'None'}

PETER'S OPEN ACTION ITEMS (he should be ready to report on these):
${peterActions.map(a => `- ${a.title} (due: ${a.dueDate ?? 'no date'}, urgency: ${a.urgencyTier ?? 'none'})`).join('\n') || 'None'}

EXTERNAL ACTION ITEMS (Peter should ask for updates on these):
${externalActions.map(a => `- [${a.assignee ?? 'Unknown'}] ${a.title} (due: ${a.dueDate ?? 'no date'}, urgency: ${a.urgencyTier ?? 'none'})`).join('\n') || 'None'}
`.trim();

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: PREP_GUIDE_SYSTEM_PROMPT },
      { role: 'user', content: contextBlock },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const guide = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
  return NextResponse.json(guide);
}
```

**Verification:** POST to `/api/meetings/[valid-id]/prep-guide` returns a JSON object with all six keys: `background`, `updates_to_request`, `peters_prep`, `suggested_agenda`, `desired_outcomes`, `watch_out_for`.

---

## Task 3: `TodayMeetingsPanel` component

**Objective:** A full-width collapsible panel above the existing split panes that shows today's meetings as expandable cards.

**Files:**
- Create: `components/TodayMeetingsPanel.tsx`

**Types (inline at top of file):**

```typescript
interface PrepGuide {
  background: string[];
  updates_to_request: { person: string; item: string; question_to_ask: string }[];
  peters_prep: string[];
  suggested_agenda: { topic: string; talking_points: string[]; time_estimate_min: number }[];
  desired_outcomes: string[];
  watch_out_for: string[];
}

interface TodayMeeting {
  id: string;
  title: string;
  meetingTime: string | null;
  attendees: { name: string; roleAtMeeting: string | null }[];
  prepItems: { kind: string; text: string }[];
  openActions: { id: string; title: string; assignee: string | null; ownerSide: string | null; dueDate: string | null }[];
  externalActions: typeof openActions;
  peterActions: typeof openActions;
  lastOccurrence: { meetingDate: string } | null;
  priorPrepItems: { kind: string; text: string }[];
}
```

**Component behavior:**
- On mount: `fetch('/api/meetings/today')` — renders nothing if result is `[]`
- Each meeting renders as a card with header row: time · title · attendee count · action item count · **[Generate Guide]** button
- Clicking a card header expands/collapses it (default: expanded if only 1 meeting today, collapsed if 2+)
- Clicking **[Generate Guide]** POSTs to `/api/meetings/[id]/prep-guide`, shows a spinner, then renders the guide sections
- Guide sections render as collapsible sub-tabs: **Background** | **Updates to Request** | **Your Prep** | **Run It** | **Watch Out For**
- A "Regenerate" button (small, ghost style) allows refreshing the guide

**Visual layout per card (expanded, guide loaded):**

```
┌──────────────────────────────────────────────────────────────────┐
│  10:00 AM  Daily Pipeline Updates        5 attendees  3 actions  │
│  ─────────────────────────────────────────────────────────────── │
│  [Background]  [Updates to Request 3]  [Your Prep]  [Run It]     │
│                                                                  │
│  BACKGROUND                                                      │
│  • Pipeline is tracking at 68% of monthly target with 4 days    │
│    remaining. Jon flagged Smart Financial intake as the main...  │
│  • True Choice contract is pending Katy's signature draft.       │
│                                                                  │
│  UPDATES TO REQUEST                                              │
│  Jon Maso    Have Smart Financial send intake form    "Jon,      │
│              and required paperwork to Katy           where are  │
│                                                       we on..."  │
│  Katy        Draft and send the contract              "Katy,     │
│              for signature                            has the    │
│                                                       contract..." │
└──────────────────────────────────────────────────────────────────┘
```

**Styling notes:**
- Match existing app design system (`var(--apex-bg)`, `var(--apex-panel)`, `var(--apex-primary-bright)`, etc.)
- Card border: `1px solid var(--apex-border)` with `border-radius: 6px`
- Section tabs: same pill/tab style used in Action Items page
- Time displayed in local time format (`10:00 AM`); if `meetingTime` is null, show `Time TBD`
- "Generate Guide" button: primary button style with `✨` prefix
- Loading state: spinner with "Generating prep guide..." text

---

## Task 4: Wire `TodayMeetingsPanel` into `DashboardClient`

**Objective:** Add the panel to the Inbox, above the split panes, auto-hidden when there are no meetings today.

**Files:**
- Modify: `components/DashboardClient.tsx`

**Changes:**

1. Add state and fetch for today's meetings:

```typescript
const [todayMeetings, setTodayMeetings] = useState<TodayMeeting[]>([]);

useEffect(() => {
  fetch('/api/meetings/today')
    .then(r => r.ok ? r.json() : [])
    .then(data => setTodayMeetings(Array.isArray(data) ? data : []))
    .catch(() => {});
}, []);
```

2. Render above the `ResizableSplit`:

```tsx
return (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--apex-bg)' }}>
    {/* Stat strip */}
    <div className="apex-statbar">
      {/* ... existing stats ... */}
    </div>

    {/* Today's Meetings — only shown when there are meetings today */}
    {todayMeetings.length > 0 && (
      <div style={{ flexShrink: 0, padding: '0 16px 12px' }}>
        <TodayMeetingsPanel meetings={todayMeetings} />
      </div>
    )}

    {/* Two panes */}
    <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
      <ResizableSplit ... />
    </div>
  </div>
);
```

3. Add today's meeting count to the stat strip:

```tsx
<div className="apex-stat">
  <span className={`apex-stat-value${todayMeetings.length > 0 ? ' accent' : ''}`}>
    {todayMeetings.length}
  </span>
  <span className="apex-stat-label">Today</span>
</div>
```

---

## Task 5: Sidebar "Today" nav item

**Objective:** Add a "Today" link at the top of the sidebar nav with a live count badge showing how many meetings are scheduled today.

**Files:**
- Modify: `components/Sidebar.tsx`

**Change:** Add to top of the nav list, before "Inbox":

```tsx
<Link href="/" className={`nav-link ${isToday ? 'active' : ''}`}>
  <span className="material-symbols-outlined">today</span>
  Today
  {todayCount > 0 && (
    <span className="nav-badge accent">{todayCount}</span>
  )}
</Link>
```

The sidebar needs to accept `todayCount` as a prop, or fetch it independently via `GET /api/meetings/today` and derive `length`. Keep it lightweight — no need to re-fetch if the dashboard already has the data. Prefer passing as a prop from the root layout if the count needs to be shared.

---

## AI Prompts Reference

### Prep Guide Generation Prompt

**Model:** `gpt-4o`
**Temperature:** `0.3`
**Response format:** `json_object`

**System prompt:**

```
You are a senior executive assistant preparing Peter Schmitt for an upcoming meeting.

You will be given:
- Meeting title, time, and attendees
- Executive summary from the most recent prior occurrence of this meeting
- Prep items (agenda, questions, desired outcomes) generated after the last meeting
- Open action items: tasks Peter owns that he should be ready to report on, and tasks owned
  by external parties that he should seek updates on

Your job: produce a concise, high-signal prep brief in JSON with exactly these keys:

- "background": array of 3-5 strings — narrative bullets summarizing what this meeting is
  about and where things stand. Reference specific people, deals, or issues by name. No
  generic filler.

- "updates_to_request": array of objects { "person": string, "item": string,
  "question_to_ask": string } — concrete updates Peter should seek from external owners.
  Each entry maps directly to an open action item. If there are no external action items,
  return [].

- "peters_prep": array of strings — things Peter should be ready to speak to or report on
  (from his own open action items and the prior meeting's desired outcomes).

- "suggested_agenda": array of objects { "topic": string, "talking_points": string[],
  "time_estimate_min": number } — a practical agenda that covers the updates, decisions, and
  open items. Sum of time_estimate_min should roughly match a typical meeting length.

- "desired_outcomes": array of strings — what a successful meeting achieves. Be specific.
  "Agree on X" or "Confirm Y by Z" not "discuss progress."

- "watch_out_for": array of strings — risks, tensions, potential surprises, or topics that
  may derail the meeting. Include anything flagged as a risk in the prior meeting.

Respond ONLY with valid JSON — no markdown fences, no explanation. Be concrete and specific.
Use names. Reference actual tasks. Do not pad.
```

**User message (template):**

```
MEETING: {title}
TIME: {meetingTime or "Not specified"}

ATTENDEES:
{attendees.map(a => `- ${a.name}${a.roleAtMeeting ? ` (${a.roleAtMeeting})` : ''}`).join('\n')}

PRIOR MEETING SUMMARY (most recent occurrence):
{lastOccurrence.executiveSummary or meeting.executiveSummary or "No prior summary available."}

PREP ITEMS FROM LAST MEETING:
Agenda items: {prepItems(agenda).join(' | ') or "None"}
Questions to ask: {prepItems(question).join(' | ') or "None"}
Desired outcomes: {prepItems(outcome).join(' | ') or "None"}

PETER'S OPEN ACTION ITEMS (he should be ready to report on these):
{peterActions.map(a => `- ${a.title} (due: ${a.dueDate}, urgency: ${a.urgencyTier})`).join('\n') or "None"}

EXTERNAL ACTION ITEMS (Peter should ask for updates on these):
{externalActions.map(a => `- [${a.assignee}] ${a.title} (due: ${a.dueDate}, urgency: ${a.urgencyTier})`).join('\n') or "None"}
```

---

## Follow-on Work (not in this plan)

1. **Google Calendar integration** — auto-populate today's meetings from GCal rather than requiring manual entry. Add `gcal_event_id` to the `meetings` table and a sync job.

2. **"Prep next occurrence" button on meeting detail pages** — lets Peter trigger prep generation from the meeting recap page for the next scheduled occurrence, before the meeting even exists in the DB.

3. **Morning briefing hook** — the prep guide output maps directly to what the morning email briefing needs. Pipe `GET /api/meetings/today` → prep guide generation → briefing email.

4. **Snooze-aware updates list** — filter `snoozedUntil` items out of `updates_to_request` so Peter isn't asked about things he's already deferred.

5. **Inline guide editing** — allow Peter to edit generated agenda items and talking points directly in the panel, saved back as `meeting_prep_items`.

---

## Commit Conventions

```
feat: add today's meetings panel to inbox dashboard
feat: add GET /api/meetings/today endpoint
feat: add POST /api/meetings/[id]/prep-guide endpoint
feat: wire TodayMeetingsPanel into DashboardClient
feat: add Today nav item to sidebar with count badge
```

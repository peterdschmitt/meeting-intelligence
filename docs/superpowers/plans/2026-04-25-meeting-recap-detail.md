# Meeting Recap Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn each meeting's detail page into a structured recap (executive summary, attendees with engagement, topic-by-topic narrative, decisions, action items grouped by urgency, risks, opportunities, next-meeting prep, effectiveness) with cross-meeting list pages for decisions/risks/opportunities.

**Architecture:** Next.js App Router (Next 16) with drizzle ORM over Postgres. Schema lives in `lib/schema.ts`; live migrations are applied via the idempotent admin endpoint `app/api/admin/migrate/route.ts` (additive `IF NOT EXISTS` SQL gated by `SEED_TOKEN`). LLM extraction in `lib/extract.ts` (gpt-4o JSON mode) is rewritten to fill all new tables in one call. Detail page is split into per-section client components composed into a single scrolling page with a sticky table-of-contents sidebar.

**Tech Stack:** Next.js 16, React 19, drizzle-orm 0.45, postgres, OpenAI SDK, TypeScript, inline styles + CSS variables (`--apex-*`).

**Spec:** [`docs/superpowers/specs/2026-04-25-meeting-recap-detail-design.md`](../specs/2026-04-25-meeting-recap-detail-design.md)

---

## Verification approach (no automated tests)

This codebase has **no test framework set up**. Do not introduce one. Each task verifies via:

- `npm run lint` — runs ESLint with type-aware rules (catches type errors).
- `npm run build` — full Next.js build, fails on type errors.
- Manual exercise against the running dev server (`npm run dev`) for any UI work.

When a task says "verify", run the listed commands and exercise the listed routes manually. Treat a build failure as the task being incomplete.

---

## File Structure

**Modified files (existing):**

- `lib/schema.ts` — add new tables and columns; rename `aiSummary` → `executiveSummary`.
- `app/api/admin/migrate/route.ts` — append idempotent DDL + a participants→meeting_attendees backfill.
- `lib/extract.ts` — replace single-summary extraction with full-recap extraction; write to all new tables.
- `app/api/meetings/[id]/extract/route.ts` — call new extract; preserve action_items across re-extract.
- `app/api/meetings/[id]/route.ts` — GET returns related entities; PATCH accepts new effectiveness fields.
- `app/api/action-items/[id]/route.ts` — PATCH accepts `urgencyTier`, `ownerSide`.
- `app/meetings/[id]/page.tsx` — full rewrite into sticky-TOC scrolling layout that composes section components.
- Top nav (component or page that holds the existing tabs) — add Decisions / Risks / Opportunities tabs.

**Created files (new):**

- `app/api/meetings/[id]/attendees/route.ts` — POST create attendee.
- `app/api/attendees/[id]/route.ts` — PATCH/DELETE.
- `app/api/meetings/[id]/topics/route.ts` — POST create topic.
- `app/api/topics/[id]/route.ts` — PATCH/DELETE.
- `app/api/meetings/[id]/decisions/route.ts` — POST create decision.
- `app/api/decisions/route.ts` — GET list (cross-meeting).
- `app/api/decisions/[id]/route.ts` — PATCH/DELETE.
- `app/api/meetings/[id]/risks/route.ts` — POST create risk.
- `app/api/risks/route.ts` — GET list.
- `app/api/risks/[id]/route.ts` — PATCH/DELETE.
- `app/api/meetings/[id]/opportunities/route.ts` — POST create.
- `app/api/opportunities/route.ts` — GET list.
- `app/api/opportunities/[id]/route.ts` — PATCH/DELETE.
- `app/api/meetings/[id]/prep-items/route.ts` — POST create prep item.
- `app/api/prep-items/[id]/route.ts` — PATCH/DELETE.
- `components/recap/BulletProse.tsx` — renders newline-separated text as `<ul>`; click-to-edit textarea.
- `components/recap/InlineText.tsx` — single-line click-to-edit text field.
- `components/recap/Section.tsx` — anchored section wrapper with title + count.
- `components/recap/TocSidebar.tsx` — sticky left nav with section anchors.
- `components/recap/AttendeesSection.tsx`
- `components/recap/TopicsSection.tsx`
- `components/recap/DecisionsSection.tsx`
- `components/recap/ActionItemsSection.tsx` — recap-page action items grouped by urgency_tier.
- `components/recap/RisksSection.tsx`
- `components/recap/OpportunitiesSection.tsx`
- `components/recap/PrepSection.tsx`
- `components/recap/EffectivenessSection.tsx`
- `components/recap/ReExtractDialog.tsx` — confirmation dialog before destructive re-extract.
- `app/decisions/page.tsx` — cross-meeting list page.
- `app/risks/page.tsx`
- `app/opportunities/page.tsx`

---

## Phase summary

1. **Phase 1 — Schema (Tasks 1-3):** drizzle definitions + caller renames, idempotent SQL, apply + verify.
2. **Phase 2 — Entity CRUD APIs (Tasks 4-9):** decisions, risks, opportunities, attendees, topics, prep items.
3. **Phase 3 — Action items + meetings extensions (Tasks 10-11):** new fields wired into existing routes.
4. **Phase 4 — Extraction overhaul (Tasks 12-13):** new prompt, full-recap writes, action-item preservation.
5. **Phase 5 — Recap UI components (Tasks 14-24):** shared primitives + per-section components + re-extract dialog.
6. **Phase 6 — Detail page assembly (Task 25):** rewrite of `app/meetings/[id]/page.tsx` with sticky TOC.
7. **Phase 7 — Cross-meeting list pages (Tasks 26-29):** decisions / risks / opportunities pages + sidebar nav.
8. **Phase 8 — Cleanup (Task 30):** drop the deprecated `participants` column.

---

## Phase 1 — Schema

### Task 1: Drizzle schema additions

**Files:**
- Modify: `lib/schema.ts`

- [ ] **Step 1: Replace the file contents**

Open `lib/schema.ts` and replace the entire file with:

```ts
import { pgTable, uuid, text, timestamp, date, boolean, integer } from 'drizzle-orm/pg-core';

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  fullName: text('full_name').notNull(),
  email: text('email'),
  role: text('role'),
  companyId: uuid('company_id').references(() => companies.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  meetingDate: timestamp('meeting_date'),
  meetingTime: text('meeting_time'),
  platform: text('platform'),
  // participants column is deprecated; kept for the migration window. New code reads meeting_attendees.
  participants: text('participants').array(),
  rawNotes: text('raw_notes'),
  executiveSummary: text('executive_summary'),
  transcript: text('transcript'),
  chapters: text('chapters'),
  keyQuestions: text('key_questions').array(),
  source: text('source').default('manual'),
  gdriveFileId: text('gdrive_file_id'),
  companyId: uuid('company_id').references(() => companies.id),
  durationMinutes: integer('duration_minutes'),
  productiveMinutes: integer('productive_minutes'),
  asyncableMinutes: integer('asyncable_minutes'),
  tangentMinutes: integer('tangent_minutes'),
  improvementNote: text('improvement_note'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const meetingAttendees = pgTable('meeting_attendees', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  roleAtMeeting: text('role_at_meeting'),
  engagement: text('engagement'), // 'dominant' | 'active' | 'quiet' | null
  position: integer('position').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const meetingTopics = pgTable('meeting_topics', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content'),
  position: integer('position').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const decisions = pgTable('decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  decision: text('decision').notNull(),
  owner: text('owner'),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  implication: text('implication'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const risks = pgTable('risks', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  risk: text('risk').notNull(),
  whyItMatters: text('why_it_matters'),
  mitigation: text('mitigation'),
  severity: text('severity').default('medium'), // 'low' | 'medium' | 'high'
  status: text('status').default('open'),       // 'open' | 'mitigated' | 'accepted'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const opportunities = pgTable('opportunities', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  opportunity: text('opportunity').notNull(),
  nextStep: text('next_step'),
  status: text('status').default('open'), // 'open' | 'pursuing' | 'won' | 'dropped'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const meetingPrepItems = pgTable('meeting_prep_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // 'agenda' | 'question' | 'outcome'
  text: text('text').notNull(),
  rationale: text('rationale'),
  completed: boolean('completed').default(false),
  position: integer('position').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const actionItems = pgTable('action_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  notes: text('notes'),
  assignee: text('assignee'),
  dueDate: date('due_date'),
  status: text('status').default('open'),
  priority: text('priority').default('medium'),
  meetingId: uuid('meeting_id').references(() => meetings.id),
  contactId: uuid('contact_id').references(() => contacts.id),
  meetingTimestamp: text('meeting_timestamp'),
  doneToken: uuid('done_token').defaultRandom(),
  completedAt: timestamp('completed_at'),
  snoozedUntil: date('snoozed_until'),
  urgencyTier: text('urgency_tier').default('none'), // 'urgent' | 'this_week' | 'waiting_on' | 'none'
  ownerSide: text('owner_side'),                     // 'peter' | 'external' | null
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const statusHistory = pgTable('status_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  actionItemId: uuid('action_item_id').notNull().references(() => actionItems.id, { onDelete: 'cascade' }),
  oldStatus: text('old_status'),
  newStatus: text('new_status').notNull(),
  note: text('note'),
  changedBy: text('changed_by').default('Peter Schmitt'),
  changedAt: timestamp('changed_at').defaultNow(),
});

export const outreachLog = pgTable('outreach_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actionItemId: uuid('action_item_id').notNull().references(() => actionItems.id, { onDelete: 'cascade' }),
  assignee: text('assignee').notNull(),
  messageSent: text('message_sent').notNull(),
  emailTo: text('email_to'),
  emailSubject: text('email_subject'),
  emailSent: boolean('email_sent').default(false),
  sentAt: timestamp('sent_at').defaultNow(),
  response: text('response'),
  respondedAt: timestamp('responded_at'),
});

export type Company = typeof companies.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type MeetingAttendee = typeof meetingAttendees.$inferSelect;
export type MeetingTopic = typeof meetingTopics.$inferSelect;
export type Decision = typeof decisions.$inferSelect;
export type Risk = typeof risks.$inferSelect;
export type Opportunity = typeof opportunities.$inferSelect;
export type MeetingPrepItem = typeof meetingPrepItems.$inferSelect;
export type ActionItem = typeof actionItems.$inferSelect;
export type StatusHistory = typeof statusHistory.$inferSelect;
export type OutreachLog = typeof outreachLog.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;
export type NewMeetingAttendee = typeof meetingAttendees.$inferInsert;
export type NewMeetingTopic = typeof meetingTopics.$inferInsert;
export type NewDecision = typeof decisions.$inferInsert;
export type NewRisk = typeof risks.$inferInsert;
export type NewOpportunity = typeof opportunities.$inferInsert;
export type NewMeetingPrepItem = typeof meetingPrepItems.$inferInsert;
export type NewActionItem = typeof actionItems.$inferInsert;
```

- [ ] **Step 2: Fix `app/api/meetings/route.ts` — alias the renamed column**

The list endpoint and POST handler currently reference `meetings.aiSummary`. Aliasing in the SELECT keeps the consuming page (`app/meetings/page.tsx`) and `components/MeetingCard.tsx` working without changes. The POST handler still writes `participants` (column kept until Phase 8) so leave that.

Open `app/api/meetings/route.ts`. There are two select clauses (`select({...})` at line ~12 and a `fullSelect` const at line ~35). In each, change the line:

```ts
        aiSummary: meetings.aiSummary,
```

to:

```ts
        aiSummary: meetings.executiveSummary,
```

Leave the `participants: meetings.participants` lines unchanged — that column still exists.

- [ ] **Step 3: Fix `app/api/action-items/[id]/context/route.ts` — same alias**

Open `app/api/action-items/[id]/context/route.ts`. Find the `meetings` select around line 85:

```ts
          aiSummary: meetings.aiSummary,
```

Change to:

```ts
          aiSummary: meetings.executiveSummary,
```

- [ ] **Step 4: Fix `app/api/seed/route.ts` — write to the renamed column**

Open `app/api/seed/route.ts`. At line ~2602:

```ts
        aiSummary: m.summary || null,
```

Change to:

```ts
        executiveSummary: m.summary || null,
```

- [ ] **Step 5: Type-check**

Run: `npm run lint`
Expected: errors remaining only in files that later tasks rewrite — `app/api/meetings/[id]/route.ts` (Task 11), `app/api/meetings/[id]/extract/route.ts` (Task 13), `lib/extract.ts` (Task 12), `app/meetings/[id]/page.tsx` (Task 25), and `app/api/import/paste/route.ts` + `app/api/import/gdrive/route.ts` (Task 13). The five files just touched should be clean.

If ESLint flags anything in the five files just modified (schema.ts, meetings list route, action-items context route, seed route), fix before proceeding.

- [ ] **Step 6: Commit**

```bash
git add lib/schema.ts app/api/meetings/route.ts app/api/action-items/[id]/context/route.ts app/api/seed/route.ts
git commit -m "Schema: recap entities + rename ai_summary; alias renamed column for list endpoints"
```

---

### Task 2: Migration SQL

**Files:**
- Modify: `app/api/admin/migrate/route.ts`

- [ ] **Step 1: Replace the STATEMENTS array**

Open `app/api/admin/migrate/route.ts` and replace the existing `const STATEMENTS = [ ... ]` block with:

```ts
const STATEMENTS = [
  // existing additive migrations
  `ALTER TABLE outreach_log ADD COLUMN IF NOT EXISTS email_to TEXT`,
  `ALTER TABLE outreach_log ADD COLUMN IF NOT EXISTS email_subject TEXT`,
  `ALTER TABLE outreach_log ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE action_items ADD COLUMN IF NOT EXISTS snoozed_until DATE`,
  `ALTER TABLE action_items ADD COLUMN IF NOT EXISTS notes TEXT`,
  `ALTER TABLE action_items ADD COLUMN IF NOT EXISTS meeting_timestamp TEXT`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS meeting_time TEXT`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS platform TEXT`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS transcript TEXT`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS chapters TEXT`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS key_questions TEXT[]`,

  // recap detail (2026-04-25)
  // 1. action_items: urgency tier + owner side
  `ALTER TABLE action_items ADD COLUMN IF NOT EXISTS urgency_tier TEXT DEFAULT 'none'`,
  `ALTER TABLE action_items ADD COLUMN IF NOT EXISTS owner_side TEXT`,

  // 2. meetings: effectiveness fields
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS productive_minutes INTEGER`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS asyncable_minutes INTEGER`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS tangent_minutes INTEGER`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS improvement_note TEXT`,

  // 3. ai_summary -> executive_summary rename, idempotent (safe to re-run)
  `DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meetings' AND column_name='ai_summary')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meetings' AND column_name='executive_summary')
     THEN
       ALTER TABLE meetings RENAME COLUMN ai_summary TO executive_summary;
     END IF;
   END $$`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS executive_summary TEXT`,

  // 4. New tables
  `CREATE TABLE IF NOT EXISTS meeting_attendees (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
     contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
     name TEXT NOT NULL,
     role_at_meeting TEXT,
     engagement TEXT,
     position INTEGER DEFAULT 0,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_meeting_attendees_meeting ON meeting_attendees(meeting_id)`,

  `CREATE TABLE IF NOT EXISTS meeting_topics (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     content TEXT,
     position INTEGER DEFAULT 0,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_meeting_topics_meeting ON meeting_topics(meeting_id)`,

  `CREATE TABLE IF NOT EXISTS decisions (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
     decision TEXT NOT NULL,
     owner TEXT,
     contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
     implication TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_decisions_meeting ON decisions(meeting_id)`,

  `CREATE TABLE IF NOT EXISTS risks (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
     risk TEXT NOT NULL,
     why_it_matters TEXT,
     mitigation TEXT,
     severity TEXT DEFAULT 'medium',
     status TEXT DEFAULT 'open',
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_risks_meeting ON risks(meeting_id)`,
  `CREATE INDEX IF NOT EXISTS idx_risks_status ON risks(status)`,

  `CREATE TABLE IF NOT EXISTS opportunities (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
     opportunity TEXT NOT NULL,
     next_step TEXT,
     status TEXT DEFAULT 'open',
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_opportunities_meeting ON opportunities(meeting_id)`,
  `CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status)`,

  `CREATE TABLE IF NOT EXISTS meeting_prep_items (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
     kind TEXT NOT NULL,
     text TEXT NOT NULL,
     rationale TEXT,
     completed BOOLEAN DEFAULT FALSE,
     position INTEGER DEFAULT 0,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_meeting_prep_items_meeting ON meeting_prep_items(meeting_id)`,

  // 5. Backfill participants -> meeting_attendees, idempotent.
  // Only inserts if no attendee rows exist for that meeting yet, so re-runs are safe.
  `INSERT INTO meeting_attendees (meeting_id, name, position)
   SELECT m.id, trim(p.name), (p.ord - 1)::int
   FROM meetings m
   CROSS JOIN LATERAL unnest(COALESCE(m.participants, ARRAY[]::text[])) WITH ORDINALITY AS p(name, ord)
   WHERE m.participants IS NOT NULL
     AND array_length(m.participants, 1) > 0
     AND NOT EXISTS (SELECT 1 FROM meeting_attendees a WHERE a.meeting_id = m.id)
     AND length(trim(p.name)) > 0`,
];
```

- [ ] **Step 2: Type-check**

Run: `npm run lint`
Expected: only the pre-existing breakage from the rename remains. The migrate route itself should be clean.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/migrate/route.ts
git commit -m "Migrate route: recap detail tables + columns + participants backfill"
```

---

### Task 3: Apply migration locally

**Files:** none modified.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server boots on http://localhost:3000. (It will fail at runtime if any code path hits a renamed column — that's fixed in later tasks. The migration endpoint itself does not depend on the rest of the app type-checking.)

- [ ] **Step 2: Hit the migrate endpoint**

The migrate endpoint requires `SEED_TOKEN`. Get the token from `.env.local` (look for `SEED_TOKEN=...`). If the project doesn't have one yet, set one in `.env.local`:

```
SEED_TOKEN=local-dev-token
```

Run:
```bash
curl -X POST 'http://localhost:3000/api/admin/migrate?token=local-dev-token'
```
Expected: HTTP 200 with JSON `{ "applied": <N>, "failed": 0, "results": [...] }`. If `failed > 0`, inspect the `results` array for the SQL error and fix.

- [ ] **Step 3: Verify schema**

Connect to the local Postgres (whatever `DATABASE_URL` in `.env.local` points to) and run:

```sql
\d meeting_attendees
\d meeting_topics
\d decisions
\d risks
\d opportunities
\d meeting_prep_items
\d meetings
\d action_items
```

Expected:
- All six new tables exist with the columns from Task 1.
- `meetings` has `executive_summary`, `duration_minutes`, `productive_minutes`, `asyncable_minutes`, `tangent_minutes`, `improvement_note`.
- `action_items` has `urgency_tier` (default `'none'`) and `owner_side`.
- For any meeting with non-empty `participants`, corresponding rows now exist in `meeting_attendees`. Spot-check with:
  ```sql
  SELECT m.id, m.participants, COUNT(a.id) AS attendees
  FROM meetings m LEFT JOIN meeting_attendees a ON a.meeting_id = m.id
  GROUP BY m.id, m.participants
  LIMIT 10;
  ```
  Each row's `attendees` count should equal `array_length(participants, 1)`.

- [ ] **Step 4: Re-run migration to confirm idempotency**

Run the same curl again. Expected: HTTP 200, `failed: 0`, attendees row counts unchanged.

- [ ] **Step 5: Commit nothing (no file changes)**

This task verifies the prior commits work end-to-end. No commit needed.

---

## Phase 2 — Entity CRUD APIs

All routes follow the same conventions as `app/api/action-items/route.ts` and `app/api/action-items/[id]/route.ts`:
- `try { ... } catch (error) { console.error(...); return 500 }` outer envelope.
- Body fields all optional in PATCH; only update what's present.
- Always set `updatedAt = new Date()` on PATCH.
- Return the updated/created row JSON; on miss, 404.

### Task 4: Decisions API

**Files:**
- Create: `app/api/meetings/[id]/decisions/route.ts`
- Create: `app/api/decisions/route.ts`
- Create: `app/api/decisions/[id]/route.ts`

- [ ] **Step 1: Create meeting-scoped POST**

Create `app/api/meetings/[id]/decisions/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decisions } from '@/lib/schema';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    const body = (await request.json()) as {
      decision: string;
      owner?: string | null;
      contactId?: string | null;
      implication?: string | null;
    };

    if (!body.decision || !body.decision.trim()) {
      return NextResponse.json({ error: 'decision is required' }, { status: 400 });
    }

    const [created] = await db
      .insert(decisions)
      .values({
        meetingId,
        decision: body.decision.trim(),
        owner: body.owner ?? null,
        contactId: body.contactId ?? null,
        implication: body.implication ?? null,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[POST /api/meetings/[id]/decisions]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create cross-meeting GET list**

Create `app/api/decisions/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decisions, meetings, companies } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(_request: NextRequest) {
  try {
    const rows = await db
      .select({
        id: decisions.id,
        decision: decisions.decision,
        owner: decisions.owner,
        contactId: decisions.contactId,
        implication: decisions.implication,
        meetingId: decisions.meetingId,
        meetingTitle: meetings.title,
        meetingDate: meetings.meetingDate,
        companyId: meetings.companyId,
        companyName: companies.name,
        createdAt: decisions.createdAt,
        updatedAt: decisions.updatedAt,
      })
      .from(decisions)
      .leftJoin(meetings, eq(decisions.meetingId, meetings.id))
      .leftJoin(companies, eq(meetings.companyId, companies.id));

    return NextResponse.json(rows);
  } catch (error) {
    console.error('[GET /api/decisions]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create per-row PATCH/DELETE**

Create `app/api/decisions/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decisions } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      decision?: string;
      owner?: string | null;
      contactId?: string | null;
      implication?: string | null;
    };

    const updates: Record<string, unknown> = {};
    if (body.decision !== undefined) updates.decision = body.decision;
    if (body.owner !== undefined) updates.owner = body.owner;
    if (body.contactId !== undefined) updates.contactId = body.contactId;
    if (body.implication !== undefined) updates.implication = body.implication;
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(decisions)
      .set(updates)
      .where(eq(decisions.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/decisions/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db.delete(decisions).where(eq(decisions.id, id)).returning();
    if (!deleted) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/decisions/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds for these three new files. (Other unrelated build errors from the rename remain — those are fixed in Phase 3. Confirm there are no errors specifically in the three files just created.)

- [ ] **Step 5: Smoke-test the routes**

With dev server running and a known meeting id (find one with `SELECT id FROM meetings LIMIT 1;`):

```bash
# Create
curl -X POST http://localhost:3000/api/meetings/<MEETING_ID>/decisions \
  -H 'Content-Type: application/json' \
  -d '{"decision":"Test decision","owner":"Sarah","implication":"None"}'
# -> 201 with the row, capture the id

# List
curl http://localhost:3000/api/decisions
# -> array including the row, with meetingTitle joined

# Patch
curl -X PATCH http://localhost:3000/api/decisions/<DECISION_ID> \
  -H 'Content-Type: application/json' \
  -d '{"implication":"Updated"}'

# Delete
curl -X DELETE http://localhost:3000/api/decisions/<DECISION_ID>
# -> {"success":true}
```

- [ ] **Step 6: Commit**

```bash
git add app/api/meetings/[id]/decisions app/api/decisions
git commit -m "API: decisions CRUD + cross-meeting list"
```

---

### Task 5: Risks API

**Files:**
- Create: `app/api/meetings/[id]/risks/route.ts`
- Create: `app/api/risks/route.ts`
- Create: `app/api/risks/[id]/route.ts`

- [ ] **Step 1: Create meeting-scoped POST**

Create `app/api/meetings/[id]/risks/route.ts`:

```ts
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
```

- [ ] **Step 2: Create cross-meeting GET list**

Create `app/api/risks/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { risks, meetings, companies } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(_request: NextRequest) {
  try {
    const rows = await db
      .select({
        id: risks.id,
        risk: risks.risk,
        whyItMatters: risks.whyItMatters,
        mitigation: risks.mitigation,
        severity: risks.severity,
        status: risks.status,
        meetingId: risks.meetingId,
        meetingTitle: meetings.title,
        meetingDate: meetings.meetingDate,
        companyId: meetings.companyId,
        companyName: companies.name,
        createdAt: risks.createdAt,
        updatedAt: risks.updatedAt,
      })
      .from(risks)
      .leftJoin(meetings, eq(risks.meetingId, meetings.id))
      .leftJoin(companies, eq(meetings.companyId, companies.id));

    return NextResponse.json(rows);
  } catch (error) {
    console.error('[GET /api/risks]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create per-row PATCH/DELETE**

Create `app/api/risks/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { risks } from '@/lib/schema';
import { eq } from 'drizzle-orm';

const VALID_SEVERITY = ['low', 'medium', 'high'];
const VALID_STATUS = ['open', 'mitigated', 'accepted'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      risk?: string;
      whyItMatters?: string | null;
      mitigation?: string | null;
      severity?: string;
      status?: string;
    };

    const updates: Record<string, unknown> = {};
    if (body.risk !== undefined) updates.risk = body.risk;
    if (body.whyItMatters !== undefined) updates.whyItMatters = body.whyItMatters;
    if (body.mitigation !== undefined) updates.mitigation = body.mitigation;
    if (body.severity !== undefined) {
      if (!VALID_SEVERITY.includes(body.severity)) {
        return NextResponse.json({ error: 'invalid severity' }, { status: 400 });
      }
      updates.severity = body.severity;
    }
    if (body.status !== undefined) {
      if (!VALID_STATUS.includes(body.status)) {
        return NextResponse.json({ error: 'invalid status' }, { status: 400 });
      }
      updates.status = body.status;
    }
    updates.updatedAt = new Date();

    const [updated] = await db.update(risks).set(updates).where(eq(risks.id, id)).returning();
    if (!updated) {
      return NextResponse.json({ error: 'Risk not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/risks/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db.delete(risks).where(eq(risks.id, id)).returning();
    if (!deleted) {
      return NextResponse.json({ error: 'Risk not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/risks/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Build + smoke-test**

Run: `npm run build` (only the new files should be considered; pre-existing rename errors persist).

Smoke-test using the same curl pattern from Task 4 Step 5, substituting `risks` for `decisions` and using a `risk` body field. Hit each of POST, GET, PATCH (try setting `severity: "high"`), DELETE.

- [ ] **Step 5: Commit**

```bash
git add app/api/meetings/[id]/risks app/api/risks
git commit -m "API: risks CRUD + cross-meeting list"
```

---

### Task 6: Opportunities API

**Files:**
- Create: `app/api/meetings/[id]/opportunities/route.ts`
- Create: `app/api/opportunities/route.ts`
- Create: `app/api/opportunities/[id]/route.ts`

- [ ] **Step 1: Create meeting-scoped POST**

Create `app/api/meetings/[id]/opportunities/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { opportunities } from '@/lib/schema';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    const body = (await request.json()) as {
      opportunity: string;
      nextStep?: string | null;
    };

    if (!body.opportunity || !body.opportunity.trim()) {
      return NextResponse.json({ error: 'opportunity is required' }, { status: 400 });
    }

    const [created] = await db
      .insert(opportunities)
      .values({
        meetingId,
        opportunity: body.opportunity.trim(),
        nextStep: body.nextStep ?? null,
        status: 'open',
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[POST /api/meetings/[id]/opportunities]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create cross-meeting GET list**

Create `app/api/opportunities/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { opportunities, meetings, companies } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(_request: NextRequest) {
  try {
    const rows = await db
      .select({
        id: opportunities.id,
        opportunity: opportunities.opportunity,
        nextStep: opportunities.nextStep,
        status: opportunities.status,
        meetingId: opportunities.meetingId,
        meetingTitle: meetings.title,
        meetingDate: meetings.meetingDate,
        companyId: meetings.companyId,
        companyName: companies.name,
        createdAt: opportunities.createdAt,
        updatedAt: opportunities.updatedAt,
      })
      .from(opportunities)
      .leftJoin(meetings, eq(opportunities.meetingId, meetings.id))
      .leftJoin(companies, eq(meetings.companyId, companies.id));

    return NextResponse.json(rows);
  } catch (error) {
    console.error('[GET /api/opportunities]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create per-row PATCH/DELETE**

Create `app/api/opportunities/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { opportunities } from '@/lib/schema';
import { eq } from 'drizzle-orm';

const VALID_STATUS = ['open', 'pursuing', 'won', 'dropped'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      opportunity?: string;
      nextStep?: string | null;
      status?: string;
    };

    const updates: Record<string, unknown> = {};
    if (body.opportunity !== undefined) updates.opportunity = body.opportunity;
    if (body.nextStep !== undefined) updates.nextStep = body.nextStep;
    if (body.status !== undefined) {
      if (!VALID_STATUS.includes(body.status)) {
        return NextResponse.json({ error: 'invalid status' }, { status: 400 });
      }
      updates.status = body.status;
    }
    updates.updatedAt = new Date();

    const [updated] = await db.update(opportunities).set(updates).where(eq(opportunities.id, id)).returning();
    if (!updated) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/opportunities/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db.delete(opportunities).where(eq(opportunities.id, id)).returning();
    if (!deleted) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/opportunities/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Build + smoke-test**

Same shape as Task 5 Step 4: `npm run build`, then curl POST/GET/PATCH/DELETE on the new routes.

- [ ] **Step 5: Commit**

```bash
git add app/api/meetings/[id]/opportunities app/api/opportunities
git commit -m "API: opportunities CRUD + cross-meeting list"
```

---

### Task 7: Attendees API

**Files:**
- Create: `app/api/meetings/[id]/attendees/route.ts`
- Create: `app/api/attendees/[id]/route.ts`

(No cross-meeting list — attendees are always viewed in a meeting context.)

- [ ] **Step 1: Create meeting-scoped POST**

Create `app/api/meetings/[id]/attendees/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetingAttendees } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

const VALID_ENGAGEMENT = ['dominant', 'active', 'quiet'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    const body = (await request.json()) as {
      name: string;
      roleAtMeeting?: string | null;
      engagement?: string | null;
      contactId?: string | null;
    };

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (body.engagement && !VALID_ENGAGEMENT.includes(body.engagement)) {
      return NextResponse.json({ error: 'invalid engagement' }, { status: 400 });
    }

    // Place new row at the end of the meeting's existing attendees.
    const [{ maxPos }] = await db
      .select({ maxPos: sql<number>`COALESCE(MAX(${meetingAttendees.position}), -1)` })
      .from(meetingAttendees)
      .where(eq(meetingAttendees.meetingId, meetingId));

    const [created] = await db
      .insert(meetingAttendees)
      .values({
        meetingId,
        name: body.name.trim(),
        roleAtMeeting: body.roleAtMeeting ?? null,
        engagement: body.engagement ?? null,
        contactId: body.contactId ?? null,
        position: (Number(maxPos) ?? -1) + 1,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[POST /api/meetings/[id]/attendees]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create per-row PATCH/DELETE**

Create `app/api/attendees/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetingAttendees } from '@/lib/schema';
import { eq } from 'drizzle-orm';

const VALID_ENGAGEMENT = ['dominant', 'active', 'quiet'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      name?: string;
      roleAtMeeting?: string | null;
      engagement?: string | null;
      contactId?: string | null;
    };

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.roleAtMeeting !== undefined) updates.roleAtMeeting = body.roleAtMeeting;
    if (body.contactId !== undefined) updates.contactId = body.contactId;
    if (body.engagement !== undefined) {
      if (body.engagement !== null && !VALID_ENGAGEMENT.includes(body.engagement)) {
        return NextResponse.json({ error: 'invalid engagement' }, { status: 400 });
      }
      updates.engagement = body.engagement;
    }
    updates.updatedAt = new Date();

    const [updated] = await db.update(meetingAttendees).set(updates).where(eq(meetingAttendees.id, id)).returning();
    if (!updated) {
      return NextResponse.json({ error: 'Attendee not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/attendees/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db.delete(meetingAttendees).where(eq(meetingAttendees.id, id)).returning();
    if (!deleted) {
      return NextResponse.json({ error: 'Attendee not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/attendees/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Build + smoke-test**

Run: `npm run build`. Smoke-test POST/PATCH/DELETE.

- [ ] **Step 4: Commit**

```bash
git add app/api/meetings/[id]/attendees app/api/attendees
git commit -m "API: meeting attendees CRUD"
```

---

### Task 8: Topics API

**Files:**
- Create: `app/api/meetings/[id]/topics/route.ts`
- Create: `app/api/topics/[id]/route.ts`

- [ ] **Step 1: Create meeting-scoped POST**

Create `app/api/meetings/[id]/topics/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetingTopics } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    const body = (await request.json()) as {
      title: string;
      content?: string | null;
    };

    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const [{ maxPos }] = await db
      .select({ maxPos: sql<number>`COALESCE(MAX(${meetingTopics.position}), -1)` })
      .from(meetingTopics)
      .where(eq(meetingTopics.meetingId, meetingId));

    const [created] = await db
      .insert(meetingTopics)
      .values({
        meetingId,
        title: body.title.trim(),
        content: body.content ?? null,
        position: (Number(maxPos) ?? -1) + 1,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[POST /api/meetings/[id]/topics]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create per-row PATCH/DELETE**

Create `app/api/topics/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetingTopics } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      title?: string;
      content?: string | null;
      position?: number;
    };

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.content !== undefined) updates.content = body.content;
    if (body.position !== undefined) updates.position = body.position;
    updates.updatedAt = new Date();

    const [updated] = await db.update(meetingTopics).set(updates).where(eq(meetingTopics.id, id)).returning();
    if (!updated) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/topics/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db.delete(meetingTopics).where(eq(meetingTopics.id, id)).returning();
    if (!deleted) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/topics/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Build + smoke-test**

Run: `npm run build`. Smoke-test POST/PATCH/DELETE.

- [ ] **Step 4: Commit**

```bash
git add app/api/meetings/[id]/topics app/api/topics
git commit -m "API: meeting topics CRUD"
```

---

### Task 9: Prep Items API

**Files:**
- Create: `app/api/meetings/[id]/prep-items/route.ts`
- Create: `app/api/prep-items/[id]/route.ts`

- [ ] **Step 1: Create meeting-scoped POST**

Create `app/api/meetings/[id]/prep-items/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetingPrepItems } from '@/lib/schema';
import { and, eq, sql } from 'drizzle-orm';

const VALID_KIND = ['agenda', 'question', 'outcome'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    const body = (await request.json()) as {
      kind: string;
      text: string;
      rationale?: string | null;
    };

    if (!body.text || !body.text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    if (!VALID_KIND.includes(body.kind)) {
      return NextResponse.json({ error: 'invalid kind' }, { status: 400 });
    }

    const [{ maxPos }] = await db
      .select({ maxPos: sql<number>`COALESCE(MAX(${meetingPrepItems.position}), -1)` })
      .from(meetingPrepItems)
      .where(and(eq(meetingPrepItems.meetingId, meetingId), eq(meetingPrepItems.kind, body.kind)));

    const [created] = await db
      .insert(meetingPrepItems)
      .values({
        meetingId,
        kind: body.kind,
        text: body.text.trim(),
        rationale: body.kind === 'agenda' ? (body.rationale ?? null) : null,
        completed: false,
        position: (Number(maxPos) ?? -1) + 1,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[POST /api/meetings/[id]/prep-items]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create per-row PATCH/DELETE**

Create `app/api/prep-items/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetingPrepItems } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      text?: string;
      rationale?: string | null;
      completed?: boolean;
    };

    const updates: Record<string, unknown> = {};
    if (body.text !== undefined) updates.text = body.text;
    if (body.rationale !== undefined) updates.rationale = body.rationale;
    if (body.completed !== undefined) updates.completed = body.completed;
    updates.updatedAt = new Date();

    const [updated] = await db.update(meetingPrepItems).set(updates).where(eq(meetingPrepItems.id, id)).returning();
    if (!updated) {
      return NextResponse.json({ error: 'Prep item not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/prep-items/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db.delete(meetingPrepItems).where(eq(meetingPrepItems.id, id)).returning();
    if (!deleted) {
      return NextResponse.json({ error: 'Prep item not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/prep-items/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Build + smoke-test**

Smoke-test POST with each `kind` value (agenda/question/outcome), plus PATCH `completed: true` on an outcome row.

- [ ] **Step 4: Commit**

```bash
git add app/api/meetings/[id]/prep-items app/api/prep-items
git commit -m "API: meeting prep items CRUD"
```

---

## Phase 3 — Action items + meetings extensions

### Task 10: action_items PATCH accepts urgency_tier + owner_side

**Files:**
- Modify: `app/api/action-items/[id]/route.ts`

- [ ] **Step 1: Add field handling to PATCH**

Open `app/api/action-items/[id]/route.ts`. The current PATCH body type lists `status`, `title`, `assignee`, `dueDate`, `priority`, `description`, `notes`, `snoozedUntil`, `note`. Replace the body type and the per-field updates block with the following extended versions.

Body type — change from:

```ts
const body = (await request.json()) as {
  status?: string;
  title?: string;
  assignee?: string | null;
  dueDate?: string | null;
  priority?: string;
  description?: string | null;
  notes?: string | null;
  snoozedUntil?: string | null;
  note?: string;
};
```

to:

```ts
const body = (await request.json()) as {
  status?: string;
  title?: string;
  assignee?: string | null;
  dueDate?: string | null;
  priority?: string;
  description?: string | null;
  notes?: string | null;
  snoozedUntil?: string | null;
  note?: string;
  urgencyTier?: string;
  ownerSide?: string | null;
};
```

Then in the updates-collection block, after the existing `if (body.snoozedUntil !== undefined) updates.snoozedUntil = body.snoozedUntil;` line, add:

```ts
if (body.urgencyTier !== undefined) {
  if (!['urgent', 'this_week', 'waiting_on', 'none'].includes(body.urgencyTier)) {
    return NextResponse.json({ error: 'invalid urgencyTier' }, { status: 400 });
  }
  updates.urgencyTier = body.urgencyTier;
}
if (body.ownerSide !== undefined) {
  if (body.ownerSide !== null && !['peter', 'external'].includes(body.ownerSide)) {
    return NextResponse.json({ error: 'invalid ownerSide' }, { status: 400 });
  }
  updates.ownerSide = body.ownerSide;
}
```

- [ ] **Step 2: Verify**

Run: `npm run lint`
Expected: no new errors.

Smoke-test:
```bash
# Pick any open action_item id
curl -X PATCH http://localhost:3000/api/action-items/<ID> \
  -H 'Content-Type: application/json' \
  -d '{"urgencyTier":"urgent","ownerSide":"peter"}'
# -> 200 with row including the new field values
```

- [ ] **Step 3: Commit**

```bash
git add app/api/action-items/[id]/route.ts
git commit -m "API: action items accept urgency_tier and owner_side"
```

---

### Task 11: meetings GET returns related entities; PATCH accepts effectiveness fields

**Files:**
- Modify: `app/api/meetings/[id]/route.ts`

- [ ] **Step 1: Replace the file contents**

Open `app/api/meetings/[id]/route.ts` and replace the entire file with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  meetings,
  companies,
  actionItems,
  meetingAttendees,
  meetingTopics,
  decisions,
  risks,
  opportunities,
  meetingPrepItems,
} from '@/lib/schema';
import { asc, eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [meeting] = await db
      .select({
        id: meetings.id,
        title: meetings.title,
        meetingDate: meetings.meetingDate,
        meetingTime: meetings.meetingTime,
        platform: meetings.platform,
        rawNotes: meetings.rawNotes,
        executiveSummary: meetings.executiveSummary,
        transcript: meetings.transcript,
        chapters: meetings.chapters,
        keyQuestions: meetings.keyQuestions,
        source: meetings.source,
        gdriveFileId: meetings.gdriveFileId,
        companyId: meetings.companyId,
        companyName: companies.name,
        durationMinutes: meetings.durationMinutes,
        productiveMinutes: meetings.productiveMinutes,
        asyncableMinutes: meetings.asyncableMinutes,
        tangentMinutes: meetings.tangentMinutes,
        improvementNote: meetings.improvementNote,
        createdAt: meetings.createdAt,
        updatedAt: meetings.updatedAt,
      })
      .from(meetings)
      .leftJoin(companies, eq(meetings.companyId, companies.id))
      .where(eq(meetings.id, id))
      .limit(1);

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const [attendeeRows, topicRows, decisionRows, actionRows, riskRows, oppRows, prepRows] = await Promise.all([
      db.select().from(meetingAttendees).where(eq(meetingAttendees.meetingId, id)).orderBy(asc(meetingAttendees.position)),
      db.select().from(meetingTopics).where(eq(meetingTopics.meetingId, id)).orderBy(asc(meetingTopics.position)),
      db.select().from(decisions).where(eq(decisions.meetingId, id)).orderBy(asc(decisions.createdAt)),
      db.select().from(actionItems).where(eq(actionItems.meetingId, id)).orderBy(asc(actionItems.createdAt)),
      db.select().from(risks).where(eq(risks.meetingId, id)).orderBy(asc(risks.createdAt)),
      db.select().from(opportunities).where(eq(opportunities.meetingId, id)).orderBy(asc(opportunities.createdAt)),
      db.select().from(meetingPrepItems).where(eq(meetingPrepItems.meetingId, id)).orderBy(asc(meetingPrepItems.position)),
    ]);

    return NextResponse.json({
      ...meeting,
      attendees: attendeeRows,
      topics: topicRows,
      decisions: decisionRows,
      actionItems: actionRows,
      risks: riskRows,
      opportunities: oppRows,
      prepItems: prepRows,
    });
  } catch (error) {
    console.error('[GET /api/meetings/[id]]', error);
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
      title?: string;
      rawNotes?: string;
      executiveSummary?: string | null;
      meetingDate?: string;
      durationMinutes?: number | null;
      productiveMinutes?: number | null;
      asyncableMinutes?: number | null;
      tangentMinutes?: number | null;
      improvementNote?: string | null;
    };

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.rawNotes !== undefined) updates.rawNotes = body.rawNotes;
    if (body.executiveSummary !== undefined) updates.executiveSummary = body.executiveSummary;
    if (body.meetingDate !== undefined) updates.meetingDate = new Date(body.meetingDate);
    if (body.durationMinutes !== undefined) updates.durationMinutes = body.durationMinutes;
    if (body.productiveMinutes !== undefined) updates.productiveMinutes = body.productiveMinutes;
    if (body.asyncableMinutes !== undefined) updates.asyncableMinutes = body.asyncableMinutes;
    if (body.tangentMinutes !== undefined) updates.tangentMinutes = body.tangentMinutes;
    if (body.improvementNote !== undefined) updates.improvementNote = body.improvementNote;
    updates.updatedAt = new Date();

    const [updated] = await db.update(meetings).set(updates).where(eq(meetings.id, id)).returning();
    if (!updated) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/meetings/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // FK cascades handle attendees/topics/decisions/risks/opportunities/prep_items.
    // action_items has ON DELETE SET NULL on meeting_id (current schema), so delete them explicitly to keep behavior identical to the prior route.
    await db.delete(actionItems).where(eq(actionItems.meetingId, id));
    const [deleted] = await db.delete(meetings).where(eq(meetings.id, id)).returning();
    if (!deleted) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/meetings/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: this file compiles. Other files (the detail page, list pages that read `aiSummary`/`participants`) may still error — those are fixed in later tasks. Confirm `app/api/meetings/[id]/route.ts` itself has no errors in the build output.

Smoke-test:
```bash
curl http://localhost:3000/api/meetings/<MEETING_ID>
# -> JSON with executiveSummary, attendees, topics, decisions, actionItems, risks, opportunities, prepItems arrays

curl -X PATCH http://localhost:3000/api/meetings/<MEETING_ID> \
  -H 'Content-Type: application/json' \
  -d '{"durationMinutes":45,"productiveMinutes":30,"improvementNote":"Test"}'
# -> 200 with updated row
```

- [ ] **Step 3: Commit**

```bash
git add app/api/meetings/[id]/route.ts
git commit -m "API: meetings GET returns related entities; PATCH accepts effectiveness fields"
```

---

## Phase 4 — Extraction overhaul

### Task 12: Rewrite `lib/extract.ts`

**Files:**
- Modify: `lib/extract.ts`

The new extract module exposes two functions:
- `extractAndSave(meetingId, rawNotes)` — initial extract; writes every structured field including action_items.
- `reExtractAndSave(meetingId, rawNotes)` — re-extract; writes everything **except** action_items (per spec — action_items are user-managed).

Both call a shared `runExtractionLLM` that returns the parsed JSON. After parse, attendees are matched to existing contacts by case-insensitive name to populate `contactId`. Re-extract clears existing rows for attendees / topics / decisions / risks / opportunities / prep_items before re-inserting.

- [ ] **Step 1: Replace the file contents**

Replace `lib/extract.ts` with:

```ts
import { db } from '@/lib/db';
import {
  meetings,
  actionItems,
  meetingAttendees,
  meetingTopics,
  decisions,
  risks,
  opportunities,
  meetingPrepItems,
  contacts,
  type NewActionItem,
  type NewMeetingAttendee,
  type NewMeetingTopic,
  type NewDecision,
  type NewRisk,
  type NewOpportunity,
  type NewMeetingPrepItem,
} from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { getOpenAI } from '@/lib/openai';

interface ExtractedAttendee {
  name: string;
  role: string | null;
  engagement: 'dominant' | 'active' | 'quiet' | null;
}

interface ExtractedTopic {
  title: string;
  content: string;
}

interface ExtractedDecision {
  decision: string;
  owner: string | null;
  implication: string | null;
}

interface ExtractedActionItem {
  title: string;
  description: string | null;
  assignee: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  urgency_tier: 'urgent' | 'this_week' | 'waiting_on' | 'none';
  owner_side: 'peter' | 'external' | null;
}

interface ExtractedRisk {
  risk: string;
  why_it_matters: string | null;
  mitigation: string | null;
  severity: 'low' | 'medium' | 'high';
}

interface ExtractedOpportunity {
  opportunity: string;
  next_step: string | null;
}

interface ExtractedPrep {
  agenda: { text: string; rationale: string | null }[];
  questions: string[];
  outcomes: string[];
}

interface ExtractedEffectiveness {
  duration_minutes: number | null;
  productive_minutes: number | null;
  asyncable_minutes: number | null;
  tangent_minutes: number | null;
  improvement_note: string | null;
}

interface ExtractedRecap {
  title: string;
  executive_summary: string;
  attendees: ExtractedAttendee[];
  topics: ExtractedTopic[];
  decisions: ExtractedDecision[];
  action_items: ExtractedActionItem[];
  risks: ExtractedRisk[];
  opportunities: ExtractedOpportunity[];
  next_meeting_prep: ExtractedPrep;
  effectiveness: ExtractedEffectiveness;
}

const SYSTEM_PROMPT = `You are an expert meeting analyst. From raw notes (or a transcript), produce a complete structured recap.

Respond ONLY with valid JSON — no markdown, no code fences, no explanation. The JSON object MUST contain every key listed below; use empty arrays / nulls when information is unavailable.

Style: write each piece of prose as narrative bullets — full sentences with weight, not labels. For multi-bullet text fields (executive_summary, topics[].content), separate bullets with a single newline ("\\n"), and DO NOT include leading bullet characters ("-", "*", "•"). One bullet per line.

Keys:
- "title": short meeting title (string)
- "executive_summary": 4-8 narrative bullets, newline-separated, summarizing the meeting at a glance
- "attendees": array of { "name", "role" (or null), "engagement": "dominant"|"active"|"quiet"|null }
- "topics": array of { "title", "content" } — each topic's content is multi-bullet narrative, newline-separated
- "decisions": array of { "decision", "owner" (or null), "implication" (or null) }
- "action_items": array of { "title", "description" (or null), "assignee" (or null), "due_date" (YYYY-MM-DD or null), "priority": "low"|"medium"|"high"|"critical", "urgency_tier": "urgent"|"this_week"|"waiting_on"|"none", "owner_side": "peter"|"external"|null }
  - urgency_tier reflects what was said in the meeting, NOT what the date implies. "urgent" = needs to happen in 24h. "this_week" = within the week. "waiting_on" = blocked on someone else's response. "none" = no urgency stated.
  - owner_side is "peter" if Peter Schmitt owes it, "external" if anyone else does, null if unclear.
- "risks": array of { "risk", "why_it_matters" (or null), "mitigation" (or null), "severity": "low"|"medium"|"high" }
- "opportunities": array of { "opportunity", "next_step" (or null) }
- "next_meeting_prep": { "agenda": [{ "text", "rationale" (or null) }], "questions": ["..."], "outcomes": ["..."] }
- "effectiveness": { "duration_minutes" (or null), "productive_minutes" (or null), "asyncable_minutes" (or null), "tangent_minutes" (or null), "improvement_note" (or null) }`;

async function runExtractionLLM(rawNotes: string): Promise<ExtractedRecap> {
  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Raw meeting notes:\n\n${rawNotes}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });
  const raw = completion.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw) as Partial<ExtractedRecap>;

  // Normalize — fill defaults for missing keys so callers never have to null-check.
  return {
    title: typeof parsed.title === 'string' ? parsed.title : '',
    executive_summary: typeof parsed.executive_summary === 'string' ? parsed.executive_summary : '',
    attendees: Array.isArray(parsed.attendees) ? parsed.attendees : [],
    topics: Array.isArray(parsed.topics) ? parsed.topics : [],
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
    next_meeting_prep: {
      agenda: Array.isArray(parsed.next_meeting_prep?.agenda) ? parsed.next_meeting_prep!.agenda : [],
      questions: Array.isArray(parsed.next_meeting_prep?.questions) ? parsed.next_meeting_prep!.questions : [],
      outcomes: Array.isArray(parsed.next_meeting_prep?.outcomes) ? parsed.next_meeting_prep!.outcomes : [],
    },
    effectiveness: {
      duration_minutes: parsed.effectiveness?.duration_minutes ?? null,
      productive_minutes: parsed.effectiveness?.productive_minutes ?? null,
      asyncable_minutes: parsed.effectiveness?.asyncable_minutes ?? null,
      tangent_minutes: parsed.effectiveness?.tangent_minutes ?? null,
      improvement_note: parsed.effectiveness?.improvement_note ?? null,
    },
  };
}

async function matchContactIdByName(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const [hit] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(sql`lower(${contacts.fullName}) = lower(${trimmed})`)
    .limit(1);
  return hit?.id ?? null;
}

async function persistRecap(meetingId: string, recap: ExtractedRecap, includeActionItems: boolean): Promise<void> {
  // Update the meeting's scalar fields.
  await db
    .update(meetings)
    .set({
      executiveSummary: recap.executive_summary,
      durationMinutes: recap.effectiveness.duration_minutes,
      productiveMinutes: recap.effectiveness.productive_minutes,
      asyncableMinutes: recap.effectiveness.asyncable_minutes,
      tangentMinutes: recap.effectiveness.tangent_minutes,
      improvementNote: recap.effectiveness.improvement_note,
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, meetingId));

  // Wipe existing rows for tables we replace wholesale.
  await Promise.all([
    db.delete(meetingAttendees).where(eq(meetingAttendees.meetingId, meetingId)),
    db.delete(meetingTopics).where(eq(meetingTopics.meetingId, meetingId)),
    db.delete(decisions).where(eq(decisions.meetingId, meetingId)),
    db.delete(risks).where(eq(risks.meetingId, meetingId)),
    db.delete(opportunities).where(eq(opportunities.meetingId, meetingId)),
    db.delete(meetingPrepItems).where(eq(meetingPrepItems.meetingId, meetingId)),
  ]);

  // Attendees — match contact_id by name where possible.
  if (recap.attendees.length > 0) {
    const attendeeRows: NewMeetingAttendee[] = [];
    let pos = 0;
    for (const a of recap.attendees) {
      if (!a.name || !a.name.trim()) continue;
      const contactId = await matchContactIdByName(a.name);
      attendeeRows.push({
        meetingId,
        name: a.name.trim(),
        roleAtMeeting: a.role ?? null,
        engagement: a.engagement ?? null,
        contactId,
        position: pos++,
      });
    }
    if (attendeeRows.length > 0) {
      await db.insert(meetingAttendees).values(attendeeRows);
    }
  }

  // Topics
  if (recap.topics.length > 0) {
    const topicRows: NewMeetingTopic[] = recap.topics
      .filter((t) => t.title && t.title.trim())
      .map((t, i) => ({
        meetingId,
        title: t.title.trim(),
        content: t.content ?? null,
        position: i,
      }));
    if (topicRows.length > 0) {
      await db.insert(meetingTopics).values(topicRows);
    }
  }

  // Decisions
  if (recap.decisions.length > 0) {
    const decisionRows: NewDecision[] = [];
    for (const d of recap.decisions) {
      if (!d.decision || !d.decision.trim()) continue;
      const contactId = d.owner ? await matchContactIdByName(d.owner) : null;
      decisionRows.push({
        meetingId,
        decision: d.decision.trim(),
        owner: d.owner ?? null,
        contactId,
        implication: d.implication ?? null,
      });
    }
    if (decisionRows.length > 0) {
      await db.insert(decisions).values(decisionRows);
    }
  }

  // Risks
  if (recap.risks.length > 0) {
    const riskRows: NewRisk[] = recap.risks
      .filter((r) => r.risk && r.risk.trim())
      .map((r) => ({
        meetingId,
        risk: r.risk.trim(),
        whyItMatters: r.why_it_matters ?? null,
        mitigation: r.mitigation ?? null,
        severity: ['low', 'medium', 'high'].includes(r.severity) ? r.severity : 'medium',
        status: 'open',
      }));
    if (riskRows.length > 0) {
      await db.insert(risks).values(riskRows);
    }
  }

  // Opportunities
  if (recap.opportunities.length > 0) {
    const oppRows: NewOpportunity[] = recap.opportunities
      .filter((o) => o.opportunity && o.opportunity.trim())
      .map((o) => ({
        meetingId,
        opportunity: o.opportunity.trim(),
        nextStep: o.next_step ?? null,
        status: 'open',
      }));
    if (oppRows.length > 0) {
      await db.insert(opportunities).values(oppRows);
    }
  }

  // Prep items — agenda first (with rationale), then questions, then outcomes.
  const prepRows: NewMeetingPrepItem[] = [];
  recap.next_meeting_prep.agenda.forEach((a, i) => {
    if (a.text && a.text.trim()) {
      prepRows.push({
        meetingId,
        kind: 'agenda',
        text: a.text.trim(),
        rationale: a.rationale ?? null,
        completed: false,
        position: i,
      });
    }
  });
  recap.next_meeting_prep.questions.forEach((q, i) => {
    if (q && q.trim()) {
      prepRows.push({
        meetingId,
        kind: 'question',
        text: q.trim(),
        rationale: null,
        completed: false,
        position: i,
      });
    }
  });
  recap.next_meeting_prep.outcomes.forEach((o, i) => {
    if (o && o.trim()) {
      prepRows.push({
        meetingId,
        kind: 'outcome',
        text: o.trim(),
        rationale: null,
        completed: false,
        position: i,
      });
    }
  });
  if (prepRows.length > 0) {
    await db.insert(meetingPrepItems).values(prepRows);
  }

  // Action items — only inserted on initial extract, never on re-extract.
  if (includeActionItems && recap.action_items.length > 0) {
    const actionRows: NewActionItem[] = recap.action_items
      .filter((ai) => ai.title && ai.title.trim())
      .map((ai) => ({
        title: ai.title.trim(),
        description: ai.description ?? null,
        assignee: ai.assignee ?? null,
        dueDate: ai.due_date ?? null,
        priority: ['low', 'medium', 'high', 'critical'].includes(ai.priority) ? ai.priority : 'medium',
        urgencyTier: ['urgent', 'this_week', 'waiting_on', 'none'].includes(ai.urgency_tier) ? ai.urgency_tier : 'none',
        ownerSide: ai.owner_side === 'peter' || ai.owner_side === 'external' ? ai.owner_side : null,
        status: 'open',
        meetingId,
      }));
    if (actionRows.length > 0) {
      await db.insert(actionItems).values(actionRows);
    }
  }
}

export async function extractAndSave(meetingId: string, rawNotes: string): Promise<void> {
  const recap = await runExtractionLLM(rawNotes);
  await persistRecap(meetingId, recap, /* includeActionItems */ true);
}

export async function reExtractAndSave(meetingId: string, rawNotes: string): Promise<void> {
  const recap = await runExtractionLLM(rawNotes);
  await persistRecap(meetingId, recap, /* includeActionItems */ false);
}
```

- [ ] **Step 2: Verify build of this file**

Run: `npm run lint`
Expected: `lib/extract.ts` itself has no errors. Callers (paste route, gdrive route, extract route) will surface errors because the old `extractAndSave` returned `ExtractionResult` and the new one returns `void`. Those are fixed in Task 13.

- [ ] **Step 3: Commit**

```bash
git add lib/extract.ts
git commit -m "Extract: full-recap extraction across all structured tables"
```

---

### Task 13: Wire up extract callers + re-extract endpoint

**Files:**
- Modify: `app/api/meetings/[id]/extract/route.ts`
- Modify: `app/api/import/paste/route.ts`
- Modify: `app/api/import/gdrive/route.ts`

The old `extractAndSave` returned `{ actionItems, summary }`. Callers either used the return value or ignored it. Update each.

- [ ] **Step 1: Update the re-extract endpoint to use `reExtractAndSave`**

Replace the contents of `app/api/meetings/[id]/extract/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetings } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { reExtractAndSave } from '@/lib/extract';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, id))
      .limit(1);

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }
    if (!meeting.rawNotes) {
      return NextResponse.json({ error: 'Meeting has no raw notes to extract from' }, { status: 400 });
    }

    await reExtractAndSave(id, meeting.rawNotes);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/meetings/[id]/extract]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Update the paste-import callers to ignore the now-void return**

Open `app/api/import/paste/route.ts`. Find the `extractAndSave(...)` call. The function now returns `void`, so any destructuring of its result (`const { actionItems, summary } = await extractAndSave(...)`) must be replaced with `await extractAndSave(...)`. After the call, if the route previously returned the extracted payload, return the meeting id and let the client refetch via `GET /api/meetings/[id]` instead.

Concretely, locate any pattern like:
```ts
const result = await extractAndSave(meeting.id, body.rawNotes);
return NextResponse.json({ meetingId: meeting.id, ...result });
```
and change it to:
```ts
await extractAndSave(meeting.id, body.rawNotes);
return NextResponse.json({ meetingId: meeting.id });
```

- [ ] **Step 3: Update the gdrive-import callers the same way**

Open `app/api/import/gdrive/route.ts`. Apply the same change as Step 2 to any `extractAndSave` call site.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds for the extraction-related files. The detail page (`app/meetings/[id]/page.tsx`) and related components that read `aiSummary` or `participants` still error — those are fixed in Phase 5/6. Confirm specifically that `lib/extract.ts`, the extract route, and both import routes compile.

- [ ] **Step 5: End-to-end smoke test**

With the dev server running:

```bash
# Pick any meeting with raw_notes content
curl -X POST http://localhost:3000/api/meetings/<MEETING_ID>/extract
# -> {"success":true}

curl http://localhost:3000/api/meetings/<MEETING_ID>
# -> JSON should now include filled-in attendees, topics, decisions, risks, opportunities, prepItems
# Verify executiveSummary is populated.
# Verify actionItems is unchanged from before re-extract (count and ids).
```

Verify in Postgres:
```sql
SELECT COUNT(*) FROM meeting_topics WHERE meeting_id = '<MEETING_ID>';
SELECT COUNT(*) FROM decisions WHERE meeting_id = '<MEETING_ID>';
SELECT COUNT(*) FROM risks WHERE meeting_id = '<MEETING_ID>';
SELECT COUNT(*) FROM opportunities WHERE meeting_id = '<MEETING_ID>';
SELECT COUNT(*) FROM meeting_prep_items WHERE meeting_id = '<MEETING_ID>';
```
Each should be > 0 (assuming rawNotes had relevant content). Re-run the curl POST a second time and confirm row counts stay sensible (replaced, not duplicated).

- [ ] **Step 6: Commit**

```bash
git add app/api/meetings/[id]/extract/route.ts app/api/import/paste/route.ts app/api/import/gdrive/route.ts
git commit -m "Extract: wire callers to new full-recap extractor"
```

---

## Phase 5 — Recap UI components

All recap components live under `components/recap/`. They are client components (`'use client'`). Styles use the existing CSS variables (`var(--apex-bg)`, `var(--apex-text)`, `var(--apex-border)`, `var(--apex-text-muted)`, `var(--apex-text-secondary)`, `var(--apex-text-faint)`, `var(--apex-primary-bright)`, `var(--apex-panel)`) consistent with the rest of the app.

State pattern: each section receives initial data + `meetingId` from the parent, manages its own optimistic updates, and calls the API endpoints from Phase 2/3. On API failure, the section reverts the optimistic change.

### Task 14: Shared primitives — `Section`, `InlineText`, `BulletProse`

**Files:**
- Create: `components/recap/Section.tsx`
- Create: `components/recap/InlineText.tsx`
- Create: `components/recap/BulletProse.tsx`

- [ ] **Step 1: Create the Section wrapper**

Create `components/recap/Section.tsx`:

```tsx
'use client';

import { ReactNode } from 'react';

interface Props {
  id: string;
  title: string;
  count?: number | null;
  actions?: ReactNode;
  children: ReactNode;
}

export default function Section({ id, title, count, actions, children }: Props) {
  return (
    <section id={id} style={{ scrollMarginTop: 64, padding: '24px 28px', borderBottom: '1px solid var(--apex-border)' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--apex-text)', margin: 0, letterSpacing: '0.02em' }}>{title}</h2>
        {count !== undefined && count !== null && (
          <span style={{ fontSize: 11, color: 'var(--apex-text-muted)' }}>({count})</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>{actions}</div>
      </header>
      <div>{children}</div>
    </section>
  );
}
```

- [ ] **Step 2: Create the InlineText editor**

Create `components/recap/InlineText.tsx`:

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  value: string | null;
  placeholder?: string;
  onSave: (next: string) => Promise<void> | void;
  multiline?: boolean;
  fontSize?: number;
  color?: string;
}

export default function InlineText({ value, placeholder = 'Click to edit…', onSave, multiline = false, fontSize = 12.5, color }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  useEffect(() => { setDraft(value ?? ''); }, [value]);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      if ('select' in ref.current) ref.current.select();
    }
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    if ((draft ?? '') === (value ?? '')) return;
    await onSave(draft);
  };
  const cancel = () => { setDraft(value ?? ''); setEditing(false); };

  if (editing) {
    if (multiline) {
      return (
        <textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }}
          style={{
            width: '100%', minHeight: 80, fontSize, lineHeight: 1.55,
            color: color ?? 'var(--apex-text-secondary)',
            background: 'var(--apex-panel)', border: '1px solid var(--apex-border)',
            borderRadius: 4, padding: '8px 10px', font: 'inherit', resize: 'vertical',
          }}
        />
      );
    }
    return (
      <input
        ref={ref as React.RefObject<HTMLInputElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') cancel(); }}
        style={{
          width: '100%', fontSize, color: color ?? 'var(--apex-text-secondary)',
          background: 'var(--apex-panel)', border: '1px solid var(--apex-border)',
          borderRadius: 4, padding: '4px 8px', font: 'inherit',
        }}
      />
    );
  }

  const display = (value ?? '').trim();
  return (
    <span
      onClick={() => setEditing(true)}
      style={{
        display: 'inline-block', fontSize, lineHeight: 1.55,
        color: display ? (color ?? 'var(--apex-text-secondary)') : 'var(--apex-text-faint)',
        cursor: 'text', whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
        minWidth: 40, padding: '2px 0',
      }}
      title="Click to edit"
    >
      {display || placeholder}
    </span>
  );
}
```

- [ ] **Step 3: Create the BulletProse renderer**

Create `components/recap/BulletProse.tsx`:

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  value: string | null;
  placeholder?: string;
  onSave: (next: string) => Promise<void> | void;
}

export default function BulletProse({ value, placeholder = 'Click to add…', onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { setDraft(value ?? ''); }, [value]);
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      // Auto-grow once on enter.
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    if ((draft ?? '') === (value ?? '')) return;
    await onSave(draft);
  };
  const cancel = () => { setDraft(value ?? ''); setEditing(false); };

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (ref.current) {
            ref.current.style.height = 'auto';
            ref.current.style.height = `${ref.current.scrollHeight}px`;
          }
        }}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }}
        placeholder="One bullet per line."
        style={{
          width: '100%', minHeight: 100, fontSize: 12.5, lineHeight: 1.6,
          color: 'var(--apex-text-secondary)', background: 'var(--apex-panel)',
          border: '1px solid var(--apex-border)', borderRadius: 4,
          padding: '8px 10px', font: 'inherit', resize: 'vertical',
        }}
      />
    );
  }

  const lines = (value ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return (
      <span
        onClick={() => setEditing(true)}
        style={{ display: 'inline-block', fontSize: 12, color: 'var(--apex-text-faint)', cursor: 'text', padding: '2px 0' }}
      >
        {placeholder}
      </span>
    );
  }
  return (
    <ul
      onClick={() => setEditing(true)}
      style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.65, color: 'var(--apex-text-secondary)', cursor: 'text' }}
      title="Click to edit"
    >
      {lines.map((l, i) => <li key={i} style={{ marginBottom: 4 }}>{l}</li>)}
    </ul>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run lint`
Expected: no errors in the three new files.

- [ ] **Step 5: Commit**

```bash
git add components/recap/Section.tsx components/recap/InlineText.tsx components/recap/BulletProse.tsx
git commit -m "Recap UI: Section + InlineText + BulletProse primitives"
```

---

### Task 15: TocSidebar component

**Files:**
- Create: `components/recap/TocSidebar.tsx`

- [ ] **Step 1: Create the sidebar**

Create `components/recap/TocSidebar.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

export interface TocEntry {
  id: string;
  label: string;
  count?: number | null;
}

interface Props {
  entries: TocEntry[];
}

export default function TocSidebar({ entries }: Props) {
  const [activeId, setActiveId] = useState<string>(entries[0]?.id ?? '');

  useEffect(() => {
    if (entries.length === 0) return;
    const observer = new IntersectionObserver(
      (records) => {
        const visible = records.filter((r) => r.isIntersecting);
        if (visible.length > 0) {
          // Pick the topmost visible.
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          const id = visible[0].target.id;
          if (id) setActiveId(id);
        }
      },
      { rootMargin: '-64px 0px -50% 0px', threshold: [0, 1] },
    );
    for (const e of entries) {
      const el = document.getElementById(e.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [entries]);

  return (
    <nav style={{
      position: 'sticky', top: 0, alignSelf: 'flex-start',
      width: 200, padding: '24px 16px',
      background: 'var(--apex-bg)',
      borderRight: '1px solid var(--apex-border)',
      maxHeight: '100vh', overflowY: 'auto',
    }}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.map((e) => {
          const active = e.id === activeId;
          return (
            <li key={e.id}>
              <a
                href={`#${e.id}`}
                onClick={(ev) => {
                  ev.preventDefault();
                  const el = document.getElementById(e.id);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  setActiveId(e.id);
                }}
                style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                  padding: '6px 8px', borderRadius: 4,
                  fontSize: 11.5, color: active ? 'var(--apex-primary-bright)' : 'var(--apex-text-muted)',
                  background: active ? 'rgba(46,98,255,0.08)' : 'transparent',
                  textDecoration: 'none', fontWeight: active ? 600 : 400,
                }}
              >
                <span>{e.label}</span>
                {e.count !== undefined && e.count !== null && e.count > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--apex-text-faint)' }}>{e.count}</span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run lint`. Expected: no errors.

```bash
git add components/recap/TocSidebar.tsx
git commit -m "Recap UI: sticky TOC sidebar with scrollspy"
```

---

### Task 16: AttendeesSection

**Files:**
- Create: `components/recap/AttendeesSection.tsx`

- [ ] **Step 1: Create the component**

Create `components/recap/AttendeesSection.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Section from './Section';
import InlineText from './InlineText';
import type { MeetingAttendee } from '@/lib/schema';

interface Props {
  meetingId: string;
  initial: MeetingAttendee[];
}

const ENGAGEMENT_OPTIONS = [
  { value: '', label: '—' },
  { value: 'dominant', label: 'Dominant' },
  { value: 'active', label: 'Active' },
  { value: 'quiet', label: 'Quiet' },
];

export default function AttendeesSection({ meetingId, initial }: Props) {
  const [rows, setRows] = useState<MeetingAttendee[]>(initial);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const prev = rows;
    setRows((r) => r.map((a) => (a.id === id ? { ...a, ...body } as MeetingAttendee : a)));
    try {
      const res = await fetch(`/api/attendees/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch { setRows(prev); }
  };

  const remove = async (id: string) => {
    const prev = rows;
    setRows((r) => r.filter((a) => a.id !== id));
    try {
      const res = await fetch(`/api/attendees/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch { setRows(prev); }
  };

  const add = async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/attendees`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New attendee' }),
      });
      if (!res.ok) return;
      const created = await res.json() as MeetingAttendee;
      setRows((r) => [...r, created]);
    } catch { /* ignore */ }
  };

  return (
    <Section
      id="attendees" title="Attendees" count={rows.length}
      actions={<button className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 11 }} onClick={add}>+ Add</button>}
    >
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--apex-text-faint)' }}>No attendees recorded.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((a) => (
            <li key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px 24px', gap: 12, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--apex-border)' }}>
              <InlineText value={a.name} onSave={(v) => patch(a.id, { name: v })} fontSize={12.5} color="var(--apex-text)" />
              <InlineText value={a.roleAtMeeting} placeholder="Role at meeting" onSave={(v) => patch(a.id, { roleAtMeeting: v })} />
              <select
                value={a.engagement ?? ''}
                onChange={(e) => patch(a.id, { engagement: e.target.value || null })}
                style={{ height: 24, fontSize: 11, padding: '0 6px', background: 'var(--apex-panel)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)', borderRadius: 4 }}
              >
                {ENGAGEMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button onClick={() => remove(a.id)} title="Delete" style={{ height: 24, width: 24, padding: 0, background: 'transparent', border: 'none', color: 'var(--apex-text-faint)', cursor: 'pointer', fontSize: 16 }}>×</button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run lint`. Expected: no errors in this file.

```bash
git add components/recap/AttendeesSection.tsx
git commit -m "Recap UI: AttendeesSection"
```

---

### Task 17: TopicsSection

**Files:**
- Create: `components/recap/TopicsSection.tsx`

- [ ] **Step 1: Create the component**

Create `components/recap/TopicsSection.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Section from './Section';
import InlineText from './InlineText';
import BulletProse from './BulletProse';
import type { MeetingTopic } from '@/lib/schema';

interface Props {
  meetingId: string;
  initial: MeetingTopic[];
}

export default function TopicsSection({ meetingId, initial }: Props) {
  const [rows, setRows] = useState<MeetingTopic[]>(initial);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const prev = rows;
    setRows((r) => r.map((t) => (t.id === id ? { ...t, ...body } as MeetingTopic : t)));
    try {
      const res = await fetch(`/api/topics/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch { setRows(prev); }
  };

  const remove = async (id: string) => {
    const prev = rows;
    setRows((r) => r.filter((t) => t.id !== id));
    try {
      const res = await fetch(`/api/topics/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch { setRows(prev); }
  };

  const add = async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/topics`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New topic', content: '' }),
      });
      if (!res.ok) return;
      const created = await res.json() as MeetingTopic;
      setRows((r) => [...r, created]);
    } catch { /* ignore */ }
  };

  return (
    <Section
      id="topics" title="Topics" count={rows.length}
      actions={<button className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 11 }} onClick={add}>+ Add</button>}
    >
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--apex-text-faint)' }}>No topics yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {rows.map((t) => (
            <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--apex-text)', flex: 1 }}>
                  <InlineText value={t.title} onSave={(v) => patch(t.id, { title: v })} fontSize={13} color="var(--apex-text)" />
                </h3>
                <button onClick={() => remove(t.id)} title="Delete" style={{ height: 22, width: 22, padding: 0, background: 'transparent', border: 'none', color: 'var(--apex-text-faint)', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
              <BulletProse value={t.content} onSave={(v) => patch(t.id, { content: v })} placeholder="Click to add bullets…" />
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run lint`. Expected: no errors.

```bash
git add components/recap/TopicsSection.tsx
git commit -m "Recap UI: TopicsSection"
```

---

### Task 18: DecisionsSection

**Files:**
- Create: `components/recap/DecisionsSection.tsx`

- [ ] **Step 1: Create the component**

Create `components/recap/DecisionsSection.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Section from './Section';
import InlineText from './InlineText';
import type { Decision } from '@/lib/schema';

interface Props {
  meetingId: string;
  initial: Decision[];
}

export default function DecisionsSection({ meetingId, initial }: Props) {
  const [rows, setRows] = useState<Decision[]>(initial);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const prev = rows;
    setRows((r) => r.map((d) => (d.id === id ? { ...d, ...body } as Decision : d)));
    try {
      const res = await fetch(`/api/decisions/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch { setRows(prev); }
  };

  const remove = async (id: string) => {
    const prev = rows;
    setRows((r) => r.filter((d) => d.id !== id));
    try {
      const res = await fetch(`/api/decisions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch { setRows(prev); }
  };

  const add = async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/decisions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'New decision' }),
      });
      if (!res.ok) return;
      const created = await res.json() as Decision;
      setRows((r) => [...r, created]);
    } catch { /* ignore */ }
  };

  return (
    <Section
      id="decisions" title="Decisions" count={rows.length}
      actions={<button className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 11 }} onClick={add}>+ Add</button>}
    >
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--apex-text-faint)' }}>No decisions recorded.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((d) => (
            <li key={d.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--apex-border)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--apex-text)', fontWeight: 600, marginBottom: 2 }}>
                    <InlineText value={d.decision} onSave={(v) => patch(d.id, { decision: v })} fontSize={12.5} color="var(--apex-text)" />
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--apex-text-muted)', marginBottom: 2 }}>
                    Owner: <InlineText value={d.owner} placeholder="—" onSave={(v) => patch(d.id, { owner: v })} fontSize={11.5} />
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--apex-text-secondary)' }}>
                    <InlineText value={d.implication} placeholder="Implication…" onSave={(v) => patch(d.id, { implication: v })} fontSize={11.5} />
                  </div>
                </div>
                <button onClick={() => remove(d.id)} title="Delete" style={{ height: 22, width: 22, padding: 0, background: 'transparent', border: 'none', color: 'var(--apex-text-faint)', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run lint`. Expected: no errors.

```bash
git add components/recap/DecisionsSection.tsx
git commit -m "Recap UI: DecisionsSection"
```

---

### Task 19: ActionItemsSection (recap variant — grouped by urgency_tier / owner_side)

**Files:**
- Create: `components/recap/ActionItemsSection.tsx`

- [ ] **Step 1: Create the component**

Create `components/recap/ActionItemsSection.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import Section from './Section';
import InlineText from './InlineText';
import type { ActionItem } from '@/lib/schema';

interface Props {
  meetingId: string;
  initial: ActionItem[];
}

type ViewMode = 'urgency' | 'owner';

const URGENCY_LABELS: Record<string, string> = {
  urgent: 'Urgent (24h)',
  this_week: 'This Week',
  waiting_on: 'Waiting On',
  none: 'No urgency',
};
const URGENCY_ORDER = ['urgent', 'this_week', 'waiting_on', 'none'];

const OWNER_LABELS: Record<string, string> = {
  peter: 'By Peter',
  external: 'By others',
  unknown: 'Unassigned side',
};

export default function ActionItemsSection({ meetingId, initial }: Props) {
  const [rows, setRows] = useState<ActionItem[]>(initial);
  const [view, setView] = useState<ViewMode>('urgency');

  const patch = async (id: string, body: Record<string, unknown>) => {
    const prev = rows;
    setRows((r) => r.map((a) => (a.id === id ? { ...a, ...body } as ActionItem : a)));
    try {
      const res = await fetch(`/api/action-items/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch { setRows(prev); }
  };

  const remove = async (id: string) => {
    const prev = rows;
    setRows((r) => r.filter((a) => a.id !== id));
    try {
      const res = await fetch(`/api/action-items/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch { setRows(prev); }
  };

  const add = async () => {
    try {
      const res = await fetch('/api/action-items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New action item', meetingId, status: 'open' }),
      });
      if (!res.ok) return;
      const created = await res.json() as ActionItem;
      setRows((r) => [...r, created]);
    } catch { /* ignore */ }
  };

  const groups = useMemo(() => {
    const map = new Map<string, ActionItem[]>();
    for (const r of rows) {
      const key = view === 'urgency'
        ? (r.urgencyTier ?? 'none')
        : (r.ownerSide ?? 'unknown');
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return map;
  }, [rows, view]);

  const orderedKeys = view === 'urgency'
    ? URGENCY_ORDER.filter((k) => groups.has(k))
    : ['peter', 'external', 'unknown'].filter((k) => groups.has(k));

  return (
    <Section
      id="action-items" title="Action Items" count={rows.length}
      actions={
        <>
          <div style={{ display: 'flex', gap: 4, marginRight: 8 }}>
            <button className={`btn ${view === 'urgency' ? 'btn-primary' : 'btn-ghost'}`} style={{ height: 24, padding: '0 8px', fontSize: 11 }} onClick={() => setView('urgency')}>By urgency</button>
            <button className={`btn ${view === 'owner' ? 'btn-primary' : 'btn-ghost'}`} style={{ height: 24, padding: '0 8px', fontSize: 11 }} onClick={() => setView('owner')}>By owner</button>
          </div>
          <button className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 11 }} onClick={add}>+ Add</button>
        </>
      }
    >
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--apex-text-faint)' }}>No action items.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {orderedKeys.map((key) => {
            const items = groups.get(key) ?? [];
            const label = view === 'urgency' ? (URGENCY_LABELS[key] ?? key) : (OWNER_LABELS[key] ?? key);
            return (
              <div key={key}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--apex-text-muted)', marginBottom: 6 }}>{label}</div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map((a) => (
                    <li key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 90px 24px', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--apex-border)' }}>
                      <InlineText value={a.title} onSave={(v) => patch(a.id, { title: v })} fontSize={12.5} color="var(--apex-text)" />
                      <InlineText value={a.assignee} placeholder="Assignee" onSave={(v) => patch(a.id, { assignee: v })} fontSize={11.5} />
                      <select
                        value={a.urgencyTier ?? 'none'}
                        onChange={(e) => patch(a.id, { urgencyTier: e.target.value })}
                        style={{ height: 24, fontSize: 11, padding: '0 6px', background: 'var(--apex-panel)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)', borderRadius: 4 }}
                      >
                        {URGENCY_ORDER.map((k) => <option key={k} value={k}>{URGENCY_LABELS[k]}</option>)}
                      </select>
                      <select
                        value={a.ownerSide ?? ''}
                        onChange={(e) => patch(a.id, { ownerSide: e.target.value || null })}
                        style={{ height: 24, fontSize: 11, padding: '0 6px', background: 'var(--apex-panel)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)', borderRadius: 4 }}
                      >
                        <option value="">—</option>
                        <option value="peter">Peter</option>
                        <option value="external">External</option>
                      </select>
                      <button onClick={() => remove(a.id)} title="Delete" style={{ height: 22, width: 22, padding: 0, background: 'transparent', border: 'none', color: 'var(--apex-text-faint)', cursor: 'pointer', fontSize: 14 }}>×</button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run lint`. Expected: no errors.

```bash
git add components/recap/ActionItemsSection.tsx
git commit -m "Recap UI: ActionItemsSection grouped by urgency/owner"
```

---

### Task 20: RisksSection

**Files:**
- Create: `components/recap/RisksSection.tsx`

- [ ] **Step 1: Create the component**

Create `components/recap/RisksSection.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Section from './Section';
import InlineText from './InlineText';
import type { Risk } from '@/lib/schema';

interface Props {
  meetingId: string;
  initial: Risk[];
}

const SEVERITY = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];
const STATUS = [
  { value: 'open', label: 'Open' },
  { value: 'mitigated', label: 'Mitigated' },
  { value: 'accepted', label: 'Accepted' },
];

export default function RisksSection({ meetingId, initial }: Props) {
  const [rows, setRows] = useState<Risk[]>(initial);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const prev = rows;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...body } as Risk : x)));
    try {
      const res = await fetch(`/api/risks/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch { setRows(prev); }
  };

  const remove = async (id: string) => {
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/risks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch { setRows(prev); }
  };

  const add = async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/risks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ risk: 'New risk', severity: 'medium' }),
      });
      if (!res.ok) return;
      const created = await res.json() as Risk;
      setRows((r) => [...r, created]);
    } catch { /* ignore */ }
  };

  return (
    <Section
      id="risks" title="Risks" count={rows.length}
      actions={<button className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 11 }} onClick={add}>+ Add</button>}
    >
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--apex-text-faint)' }}>No risks recorded.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((x) => (
            <li key={x.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--apex-border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--apex-text)', fontWeight: 600, marginBottom: 4 }}>
                  <InlineText value={x.risk} onSave={(v) => patch(x.id, { risk: v })} fontSize={12.5} color="var(--apex-text)" />
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--apex-text-secondary)', marginBottom: 4 }}>
                  Why it matters: <InlineText value={x.whyItMatters} placeholder="…" onSave={(v) => patch(x.id, { whyItMatters: v })} fontSize={11.5} multiline />
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--apex-text-secondary)', marginBottom: 6 }}>
                  Mitigation: <InlineText value={x.mitigation} placeholder="…" onSave={(v) => patch(x.id, { mitigation: v })} fontSize={11.5} multiline />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={x.severity ?? 'medium'}
                    onChange={(e) => patch(x.id, { severity: e.target.value })}
                    style={{ height: 22, fontSize: 11, padding: '0 6px', background: 'var(--apex-panel)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)', borderRadius: 4 }}
                  >
                    {SEVERITY.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <select
                    value={x.status ?? 'open'}
                    onChange={(e) => patch(x.id, { status: e.target.value })}
                    style={{ height: 22, fontSize: 11, padding: '0 6px', background: 'var(--apex-panel)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)', borderRadius: 4 }}
                  >
                    {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={() => remove(x.id)} title="Delete" style={{ height: 22, width: 22, padding: 0, background: 'transparent', border: 'none', color: 'var(--apex-text-faint)', cursor: 'pointer', fontSize: 14 }}>×</button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run lint`. Expected: no errors.

```bash
git add components/recap/RisksSection.tsx
git commit -m "Recap UI: RisksSection"
```

---

### Task 21: OpportunitiesSection

**Files:**
- Create: `components/recap/OpportunitiesSection.tsx`

- [ ] **Step 1: Create the component**

Create `components/recap/OpportunitiesSection.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Section from './Section';
import InlineText from './InlineText';
import type { Opportunity } from '@/lib/schema';

interface Props {
  meetingId: string;
  initial: Opportunity[];
}

const STATUS = [
  { value: 'open', label: 'Open' },
  { value: 'pursuing', label: 'Pursuing' },
  { value: 'won', label: 'Won' },
  { value: 'dropped', label: 'Dropped' },
];

export default function OpportunitiesSection({ meetingId, initial }: Props) {
  const [rows, setRows] = useState<Opportunity[]>(initial);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const prev = rows;
    setRows((r) => r.map((o) => (o.id === id ? { ...o, ...body } as Opportunity : o)));
    try {
      const res = await fetch(`/api/opportunities/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch { setRows(prev); }
  };

  const remove = async (id: string) => {
    const prev = rows;
    setRows((r) => r.filter((o) => o.id !== id));
    try {
      const res = await fetch(`/api/opportunities/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch { setRows(prev); }
  };

  const add = async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/opportunities`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity: 'New opportunity' }),
      });
      if (!res.ok) return;
      const created = await res.json() as Opportunity;
      setRows((r) => [...r, created]);
    } catch { /* ignore */ }
  };

  return (
    <Section
      id="opportunities" title="Opportunities" count={rows.length}
      actions={<button className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 11 }} onClick={add}>+ Add</button>}
    >
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--apex-text-faint)' }}>No opportunities recorded.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((o) => (
            <li key={o.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--apex-border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--apex-text)', fontWeight: 600, marginBottom: 4 }}>
                  <InlineText value={o.opportunity} onSave={(v) => patch(o.id, { opportunity: v })} fontSize={12.5} color="var(--apex-text)" />
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--apex-text-secondary)', marginBottom: 6 }}>
                  Next step: <InlineText value={o.nextStep} placeholder="…" onSave={(v) => patch(o.id, { nextStep: v })} fontSize={11.5} multiline />
                </div>
                <select
                  value={o.status ?? 'open'}
                  onChange={(e) => patch(o.id, { status: e.target.value })}
                  style={{ height: 22, fontSize: 11, padding: '0 6px', background: 'var(--apex-panel)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)', borderRadius: 4 }}
                >
                  {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <button onClick={() => remove(o.id)} title="Delete" style={{ height: 22, width: 22, padding: 0, background: 'transparent', border: 'none', color: 'var(--apex-text-faint)', cursor: 'pointer', fontSize: 14 }}>×</button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run lint`. Expected: no errors.

```bash
git add components/recap/OpportunitiesSection.tsx
git commit -m "Recap UI: OpportunitiesSection"
```

---

### Task 22: PrepSection (agenda / questions / outcomes)

**Files:**
- Create: `components/recap/PrepSection.tsx`

- [ ] **Step 1: Create the component**

Create `components/recap/PrepSection.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import Section from './Section';
import InlineText from './InlineText';
import type { MeetingPrepItem } from '@/lib/schema';

interface Props {
  meetingId: string;
  initial: MeetingPrepItem[];
}

type Kind = 'agenda' | 'question' | 'outcome';
const KINDS: { kind: Kind; title: string; placeholder: string }[] = [
  { kind: 'agenda',   title: 'Suggested agenda', placeholder: 'New agenda item' },
  { kind: 'question', title: 'Questions to ask', placeholder: 'New question' },
  { kind: 'outcome',  title: 'Desired outcomes', placeholder: 'New outcome' },
];

export default function PrepSection({ meetingId, initial }: Props) {
  const [rows, setRows] = useState<MeetingPrepItem[]>(initial);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const prev = rows;
    setRows((r) => r.map((p) => (p.id === id ? { ...p, ...body } as MeetingPrepItem : p)));
    try {
      const res = await fetch(`/api/prep-items/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch { setRows(prev); }
  };

  const remove = async (id: string) => {
    const prev = rows;
    setRows((r) => r.filter((p) => p.id !== id));
    try {
      const res = await fetch(`/api/prep-items/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch { setRows(prev); }
  };

  const add = async (kind: Kind, defaultText: string) => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/prep-items`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, text: defaultText }),
      });
      if (!res.ok) return;
      const created = await res.json() as MeetingPrepItem;
      setRows((r) => [...r, created]);
    } catch { /* ignore */ }
  };

  const grouped = useMemo(() => {
    const m: Record<Kind, MeetingPrepItem[]> = { agenda: [], question: [], outcome: [] };
    for (const p of rows) {
      const k = p.kind as Kind;
      if (k in m) m[k].push(p);
    }
    return m;
  }, [rows]);

  const total = rows.length;

  return (
    <Section id="prep" title="Next Meeting Prep" count={total}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {KINDS.map(({ kind, title, placeholder }) => (
          <div key={kind}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--apex-text-muted)', margin: 0 }}>{title}</h3>
              <button className="btn btn-ghost" style={{ height: 22, padding: '0 8px', fontSize: 11 }} onClick={() => add(kind, placeholder)}>+ Add</button>
            </div>
            {grouped[kind].length === 0 ? (
              <p style={{ fontSize: 11.5, color: 'var(--apex-text-faint)', margin: 0 }}>None.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {grouped[kind].map((p) => (
                  <li key={p.id} style={{ display: 'grid', gridTemplateColumns: kind === 'outcome' ? '20px 1fr 24px' : (kind === 'agenda' ? '1fr 1fr 24px' : '1fr 24px'), gap: 10, alignItems: 'center', padding: '4px 0' }}>
                    {kind === 'outcome' && (
                      <input
                        type="checkbox"
                        checked={p.completed ?? false}
                        onChange={(e) => patch(p.id, { completed: e.target.checked })}
                      />
                    )}
                    <InlineText value={p.text} onSave={(v) => patch(p.id, { text: v })} fontSize={12} />
                    {kind === 'agenda' && (
                      <InlineText value={p.rationale} placeholder="Rationale (why)" onSave={(v) => patch(p.id, { rationale: v })} fontSize={11.5} />
                    )}
                    <button onClick={() => remove(p.id)} title="Delete" style={{ height: 22, width: 22, padding: 0, background: 'transparent', border: 'none', color: 'var(--apex-text-faint)', cursor: 'pointer', fontSize: 14 }}>×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run lint`. Expected: no errors.

```bash
git add components/recap/PrepSection.tsx
git commit -m "Recap UI: PrepSection (agenda/questions/outcomes)"
```

---

### Task 23: EffectivenessSection

**Files:**
- Create: `components/recap/EffectivenessSection.tsx`

- [ ] **Step 1: Create the component**

Create `components/recap/EffectivenessSection.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Section from './Section';
import BulletProse from './BulletProse';

interface Props {
  meetingId: string;
  initial: {
    durationMinutes: number | null;
    productiveMinutes: number | null;
    asyncableMinutes: number | null;
    tangentMinutes: number | null;
    improvementNote: string | null;
  };
}

export default function EffectivenessSection({ meetingId, initial }: Props) {
  const [data, setData] = useState(initial);

  const patch = async (body: Partial<typeof initial>) => {
    const prev = data;
    setData((d) => ({ ...d, ...body }));
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch { setData(prev); }
  };

  const numInput = (label: string, key: 'productiveMinutes' | 'asyncableMinutes' | 'tangentMinutes' | 'durationMinutes') => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: 'var(--apex-text-muted)' }}>
      <span>{label}</span>
      <input
        type="number" min={0}
        value={data[key] ?? ''}
        onChange={(e) => {
          const v = e.target.value === '' ? null : Number(e.target.value);
          patch({ [key]: v } as Partial<typeof initial>);
        }}
        style={{ width: 80, height: 26, fontSize: 12, padding: '0 6px', background: 'var(--apex-panel)', color: 'var(--apex-text)', border: '1px solid var(--apex-border)', borderRadius: 4 }}
      />
    </label>
  );

  return (
    <Section id="effectiveness" title="Meeting Effectiveness">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {numInput('Total (min)', 'durationMinutes')}
          {numInput('Productive', 'productiveMinutes')}
          {numInput('Async-able', 'asyncableMinutes')}
          {numInput('Tangent', 'tangentMinutes')}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--apex-text-muted)', marginBottom: 6 }}>What to improve</div>
          <BulletProse
            value={data.improvementNote}
            placeholder="Click to add notes about what to improve next time… (one bullet per line)"
            onSave={(v) => patch({ improvementNote: v })}
          />
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run lint`. Expected: no errors.

```bash
git add components/recap/EffectivenessSection.tsx
git commit -m "Recap UI: EffectivenessSection"
```

---

### Task 24: ReExtractDialog

**Files:**
- Create: `components/recap/ReExtractDialog.tsx`

- [ ] **Step 1: Create the dialog**

Create `components/recap/ReExtractDialog.tsx`:

```tsx
'use client';

import { useState } from 'react';

interface Props {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export default function ReExtractDialog({ open, onCancel, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const confirm = async () => {
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  };

  return (
    <div
      role="dialog" aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460, background: 'var(--apex-panel)', border: '1px solid var(--apex-border)',
          borderRadius: 6, padding: 20, color: 'var(--apex-text)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Re-extract this meeting?</h3>
        <p style={{ margin: '12px 0', fontSize: 12.5, lineHeight: 1.55, color: 'var(--apex-text-secondary)' }}>
          The LLM will replace the following from the raw notes:
        </p>
        <ul style={{ margin: '0 0 12px 18px', fontSize: 12, lineHeight: 1.6, color: 'var(--apex-text-secondary)' }}>
          <li>Executive summary</li>
          <li>Topics</li>
          <li>Attendees</li>
          <li>Decisions</li>
          <li>Risks</li>
          <li>Opportunities</li>
          <li>Next-meeting prep (agenda, questions, outcomes)</li>
          <li>Effectiveness (time breakdown, improvement note)</li>
        </ul>
        <p style={{ margin: '0 0 16px 0', fontSize: 12, color: 'var(--apex-text-muted)' }}>
          Action items are <strong>preserved</strong>.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={confirm} disabled={busy}>
            {busy ? 'Working…' : 'Re-extract'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run lint`. Expected: no errors.

```bash
git add components/recap/ReExtractDialog.tsx
git commit -m "Recap UI: ReExtractDialog"
```

---

## Phase 6 — Detail page assembly

### Task 25: Rewrite `app/meetings/[id]/page.tsx`

**Files:**
- Modify: `app/meetings/[id]/page.tsx`

The new page has three regions:
1. **Header** — title, date/time/platform/company, Re-extract + Share buttons.
2. **Body** — two-column layout: sticky `TocSidebar` on the left, scrollable main column on the right with all sections.
3. The transcript and existing chapters/key questions display below the recap sections (collapsed by default for transcript; chapters/questions hidden when empty).

The page fetches `/api/meetings/[id]` once on mount and passes pre-loaded arrays to each section component. Each section manages its own optimistic state from there. The Re-extract action triggers `POST /api/meetings/[id]/extract`, then refetches the meeting to refresh every section.

- [ ] **Step 1: Replace the file**

Replace `app/meetings/[id]/page.tsx` with:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import TocSidebar, { type TocEntry } from '@/components/recap/TocSidebar';
import Section from '@/components/recap/Section';
import BulletProse from '@/components/recap/BulletProse';
import AttendeesSection from '@/components/recap/AttendeesSection';
import TopicsSection from '@/components/recap/TopicsSection';
import DecisionsSection from '@/components/recap/DecisionsSection';
import ActionItemsSection from '@/components/recap/ActionItemsSection';
import RisksSection from '@/components/recap/RisksSection';
import OpportunitiesSection from '@/components/recap/OpportunitiesSection';
import PrepSection from '@/components/recap/PrepSection';
import EffectivenessSection from '@/components/recap/EffectivenessSection';
import ReExtractDialog from '@/components/recap/ReExtractDialog';
import type {
  ActionItem,
  Decision,
  MeetingAttendee,
  MeetingPrepItem,
  MeetingTopic,
  Opportunity,
  Risk,
} from '@/lib/schema';

interface MeetingDetail {
  id: string;
  title: string;
  meetingDate: string | null;
  meetingTime: string | null;
  platform: string | null;
  companyId: string | null;
  companyName: string | null;
  rawNotes: string | null;
  executiveSummary: string | null;
  transcript: string | null;
  chapters: string | null;
  keyQuestions: string[] | null;
  durationMinutes: number | null;
  productiveMinutes: number | null;
  asyncableMinutes: number | null;
  tangentMinutes: number | null;
  improvementNote: string | null;
  attendees: MeetingAttendee[];
  topics: MeetingTopic[];
  decisions: Decision[];
  actionItems: ActionItem[];
  risks: Risk[];
  opportunities: Opportunity[];
  prepItems: MeetingPrepItem[];
}

interface Chapter { title: string; timestamp: string; bullets: string[] }

function formatDate(s: string | null): string {
  if (!s) return '—';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(s));
}

function parseChapters(raw: string | null): Chapter[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as Chapter[] : [];
  } catch { return []; }
}

export default function MeetingDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reExtractOpen, setReExtractOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${id}`);
      if (!res.ok) { setMeeting(null); return; }
      const data = await res.json() as MeetingDetail;
      setMeeting(data);
    } catch { setMeeting(null); }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const reExtract = async () => {
    try {
      const res = await fetch(`/api/meetings/${id}/extract`, { method: 'POST' });
      if (res.ok) { setReExtractOpen(false); await load(); }
    } catch { /* keep dialog open */ }
  };

  const updateExecSummary = async (next: string) => {
    if (!meeting) return;
    setMeeting({ ...meeting, executiveSummary: next });
    try {
      await fetch(`/api/meetings/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executiveSummary: next }),
      });
    } catch { /* ignore */ }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>Loading…</div>;
  }
  if (!meeting) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--apex-text-muted)', marginBottom: 12 }}>Meeting not found.</p>
        <Link href="/meetings" className="btn btn-ghost">← Meetings</Link>
      </div>
    );
  }

  const chapters = parseChapters(meeting.chapters);
  const keyQuestions = meeting.keyQuestions ?? [];
  const hasTranscriptOrChapters = !!meeting.transcript || chapters.length > 0 || keyQuestions.length > 0;

  const tocEntries: TocEntry[] = [
    { id: 'executive-summary', label: 'Executive Summary' },
    { id: 'attendees',         label: 'Attendees', count: meeting.attendees.length },
    { id: 'topics',            label: 'Topics', count: meeting.topics.length },
    { id: 'decisions',         label: 'Decisions', count: meeting.decisions.length },
    { id: 'action-items',      label: 'Action Items', count: meeting.actionItems.length },
    { id: 'risks',             label: 'Risks', count: meeting.risks.length },
    { id: 'opportunities',     label: 'Opportunities', count: meeting.opportunities.length },
    { id: 'prep',              label: 'Next Meeting Prep', count: meeting.prepItems.length },
    { id: 'effectiveness',     label: 'Effectiveness' },
  ];
  if (hasTranscriptOrChapters) tocEntries.push({ id: 'transcript', label: 'Transcript' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--apex-bg)' }}>
      {/* Header */}
      <div className="apex-page-header" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          <Link href="/meetings" className="btn-icon" aria-label="Back" style={{ flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
          </Link>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--apex-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
            {meeting.title}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button className="btn btn-ghost"><span className="material-symbols-outlined">share</span>Share</button>
          <button className="btn btn-primary" onClick={() => setReExtractOpen(true)}>
            <span className="material-symbols-outlined">auto_awesome</span>Re-extract
          </button>
        </div>
      </div>

      <div className="apex-statbar" style={{ flexShrink: 0 }}>
        <div className="apex-stat"><span className="apex-stat-value mono" style={{ fontSize: 12 }}>{formatDate(meeting.meetingDate)}</span></div>
        {meeting.meetingTime && <div className="apex-stat"><span className="cell-meta">{meeting.meetingTime}</span></div>}
        {meeting.durationMinutes !== null && <div className="apex-stat"><span className="cell-meta">{meeting.durationMinutes} min</span></div>}
        {meeting.platform && <div className="apex-stat"><span className="cell-meta">{meeting.platform}</span></div>}
        {meeting.companyName && <div className="apex-stat"><span className="cell-secondary" style={{ fontSize: 11.5 }}>{meeting.companyName}</span></div>}
      </div>

      {/* Body: TOC + scroll area */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <TocSidebar entries={tocEntries} />
        <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
          <Section id="executive-summary" title="Executive Summary">
            <BulletProse value={meeting.executiveSummary} onSave={updateExecSummary} placeholder="Click to add an executive summary…" />
          </Section>

          <AttendeesSection meetingId={meeting.id} initial={meeting.attendees} />
          <TopicsSection meetingId={meeting.id} initial={meeting.topics} />
          <DecisionsSection meetingId={meeting.id} initial={meeting.decisions} />
          <ActionItemsSection meetingId={meeting.id} initial={meeting.actionItems} />
          <RisksSection meetingId={meeting.id} initial={meeting.risks} />
          <OpportunitiesSection meetingId={meeting.id} initial={meeting.opportunities} />
          <PrepSection meetingId={meeting.id} initial={meeting.prepItems} />
          <EffectivenessSection
            meetingId={meeting.id}
            initial={{
              durationMinutes: meeting.durationMinutes,
              productiveMinutes: meeting.productiveMinutes,
              asyncableMinutes: meeting.asyncableMinutes,
              tangentMinutes: meeting.tangentMinutes,
              improvementNote: meeting.improvementNote,
            }}
          />

          {hasTranscriptOrChapters && (
            <Section
              id="transcript" title="Transcript & Chapters"
              actions={
                <button className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 11 }} onClick={() => setTranscriptOpen((o) => !o)}>
                  {transcriptOpen ? 'Hide' : 'Show'}
                </button>
              }
            >
              {transcriptOpen ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {chapters.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--apex-text-muted)', margin: '0 0 6px 0' }}>Chapters</h4>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {chapters.map((ch, i) => (
                          <li key={i} style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 8, fontSize: 12 }}>
                            <span className="cell-meta">{ch.timestamp}</span>
                            <span style={{ color: 'var(--apex-text-secondary)' }}>{ch.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {keyQuestions.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--apex-text-muted)', margin: '0 0 6px 0' }}>Key Questions</h4>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--apex-text-secondary)' }}>
                        {keyQuestions.map((q, i) => <li key={i}>{q}</li>)}
                      </ul>
                    </div>
                  )}
                  {meeting.transcript && (
                    <div>
                      <h4 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--apex-text-muted)', margin: '0 0 6px 0' }}>Transcript</h4>
                      <pre style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--apex-text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
                        {meeting.transcript}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--apex-text-muted)', margin: 0 }}>Click "Show" to expand the raw transcript and chapters.</p>
              )}
            </Section>
          )}
        </main>
      </div>

      <ReExtractDialog
        open={reExtractOpen}
        onCancel={() => setReExtractOpen(false)}
        onConfirm={reExtract}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build succeeds. The detail page is now consuming the new API shape; the meetings list page (`app/meetings/page.tsx`) still references `aiSummary`/`participants` from the list endpoint and will fail to build until those are also updated.

If the build fails on `app/meetings/page.tsx`, do this minimal fix in that file:
- Find every read of `meetings.aiSummary` (in `app/api/meetings/route.ts`) and replace with `meetings.executiveSummary` aliased back to `aiSummary` if the page uses that name. Same for `participants`: that column still exists on the schema for now (Phase 8 drops it), so the existing code path continues to work.
- The list page's "preview" pane that shows aiSummary should now read the renamed field; either rename the local variable or change the GET endpoint to return `aiSummary: meetings.executiveSummary` as an aliased select. The smaller change is the latter.

Concretely, in `app/api/meetings/route.ts`, locate the `select({ ... aiSummary: meetings.aiSummary, ... })` clause (if present) and change it to `aiSummary: meetings.executiveSummary,`. The list page can keep using `aiSummary` as its field name.

Re-run `npm run build` until it passes.

- [ ] **Step 3: Manual exercise**

Start dev server (`npm run dev`). Open http://localhost:3000/meetings/<MEETING_ID> for a meeting that has been re-extracted (Task 13 Step 5 left at least one).

Verify:
- Header shows title, date, duration, platform.
- Sticky TOC on the left highlights the section currently in view as you scroll.
- Each section renders its data; counts in the TOC match the rendered counts.
- Click an attendee name → editable; type, blur → name persists on reload.
- Add a decision via "+ Add" → it appears immediately and persists on reload.
- Toggle "By urgency" / "By owner" on Action Items.
- Edit the executive summary (multi-line, one bullet per line) → bullets render correctly.
- Click "Re-extract" → dialog opens; click Re-extract; sections refresh with new data; existing action items are preserved.

- [ ] **Step 4: Commit**

```bash
git add app/meetings/[id]/page.tsx app/api/meetings/route.ts
git commit -m "Meeting detail: full recap rewrite with sticky TOC and section components"
```

---

## Phase 7 — Cross-meeting list pages + nav

Each list page is a thin client page that fetches its `/api/<resource>` endpoint, sortable by clicking column headers (using the existing `components/SortHeader.tsx`). No detail pane — clicking the meeting cell links to the source meeting detail page. Status edits use native `<select>` elements with optimistic update + revert on failure.

### Task 26: Decisions list page

**Files:**
- Create: `app/decisions/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/decisions/page.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SortHeader from '@/components/SortHeader';

interface Row {
  id: string;
  decision: string;
  owner: string | null;
  implication: string | null;
  meetingId: string | null;
  meetingTitle: string | null;
  meetingDate: string | null;
  companyName: string | null;
}

type SortKey = 'decision' | 'owner' | 'meeting' | 'date' | null;

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d));
}

export default function DecisionsListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetch('/api/decisions')
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const onSort = (k: NonNullable<SortKey>) => {
    if (sortKey !== k) { setSortKey(k); setSortDir('asc'); return; }
    if (sortDir === 'asc') setSortDir('desc');
    else { setSortKey(null); }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const cmp = (a: Row, b: Row) => {
      const av = sortKey === 'decision' ? a.decision
        : sortKey === 'owner' ? (a.owner ?? '')
        : sortKey === 'meeting' ? (a.meetingTitle ?? '')
        : (a.meetingDate ?? '');
      const bv = sortKey === 'decision' ? b.decision
        : sortKey === 'owner' ? (b.owner ?? '')
        : sortKey === 'meeting' ? (b.meetingTitle ?? '')
        : (b.meetingDate ?? '');
      return av < bv ? -1 : av > bv ? 1 : 0;
    };
    const out = [...rows].sort(cmp);
    return sortDir === 'desc' ? out.reverse() : out;
  }, [rows, sortKey, sortDir]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="apex-page-header">
        <span className="apex-page-title">Decisions</span>
        <span className="cell-meta">{rows.length}</span>
      </div>
      <div className="apex-grid-header" style={{ gridTemplateColumns: '2fr 140px 1fr 140px 1.5fr' }}>
        <SortHeader label="Decision" k="decision" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Owner" k="owner" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Meeting" k="meeting" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Date" k="date" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--apex-text-muted)', textTransform: 'uppercase' }}>Implication</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>Loading…</div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>No decisions yet.</div>
        ) : (
          sorted.map((r) => (
            <div key={r.id} className="apex-grid-row" style={{ gridTemplateColumns: '2fr 140px 1fr 140px 1.5fr', minHeight: 32, padding: '6px 14px' }}>
              <span className="cell-primary" style={{ fontSize: 12 }}>{r.decision}</span>
              <span className="cell-meta" style={{ fontSize: 11.5 }}>{r.owner ?? '—'}</span>
              <Link href={r.meetingId ? `/meetings/${r.meetingId}` : '#'} style={{ fontSize: 11.5, color: 'var(--apex-primary-bright)', textDecoration: 'none' }}>
                {r.meetingTitle ?? '—'}
              </Link>
              <span className="cell-meta" style={{ fontSize: 11.5 }}>{formatDate(r.meetingDate)}</span>
              <span className="cell-secondary" style={{ fontSize: 11.5 }}>{r.implication ?? '—'}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run build`. Expected: builds.

```bash
git add app/decisions
git commit -m "List page: cross-meeting Decisions"
```

---

### Task 27: Risks list page

**Files:**
- Create: `app/risks/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/risks/page.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SortHeader from '@/components/SortHeader';

interface Row {
  id: string;
  risk: string;
  severity: string | null;
  status: string | null;
  whyItMatters: string | null;
  mitigation: string | null;
  meetingId: string | null;
  meetingTitle: string | null;
  meetingDate: string | null;
  companyName: string | null;
}

type SortKey = 'risk' | 'severity' | 'status' | 'meeting' | 'date' | null;

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'mitigated', label: 'Mitigated' },
  { value: 'accepted', label: 'Accepted' },
];

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d));
}

export default function RisksListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('severity');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetch('/api/risks')
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const onSort = (k: NonNullable<SortKey>) => {
    if (sortKey !== k) { setSortKey(k); setSortDir('asc'); return; }
    if (sortDir === 'asc') setSortDir('desc');
    else { setSortKey(null); }
  };

  const setStatus = async (id: string, status: string) => {
    const prev = rows;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
    try {
      const res = await fetch(`/api/risks/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch { setRows(prev); }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const cmp = (a: Row, b: Row) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortKey === 'severity') {
        av = SEVERITY_ORDER[a.severity ?? ''] ?? 99;
        bv = SEVERITY_ORDER[b.severity ?? ''] ?? 99;
      } else if (sortKey === 'risk')    { av = a.risk; bv = b.risk; }
      else if (sortKey === 'status')  { av = a.status ?? ''; bv = b.status ?? ''; }
      else if (sortKey === 'meeting') { av = a.meetingTitle ?? ''; bv = b.meetingTitle ?? ''; }
      else                             { av = a.meetingDate ?? ''; bv = b.meetingDate ?? ''; }
      return av < bv ? -1 : av > bv ? 1 : 0;
    };
    const out = [...rows].sort(cmp);
    return sortDir === 'desc' ? out.reverse() : out;
  }, [rows, sortKey, sortDir]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="apex-page-header">
        <span className="apex-page-title">Risks</span>
        <span className="cell-meta">{rows.length}</span>
      </div>
      <div className="apex-grid-header" style={{ gridTemplateColumns: '2.5fr 90px 110px 1fr 130px' }}>
        <SortHeader label="Risk" k="risk" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Severity" k="severity" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Meeting" k="meeting" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Date" k="date" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>Loading…</div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>No risks yet.</div>
        ) : (
          sorted.map((r) => (
            <div key={r.id} className="apex-grid-row" style={{ gridTemplateColumns: '2.5fr 90px 110px 1fr 130px', minHeight: 32, padding: '6px 14px', alignItems: 'center' }}>
              <span className="cell-primary" style={{ fontSize: 12 }}>{r.risk}</span>
              <span className={`badge sev-${r.severity ?? 'medium'}`} style={{ fontSize: 10 }}>{(r.severity ?? '—').toUpperCase()}</span>
              <select
                value={r.status ?? 'open'}
                onChange={(e) => setStatus(r.id, e.target.value)}
                style={{ height: 24, fontSize: 11, padding: '0 6px', background: 'var(--apex-panel)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)', borderRadius: 4 }}
              >
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <Link href={r.meetingId ? `/meetings/${r.meetingId}` : '#'} style={{ fontSize: 11.5, color: 'var(--apex-primary-bright)', textDecoration: 'none' }}>
                {r.meetingTitle ?? '—'}
              </Link>
              <span className="cell-meta" style={{ fontSize: 11.5 }}>{formatDate(r.meetingDate)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run build`. Expected: builds.

```bash
git add app/risks
git commit -m "List page: cross-meeting Risks"
```

---

### Task 28: Opportunities list page

**Files:**
- Create: `app/opportunities/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/opportunities/page.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SortHeader from '@/components/SortHeader';

interface Row {
  id: string;
  opportunity: string;
  nextStep: string | null;
  status: string | null;
  meetingId: string | null;
  meetingTitle: string | null;
  meetingDate: string | null;
  companyName: string | null;
}

type SortKey = 'opportunity' | 'status' | 'meeting' | 'date' | null;

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'pursuing', label: 'Pursuing' },
  { value: 'won', label: 'Won' },
  { value: 'dropped', label: 'Dropped' },
];

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d));
}

export default function OpportunitiesListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetch('/api/opportunities')
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const onSort = (k: NonNullable<SortKey>) => {
    if (sortKey !== k) { setSortKey(k); setSortDir('asc'); return; }
    if (sortDir === 'asc') setSortDir('desc');
    else { setSortKey(null); }
  };

  const setStatus = async (id: string, status: string) => {
    const prev = rows;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
    try {
      const res = await fetch(`/api/opportunities/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch { setRows(prev); }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const cmp = (a: Row, b: Row) => {
      const av = sortKey === 'opportunity' ? a.opportunity
        : sortKey === 'status' ? (a.status ?? '')
        : sortKey === 'meeting' ? (a.meetingTitle ?? '')
        : (a.meetingDate ?? '');
      const bv = sortKey === 'opportunity' ? b.opportunity
        : sortKey === 'status' ? (b.status ?? '')
        : sortKey === 'meeting' ? (b.meetingTitle ?? '')
        : (b.meetingDate ?? '');
      return av < bv ? -1 : av > bv ? 1 : 0;
    };
    const out = [...rows].sort(cmp);
    return sortDir === 'desc' ? out.reverse() : out;
  }, [rows, sortKey, sortDir]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="apex-page-header">
        <span className="apex-page-title">Opportunities</span>
        <span className="cell-meta">{rows.length}</span>
      </div>
      <div className="apex-grid-header" style={{ gridTemplateColumns: '2.5fr 110px 1.5fr 1fr 130px' }}>
        <SortHeader label="Opportunity" k="opportunity" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--apex-text-muted)', textTransform: 'uppercase' }}>Next step</span>
        <SortHeader label="Meeting" k="meeting" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Date" k="date" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>Loading…</div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>No opportunities yet.</div>
        ) : (
          sorted.map((r) => (
            <div key={r.id} className="apex-grid-row" style={{ gridTemplateColumns: '2.5fr 110px 1.5fr 1fr 130px', minHeight: 32, padding: '6px 14px', alignItems: 'center' }}>
              <span className="cell-primary" style={{ fontSize: 12 }}>{r.opportunity}</span>
              <select
                value={r.status ?? 'open'}
                onChange={(e) => setStatus(r.id, e.target.value)}
                style={{ height: 24, fontSize: 11, padding: '0 6px', background: 'var(--apex-panel)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)', borderRadius: 4 }}
              >
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <span className="cell-secondary" style={{ fontSize: 11.5 }}>{r.nextStep ?? '—'}</span>
              <Link href={r.meetingId ? `/meetings/${r.meetingId}` : '#'} style={{ fontSize: 11.5, color: 'var(--apex-primary-bright)', textDecoration: 'none' }}>
                {r.meetingTitle ?? '—'}
              </Link>
              <span className="cell-meta" style={{ fontSize: 11.5 }}>{formatDate(r.meetingDate)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run build`. Expected: builds.

```bash
git add app/opportunities
git commit -m "List page: cross-meeting Opportunities"
```

---

### Task 29: Add nav links

**Files:**
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Extend the primaryNav array**

Open `components/Sidebar.tsx`. Find the `primaryNav` array (currently has Inbox, Meetings, Action Items, People, Companies). Insert three new entries between "Action Items" and "People":

Replace:
```ts
const primaryNav = [
  { href: '/',             icon: 'space_dashboard', label: 'Inbox' },
  { href: '/meetings',     icon: 'event_note',      label: 'Meetings' },
  { href: '/action-items', icon: 'checklist',       label: 'Action Items' },
  { href: '/contacts',     icon: 'group',           label: 'People' },
  { href: '/companies',    icon: 'business',        label: 'Companies' },
];
```

with:
```ts
const primaryNav = [
  { href: '/',              icon: 'space_dashboard', label: 'Inbox' },
  { href: '/meetings',      icon: 'event_note',      label: 'Meetings' },
  { href: '/action-items',  icon: 'checklist',       label: 'Action Items' },
  { href: '/decisions',     icon: 'gavel',           label: 'Decisions' },
  { href: '/risks',         icon: 'warning',         label: 'Risks' },
  { href: '/opportunities', icon: 'trending_up',     label: 'Opportunities' },
  { href: '/contacts',      icon: 'group',           label: 'People' },
  { href: '/companies',     icon: 'business',        label: 'Companies' },
];
```

- [ ] **Step 2: Verify + commit**

Start `npm run dev` and confirm the three new links appear, click each, confirm the page renders.

```bash
git add components/Sidebar.tsx
git commit -m "Sidebar: add Decisions / Risks / Opportunities nav links"
```

---

## Phase 8 — Cleanup

### Task 30: Drop the deprecated `participants` column

**Pre-condition.** This is the only intentionally destructive task in the plan. Do NOT run it until you've shipped Tasks 1-29 and verified for at least one full session that nothing in the app reads `meetings.participants`. Once dropped, the column is gone — backups are your only recovery.

**Files:**
- Modify: `lib/schema.ts`
- Modify: `app/api/admin/migrate/route.ts`

- [ ] **Step 1: Verify no callers read `participants`**

Run:
```bash
grep -rn "participants" app components lib --include="*.ts" --include="*.tsx"
```
Expected: only matches inside the migration backfill SQL and the schema definition. Any caller code (page components, API routes) that still reads `meetings.participants` must be cleaned up first — fix and recommit before proceeding.

- [ ] **Step 2: Remove from drizzle schema**

In `lib/schema.ts`, remove the line:
```ts
  participants: text('participants').array(),
```
from the `meetings` table definition.

- [ ] **Step 3: Add the drop statement to the migrate route**

In `app/api/admin/migrate/route.ts`, append to the `STATEMENTS` array (at the end):

```ts
  // recap detail follow-up: drop deprecated participants column.
  // Idempotent — DROP COLUMN IF EXISTS is a no-op once the column is gone.
  `ALTER TABLE meetings DROP COLUMN IF EXISTS participants`,
```

- [ ] **Step 4: Apply and verify**

Run the migrate endpoint:
```bash
curl -X POST 'http://localhost:3000/api/admin/migrate?token=local-dev-token'
```
Expected: HTTP 200, `failed: 0`.

Verify in Postgres:
```sql
\d meetings
```
The `participants` column should be gone. Refresh a meeting detail page and confirm everything still loads.

- [ ] **Step 5: Build and commit**

Run: `npm run build`
Expected: builds clean.

```bash
git add lib/schema.ts app/api/admin/migrate/route.ts
git commit -m "Drop deprecated meetings.participants column"
```

---

## Self-review notes

After completing all tasks, do a final pass:

1. `npm run build` — full type-check and build pass with no errors.
2. `npm run lint` — clean.
3. `grep -rn "aiSummary" app components lib --include="*.ts" --include="*.tsx"` — should return zero hits (the field has been fully renamed).
4. `grep -rn "meetings.participants\|participants:" app components lib --include="*.ts" --include="*.tsx"` — only the historical migration backfill should remain (in `app/api/admin/migrate/route.ts`).
5. Manually exercise: import a fresh meeting via Paste Notes, confirm every section populates from the LLM. Re-extract; confirm action items survive. Edit a decision inline; confirm persistence. Visit each list page; confirm sortable headers and meeting links work. Drop participants column (Task 30) only after this checklist passes.









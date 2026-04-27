# Today's Meetings Prep Guide — Design

**Status:** Approved design, pending implementation plan
**Author:** Brainstormed with Peter, 2026-04-27
**Replaces conceptually:** `docs/plans/today-meetings-prep-guide.md` (kept for reference; this design supersedes it)

---

## Goal

When Peter opens the app in the morning, he sees today's meetings already laid out with AI-generated prep briefs — without clicking anything, without waiting for AI to run, and without manual data entry. By 5:00 AM ET each day, the system has fetched his calendars, deduped events, and generated structured prep guides for every meeting on his day.

## Non-goals (v1)

- Editing the AI-generated prep inline (read-only)
- Calendar write-back / two-way sync (we never modify calendars)
- Multi-day view (today only; tomorrow/week views are follow-ons)
- Email digest of the brief
- Linking post-meeting Read.ai recaps to the pre-meeting prep row by `ics_uid` (separate design problem; Read.ai imports don't carry ICS UIDs)
- Editable agenda items written back as `meeting_prep_items`

---

## High-level architecture

```
ICS feeds (3 URLs) ─▶ Fetch & parse ─▶ Dedupe ─▶ Upsert meetings rows
                                                       │
                                                       ▼
                                       For each new/changed meeting:
                                       generate prep guide via GPT-4o,
                                       insert into meeting_prep_guides
                                                       │
                                                       ▼
                                  /api/meetings/today (DB-only read)
                                                       │
                                                       ▼
                                  TodayMeetingsPanel + /today page
```

**Triggers (3× daily Vercel cron, UTC):**
- `09:00 UTC` — 5 AM ET (4 AM during EST)
- `13:00 UTC` — 9 AM ET (8 AM during EST)
- `17:00 UTC` — 1 PM ET (12 PM during EST)

DST drift is acceptable; the intent is "morning / mid-morning / afternoon" refresh cadence.

**Read path is pure DB.** UI never triggers external fetches or AI calls during page render. ICS or OpenAI outages cannot break the dashboard — they just mean stale data.

**Manual escape hatch:** every meeting card has a "Regenerate" button that calls `POST /api/meetings/[id]/regenerate-prep` to force a fresh AI run.

---

## Data model

### Add columns to `meetings`

| Column | Type | Notes |
|---|---|---|
| `ics_uid` | `text UNIQUE` | Stable per-event ID from ICS. Primary dedupe key. Null for legacy/Drive-imported rows. |
| `start_at` | `timestamptz` | Precise start. Replaces the brittle `meeting_date timestamp` + `meeting_time text` combo for ICS-sourced rows. Existing rows keep their old fields. |
| `end_at` | `timestamptz` | Precise end. |
| `calendar_source` | `text` | `'conversely'` / `'pine-lake'` / `'cranbrook'`. Distinct from existing `source` column (which means import path: `'manual'`, `'drive'`, etc.). |
| `join_url` | `text` | Teams / Zoom / Meet link extracted from ICS event description or location. |

`platform` (existing column) is populated from join URL detection: `'teams'` if the URL is `teams.microsoft.com`, etc.

### New table `meeting_prep_guides`

```sql
CREATE TABLE meeting_prep_guides (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id      uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  guide           jsonb NOT NULL,
  input_hash      text NOT NULL,
  model           text NOT NULL,
  generated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX meeting_prep_guides_meeting_id_idx
  ON meeting_prep_guides (meeting_id, generated_at DESC);
```

UI reads the latest by `meeting_id` ordered by `generated_at DESC LIMIT 1`. Older rows are kept as a regen history (debugging, auditing how prep evolved across the day).

### Migration

Add to existing `app/api/admin/migrate/route.ts` using the established `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS` pattern. No data backfill needed.

---

## Cron pipeline (`POST /api/cron/sync-calendar`)

Single endpoint orchestrates the whole run. Steps:

### 1. Fetch all 3 ICS feeds in parallel

Library: `node-ical` (handles RRULE expansion, attendees, descriptions).

Config (env vars):
- `ICS_FEED_CONVERSELY`
- `ICS_FEED_PINE_LAKE`
- `ICS_FEED_CRANBROOK`

If a feed times out or 404s: log the failure, continue with the others. The endpoint returns 200 with a per-feed status summary even if some failed.

### 2. Expand each feed to today's events only

For each event in each feed, expand RRULEs and filter to events whose `start_at` falls on today (in `America/New_York`). For each event, extract:

- `ics_uid` (the `UID` property)
- `summary` (title)
- `description`
- `location`
- `start`, `end` (as `timestamptz`)
- `attendees` (array of `{ email, cn }`)

Then derive:

- `join_url`: regex search description + location for `teams.microsoft.com/l/meetup-join`, `meet.google.com`, or `zoom.us` URLs (first match wins)
- `platform`: `'teams' | 'zoom' | 'meet' | null` from join URL
- `calendar_source`: which feed this came from
- Title cleaning: strip leading `FW:`, `Re:`, `Invitation:` prefixes for downstream matching (preserve original in `summary`)

### 3. Dedupe across feeds

Match in this order:

1. **Same `ics_uid`** as an existing `meetings` row → upsert (update `start_at`, `end_at`, `summary`, etc.). Idempotent.
2. **Same `start_at` (within ±5 min) AND fuzzy title match** with another event in this run → it's a cross-calendar duplicate. Drop it. Calendar priority for which copy wins:
   1. `conversely`
   2. `pine-lake`
   3. `cranbrook`
3. **No match** → insert as a new `meetings` row.

Fuzzy title match: lowercase, strip prefixes, compare with shared-token threshold (≥3 significant tokens in common, or Levenshtein ratio ≥ 0.85). Implementation detail; tune in code.

### 4. Match attendees to contacts

For each ICS attendee:

- Look up `contacts` by `email`. If found → create `meeting_attendees` row with `contact_id` set.
- If not found → create a stub `contacts` row (`fullName` = ICS `CN` field, `email`, `kind = null`), then link.

This gracefully grows the contacts table as new people appear on the calendar.

### 5. Generate prep guides

For each meeting in today's set (after dedupe):

1. Classify the meeting (rule-based, see "Type-aware prep" below).
2. Gather context based on type.
3. Compute `input_hash` = SHA-256 of a canonical-form string of all prompt inputs (attendees emails, prior meeting summary, open action items, meeting metadata).
4. Look up the most recent `meeting_prep_guides` row for this meeting:
   - If `input_hash` matches and the row was generated less than 12 hours ago → **skip** the AI call (cron-level cache).
   - Otherwise → call OpenAI, insert a new `meeting_prep_guides` row.

**Manual regenerate** (the UI button) always forces a fresh call regardless of hash.

### 6. Audit

Insert a row into a small `cron_runs` table (or log to console for v1 — keep it minimal):
- `started_at`, `finished_at`
- `feeds_succeeded`, `feeds_failed`
- `meetings_inserted`, `meetings_updated`, `meetings_deduped`
- `guides_generated`, `guides_skipped_cache`, `guides_failed`

Per-feed failure detail can wait for v2 if needed.

---

## Type-aware prep generation

### Step 1 — Classify (rule-based, no AI)

| Signal | Type |
|---|---|
| Title contains `interview` (case-insensitive) and a known person's name | `interview` |
| Title matches another past meeting (same fuzzy-title-match logic) | `recurring` |
| Title contains `1:1` or `/` between two names, OR exactly 2 attendees | `one_on_one` |
| Has external attendees AND `companyId` set | `external_meeting` |
| Default | `general` |

Classification is a small pure function. Tested independently.

### Step 2 — Gather type-specific context

- **`recurring`:** most recent prior occurrence (matched by fuzzy title + same calendar) — its `executive_summary`, `meeting_prep_items`, related `decisions`/`risks`/`opportunities`, plus open `action_items` tied to that meeting series.
- **`interview`:** `contacts` row for the interviewee (role, notes, email), prior meetings whose title contains the same person's name (prior rounds), the role context derived from the title (e.g. "Operations Officer"). If consecutive interviews for the same role → see Step 4.
- **`one_on_one`:** prior 1:1s with this person, open action items they own, open action items Peter owes them.
- **`external_meeting`:** `companies` row for `companyId`, all prior meetings with this company, open `opportunities` and `risks` tied to the company.
- **`general`:** attendees + any prior meeting with a fuzzy-matching title.

In all cases: filter out action items where the assignee matches an `excludeFromTasks` contact. Use the same matching logic as [DashboardClient.tsx:138-156](../../components/DashboardClient.tsx) — full name AND first-name token, case-insensitive. Implement once in `lib/exclusions.ts` and reuse server-side.

### Step 3 — Prompt to GPT-4o

Same JSON output shape across all types (so the UI is uniform):

```ts
type PrepGuide = {
  background: string[];                    // 3-5 narrative bullets
  updates_to_request: {                    // ask external owners for X
    person: string;
    item: string;
    question_to_ask: string;
  }[];
  your_prep: string[];                     // what Peter should be ready to speak to
  suggested_agenda: {
    topic: string;
    talking_points: string[];
    time_estimate_min: number;
  }[];
  desired_outcomes: string[];
  watch_out_for: string[];                 // risks, tensions, traps
};
```

The *content* differs by type:
- For `interview`: `updates_to_request` may be empty; `your_prep` lists probing questions; `watch_out_for` highlights candidate red flags from prior rounds.
- For `recurring`: `background` is the prior-occurrence story; `updates_to_request` enumerates open external action items.
- For `one_on_one`: heavier emphasis on `updates_to_request` and bidirectional action items.
- For `external_meeting`: heavier emphasis on company context and opportunities.
- For `general`: lighter prep, focus on attendee research.

System prompts are per-type, kept in `lib/prep-prompts.ts`. Each prompt insists on JSON output, no markdown fences, names referenced concretely.

Model: `gpt-4o` (consistent with [lib/extract.ts:117](../../lib/extract.ts) and [outreach/route.ts:79](../../app/api/action-items/[id]/outreach/route.ts)). Temperature: `0.3`. `response_format: { type: 'json_object' }`.

### Step 4 — Group consecutive same-context meetings

Detection: 3+ meetings within 90 minutes whose titles share a normalized stem (e.g. `"Operations Officer ... Interview"`).

For these, generate a single shared "context block" (about the role/company/screening criteria) once. Each per-meeting prep call uses that shared block as additional system context, then focuses on the interviewee-specific prep. Net effect in the UI: each card has its own prep, but they're internally consistent and Peter doesn't see the same role description repeated 3 times.

### Step 5 — Cache by input hash

`input_hash` = SHA-256 of a canonical-form string built from:
- meeting `id`
- attendee emails (sorted)
- attendee names (sorted)
- prior meeting `id` if any (the matched prior-occurrence)
- open action item IDs + statuses + assignees (sorted)
- meeting type
- meeting `summary`, `start_at`

If the hash matches the latest `meeting_prep_guides` row's `input_hash` and that row is < 12h old, skip the OpenAI call. Otherwise regenerate. Manual regenerate always forces.

---

## API surface

### `GET /api/meetings/today`

Pure DB read. No external fetches.

Returns: array of today's meetings (where `start_at` falls in today in `America/New_York`), excluding rows where `ics_uid` is null and `meeting_date` doesn't match today (i.e. legacy meetings without start_at use the existing date logic). Each meeting object includes:

```ts
{
  id, summary, start_at, end_at, calendar_source, join_url, platform, companyName,
  attendees: [{ name, email, role_at_meeting, contact_id, kind }],
  open_actions: ActionItem[],          // filtered by excludeFromTasks
  external_actions: ActionItem[],      // ownerSide === 'external', also filtered
  peter_actions: ActionItem[],         // ownerSide === 'peter', also filtered
  prep_guide: PrepGuide | null,        // latest from meeting_prep_guides
  prep_guide_generated_at: string | null,
  meeting_type: 'recurring' | 'interview' | 'one_on_one' | 'external_meeting' | 'general',
  prior_occurrence: { id, summary, meeting_date, executive_summary } | null,
}
```

### `POST /api/meetings/[id]/regenerate-prep`

Forces a fresh prep guide for the given meeting. Re-runs context gathering, ignores cache hash, calls OpenAI, inserts a new `meeting_prep_guides` row. Returns the new guide.

Errors:
- 404 if meeting not found
- 500 with structured error body if OpenAI fails or returns invalid JSON (caught and reported)

### `POST /api/cron/sync-calendar`

The cron endpoint. Same function described in "Cron pipeline" section above. Returns 200 with a status summary even on partial failure.

Authentication: protected by Vercel cron's standard mechanism (matches existing `/api/cron/import-drive`).

---

## UI

### `<TodayMeetingsPanel>` component

Renders the day's meetings as a vertical stack of expandable cards.

**Layout per card (collapsed):**
```
▶ 10:30 AM — 11:00 AM   True Choice Morning Huddle              [Join]
   Conversely · 6 attendees · 2 open actions
```

**Layout per card (expanded):**
```
▼ 10:30 AM — 11:00 AM   True Choice Morning Huddle              [Join]
   Conversely · 6 attendees · 2 open actions

   BACKGROUND
   • [3-5 bullets...]

   UPDATES TO REQUEST
   • Jon Maso → "Where are we on Smart Financial intake?"
   • [...]

   YOUR PREP
   • [list...]

   SUGGESTED AGENDA
   • Topic — 5 min — talking point 1, talking point 2
   • [...]

   DESIRED OUTCOMES
   • [list...]

   WATCH OUT FOR
   • [list...]

   [↻ Regenerate]   Generated 5:02 AM by gpt-4o
```

**Behavior:**
- Default state: expanded if ≤2 meetings today; collapsed if 3+ (Peter expands as he goes).
- Card header click toggles expand/collapse.
- `[Join]` button only shown when `join_url` is present; opens in new tab.
- `[Regenerate]` is a small ghost-style button at the bottom of the expanded body. Shows a spinner during regen.
- If `prep_guide` is null for a meeting (e.g. cron failed for it), show `[Generate guide]` button instead of the prep sections, calling the same regenerate endpoint.
- Auto-hides the entire panel if zero meetings today.

**Styling:** matches existing app design system (`var(--apex-bg)`, `var(--apex-panel)`, `var(--apex-primary-bright)`, etc.). Card border `1px solid var(--apex-border)`, `border-radius: 6px`. Section labels in the same uppercase-tracking style used elsewhere.

### Mounting

The same `<TodayMeetingsPanel>` component renders in two places:

1. **Inbox** (`/`): mounted at the top of `DashboardClient`, above the `ResizableSplit`. Auto-hides when zero meetings.
2. **Dedicated `/today` page**: full-page focused view. New file `app/today/page.tsx` + `app/today/layout.tsx` if needed. Same component, different layout wrapper.

### Sidebar

Add `/today` entry at the top of `primaryNav` in [Sidebar.tsx:7](../../components/Sidebar.tsx):

```tsx
{ href: '/today', icon: 'today', label: 'Today' }
```

Sidebar fetches `/api/meetings/today` on mount (lightweight) to drive a count badge:

```tsx
<Link href="/today" className={...}>
  <span className="material-symbols-outlined">today</span>
  Today
  {todayCount > 0 && <span className="nav-badge accent">{todayCount}</span>}
</Link>
```

Active when `pathname === '/today'`.

### Stat strip

Add a "Today" stat to the existing strip in [DashboardClient.tsx:508](../../components/DashboardClient.tsx) (between "This Month" and "Open"):

```tsx
<div className="apex-stat">
  <span className={`apex-stat-value${todayCount > 0 ? ' accent' : ''}`}>{todayCount}</span>
  <span className="apex-stat-label">Today</span>
</div>
```

---

## Failure modes & edge cases

| Scenario | Behavior |
|---|---|
| ICS feed unreachable | Other feeds proceed. Cron returns 200. UI shows whatever was last successfully fetched. |
| OpenAI fails for one meeting | That meeting renders without a prep guide; UI offers `[Generate guide]` button. |
| Calendar changes mid-day | Next cron picks it up. UI freshness timestamp shows last generation time. |
| Manually-created meeting (existing CRUD) for today | Appears in panel without a prep guide; UI offers `[Generate guide]` button. |
| Cross-calendar duplicate added later | Dedupe still applies; one survives, others dropped. |
| No meetings today | Panel auto-hides on Inbox; `/today` page shows an empty state ("No meetings today"). |
| `excludeFromTasks` contact appears as attendee | Their open action items are filtered from the prep guide context AND the `updates_to_request` list. |
| OpenAI returns invalid JSON | Catch, log, return null prep guide. UI shows the `[Generate guide]` button. No silent corruption. |
| ICS attendee has no email | Stub contact created with email = null. Won't merge with future records — acceptable for v1. |

---

## Testing & verification

- **ICS parser unit tests** (mock ICS strings): RRULE expansion, attendee parsing, join URL extraction, prefix stripping.
- **Dedupe unit tests:** same UID, fuzzy match across feeds, no match.
- **Classifier unit tests:** each meeting type, edge cases (interview without person name, 1:1 with 3 attendees).
- **Cache hash tests:** identical inputs → same hash; one attendee changes → different hash.
- **Excludes filter tests:** ensure `excludeFromTasks` contacts are filtered everywhere.
- **End-to-end manual:** with the 3 ICS URLs configured, run `POST /api/cron/sync-calendar` manually, verify today's meetings + guides appear in `/today`.
- **Regenerate path:** click regenerate, verify a new `meeting_prep_guides` row is inserted with a different `generated_at`.

---

## Implementation outline (for the implementation plan to expand)

1. Add `node-ical` and `crypto` (built-in) dependencies.
2. Schema migration: new columns on `meetings`, new `meeting_prep_guides` table.
3. `lib/ics.ts` — fetch + parse + expand to today.
4. `lib/dedupe.ts` — UID + fuzzy match logic.
5. `lib/exclusions.ts` — server-side reusable excludeFromTasks filter (refactor from DashboardClient pattern).
6. `lib/classify-meeting.ts` — meeting type classifier.
7. `lib/prep-prompts.ts` — per-type system prompts.
8. `lib/prep-context.ts` — gather context per type.
9. `lib/prep-hash.ts` — input hashing.
10. `lib/generate-prep.ts` — orchestrates classify → context → hash → cache check → OpenAI call.
11. `app/api/cron/sync-calendar/route.ts` — the cron endpoint.
12. `app/api/meetings/today/route.ts` — DB-only read endpoint.
13. `app/api/meetings/[id]/regenerate-prep/route.ts` — manual force-regen endpoint.
14. `components/TodayMeetingsPanel.tsx` — the panel component.
15. `app/today/page.tsx` — dedicated route.
16. Mount panel in `DashboardClient.tsx`; add stat-strip "Today" cell; add Sidebar nav entry + badge fetch.
17. Update `vercel.json` with three cron entries.
18. Update `app/api/admin/migrate/route.ts` with the new schema statements.

Each gets its own task in the implementation plan, with verification steps.

---

## Open follow-on work (not in v1)

- **Read.ai recap → prep meeting linking.** When a Read.ai recap imports later that day for a meeting we already prepped, link the recap to the prep meeting row (so prep + recap stay tied to one meeting). Needs a fuzzy match strategy since Read.ai imports don't carry ICS UIDs.
- **Multi-day view.** Tomorrow / This Week views, same component reused with date range filter.
- **Email digest.** Pipe `GET /api/meetings/today` → an email at 6 AM ET via `lib/mail.ts`.
- **Editable prep.** Allow Peter to edit AI-generated agenda items inline, persisted as `meeting_prep_items`.
- **Snooze-aware updates.** Filter `snoozedUntil` action items out of `updates_to_request`.
- **RSVP / response sync.** Two-way calendar integration. Out of scope.

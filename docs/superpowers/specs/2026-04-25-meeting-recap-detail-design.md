# Meeting Recap Detail — Design

**Date:** 2026-04-25
**Status:** Approved for implementation planning

## Goal

Turn each meeting's detail page into a complete, structured recap that captures the key details of the meeting — executive summary, attendees with engagement, topic-by-topic narrative, decisions, action items (commitments and follow-ups), risks, opportunities, next-meeting prep, and meeting effectiveness. Written as narrative bullet points: structure for scanability, prose-weight bullets so the recap reads like notes a person would actually take.

Decisions, risks, and opportunities also become real entities with cross-meeting list pages, mirroring the existing Action Items list.

## Non-goals

- Building a full CRM-grade contact link for every attendee (free-text by default; optional contact link later).
- Real-time collaborative editing.
- Any change to the import flow itself (Paste Notes / Google Drive remain as-is — only what we extract changes).
- Markdown-WYSIWYG editing for prose. Inline edit fields are plain text; bullet structure comes from the schema, not from markdown parsing.

## Approach summary

- **Storage:** fully structured. New tables for attendees, topics, decisions, risks, opportunities, next-meeting prep. Extended columns on `action_items` and `meetings`.
- **Action items / commitments / follow-ups:** one entity (`action_items`), multiple views via two new columns — `urgency_tier` and `owner_side`.
- **Extraction:** one beefed-up LLM prompt (JSON mode) on import and on "Re-extract" fills every structured field.
- **Editing:** every section is editable inline on the detail page (rows can be added, edited, removed; prose fields are inline-edit on click, save on blur).
- **Layout:** single scrolling detail page with a sticky left-sidebar table of contents.
- **Cross-meeting views:** new list pages for Decisions, Risks, Opportunities that mirror the existing Action Items list (sortable headers, filter by company, click-through to source meeting).

## Schema changes

### New tables

**`meeting_attendees`** — replaces the current `meetings.participants` text array.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `meeting_id` | uuid FK → meetings | not null |
| `contact_id` | uuid FK → contacts | nullable; populated when an attendee is linked to a contact |
| `name` | text | not null; snapshot — survives if contact is deleted, used directly when no contact link |
| `role_at_meeting` | text | e.g. "Partner, Firm X". Snapshot at time of meeting. |
| `engagement` | text enum | `dominant` / `active` / `quiet`; nullable if unknown |
| `position` | int | stable display order |
| `created_at`, `updated_at` | timestamp | |

**`meeting_topics`** — the "Summary by topic" section.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `meeting_id` | uuid FK → meetings | not null |
| `title` | text | not null |
| `content` | text | bullet-narrative body, plain text with newlines as bullet separators |
| `position` | int | reorderable |
| `created_at`, `updated_at` | timestamp | |

**`decisions`**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `meeting_id` | uuid FK → meetings | not null |
| `decision` | text | not null |
| `owner` | text | name string |
| `contact_id` | uuid FK → contacts | nullable, optional contact link |
| `implication` | text | |
| `created_at`, `updated_at` | timestamp | |

**`risks`**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `meeting_id` | uuid FK → meetings | not null |
| `risk` | text | not null |
| `why_it_matters` | text | |
| `mitigation` | text | |
| `severity` | text enum | `low` / `medium` / `high` |
| `status` | text enum | `open` / `mitigated` / `accepted`; default `open` |
| `created_at`, `updated_at` | timestamp | |

**`opportunities`**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `meeting_id` | uuid FK → meetings | not null |
| `opportunity` | text | not null |
| `next_step` | text | |
| `status` | text enum | `open` / `pursuing` / `won` / `dropped`; default `open` |
| `created_at`, `updated_at` | timestamp | |

**`meeting_prep_items`** — Next Meeting Prep, one table for all three sub-lists.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `meeting_id` | uuid FK → meetings | not null; this is the meeting whose recap holds the prep — i.e. prep "for the next meeting after this one" |
| `kind` | text enum | `agenda` / `question` / `outcome` |
| `text` | text | not null |
| `rationale` | text | nullable; only meaningful for `agenda` (the "why") |
| `completed` | bool | default false; only meaningful for `outcome` |
| `position` | int | stable order within `kind` |
| `created_at`, `updated_at` | timestamp | |

### Extended tables

**`action_items`** — add two columns:

| Column | Type | Notes |
|---|---|---|
| `urgency_tier` | text enum | `urgent` / `this_week` / `waiting_on` / `none`; default `none` |
| `owner_side` | text enum | `peter` / `external`; nullable |

Existing rows: backfill `urgency_tier = 'none'` and leave `owner_side` null.

**`meetings`** — rename + add columns:

| Change | Detail |
|---|---|
| Rename | `ai_summary` → `executive_summary` |
| Add | `duration_minutes` int |
| Add | `productive_minutes` int |
| Add | `asyncable_minutes` int |
| Add | `tangent_minutes` int |
| Add | `improvement_note` text |
| Drop | `participants` text[] (after data migration) |

### Migration

A one-shot migration script:

1. Adds new tables and columns.
2. For each existing meeting, splits `participants` into `meeting_attendees` rows (`name` populated, `engagement`/`role_at_meeting`/`contact_id` left null, `position` from array index).
3. Renames `ai_summary` → `executive_summary` (no data transformation; existing summary text becomes the executive summary).
4. Drops the `participants` column.

Existing meetings will have empty `meeting_topics`, `decisions`, `risks`, `opportunities`, `meeting_prep_items`, and effectiveness fields until the user clicks "Re-extract" on them.

## Extraction

`lib/extract.ts` is rewritten to produce a single JSON document covering every structured field. Same model (GPT-4o, JSON mode); the prompt is the bulk of the change.

**JSON shape returned:**

```json
{
  "title": "string",
  "executive_summary": "string (4-8 narrative bullets, separated by newlines, no leading bullet character)",
  "attendees": [
    {
      "name": "string",
      "role": "string|null",
      "engagement": "dominant|active|quiet|null"
    }
  ],
  "topics": [
    { "title": "string", "content": "string (bullet-narrative body, newline-separated)" }
  ],
  "decisions": [
    { "decision": "string", "owner": "string|null", "implication": "string|null" }
  ],
  "action_items": [
    {
      "title": "string",
      "description": "string|null",
      "assignee": "string|null",
      "due_date": "YYYY-MM-DD|null",
      "priority": "low|medium|high",
      "urgency_tier": "urgent|this_week|waiting_on|none",
      "owner_side": "peter|external|null"
    }
  ],
  "risks": [
    {
      "risk": "string",
      "why_it_matters": "string|null",
      "mitigation": "string|null",
      "severity": "low|medium|high"
    }
  ],
  "opportunities": [
    { "opportunity": "string", "next_step": "string|null" }
  ],
  "next_meeting_prep": {
    "agenda": [{ "text": "string", "rationale": "string|null" }],
    "questions": ["string"],
    "outcomes": ["string"]
  },
  "effectiveness": {
    "duration_minutes": "int|null",
    "productive_minutes": "int|null",
    "asyncable_minutes": "int|null",
    "tangent_minutes": "int|null",
    "improvement_note": "string|null"
  }
}
```

**Behavior:**

- Called on Paste Notes import, Google Drive import, and the manual "Re-extract" button.
- "Re-extract" replaces all structured fields *except* user-edited `action_items` (action items are already user-managed; we do not blow away in-progress work). For all other tables (decisions, risks, opportunities, topics, prep items, attendees), Re-extract clears existing rows and replaces with the LLM output.
- Attendee linking: extraction does not invent `contact_id`s. After extraction, a server-side step does case-insensitive name matching against `contacts.full_name`; matches are linked, non-matches stay free-text.

## Edit UX

Every section on the detail page is editable. Affordances by section:

- **Executive summary, topic content, improvement note, prose fields on rows:** click to edit inline (textarea grows to fit), save on blur. Esc cancels.
- **Attendees, decisions, risks, opportunities, prep items:** "Add row" button at the section bottom; row-level menu offers Edit / Delete. Inline cell edit on click for individual fields.
- **Engagement, severity, status, urgency_tier, owner_side, kind:** native `<select>` dropdowns (matching the existing pattern in the action items list — see `70d5947` and recent commits).
- **Action items:** existing UI on the detail page extended with `urgency_tier` and `owner_side` controls per row. Two view toggles: "By urgency" (default — groups by tier) and "By owner" (groups by Peter / external).
- **Time breakdown:** three numeric inputs side-by-side; `duration_minutes` is editable independently from the breakdown total (they're allowed to disagree — the time-breakdown is approximate).

**Bullet rendering for prose fields.** `executive_summary`, `meeting_topics.content`, and `improvement_note` are stored as plain text with newline-separated lines. The renderer splits on newlines and emits an `<ul><li>` per non-empty line. This is the only "markdown-like" affordance — no inline parsing of `*`, `**`, links, etc.

PATCH endpoints follow the existing conventions in `app/api/`. Each table gets a thin `app/api/<resource>/[id]/route.ts` for `PATCH`/`DELETE`, and `app/api/meetings/[id]/<resource>/route.ts` for `POST` (create within a meeting).

## Detail page UI

Single scrolling page. Layout:

- **Sticky left sidebar (TOC):** section titles, with row counts where useful (e.g., "Action Items (5)", "Risks (1)"). Click scrolls to section. Highlights current section while scrolling.
- **Main scroll area:** sections in this order:
  1. Header: title, date, duration, platform, company, [Re-extract] [Share] buttons
  2. Executive Summary
  3. Attendees
  4. Topics (each topic is its own subsection with title + bullet body)
  5. Decisions
  6. Action Items (with view toggle: By urgency / By owner)
  7. Risks
  8. Opportunities
  9. Next Meeting Prep (three sub-blocks: Suggested agenda, Questions to ask, Desired outcomes)
  10. Meeting Effectiveness (time breakdown + improvement note)
  11. Transcript (collapsible, closed by default)

Existing "Chapters" and "Key Questions" data on the meetings table are preserved as-is and continue to render — they sit before the Transcript section, since they're transcript-derived rather than recap content. (If Chapters/Key Questions are empty for a meeting, the section is hidden.)

## Cross-meeting list pages

Three new pages, each modeled directly on `app/action-items/page.tsx`:

- `app/decisions/page.tsx` — columns: Decision, Owner, Meeting, Date, Implication. Sortable headers.
- `app/risks/page.tsx` — columns: Risk, Severity, Status, Meeting, Date. Sortable; status is a `<select>` dropdown like action item status.
- `app/opportunities/page.tsx` — columns: Opportunity, Status, Next Step, Meeting, Date. Sortable; status is a `<select>` dropdown.

Each row's Meeting cell links to the source meeting detail page. Top-level navigation gets three new tabs (Decisions, Risks, Opportunities) alongside the existing tabs.

API endpoints `app/api/decisions/route.ts`, `app/api/risks/route.ts`, `app/api/opportunities/route.ts` provide the list (with simple sort/filter query params), mirroring the existing action items list endpoint.

## Backfill

No automatic backfill of decisions/risks/opportunities/topics/prep/effectiveness on existing meetings. The "Re-summarize" button (currently on the detail page) is renamed to **"Re-extract"** and now runs the new full-fields prompt. Users opt in per meeting.

The `participants` → `meeting_attendees` migration *does* run for all existing meetings automatically — that's a structural data move, not a regenerated-content change.

## Out of scope (explicitly)

- Markdown rendering inside prose fields. Bullet structure comes from the schema and the topic content's newlines, not from inline markdown.
- Bulk re-extract across many meetings at once.
- Per-section regenerate buttons (e.g., "regenerate just risks"). Re-extract is all-or-nothing.
- Automatically converting risks or opportunities into action items (and vice versa).
- Cross-meeting roll-ups beyond simple list pages (no dashboard, no charts).
- Sharing / export of the recap as PDF or Markdown.
- Tags / labels on meetings (the sample template's frontmatter `tags`). Out of scope for this design — meetings already have a `companyId`, which covers the most common grouping.

## Risks (in this design)

- **Re-extract data loss.** Re-extract replaces decisions/risks/opportunities/topics/prep wholesale. If a user edited a decision and then re-extracted, their edit is lost. *Mitigation:* confirmation dialog on Re-extract listing what will be replaced. Action items are explicitly preserved across re-extract for this reason.
- **LLM accuracy on subjective fields.** Engagement and effectiveness are judgment calls; the LLM will be wrong some of the time. Edit-everywhere mitigates this — the LLM gives a starting point, the user is the source of truth.
- **List-page scope creep.** Three new list pages plus the detail page is a meaningful build. If timeline is tight, the list pages can ship in a follow-up — the schema supports them either way.

## Open questions

None blocking — all major forks resolved during brainstorming. Implementation plan can proceed.

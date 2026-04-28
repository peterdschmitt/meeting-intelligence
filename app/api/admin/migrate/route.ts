import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

// Idempotent schema migration runner.
// Gated by SEED_TOKEN. POST with `?token=...` or `Authorization: Bearer <token>`.
// Adds any new columns / tables introduced since the last deploy. Safe to call
// multiple times — every statement is `IF NOT EXISTS`.

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

  // 6. People classification + email capture
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS kind TEXT`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS exclude_from_tasks BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE meeting_attendees ADD COLUMN IF NOT EXISTS email TEXT`,

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

  // Backfill company_id for ICS-source meetings that the cron hasn't touched
  // (e.g. past events the feed no longer returns). Idempotent — only sets
  // company_id where it's currently null.
  `UPDATE meetings SET company_id = (SELECT id FROM companies WHERE name = 'Conversely AI' LIMIT 1)
     WHERE company_id IS NULL AND calendar_source = 'conversely'`,
  `UPDATE meetings SET company_id = (SELECT id FROM companies WHERE name = 'Pine Lake Capital' LIMIT 1)
     WHERE company_id IS NULL AND calendar_source = 'pine-lake'`,
  `UPDATE meetings SET company_id = (SELECT id FROM companies WHERE name = 'Cranbrook Analytics' LIMIT 1)
     WHERE company_id IS NULL AND calendar_source = 'cranbrook'`,
];

function authorize(request: NextRequest): NextResponse | null {
  const expected = process.env.SEED_TOKEN;
  if (!expected) return NextResponse.json({ error: 'SEED_TOKEN not configured' }, { status: 503 });
  const url = new URL(request.url);
  const provided =
    url.searchParams.get('token') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (provided !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}

export async function POST(request: NextRequest) {
  const blocked = authorize(request);
  if (blocked) return blocked;

  const results: { stmt: string; ok: boolean; error?: string }[] = [];
  for (const stmt of STATEMENTS) {
    try {
      await db.execute(sql.raw(stmt));
      results.push({ stmt, ok: true });
    } catch (e: unknown) {
      results.push({ stmt, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  const failed = results.filter((r) => !r.ok).length;
  return NextResponse.json(
    { applied: results.length - failed, failed, results },
    { status: failed === 0 ? 200 : 500 },
  );
}

export async function GET(request: NextRequest) {
  return POST(request);
}

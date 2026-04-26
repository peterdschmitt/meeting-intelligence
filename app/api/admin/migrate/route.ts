import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

// Idempotent schema migration runner.
// Gated by SEED_TOKEN. POST with `?token=...` or `Authorization: Bearer <token>`.
// Adds any new columns / tables introduced since the last deploy. Safe to call
// multiple times — every statement is `IF NOT EXISTS`.

const STATEMENTS = [
  // outreach_log additions
  `ALTER TABLE outreach_log ADD COLUMN IF NOT EXISTS email_to TEXT`,
  `ALTER TABLE outreach_log ADD COLUMN IF NOT EXISTS email_subject TEXT`,
  `ALTER TABLE outreach_log ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE`,
  // action_items additions
  `ALTER TABLE action_items ADD COLUMN IF NOT EXISTS snoozed_until DATE`,
];

export async function POST(request: NextRequest) {
  const expected = process.env.SEED_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'SEED_TOKEN not configured' }, { status: 503 });
  }
  const url = new URL(request.url);
  const provided =
    url.searchParams.get('token') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  // TEMPORARY ungated GET — runs the migration AND returns diagnostic info.
  // Remove this once migration is confirmed.
  try {
    for (const stmt of STATEMENTS) {
      try { await db.execute(sql.raw(stmt)); } catch (e) { console.error('stmt fail:', stmt, e); }
    }
    const u = process.env.DATABASE_URL ?? '';
    const masked = u.replace(/(:\/\/)[^@]+(@)/, '$1***$2').slice(0, 80);
    const cols = await db.execute(sql.raw(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'action_items' ORDER BY column_name`,
    ));
    return NextResponse.json({
      databaseUrlPrefix: masked,
      action_items_columns: (cols as unknown as { column_name: string }[]).map((c) => c.column_name),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

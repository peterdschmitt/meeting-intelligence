import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetings } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { google } from 'googleapis';
import fs from 'fs';
import { extractAndSave } from '@/lib/extract';

// Extend the function timeout — each LLM extraction takes ~20-30s and we may
// process several new docs in one run. Vercel Hobby caps at 60s; Pro at 300s.
export const maxDuration = 300;

const FOLDER_ID = '1BTVZT0lw6c3HrdGlYIHnMa9GpDTpuHXP';

function authorize(request: NextRequest): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Manual triggers can use ?token=.
  const auth = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const tokenParam = new URL(request.url).searchParams.get('token');
  if (auth === expected || tokenParam === expected) return null;
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function getJwtAuth(): InstanceType<typeof google.auth.JWT> {
  const inlineJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
  const rawKey = inlineJson ?? (filePath ? fs.readFileSync(filePath, 'utf-8') : null);
  if (!rawKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_PATH must be set');
  }
  const key = JSON.parse(rawKey) as { client_email: string; private_key: string };
  return new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/documents.readonly',
    ],
  });
}

interface DriveDoc { id: string; name: string }

async function listFolderDocs(drive: ReturnType<typeof google.drive>): Promise<DriveDoc[]> {
  const all: DriveDoc[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`,
      pageSize: 100,
      fields: 'nextPageToken, files(id, name)',
      pageToken,
      orderBy: 'modifiedTime desc',
    });
    for (const f of res.data.files ?? []) {
      if (f.id && f.name) all.push({ id: f.id, name: f.name });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return all;
}

interface ImportResult {
  fileId: string;
  name: string;
  status: 'imported' | 'skipped' | 'error';
  meetingId?: string;
  error?: string;
}

async function importOne(drive: ReturnType<typeof google.drive>, doc: DriveDoc): Promise<ImportResult> {
  const [existing] = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(eq(meetings.gdriveFileId, doc.id))
    .limit(1);
  if (existing) {
    return { fileId: doc.id, name: doc.name, status: 'skipped', meetingId: existing.id };
  }
  try {
    const exp = await drive.files.export(
      { fileId: doc.id, mimeType: 'text/plain' },
      { responseType: 'text' },
    );
    const rawNotes = typeof exp.data === 'string' ? exp.data : '';
    const [meeting] = await db
      .insert(meetings)
      .values({
        title: doc.name,
        rawNotes,
        source: 'gdrive',
        gdriveFileId: doc.id,
      })
      .returning();
    await extractAndSave(meeting.id, rawNotes, { title: doc.name });
    return { fileId: doc.id, name: doc.name, status: 'imported', meetingId: meeting.id };
  } catch (e) {
    return {
      fileId: doc.id,
      name: doc.name,
      status: 'error',
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function GET(request: NextRequest) {
  const blocked = authorize(request);
  if (blocked) return blocked;
  try {
    const auth = getJwtAuth();
    const drive = google.drive({ version: 'v3', auth });
    const docs = await listFolderDocs(drive);

    const results: ImportResult[] = [];
    for (const doc of docs) {
      results.push(await importOne(drive, doc));
    }

    return NextResponse.json({
      total: docs.length,
      imported: results.filter((r) => r.status === 'imported').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errors: results.filter((r) => r.status === 'error').length,
      results,
    });
  } catch (error) {
    console.error('[GET /api/cron/import-drive]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

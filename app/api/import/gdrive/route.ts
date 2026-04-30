import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetings } from '@/lib/schema';
import { extractAndSave } from '@/lib/extract';
import { google } from 'googleapis';
import fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      fileId: string;
      title: string;
    };

    const { fileId, title } = body;

    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const inlineJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
    if (!inlineJson && !serviceAccountPath) {
      return NextResponse.json(
        { error: 'GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_PATH env var must be set' },
        { status: 500 }
      );
    }
    const rawKey = inlineJson ?? fs.readFileSync(serviceAccountPath!, 'utf-8');
    const serviceAccountKey = JSON.parse(rawKey) as {
      client_email: string;
      private_key: string;
    };

    const auth = new google.auth.JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/documents.readonly',
      ],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Export Google Doc as plain text
    const exportResponse = await drive.files.export(
      { fileId, mimeType: 'text/plain' },
      { responseType: 'text' }
    );

    const rawNotes = typeof exportResponse.data === 'string' ? exportResponse.data : '';

    const [meeting] = await db
      .insert(meetings)
      .values({
        title,
        rawNotes,
        source: 'gdrive',
        gdriveFileId: fileId,
      })
      .returning();

    await extractAndSave(meeting.id, rawNotes, { title });

    return NextResponse.json({ meetingId: meeting.id }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/import/gdrive]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

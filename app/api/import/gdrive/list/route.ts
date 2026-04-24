import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';

export async function GET(_request: NextRequest) {
  try {
    const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
    if (!serviceAccountPath) {
      return NextResponse.json(
        { error: 'GOOGLE_SERVICE_ACCOUNT_PATH env var is not set' },
        { status: 500 }
      );
    }

    const serviceAccountKey = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8')) as {
      client_email: string;
      private_key: string;
    };

    const auth = new google.auth.JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.document' and trashed=false",
      pageSize: 20,
      orderBy: 'modifiedTime desc',
      fields: 'files(id,name,modifiedTime,webViewLink)',
    });

    const files = (response.data.files ?? []).map((f) => ({
      id: f.id ?? '',
      name: f.name ?? '',
      modifiedTime: f.modifiedTime ?? '',
      webViewLink: f.webViewLink ?? '',
    }));

    return NextResponse.json(files);
  } catch (error) {
    console.error('[GET /api/import/gdrive/list]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

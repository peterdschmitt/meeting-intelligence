import { google } from 'googleapis';
import * as fs from 'fs';

// Supports both file path (local dev) and JSON string (Vercel/production)
export function getGoogleAuth() {
  const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;

  if (jsonStr) {
    const credentials = JSON.parse(jsonStr);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
  }

  if (filePath && fs.existsSync(filePath)) {
    return new google.auth.GoogleAuth({
      keyFile: filePath,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
  }

  throw new Error('No Google service account credentials found. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_PATH.');
}

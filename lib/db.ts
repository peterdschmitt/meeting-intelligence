import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

function getDbUrl(): string {
  // TURSO_DATABASE_URL takes priority (native libsql)
  const turso = process.env.TURSO_DATABASE_URL;
  if (turso) return turso;

  const raw = process.env.DATABASE_URL ?? '';

  // libsql only supports file: and libsql:// schemes — not postgres://
  if (raw.startsWith('file:') || raw.startsWith('libsql://') || raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }

  // Fall back to a local SQLite file
  return 'file:local.db';
}

const client = createClient({
  url: getDbUrl(),
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Lazy-initialised so missing DATABASE_URL doesn't crash module load (e.g.
// during `next build` page-data collection or when running the dev server
// without a connection string yet). Frontend pages can still render and
// degrade gracefully via fetch error handling; only API routes that touch
// the DB will throw, and they should be hit only when DATABASE_URL is set.

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let cached: DrizzleDb | null = null;

function init(): DrizzleDb {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Add it to .env.local before calling DB operations.',
    );
  }
  const client = postgres(url, { prepare: false, ssl: 'require' });
  cached = drizzle(client, { schema });
  return cached;
}

// Proxy that forwards every property access to the real Drizzle client.
// This preserves the existing `import { db }` ergonomics across the codebase
// without forcing every call site to invoke a getter.
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    const real = init();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === 'function' ? value.bind(real) : value;
  },
}) as DrizzleDb;

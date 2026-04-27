import { db } from '@/lib/db';
import { contacts } from '@/lib/schema';
import { eq } from 'drizzle-orm';

/**
 * Build the set of normalized assignee tokens to exclude.
 * Includes both the full lowercased name AND the first-name token, so an
 * action item with assignee = "Jon" matches a contact "Jon Maso" marked
 * excludeFromTasks. Mirrors the client-side rule in DashboardClient.
 */
export async function loadExcludedAssignees(): Promise<Set<string>> {
  const rows = await db
    .select({ fullName: contacts.fullName, exclude: contacts.excludeFromTasks })
    .from(contacts)
    .where(eq(contacts.excludeFromTasks, true));

  const set = new Set<string>();
  for (const row of rows) {
    if (!row.fullName) continue;
    const full = row.fullName.toLowerCase().trim();
    if (full) set.add(full);
    const first = full.split(/\s+/)[0];
    if (first) set.add(first);
  }
  return set;
}

/**
 * Returns true if the assignee string should be excluded from task-style
 * displays / prep contexts. Match logic: lowercase + trim, then check both the
 * full string and the first-name token.
 */
export function isExcludedAssignee(
  assignee: string | null | undefined,
  excluded: Set<string>,
): boolean {
  if (!assignee) return false;
  const a = assignee.toLowerCase().trim();
  if (excluded.has(a)) return true;
  const first = a.split(/\s+/)[0];
  return !!first && excluded.has(first);
}

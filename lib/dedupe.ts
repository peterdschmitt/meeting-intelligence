import type { ParsedIcsEvent } from '@/lib/ics';

export const CALENDAR_PRIORITY: Record<string, number> = {
  conversely: 0,
  'pine-lake': 1,
  cranbrook: 2,
};

const DEDUPE_WINDOW_MS = 5 * 60 * 1000; // ±5 minutes

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'with', 'for', 'in', 'on', 'at',
  'meeting', 'call', 'sync', 'huddle', 'discussion',
]);

function normalize(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

export function fuzzyTitleMatch(a: string, b: string): boolean {
  const aw = new Set(normalize(a));
  const bw = new Set(normalize(b));
  if (aw.size === 0 || bw.size === 0) return false;
  let shared = 0;
  for (const w of aw) if (bw.has(w)) shared++;
  // Both: at least 3 shared significant tokens, OR 80% of the smaller side overlaps
  const smaller = Math.min(aw.size, bw.size);
  return shared >= 3 || shared / smaller >= 0.8;
}

export function isLikelyDuplicate(a: ParsedIcsEvent, b: ParsedIcsEvent): boolean {
  if (a.uid === b.uid) return true;
  const dt = Math.abs(a.startAt.getTime() - b.startAt.getTime());
  if (dt > DEDUPE_WINDOW_MS) return false;
  return fuzzyTitleMatch(a.cleanedSummary, b.cleanedSummary);
}

/**
 * Reduce a list of cross-feed events to a deduped list. When two events match,
 * the one whose calendar_source has the lower priority number wins. Returns
 * the survivors in start_at-ascending order.
 */
export function dedupeEvents(events: ParsedIcsEvent[]): ParsedIcsEvent[] {
  const survivors: ParsedIcsEvent[] = [];

  for (const ev of events) {
    const dupIdx = survivors.findIndex((s) => isLikelyDuplicate(s, ev));
    if (dupIdx === -1) {
      survivors.push(ev);
      continue;
    }
    const incumbent = survivors[dupIdx];
    const incumbentPri = CALENDAR_PRIORITY[incumbent.calendarSource] ?? 99;
    const challengerPri = CALENDAR_PRIORITY[ev.calendarSource] ?? 99;
    if (challengerPri < incumbentPri) {
      survivors[dupIdx] = ev;
    }
    // else: drop the challenger
  }

  return survivors.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

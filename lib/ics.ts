import ical from 'node-ical';

export interface ParsedIcsEvent {
  uid: string;
  summary: string;          // raw title
  cleanedSummary: string;   // prefixes stripped
  description: string;
  location: string;
  startAt: Date;
  endAt: Date;
  attendees: { email: string; name: string }[];
  joinUrl: string | null;
  platform: 'teams' | 'zoom' | 'meet' | null;
  calendarSource: string;   // identifies which feed (e.g. 'conversely')
}

const PREFIX_RE = /^\s*(FW:|Re:|Invitation:|Updated invitation:|Accepted:)\s*/i;

const JOIN_PATTERNS: { regex: RegExp; platform: 'teams' | 'zoom' | 'meet' }[] = [
  { regex: /https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"'<>)]+/i, platform: 'teams' },
  { regex: /https?:\/\/[^\s"'<>)]*zoom\.us\/[^\s"'<>)]+/i, platform: 'zoom' },
  { regex: /https?:\/\/meet\.google\.com\/[^\s"'<>)]+/i, platform: 'meet' },
];

export function cleanTitle(raw: string): string {
  let t = raw ?? '';
  // Strip up to 3 nested prefixes (e.g. "FW: Re: Invitation: foo")
  for (let i = 0; i < 3; i++) {
    const m = t.match(PREFIX_RE);
    if (!m) break;
    t = t.slice(m[0].length);
  }
  return t.trim();
}

export function extractJoinUrl(
  description: string,
  location: string,
): { url: string | null; platform: 'teams' | 'zoom' | 'meet' | null } {
  const haystack = `${location ?? ''}\n${description ?? ''}`;
  for (const { regex, platform } of JOIN_PATTERNS) {
    const m = haystack.match(regex);
    if (m) return { url: m[0], platform };
  }
  return { url: null, platform: null };
}

function isSameDayInTimezone(a: Date, b: Date, timeZone: string): boolean {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(a) === fmt.format(b);
}

/** Extract the plain string from a node-ical ParameterValue (string | { val: string }) */
function pv(value: ical.ParameterValue | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'val' in value) return String(value.val ?? '');
  return '';
}

/**
 * Fetch a single ICS feed and return all events whose start_at falls "today"
 * in the given timezone. Expands RRULEs by walking node-ical's recurrences map.
 *
 * On error (network, parse) returns an empty array and logs to console.
 */
export async function fetchIcsForDay(
  feedUrl: string,
  calendarSource: string,
  todayInTz: Date = new Date(),
  timeZone = 'America/New_York',
): Promise<ParsedIcsEvent[]> {
  let parsed: ical.CalendarResponse;
  try {
    parsed = await ical.async.fromURL(feedUrl);
  } catch (err) {
    console.error(`[ics] failed to fetch ${calendarSource}:`, err);
    return [];
  }

  const out: ParsedIcsEvent[] = [];

  for (const key of Object.keys(parsed)) {
    const ev = parsed[key];
    if (!ev || ev.type !== 'VEVENT') continue;

    // Build the list of concrete instances for "today":
    // - one-off events: just the event itself if it falls today
    // - recurring events: walk node-ical's recurrence rule for today
    const candidates: { start: Date; end: Date; uidSuffix: string }[] = [];

    if (ev.rrule) {
      const startOfDay = new Date(todayInTz);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(todayInTz);
      endOfDay.setHours(23, 59, 59, 999);
      const dates = ev.rrule.between(startOfDay, endOfDay, true);
      const durationMs = (ev.end as Date).getTime() - (ev.start as Date).getTime();
      for (const d of dates) {
        candidates.push({
          start: d,
          end: new Date(d.getTime() + durationMs),
          uidSuffix: `_${d.toISOString().split('T')[0]}`,
        });
      }
    } else if (ev.start && isSameDayInTimezone(ev.start as Date, todayInTz, timeZone)) {
      candidates.push({
        start: ev.start as Date,
        end: (ev.end as Date) ?? (ev.start as Date),
        uidSuffix: '',
      });
    }

    if (candidates.length === 0) continue;

    // Pull attendees off the parent event (recurring instances share attendees)
    const attendees: { email: string; name: string }[] = [];
    const att = (ev as unknown as { attendee?: unknown }).attendee;
    const list = Array.isArray(att) ? att : att ? [att] : [];
    for (const a of list) {
      if (typeof a === 'string') {
        const m = a.match(/mailto:([^>"\s]+)/i);
        if (m) attendees.push({ email: m[1], name: m[1] });
      } else if (a && typeof a === 'object') {
        const obj = a as { val?: string; params?: { CN?: string } };
        const email = obj.val?.replace(/^mailto:/i, '') ?? '';
        const name = obj.params?.CN ?? email;
        if (email) attendees.push({ email, name });
      }
    }

    const summaryRaw = pv(ev.summary);
    const description = pv(ev.description);
    const location = pv(ev.location);
    const { url: joinUrl, platform } = extractJoinUrl(description, location);

    for (const inst of candidates) {
      out.push({
        uid: `${(ev.uid ?? key) as string}${inst.uidSuffix}`,
        summary: summaryRaw,
        cleanedSummary: cleanTitle(summaryRaw),
        description,
        location,
        startAt: inst.start,
        endAt: inst.end,
        attendees,
        joinUrl,
        platform,
        calendarSource,
      });
    }
  }

  return out;
}

export interface MultiFeedResult {
  events: ParsedIcsEvent[];
  perFeed: { source: string; count: number; ok: boolean }[];
}

export async function fetchAllFeedsForDay(
  feeds: { source: string; url: string | undefined }[],
  todayInTz: Date = new Date(),
  timeZone = 'America/New_York',
): Promise<MultiFeedResult> {
  const results = await Promise.all(
    feeds.map(async (f) => {
      if (!f.url) {
        console.warn(`[ics] feed not configured: ${f.source}`);
        return { source: f.source, events: [] as ParsedIcsEvent[], ok: false };
      }
      const events = await fetchIcsForDay(f.url, f.source, todayInTz, timeZone);
      return { source: f.source, events, ok: events.length >= 0 };
    })
  );
  return {
    events: results.flatMap((r) => r.events),
    perFeed: results.map((r) => ({ source: r.source, count: r.events.length, ok: r.ok })),
  };
}

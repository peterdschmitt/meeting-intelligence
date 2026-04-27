import { createHash } from 'crypto';
import type { PrepContext } from '@/lib/prep-context';

/**
 * Build a canonical-form string from a PrepContext such that identical
 * inputs always produce the identical string. Sorts arrays whose order
 * doesn't carry meaning (attendees, action items).
 */
function canonicalize(ctx: PrepContext): string {
  const sortedAttendees = [...ctx.attendees].sort((a, b) =>
    (a.email ?? a.name).localeCompare(b.email ?? b.name)
  );

  const sortedActions = (arr: typeof ctx.openActions.peter) =>
    [...arr].sort((a, b) => a.title.localeCompare(b.title));

  const obj = {
    type: ctx.type,
    meeting: {
      id: ctx.meeting.id,
      title: ctx.meeting.cleanedTitle,
      startAt: ctx.meeting.startAt?.toISOString() ?? null,
    },
    attendees: sortedAttendees.map((a) => ({ email: a.email, name: a.name })),
    priorId: ctx.priorOccurrence?.id ?? null,
    priorSummary: ctx.priorOccurrence?.executiveSummary ?? null,
    actions: {
      peter: sortedActions(ctx.openActions.peter),
      external: sortedActions(ctx.openActions.external),
    },
  };
  return JSON.stringify(obj);
}

export function hashPrepContext(ctx: PrepContext): string {
  return createHash('sha256').update(canonicalize(ctx)).digest('hex');
}

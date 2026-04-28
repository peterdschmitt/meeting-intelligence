import { db } from '@/lib/db';
import {
  meetings, meetingPrepItems, meetingAttendees, actionItems, contacts, companies,
  decisions, risks, opportunities,
} from '@/lib/schema';
import { eq, and, ne, desc, sql, inArray } from 'drizzle-orm';
import { loadExcludedAssignees, isExcludedAssignee } from '@/lib/exclusions';
import type { MeetingType } from '@/lib/classify-meeting';

export interface PrepContext {
  type: MeetingType;
  meeting: {
    id: string;
    title: string;
    cleanedTitle: string;
    startAt: Date | null;
    endAt: Date | null;
  };
  attendees: { name: string; email: string | null; roleAtMeeting: string | null }[];
  attendeeContacts: { fullName: string; email: string | null; role: string | null; notes: string | null; kind: string | null }[];
  priorOccurrence: {
    id: string;
    title: string;
    meetingDate: Date | null;
    executiveSummary: string | null;
    prepItems: { kind: string; text: string }[];
    decisions: { decision: string; owner: string | null }[];
    risks: { risk: string; severity: string | null }[];
    opportunities: { opportunity: string; nextStep: string | null }[];
  } | null;
  openActions: {
    peter: { title: string; assignee: string | null; dueDate: string | null; urgencyTier: string | null }[];
    external: { title: string; assignee: string | null; dueDate: string | null; urgencyTier: string | null }[];
  };
  company: { name: string; type: string | null; notes: string | null } | null;
  priorMeetings: { id: string; title: string; meetingDate: Date | null; executiveSummary: string | null }[];
}

/**
 * Find the most recent prior occurrence of this meeting (recurring match).
 * Strategy: same companyId AND fuzzy title match. Returns the latest by
 * meetingDate/startAt. Excludes the meeting itself.
 */
async function findPriorOccurrence(
  meetingId: string,
  cleanedTitle: string,
  companyId: string | null,
): Promise<{ id: string; title: string; meetingDate: Date | null; executiveSummary: string | null } | null> {
  // Pull a candidate set scoped by company (if any) and ordered by date desc.
  // Then filter in JS by fuzzy title match (importing fuzzyTitleMatch).
  const { fuzzyTitleMatch } = await import('@/lib/dedupe');

  const where = companyId
    ? and(eq(meetings.companyId, companyId), ne(meetings.id, meetingId))
    : ne(meetings.id, meetingId);

  const candidates = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      meetingDate: meetings.meetingDate,
      startAt: meetings.startAt,
      executiveSummary: meetings.executiveSummary,
    })
    .from(meetings)
    .where(where)
    .orderBy(desc(sql`coalesce(${meetings.startAt}, ${meetings.meetingDate})`))
    .limit(50);

  for (const c of candidates) {
    if (fuzzyTitleMatch(c.title, cleanedTitle)) {
      return {
        id: c.id,
        title: c.title,
        meetingDate: (c.startAt as Date | null) ?? (c.meetingDate as Date | null) ?? null,
        executiveSummary: c.executiveSummary ?? null,
      };
    }
  }
  return null;
}

export async function gatherPrepContext(
  meetingId: string,
  type: MeetingType,
): Promise<PrepContext> {
  const [m] = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      startAt: meetings.startAt,
      endAt: meetings.endAt,
      meetingDate: meetings.meetingDate,
      companyId: meetings.companyId,
    })
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);

  if (!m) throw new Error(`gatherPrepContext: meeting ${meetingId} not found`);

  const cleanedTitle = m.title.replace(/^\s*(FW:|Re:|Invitation:)\s*/i, '').trim();

  // Attendees
  const attRows = await db
    .select({
      name: meetingAttendees.name,
      email: meetingAttendees.email,
      roleAtMeeting: meetingAttendees.roleAtMeeting,
      contactId: meetingAttendees.contactId,
    })
    .from(meetingAttendees)
    .where(eq(meetingAttendees.meetingId, meetingId));

  const attendees = attRows.map((a) => ({
    name: a.name,
    email: a.email,
    roleAtMeeting: a.roleAtMeeting,
  }));

  // Attendee contact records (for richer prep — esp. interviews)
  const contactIds = attRows.map((a) => a.contactId).filter((x): x is string => !!x);
  const attendeeContacts = contactIds.length
    ? await db
        .select({
          fullName: contacts.fullName,
          email: contacts.email,
          role: contacts.role,
          notes: contacts.notes,
          kind: contacts.kind,
        })
        .from(contacts)
        .where(inArray(contacts.id, contactIds))
    : [];

  // Prior occurrence
  const prior = await findPriorOccurrence(meetingId, cleanedTitle, m.companyId);
  let priorOccurrence: PrepContext['priorOccurrence'] = null;
  if (prior) {
    const [priorPrep, priorDecisions, priorRisks, priorOpps] = await Promise.all([
      db.select({ kind: meetingPrepItems.kind, text: meetingPrepItems.text })
        .from(meetingPrepItems)
        .where(eq(meetingPrepItems.meetingId, prior.id))
        .orderBy(meetingPrepItems.position),
      db.select({ decision: decisions.decision, owner: decisions.owner })
        .from(decisions)
        .where(eq(decisions.meetingId, prior.id)),
      db.select({ risk: risks.risk, severity: risks.severity })
        .from(risks)
        .where(eq(risks.meetingId, prior.id)),
      db.select({ opportunity: opportunities.opportunity, nextStep: opportunities.nextStep })
        .from(opportunities)
        .where(eq(opportunities.meetingId, prior.id)),
    ]);
    priorOccurrence = {
      id: prior.id,
      title: prior.title,
      meetingDate: prior.meetingDate,
      executiveSummary: prior.executiveSummary,
      prepItems: priorPrep,
      decisions: priorDecisions,
      risks: priorRisks,
      opportunities: priorOpps,
    };
  }

  // Open actions (this meeting OR any prior occurrence)
  const meetingIdsForActions = prior ? [meetingId, prior.id] : [meetingId];
  const allActions = await db
    .select({
      title: actionItems.title,
      assignee: actionItems.assignee,
      dueDate: actionItems.dueDate,
      urgencyTier: actionItems.urgencyTier,
      ownerSide: actionItems.ownerSide,
      status: actionItems.status,
    })
    .from(actionItems)
    .where(inArray(actionItems.meetingId, meetingIdsForActions));

  const excluded = await loadExcludedAssignees();
  const openOnly = allActions.filter(
    (a) => a.status !== 'done' && a.status !== 'cancelled' && !isExcludedAssignee(a.assignee, excluded),
  );

  const openActions = {
    peter: openOnly.filter((a) => a.ownerSide === 'peter').map(({ title, assignee, dueDate, urgencyTier }) => ({ title, assignee, dueDate, urgencyTier })),
    external: openOnly.filter((a) => a.ownerSide === 'external').map(({ title, assignee, dueDate, urgencyTier }) => ({ title, assignee, dueDate, urgencyTier })),
  };

  // Company
  let company: PrepContext['company'] = null;
  if (m.companyId) {
    const [c] = await db
      .select({ name: companies.name, type: companies.type, notes: companies.notes })
      .from(companies)
      .where(eq(companies.id, m.companyId))
      .limit(1);
    if (c) company = c;
  }

  // Prior meetings with the same company (for external_meeting type, gives broader history)
  const priorMeetings = m.companyId
    ? await db
        .select({
          id: meetings.id,
          title: meetings.title,
          meetingDate: meetings.meetingDate,
          executiveSummary: meetings.executiveSummary,
        })
        .from(meetings)
        .where(and(eq(meetings.companyId, m.companyId), ne(meetings.id, meetingId)))
        .orderBy(desc(sql`coalesce(${meetings.startAt}, ${meetings.meetingDate})`))
        .limit(5)
    : [];

  return {
    type,
    meeting: {
      id: m.id,
      title: m.title,
      cleanedTitle,
      startAt: m.startAt as Date | null,
      endAt: m.endAt as Date | null,
    },
    attendees,
    attendeeContacts,
    priorOccurrence,
    openActions,
    company,
    priorMeetings,
  };
}

/**
 * Render the gathered context into a single user-message string for GPT-4o.
 * Type-aware (omits irrelevant sections).
 */
export function renderContext(ctx: PrepContext): string {
  const lines: string[] = [];
  lines.push(`MEETING: ${ctx.meeting.title}`);
  lines.push(`TYPE: ${ctx.type}`);
  if (ctx.meeting.startAt) lines.push(`TIME: ${ctx.meeting.startAt.toISOString()}`);

  lines.push('');
  lines.push('ATTENDEES:');
  if (ctx.attendees.length === 0) lines.push('  (not specified)');
  for (const a of ctx.attendees) {
    lines.push(`  - ${a.name}${a.email ? ` <${a.email}>` : ''}${a.roleAtMeeting ? ` (${a.roleAtMeeting})` : ''}`);
  }

  if (ctx.type === 'interview' && ctx.attendeeContacts.length > 0) {
    lines.push('');
    lines.push('CANDIDATE / ATTENDEE NOTES:');
    for (const c of ctx.attendeeContacts) {
      lines.push(`  - ${c.fullName}${c.role ? ` — ${c.role}` : ''}${c.kind ? ` [${c.kind}]` : ''}`);
      if (c.notes) lines.push(`    notes: ${c.notes}`);
    }
  }

  if (ctx.priorOccurrence) {
    lines.push('');
    lines.push('PRIOR OCCURRENCE:');
    lines.push(`  Title: ${ctx.priorOccurrence.title}`);
    if (ctx.priorOccurrence.meetingDate) lines.push(`  Date: ${ctx.priorOccurrence.meetingDate.toISOString().split('T')[0]}`);
    if (ctx.priorOccurrence.executiveSummary) {
      lines.push('  Executive summary:');
      lines.push('    ' + ctx.priorOccurrence.executiveSummary.replace(/\n/g, '\n    '));
    }
    if (ctx.priorOccurrence.prepItems.length > 0) {
      lines.push('  Prep items from last meeting:');
      const grouped: Record<string, string[]> = {};
      for (const p of ctx.priorOccurrence.prepItems) {
        (grouped[p.kind] = grouped[p.kind] || []).push(p.text);
      }
      for (const [kind, texts] of Object.entries(grouped)) {
        lines.push(`    ${kind}: ${texts.join(' | ')}`);
      }
    }
    if (ctx.priorOccurrence.decisions.length > 0) {
      lines.push('  Prior decisions:');
      for (const d of ctx.priorOccurrence.decisions) lines.push(`    - ${d.decision}${d.owner ? ` (${d.owner})` : ''}`);
    }
    if (ctx.priorOccurrence.risks.length > 0) {
      lines.push('  Prior risks:');
      for (const r of ctx.priorOccurrence.risks) lines.push(`    - [${r.severity ?? 'medium'}] ${r.risk}`);
    }
    if (ctx.priorOccurrence.opportunities.length > 0) {
      lines.push('  Prior opportunities:');
      for (const o of ctx.priorOccurrence.opportunities) lines.push(`    - ${o.opportunity}${o.nextStep ? ` (next: ${o.nextStep})` : ''}`);
    }
  }

  lines.push('');
  lines.push('PETER\'S OPEN ACTION ITEMS (be ready to report on these):');
  if (ctx.openActions.peter.length === 0) lines.push('  (none)');
  for (const a of ctx.openActions.peter) {
    lines.push(`  - ${a.title} (due: ${a.dueDate ?? 'no date'}, urgency: ${a.urgencyTier ?? 'none'})`);
  }

  lines.push('');
  lines.push('EXTERNAL OPEN ACTION ITEMS (Peter should ask for updates on these):');
  if (ctx.openActions.external.length === 0) lines.push('  (none)');
  for (const a of ctx.openActions.external) {
    lines.push(`  - [${a.assignee ?? 'Unknown'}] ${a.title} (due: ${a.dueDate ?? 'no date'}, urgency: ${a.urgencyTier ?? 'none'})`);
  }

  if (ctx.company) {
    lines.push('');
    lines.push(`COMPANY: ${ctx.company.name}${ctx.company.type ? ` (${ctx.company.type})` : ''}`);
    if (ctx.company.notes) lines.push(`  notes: ${ctx.company.notes}`);
  }

  if (ctx.type === 'external_meeting' && ctx.priorMeetings.length > 0) {
    lines.push('');
    lines.push('PRIOR MEETINGS WITH THIS COMPANY:');
    for (const pm of ctx.priorMeetings) {
      const dateStr = pm.meetingDate ? pm.meetingDate.toISOString().split('T')[0] : '?';
      lines.push(`  - [${dateStr}] ${pm.title}`);
      if (pm.executiveSummary) lines.push(`    ${pm.executiveSummary.split('\n')[0]}`);
    }
  }

  return lines.join('\n');
}

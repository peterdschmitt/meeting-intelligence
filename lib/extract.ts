import { db } from '@/lib/db';
import {
  meetings,
  actionItems,
  meetingAttendees,
  meetingTopics,
  decisions,
  risks,
  opportunities,
  meetingPrepItems,
  contacts,
  type NewActionItem,
  type NewMeetingAttendee,
  type NewMeetingTopic,
  type NewDecision,
  type NewRisk,
  type NewOpportunity,
  type NewMeetingPrepItem,
} from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { getOpenAI } from '@/lib/openai';

interface ExtractedAttendee {
  name: string;
  role: string | null;
  engagement: 'dominant' | 'active' | 'quiet' | null;
}

interface ExtractedTopic {
  title: string;
  content: string;
}

interface ExtractedDecision {
  decision: string;
  owner: string | null;
  implication: string | null;
}

interface ExtractedActionItem {
  title: string;
  description: string | null;
  assignee: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  urgency_tier: 'urgent' | 'this_week' | 'waiting_on' | 'none';
  owner_side: 'peter' | 'external' | null;
}

interface ExtractedRisk {
  risk: string;
  why_it_matters: string | null;
  mitigation: string | null;
  severity: 'low' | 'medium' | 'high';
}

interface ExtractedOpportunity {
  opportunity: string;
  next_step: string | null;
}

interface ExtractedPrep {
  agenda: { text: string; rationale: string | null }[];
  questions: string[];
  outcomes: string[];
}

interface ExtractedEffectiveness {
  duration_minutes: number | null;
  productive_minutes: number | null;
  asyncable_minutes: number | null;
  tangent_minutes: number | null;
  improvement_note: string | null;
}

interface ExtractedRecap {
  title: string;
  executive_summary: string;
  attendees: ExtractedAttendee[];
  topics: ExtractedTopic[];
  decisions: ExtractedDecision[];
  action_items: ExtractedActionItem[];
  risks: ExtractedRisk[];
  opportunities: ExtractedOpportunity[];
  next_meeting_prep: ExtractedPrep;
  effectiveness: ExtractedEffectiveness;
}

function buildSystemPrompt(today: string): string {
  return `You are an expert meeting analyst. From raw notes (or a transcript), produce a complete structured recap.

Today is ${today}. When the notes use relative dates ("next Tuesday", "by end of week", "in two weeks"), resolve them against today. When the notes give an explicit date, use that. NEVER emit a year earlier than ${today.slice(0, 4)} unless the notes explicitly reference one.

Respond ONLY with valid JSON — no markdown, no code fences, no explanation. The JSON object MUST contain every key listed below; use empty arrays / nulls when information is unavailable.

Style: write each piece of prose as narrative bullets — full sentences with weight, not labels. For multi-bullet text fields (executive_summary, topics[].content), separate bullets with a single newline ("\\n"), and DO NOT include leading bullet characters ("-", "*", "•"). One bullet per line.

Keys:
- "title": short meeting title (string)
- "executive_summary": 4-8 narrative bullets, newline-separated, summarizing the meeting at a glance
- "attendees": array of { "name", "role" (or null), "engagement": "dominant"|"active"|"quiet"|null }
- "topics": array of { "title", "content" } — each topic's content is multi-bullet narrative, newline-separated
- "decisions": array of { "decision", "owner" (or null), "implication" (or null) }
- "action_items": array of { "title", "description" (or null), "assignee" (or null), "due_date" (YYYY-MM-DD or null), "priority": "low"|"medium"|"high"|"critical", "urgency_tier": "urgent"|"this_week"|"waiting_on"|"none", "owner_side": "peter"|"external"|null }
  - urgency_tier reflects what was said in the meeting, NOT what the date implies. "urgent" = needs to happen in 24h. "this_week" = within the week. "waiting_on" = blocked on someone else's response. "none" = no urgency stated.
  - owner_side is "peter" if Peter Schmitt owes it, "external" if anyone else does, null if unclear.
- "risks": array of { "risk", "why_it_matters" (or null), "mitigation" (or null), "severity": "low"|"medium"|"high" }
- "opportunities": array of { "opportunity", "next_step" (or null) }
- "next_meeting_prep": { "agenda": [{ "text", "rationale" (or null) }], "questions": ["..."], "outcomes": ["..."] }
- "effectiveness": { "duration_minutes" (or null), "productive_minutes" (or null), "asyncable_minutes" (or null), "tangent_minutes" (or null), "improvement_note" (or null) }`;
}

async function runExtractionLLM(rawNotes: string): Promise<ExtractedRecap> {
  const today = new Date().toISOString().slice(0, 10);
  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: buildSystemPrompt(today) },
      { role: 'user', content: `Raw meeting notes:\n\n${rawNotes}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });
  const raw = completion.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw) as Partial<ExtractedRecap>;

  return {
    title: typeof parsed.title === 'string' ? parsed.title : '',
    executive_summary: typeof parsed.executive_summary === 'string' ? parsed.executive_summary : '',
    attendees: Array.isArray(parsed.attendees) ? parsed.attendees : [],
    topics: Array.isArray(parsed.topics) ? parsed.topics : [],
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
    next_meeting_prep: {
      agenda: Array.isArray(parsed.next_meeting_prep?.agenda) ? parsed.next_meeting_prep!.agenda : [],
      questions: Array.isArray(parsed.next_meeting_prep?.questions) ? parsed.next_meeting_prep!.questions : [],
      outcomes: Array.isArray(parsed.next_meeting_prep?.outcomes) ? parsed.next_meeting_prep!.outcomes : [],
    },
    effectiveness: {
      duration_minutes: parsed.effectiveness?.duration_minutes ?? null,
      productive_minutes: parsed.effectiveness?.productive_minutes ?? null,
      asyncable_minutes: parsed.effectiveness?.asyncable_minutes ?? null,
      tangent_minutes: parsed.effectiveness?.tangent_minutes ?? null,
      improvement_note: parsed.effectiveness?.improvement_note ?? null,
    },
  };
}

async function matchContactIdByName(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const [hit] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(sql`lower(${contacts.fullName}) = lower(${trimmed})`)
    .limit(1);
  return hit?.id ?? null;
}

async function persistRecap(meetingId: string, recap: ExtractedRecap, includeActionItems: boolean): Promise<void> {
  await db
    .update(meetings)
    .set({
      executiveSummary: recap.executive_summary,
      durationMinutes: recap.effectiveness.duration_minutes,
      productiveMinutes: recap.effectiveness.productive_minutes,
      asyncableMinutes: recap.effectiveness.asyncable_minutes,
      tangentMinutes: recap.effectiveness.tangent_minutes,
      improvementNote: recap.effectiveness.improvement_note,
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, meetingId));

  await Promise.all([
    db.delete(meetingAttendees).where(eq(meetingAttendees.meetingId, meetingId)),
    db.delete(meetingTopics).where(eq(meetingTopics.meetingId, meetingId)),
    db.delete(decisions).where(eq(decisions.meetingId, meetingId)),
    db.delete(risks).where(eq(risks.meetingId, meetingId)),
    db.delete(opportunities).where(eq(opportunities.meetingId, meetingId)),
    db.delete(meetingPrepItems).where(eq(meetingPrepItems.meetingId, meetingId)),
  ]);

  if (recap.attendees.length > 0) {
    const attendeeRows: NewMeetingAttendee[] = [];
    let pos = 0;
    for (const a of recap.attendees) {
      if (!a.name || !a.name.trim()) continue;
      const contactId = await matchContactIdByName(a.name);
      attendeeRows.push({
        meetingId,
        name: a.name.trim(),
        roleAtMeeting: a.role ?? null,
        engagement: a.engagement ?? null,
        contactId,
        position: pos++,
      });
    }
    if (attendeeRows.length > 0) {
      await db.insert(meetingAttendees).values(attendeeRows);
    }
  }

  if (recap.topics.length > 0) {
    const topicRows: NewMeetingTopic[] = recap.topics
      .filter((t) => t.title && t.title.trim())
      .map((t, i) => ({
        meetingId,
        title: t.title.trim(),
        content: t.content ?? null,
        position: i,
      }));
    if (topicRows.length > 0) {
      await db.insert(meetingTopics).values(topicRows);
    }
  }

  if (recap.decisions.length > 0) {
    const decisionRows: NewDecision[] = [];
    for (const d of recap.decisions) {
      if (!d.decision || !d.decision.trim()) continue;
      const contactId = d.owner ? await matchContactIdByName(d.owner) : null;
      decisionRows.push({
        meetingId,
        decision: d.decision.trim(),
        owner: d.owner ?? null,
        contactId,
        implication: d.implication ?? null,
      });
    }
    if (decisionRows.length > 0) {
      await db.insert(decisions).values(decisionRows);
    }
  }

  if (recap.risks.length > 0) {
    const riskRows: NewRisk[] = recap.risks
      .filter((r) => r.risk && r.risk.trim())
      .map((r) => ({
        meetingId,
        risk: r.risk.trim(),
        whyItMatters: r.why_it_matters ?? null,
        mitigation: r.mitigation ?? null,
        severity: ['low', 'medium', 'high'].includes(r.severity) ? r.severity : 'medium',
        status: 'open',
      }));
    if (riskRows.length > 0) {
      await db.insert(risks).values(riskRows);
    }
  }

  if (recap.opportunities.length > 0) {
    const oppRows: NewOpportunity[] = recap.opportunities
      .filter((o) => o.opportunity && o.opportunity.trim())
      .map((o) => ({
        meetingId,
        opportunity: o.opportunity.trim(),
        nextStep: o.next_step ?? null,
        status: 'open',
      }));
    if (oppRows.length > 0) {
      await db.insert(opportunities).values(oppRows);
    }
  }

  const prepRows: NewMeetingPrepItem[] = [];
  recap.next_meeting_prep.agenda.forEach((a, i) => {
    if (a.text && a.text.trim()) {
      prepRows.push({
        meetingId,
        kind: 'agenda',
        text: a.text.trim(),
        rationale: a.rationale ?? null,
        completed: false,
        position: i,
      });
    }
  });
  recap.next_meeting_prep.questions.forEach((q, i) => {
    if (q && q.trim()) {
      prepRows.push({
        meetingId,
        kind: 'question',
        text: q.trim(),
        rationale: null,
        completed: false,
        position: i,
      });
    }
  });
  recap.next_meeting_prep.outcomes.forEach((o, i) => {
    if (o && o.trim()) {
      prepRows.push({
        meetingId,
        kind: 'outcome',
        text: o.trim(),
        rationale: null,
        completed: false,
        position: i,
      });
    }
  });
  if (prepRows.length > 0) {
    await db.insert(meetingPrepItems).values(prepRows);
  }

  if (includeActionItems && recap.action_items.length > 0) {
    const actionRows: NewActionItem[] = recap.action_items
      .filter((ai) => ai.title && ai.title.trim())
      .map((ai) => ({
        title: ai.title.trim(),
        description: ai.description ?? null,
        assignee: ai.assignee ?? null,
        dueDate: ai.due_date ?? null,
        priority: ['low', 'medium', 'high', 'critical'].includes(ai.priority) ? ai.priority : 'medium',
        urgencyTier: ['urgent', 'this_week', 'waiting_on', 'none'].includes(ai.urgency_tier) ? ai.urgency_tier : 'none',
        ownerSide: ai.owner_side === 'peter' || ai.owner_side === 'external' ? ai.owner_side : null,
        status: 'open',
        meetingId,
      }));
    if (actionRows.length > 0) {
      await db.insert(actionItems).values(actionRows);
    }
  }
}

export async function extractAndSave(meetingId: string, rawNotes: string): Promise<void> {
  const recap = await runExtractionLLM(rawNotes);
  await persistRecap(meetingId, recap, /* includeActionItems */ true);
}

export async function reExtractAndSave(meetingId: string, rawNotes: string): Promise<void> {
  const recap = await runExtractionLLM(rawNotes);
  await persistRecap(meetingId, recap, /* includeActionItems */ false);
}

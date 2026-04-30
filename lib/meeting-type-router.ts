import { PROMPT_KITS, getPromptKit, type PromptKit } from '@/lib/prompt-kits';
import { type MeetingType } from '@/lib/meeting-types';

export interface MeetingClassificationInput {
  title?: string | null;
  rawNotes?: string | null;
  attendees?: string[] | null;
  companyName?: string | null;
}

export interface MeetingClassification {
  type: MeetingType;
  confidence: number;
  reasons: string[];
  alternates: { type: MeetingType; score: number }[];
}

export interface RoutedPromptKit {
  classification: MeetingClassification;
  kit: PromptKit;
}

const TYPE_WEIGHTS: Record<MeetingType, number> = {
  sales_bd: 0,
  board_exec: 0,
  internal_ops: 0,
  finance_ops: 0,
  recruiting: 0,
  client_portfolio: 0,
  investment_diligence: 0,
  project_status: 0,
  vendor_partner: 0,
  support_issue: 0,
  recurring_sync: 0,
  generic: 0,
};

function normalize(value: string | null | undefined): string {
  return (value ?? '').toLowerCase();
}

function addScore(scores: Record<MeetingType, number>, type: MeetingType, amount: number): void {
  scores[type] = (scores[type] ?? 0) + amount;
}

export function classifyMeetingType(input: MeetingClassificationInput): MeetingClassification {
  const scores: Record<MeetingType, number> = { ...TYPE_WEIGHTS };
  const reasons: string[] = [];
  const title = normalize(input.title);
  const notes = normalize(input.rawNotes).slice(0, 6000);
  const company = normalize(input.companyName);
  const attendees = (input.attendees ?? []).join(' ').toLowerCase();
  const corpus = `${title}\n${company}\n${attendees}\n${notes}`;

  for (const kit of Object.values(PROMPT_KITS)) {
    if (kit.type === 'generic') continue;
    for (const hint of kit.classifyHints) {
      const h = hint.toLowerCase();
      if (title.includes(h)) {
        addScore(scores, kit.type, 3);
        reasons.push(`Title matched "${hint}" for ${kit.label}.`);
      } else if (corpus.includes(h)) {
        addScore(scores, kit.type, 1);
      }
    }
  }

  if (/daily|weekly|monthly|huddle|standup|pipeline/.test(title)) addScore(scores, 'recurring_sync', 2);
  if (/pipeline|lead|proposal|prospect|sales/.test(corpus)) addScore(scores, 'sales_bd', 2);
  if (/commission|carrier|statement|reconcil|cash|invoice|payment|bad debt|income statement/.test(corpus)) addScore(scores, 'finance_ops', 3);
  if (/policyguardian|sow|contract|go-live|implementation|scope/.test(corpus)) addScore(scores, 'project_status', 2);
  if (/candidate|interview|hire|operator|recruit/.test(corpus)) addScore(scores, 'recruiting', 3);

  const ranked = Object.entries(scores)
    .filter(([type]) => type !== 'generic')
    .map(([type, score]) => ({ type: type as MeetingType, score }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  if (!top || top.score <= 0) {
    return {
      type: 'generic',
      confidence: 0.25,
      reasons: ['No strong meeting-type hints found; using generic executive meeting kit.'],
      alternates: ranked.slice(0, 3),
    };
  }

  const second = ranked[1]?.score ?? 0;
  const confidence = Math.min(0.95, Math.max(0.45, (top.score + 1) / (top.score + second + 2)));
  const topKit = getPromptKit(top.type);
  const finalReasons = reasons.length > 0 ? reasons.slice(0, 4) : [`Content matched ${topKit.label} signals.`];

  return {
    type: top.type,
    confidence: Number(confidence.toFixed(2)),
    reasons: finalReasons,
    alternates: ranked.filter((r) => r.type !== top.type && r.score > 0).slice(0, 3),
  };
}

export function routePromptKit(input: MeetingClassificationInput): RoutedPromptKit {
  const classification = classifyMeetingType(input);
  return { classification, kit: getPromptKit(classification.type) };
}

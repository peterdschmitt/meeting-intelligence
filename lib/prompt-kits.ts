import { MEETING_TYPE_LABELS, type MeetingPhase, type MeetingType } from '@/lib/meeting-types';

export interface PromptKit {
  type: MeetingType;
  label: string;
  classifyHints: string[];
  preMeetingPrompt: string;
  postMeetingPrompt: string;
}

const BASE_PRE_MEETING = `Produce an executive pre-brief for Peter. Be concise, specific, and action-oriented. Include: meeting objective, relevant prior history, unresolved commitments, decisions needed, stakeholder dynamics, likely objections or friction, questions Peter should ask, Peter's recommended posture, and desired outcome.`;

const BASE_POST_MEETING = `Extract the meeting as an operating record, not generic minutes. Prioritize decisions, commitments, owner clarity, unresolved issues, risks, opportunities, follow-up messages, and what should change before the next meeting. Mark unknown owners or dates as null rather than guessing.`;

export const PROMPT_KITS: Record<MeetingType, PromptKit> = {
  sales_bd: {
    type: 'sales_bd',
    label: MEETING_TYPE_LABELS.sales_bd,
    classifyHints: ['sales', 'pipeline', 'lead', 'prospect', 'proposal', 'partnership', 'bd', 'customer discovery'],
    preMeetingPrompt: `${BASE_PRE_MEETING}\nFocus the brief on buying intent, commercial objective, stakeholder map, objections, competitive positioning, proposal next step, and the specific ask Peter should make.`,
    postMeetingPrompt: `${BASE_POST_MEETING}\nFor this sales/BD meeting, emphasize buying signals, objections, budget/timing/authority, proposal commitments, next commercial step, expansion opportunities, and follow-up language that advances the deal.`,
  },
  board_exec: {
    type: 'board_exec',
    label: MEETING_TYPE_LABELS.board_exec,
    classifyHints: ['board', 'investor', 'executive', 'leadership', 'committee', 'strategic review'],
    preMeetingPrompt: `${BASE_PRE_MEETING}\nFocus on key decisions, board-level risks, financial/operating narrative, stakeholder interests, likely hard questions, and the recommendation Peter should defend.`,
    postMeetingPrompt: `${BASE_POST_MEETING}\nFor this executive meeting, capture decisions, rationale, approvals, strategic risks, unresolved executive questions, and exact follow-ups required to keep governance moving.`,
  },
  internal_ops: {
    type: 'internal_ops',
    label: MEETING_TYPE_LABELS.internal_ops,
    classifyHints: ['operations', 'ops', 'daily huddle', 'weekly review', 'standup', 'team', 'internal'],
    preMeetingPrompt: `${BASE_PRE_MEETING}\nFocus on operating metrics, blockers, accountability, overdue commitments, staffing/process constraints, and where Peter should press for specificity.`,
    postMeetingPrompt: `${BASE_POST_MEETING}\nFor this operating meeting, extract commitments, blockers, process changes, metric misses, escalation points, and accountable owners. Be strict about who owes what.`,
  },
  finance_ops: {
    type: 'finance_ops',
    label: MEETING_TYPE_LABELS.finance_ops,
    classifyHints: ['finance', 'commission', 'reconciliation', 'cash', 'carrier statement', 'income statement', 'bad debt', 'billing'],
    preMeetingPrompt: `${BASE_PRE_MEETING}\nFocus on financial variances, reconciliation gaps, receivables/payables, commission questions, required source documents, and decisions that affect cash or reporting.`,
    postMeetingPrompt: `${BASE_POST_MEETING}\nFor this finance review, extract numeric discrepancies, reconciliation tasks, reporting decisions, cash risks, payment/commission issues, and owners for each finance follow-up.`,
  },
  recruiting: {
    type: 'recruiting',
    label: MEETING_TYPE_LABELS.recruiting,
    classifyHints: ['interview', 'candidate', 'recruiting', 'hire', 'talent', 'role', 'operator'],
    preMeetingPrompt: `${BASE_PRE_MEETING}\nFocus on candidate evaluation criteria, gaps to probe, role fit, compensation/timing, red flags, and the decision Peter needs to make after the meeting.`,
    postMeetingPrompt: `${BASE_POST_MEETING}\nFor this recruiting meeting, capture candidate strengths, concerns, role fit, compensation/timing, decision status, next interview steps, and references or follow-up materials needed.`,
  },
  client_portfolio: {
    type: 'client_portfolio',
    label: MEETING_TYPE_LABELS.client_portfolio,
    classifyHints: ['client', 'portfolio', 'account review', 'check-in', 'true choice', 'pine lake', 'conversely'],
    preMeetingPrompt: `${BASE_PRE_MEETING}\nFocus on relationship status, prior commitments, service issues, performance metrics, open risks, opportunities to expand value, and Peter's recommended posture.`,
    postMeetingPrompt: `${BASE_POST_MEETING}\nFor this client/portfolio check-in, capture service commitments, relationship risks, value opportunities, stakeholder sentiment, and follow-ups needed to protect or expand the relationship.`,
  },
  investment_diligence: {
    type: 'investment_diligence',
    label: MEETING_TYPE_LABELS.investment_diligence,
    classifyHints: ['diligence', 'investment', 'deal', 'acquisition', 'target', 'valuation', 'quality of earnings'],
    preMeetingPrompt: `${BASE_PRE_MEETING}\nFocus on investment thesis, diligence gaps, key risks, economics, management quality, decision gates, and questions that change go/no-go confidence.`,
    postMeetingPrompt: `${BASE_POST_MEETING}\nFor this diligence meeting, capture thesis updates, evidence gathered, open diligence requests, risk changes, decision gates, valuation implications, and next diligence owners.`,
  },
  project_status: {
    type: 'project_status',
    label: MEETING_TYPE_LABELS.project_status,
    classifyHints: ['project', 'status', 'implementation', 'launch', 'go-live', 'roadmap', 'sprint'],
    preMeetingPrompt: `${BASE_PRE_MEETING}\nFocus on milestone status, blockers, decision dependencies, resourcing, launch risks, and what Peter should unblock or decide.`,
    postMeetingPrompt: `${BASE_POST_MEETING}\nFor this project meeting, capture milestones, blockers, owner/date commitments, scope changes, launch risks, dependencies, and decisions required before the next checkpoint.`,
  },
  vendor_partner: {
    type: 'vendor_partner',
    label: MEETING_TYPE_LABELS.vendor_partner,
    classifyHints: ['vendor', 'partner', 'supplier', 'sow', 'contract', 'onboarding', 'implementation partner'],
    preMeetingPrompt: `${BASE_PRE_MEETING}\nFocus on scope, contract/SOW terms, vendor accountability, deliverables, dependencies, commercial terms, and acceptance criteria.`,
    postMeetingPrompt: `${BASE_POST_MEETING}\nFor this vendor/partner meeting, capture deliverables, acceptance criteria, SOW/contract changes, dependencies, deadlines, and vendor-side commitments.`,
  },
  support_issue: {
    type: 'support_issue',
    label: MEETING_TYPE_LABELS.support_issue,
    classifyHints: ['support', 'issue', 'bug', 'complaint', 'incident', 'escalation', 'outage', 'error'],
    preMeetingPrompt: `${BASE_PRE_MEETING}\nFocus on issue severity, customer impact, reproduction facts, ownership, mitigation, escalation path, and what decision or communication is needed.`,
    postMeetingPrompt: `${BASE_POST_MEETING}\nFor this support/customer issue meeting, extract facts, impact, root-cause hypotheses, mitigation, owners, customer communications, and unresolved diagnostics.`,
  },
  recurring_sync: {
    type: 'recurring_sync',
    label: MEETING_TYPE_LABELS.recurring_sync,
    classifyHints: ['sync', 'recurring', 'weekly', 'daily', 'touch base', 'check in'],
    preMeetingPrompt: `${BASE_PRE_MEETING}\nFocus on changes since last sync, stale commitments, blocked decisions, and the few questions that make the meeting worth holding.`,
    postMeetingPrompt: `${BASE_POST_MEETING}\nFor this recurring sync, avoid generic summary. Capture deltas, commitments, blockers, owner/date changes, and items that should roll into the next sync.`,
  },
  generic: {
    type: 'generic',
    label: MEETING_TYPE_LABELS.generic,
    classifyHints: [],
    preMeetingPrompt: BASE_PRE_MEETING,
    postMeetingPrompt: BASE_POST_MEETING,
  },
};

export function getPromptKit(type: MeetingType | null | undefined): PromptKit {
  if (!type || !(type in PROMPT_KITS)) return PROMPT_KITS.generic;
  return PROMPT_KITS[type];
}

export function getPromptFor(type: MeetingType | null | undefined, phase: MeetingPhase): string {
  const kit = getPromptKit(type);
  return phase === 'pre' ? kit.preMeetingPrompt : kit.postMeetingPrompt;
}

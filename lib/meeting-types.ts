export const MEETING_TYPES = [
  'sales_bd',
  'board_exec',
  'internal_ops',
  'finance_ops',
  'recruiting',
  'client_portfolio',
  'investment_diligence',
  'project_status',
  'vendor_partner',
  'support_issue',
  'recurring_sync',
  'generic',
] as const;

export type MeetingType = (typeof MEETING_TYPES)[number];
export type MeetingPhase = 'pre' | 'post';

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  sales_bd: 'Sales / BD / Partnership',
  board_exec: 'Board / Executive / Investor',
  internal_ops: 'Internal Operating Review',
  finance_ops: 'Finance / Operations Review',
  recruiting: 'Recruiting / Talent',
  client_portfolio: 'Client / Portfolio Company Check-in',
  investment_diligence: 'Investment / Diligence',
  project_status: 'Project Status',
  vendor_partner: 'Vendor / Partner',
  support_issue: 'Support / Customer Issue',
  recurring_sync: 'Recurring Sync',
  generic: 'Generic Executive Meeting',
};

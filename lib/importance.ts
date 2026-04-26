// Heuristic importance score for action items.
//
// Higher score = more important / more attention-worthy. Rules-based, no ML.
// When something looks wrong, fix the row's tier/priority/dueDate or tweak the
// weights below — don't reach for a learning loop until you've outgrown this.

export interface ScorableItem {
  status?: string | null;
  priority?: string | null;
  urgencyTier?: string | null;
  dueDate?: string | null;
  snoozedUntil?: string | null;
  createdAt?: string | null;
}

const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 8,
  high:     5,
  medium:   2,
  low:      0,
};

const URGENCY_WEIGHT: Record<string, number> = {
  urgent:     10,
  this_week:   5,
  waiting_on:  2,
  none:        0,
};

function startOfDay(d: Date): number {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

export function importanceScore(item: ScorableItem): number {
  // Resolved items sink to the bottom.
  if (item.status === 'done' || item.status === 'cancelled') return -1000;

  // Snoozed items are intentionally hidden from "what matters now".
  if (item.snoozedUntil && new Date(item.snoozedUntil).getTime() > Date.now()) {
    return -500;
  }

  let score = 0;

  // Stated priority.
  score += PRIORITY_WEIGHT[item.priority ?? 'medium'] ?? PRIORITY_WEIGHT.medium;

  // Urgency tier captured in the meeting (urgent / this_week / waiting_on).
  score += URGENCY_WEIGHT[item.urgencyTier ?? 'none'] ?? 0;

  // Due-date boost — most useful signal when present.
  if (item.dueDate) {
    const today = startOfDay(new Date());
    const due = startOfDay(new Date(item.dueDate));
    const days = Math.round((due - today) / 86400000);
    if (days < 0)        score += 8; // overdue
    else if (days === 0) score += 6; // today
    else if (days <= 7)  score += 3; // this week
    else if (days <= 30) score += 1; // this month
  }

  // Age penalty — old, undated items get pushed down so they don't crowd the top.
  if (item.createdAt) {
    const ageDays = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000);
    if (ageDays > 14) {
      score -= Math.min(5, Math.floor((ageDays - 14) / 7));
    }
  }

  return score;
}

export function compareByImportance(a: ScorableItem, b: ScorableItem): number {
  return importanceScore(b) - importanceScore(a); // descending — highest first
}

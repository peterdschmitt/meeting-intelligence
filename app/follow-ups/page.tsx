'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SortHeader from '@/components/SortHeader';
import { compareByImportance, importanceScore } from '@/lib/importance';
import { formatDate } from '@/lib/format-date';

// Friendly day label for a due-date string (Today / Tomorrow / Overdue / "Mon, Apr 27" / "No due date").
function dueDayLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return 'No due date';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'No due date';
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const dayKey = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  if (dayKey < todayKey) return 'Overdue';
  if (dayKey === todayKey) return 'Today';
  const tomorrowKey = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  if (dayKey === tomorrowKey) return 'Tomorrow';
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York',
  });
}

function dueDaySortValue(dateStr: string | null | undefined): number {
  if (!dateStr) return Number.MAX_SAFE_INTEGER;
  const t = new Date(dateStr).getTime();
  return isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

interface ActionItem {
  id: string;
  title: string;
  status: string | null;
  assignee: string | null;
  dueDate: string | null;
  priority: string | null;
  urgencyTier: string | null;
  ownerSide: string | null;
  meetingId: string | null;
  meetingTitle?: string | null;
  createdAt?: string | null;
  snoozedUntil?: string | null;
}

const ME_PATTERNS = ['peter schmitt', 'peter', 'pschmitt', 'p. schmitt'];
const isMe = (s: string | null | undefined): boolean => {
  if (!s) return false;
  const a = s.toLowerCase();
  return ME_PATTERNS.some((p) => a.includes(p));
};

function isOpen(item: ActionItem): boolean {
  const s = item.status ?? 'open';
  return s !== 'done' && s !== 'cancelled';
}

const STATUS_ORDER: Record<string, number> = {
  blocked: 0, in_progress: 1, open: 2, deferred: 3, done: 4, cancelled: 5,
};
const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const URGENCY_ORDER: Record<string, number> = { urgent: 0, this_week: 1, waiting_on: 2, none: 3 };

function dueLabel(d: string | null | undefined): { label: string; tone: 'overdue' | 'today' | 'soon' | 'normal' | 'none' } {
  if (!d) return { label: '—', tone: 'none' };
  const due = new Date(d); due.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: `${days}d`, tone: 'overdue' };
  if (days === 0) return { label: 'Today', tone: 'today' };
  if (days <= 7) return { label: `+${days}d`, tone: 'soon' };
  return { label: formatDate(d), tone: 'normal' };
}

function dueColor(tone: 'overdue' | 'today' | 'soon' | 'normal' | 'none'): string {
  if (tone === 'overdue') return 'var(--apex-error)';
  if (tone === 'today') return 'var(--apex-amber)';
  if (tone === 'soon') return 'var(--apex-primary-bright)';
  return 'var(--apex-text-muted)';
}

function daysOutstanding(createdAt: string | null | undefined): number | null {
  if (!createdAt) return null;
  const created = new Date(createdAt).getTime();
  if (isNaN(created)) return null;
  return Math.max(0, Math.floor((Date.now() - created) / 86400000));
}

function effectiveCreatedDate(item: { createdAt?: string | null; meetingTitle?: string | null }): string | null {
  const m = (item.meetingTitle ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return item.createdAt ?? null;
}

function initials(name: string | null | undefined): string {
  if (!name) return '·';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '·';
}

function composeMailto(person: string, items: ActionItem[]): string {
  const subject = `Following up on ${items.length} item${items.length === 1 ? '' : 's'}`;
  const lines = items.map((it) => {
    const due = it.dueDate ? ` (due ${formatDate(it.dueDate)})` : '';
    return `• ${it.title}${due}`;
  });
  const body = `Hi ${person.split(/\s+/)[0]},\n\nQuick follow-up on the items below — let me know where each stands.\n\n${lines.join('\n')}\n\nThanks,\nPeter`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

type SortKey = 'status' | 'priority' | 'urgency' | 'owner' | 'task' | 'days' | 'due' | 'created' | 'importance' | null;

export default function FollowUpsPage() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [excludedAssignees, setExcludedAssignees] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('importance');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    Promise.all([
      fetch('/api/action-items').then((r) => r.ok ? r.json() : []),
      fetch('/api/contacts').then((r) => r.ok ? r.json() : []),
    ]).then(([d, c]) => {
      setItems(Array.isArray(d) ? d : []);
      const s = new Set<string>();
      for (const x of (Array.isArray(c) ? c : []) as { fullName?: string; excludeFromTasks?: boolean }[]) {
        if (!x.excludeFromTasks || !x.fullName) continue;
        const full = x.fullName.toLowerCase().trim();
        s.add(full);
        const first = full.split(/\s+/)[0];
        if (first) s.add(first);
      }
      setExcludedAssignees(s);
    }).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);

  const patchAction = useCallback(async (id: string, body: Record<string, unknown>) => {
    const prev = items;
    setItems((arr) => arr.map((i) => i.id === id ? { ...i, ...body } as ActionItem : i));
    try {
      const res = await fetch(`/api/action-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch {
      setItems(prev);
    }
  }, [items]);

  // Open items not assigned to Peter, and not assigned to anyone marked exclude-from-tasks.
  const isExcluded = useCallback((assignee: string | null | undefined) => {
    if (!assignee) return false;
    const a = assignee.toLowerCase().trim();
    if (excludedAssignees.has(a)) return true;
    const first = a.split(/\s+/)[0];
    return !!first && excludedAssignees.has(first);
  }, [excludedAssignees]);

  const openExternal = useMemo(
    () => items
      .filter(isOpen)
      .filter((i) => !isMe(i.assignee) && (i.assignee ?? '').trim())
      .filter((i) => !isExcluded(i.assignee)),
    [items, isExcluded],
  );

  // For per-row "Compose follow-up" we need the full set of that person's open items.
  const itemsByPerson = useMemo(() => {
    const m = new Map<string, ActionItem[]>();
    for (const it of openExternal) {
      const name = (it.assignee ?? '').trim();
      const arr = m.get(name) ?? [];
      arr.push(it);
      m.set(name, arr);
    }
    return m;
  }, [openExternal]);

  const onSort = (k: NonNullable<SortKey>) => {
    if (sortKey === k) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortKey(null); setSortDir('asc'); }
    } else { setSortKey(k); setSortDir('asc'); }
  };

  const sorted = useMemo(() => {
    // Default (no sort key clicked): order by due-day so the day-headers come out
    // in chronological order — Overdue → Today → Tomorrow → upcoming → No due date.
    if (!sortKey) {
      return [...openExternal].sort((a, b) => dueDaySortValue(a.dueDate) - dueDaySortValue(b.dueDate));
    }
    const sign = sortDir === 'asc' ? 1 : -1;
    const v = (i: ActionItem): number | string => {
      switch (sortKey) {
        case 'status':     return STATUS_ORDER[i.status ?? 'open'] ?? 99;
        case 'priority':   return PRIORITY_ORDER[i.priority ?? 'medium'] ?? 99;
        case 'urgency':    return URGENCY_ORDER[i.urgencyTier ?? 'none'] ?? 99;
        case 'owner':      return (i.assignee ?? '~~~').toLowerCase();
        case 'task':       return i.title.toLowerCase();
        case 'days':       return daysOutstanding(effectiveCreatedDate(i)) ?? -1;
        case 'created':    { const d = effectiveCreatedDate(i); return d ? new Date(d).getTime() : 0; }
        case 'due':        return i.dueDate ? new Date(i.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        case 'importance': return -importanceScore(i); // higher score first under default asc
        default:           return '';
      }
    };
    return [...openExternal].sort((a, b) => {
      const av = v(a), bv = v(b);
      if (av < bv) return -1 * sign;
      if (av > bv) return 1 * sign;
      return 0;
    });
  }, [openExternal, sortKey, sortDir]);

  // status | pri | urgency | owner | task | days | created | due | compose
  const cols = '38px 38px 60px 130px 1fr 50px 70px 70px 28px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="apex-page-header">
        <span className="apex-page-title">Follow-ups</span>
        <span className="cell-meta">
          {itemsByPerson.size} {itemsByPerson.size === 1 ? 'person' : 'people'} · {openExternal.length} open
        </span>
      </div>

      {/* Column header */}
      <div className="apex-grid-header" style={{ gridTemplateColumns: cols }}>
        <SortHeader label="St"   k="status"   sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Pri"  k="priority" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Urg"  k="urgency"  sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Owner"    k="owner"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Task"     k="task"     sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Days"    k="days"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
        <SortHeader label="Created" k="created" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
        <SortHeader label="Due"     k="due"     sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
        <span></span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>Loading…</div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>
            No open items assigned to other people.
          </div>
        ) : (
          sorted.map((it, idx) => {
            const due = dueLabel(it.dueDate);
            const created = effectiveCreatedDate(it);
            const days = daysOutstanding(created);
            const status = it.status ?? 'open';
            const priority = it.priority ?? 'medium';
            const urgency = it.urgencyTier ?? 'none';
            const ownerName = (it.assignee ?? '').trim();
            const personItems = itemsByPerson.get(ownerName) ?? [it];
            const myDayLabel = dueDayLabel(it.dueDate);
            const prevDayLabel = idx > 0 ? dueDayLabel(sorted[idx - 1].dueDate) : null;
            const showDayHeader = !sortKey && myDayLabel !== prevDayLabel;
            return (
              <Fragment key={it.id}>
                {showDayHeader && (
                  <div
                    style={{
                      padding: '6px 14px',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: myDayLabel === 'Overdue' ? 'var(--apex-error)' : 'var(--apex-text-muted)',
                      background: 'rgba(255,255,255,0.015)',
                      borderTop: '1px solid var(--apex-border)',
                      borderBottom: '1px solid var(--apex-border)',
                    }}
                  >
                    {myDayLabel}
                  </div>
                )}
              <div
                className="apex-grid-row"
                style={{ gridTemplateColumns: cols, alignItems: 'center', padding: '6px 14px' }}
              >
                <select
                  className="inline-select"
                  value={status}
                  onChange={(e) => patchAction(it.id, { status: e.target.value })}
                  title={`Status: ${status.replace('_', ' ')}`}
                  style={{ height: 22, fontSize: 11, padding: '0 4px', textAlign: 'center' }}
                >
                  <option value="open">O</option>
                  <option value="in_progress">IP</option>
                  <option value="blocked">B</option>
                  <option value="deferred">De</option>
                  <option value="done">Dn</option>
                  <option value="cancelled">X</option>
                </select>
                <select
                  className="inline-select"
                  value={priority}
                  onChange={(e) => patchAction(it.id, { priority: e.target.value })}
                  title={`Priority: ${priority}`}
                  style={{ height: 22, fontSize: 11, padding: '0 4px', textAlign: 'center' }}
                >
                  <option value="critical">C</option>
                  <option value="high">H</option>
                  <option value="medium">M</option>
                  <option value="low">L</option>
                </select>
                <select
                  className="inline-select"
                  value={urgency}
                  onChange={(e) => patchAction(it.id, { urgencyTier: e.target.value })}
                  title={`Urgency: ${urgency.replace('_', ' ')}`}
                  style={{ height: 22, fontSize: 11, padding: '0 4px', textAlign: 'center' }}
                >
                  <option value="urgent">U</option>
                  <option value="this_week">TW</option>
                  <option value="waiting_on">WO</option>
                  <option value="none">—</option>
                </select>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span className="avatar" style={{ width: 18, height: 18, fontSize: 8 }}>{initials(ownerName)}</span>
                  <span className="cell-secondary" style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ownerName.split(' ')[0] || '—'}
                  </span>
                </span>
                <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: 'var(--apex-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.title}
                  </span>
                  {it.meetingTitle && (
                    <Link
                      href={it.meetingId ? `/meetings/${it.meetingId}` : '#'}
                      style={{ fontSize: 10.5, color: 'var(--apex-text-faint)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      from {it.meetingTitle}
                    </Link>
                  )}
                </span>
                <span style={{ fontSize: 11, color: 'var(--apex-text-muted)', textAlign: 'right' }}>
                  {days === null ? '—' : `${days}d`}
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--apex-text-muted)', textAlign: 'right' }}>
                  {created ? formatDate(created) : '—'}
                </span>
                <span style={{ fontSize: 10.5, color: dueColor(due.tone), textAlign: 'right' }}>
                  {due.label}
                </span>
                <a
                  href={composeMailto(ownerName, personItems)}
                  title={`Compose follow-up to ${ownerName} (${personItems.length} item${personItems.length === 1 ? '' : 's'})`}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 22, color: 'var(--apex-text-faint)', textDecoration: 'none' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--apex-primary-bright)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--apex-text-faint)'; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>mail</span>
                </a>
              </div>
              </Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}

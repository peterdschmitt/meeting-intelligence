'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import ResizableSplit from '@/components/ResizableSplit';
import SortHeader from '@/components/SortHeader';
import { formatDate } from '@/lib/format-date';
import TodayMeetingsPanel from '@/components/TodayMeetingsPanel';

interface Meeting {
  id: string;
  title: string;
  meetingDate: string | null;
  participants: string[] | null;
  companyName?: string | null;
}

interface ActionItem {
  id: string;
  title: string;
  status: string | null;
  assignee: string | null;
  meetingId: string | null;
  meetingTitle?: string | null;
  dueDate?: string | null;
  priority?: string | null;
  createdAt?: string | null;
}

function daysOutstanding(createdAt: string | null | undefined): number | null {
  if (!createdAt) return null;
  const created = new Date(createdAt).getTime();
  if (isNaN(created)) return null;
  return Math.max(0, Math.floor((Date.now() - created) / 86400000));
}

// The action item's DB createdAt is just when we ingested it. The semantically
// useful "created" is when it was noted in the meeting — parse from the
// meeting title's YYYY-MM-DD prefix and fall back to DB createdAt.
function effectiveCreatedDate(item: { createdAt?: string | null; meetingTitle?: string | null }): string | null {
  const m = (item.meetingTitle ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return item.createdAt ?? null;
}

interface Contact {
  id: string;
  fullName: string;
  excludeFromTasks?: boolean;
}

// Many meeting titles start with a YYYY-MM-DD prefix (the Drive doc convention).
// Use that as a fallback when meetingDate isn't set in the row.
function parseDateFromTitle(title: string): string | null {
  const m = title.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function effectiveDate(m: { meetingDate: string | null; title: string }): string | null {
  return m.meetingDate ?? parseDateFromTitle(m.title);
}

function isThisWeek(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}

function isThisMonth(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() < Date.now() - 24 * 60 * 60 * 1000;
}

function cycleStatus(s: string | null): string {
  if (s === 'open') return 'in_progress';
  if (s === 'in_progress') return 'done';
  return 'open';
}

function initials(name: string | null | undefined): string {
  if (!name) return '·';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '·';
}

type MtgSortKey = 'date' | 'title' | 'act' | null;
type ActSortKey = 'status' | 'owner' | 'task' | 'due' | 'created' | 'days' | null;

export default function DashboardClient() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [mtgSort, setMtgSort] = useState<MtgSortKey>(null);
  const [mtgDir, setMtgDir] = useState<'asc' | 'desc'>('asc');
  const [actSort, setActSort] = useState<ActSortKey>(null);
  const [actDir, setActDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [todayCount, setTodayCount] = useState(0);
  const [today] = useState(() =>
    new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())
  );

  useEffect(() => {
    Promise.all([
      fetch('/api/meetings').then((r) => r.ok ? r.json() : []),
      fetch('/api/action-items').then((r) => r.ok ? r.json() : []),
      fetch('/api/contacts').then((r) => r.ok ? r.json() : []),
      fetch('/api/meetings/today').then((r) => r.ok ? r.json() : []),
    ]).then(([m, a, c, t]) => {
      setMeetings(Array.isArray(m) ? m as Meeting[] : []);
      setActionItems(Array.isArray(a) ? a as ActionItem[] : []);
      setContacts(Array.isArray(c) ? c as Contact[] : []);
      setTodayCount(Array.isArray(t) ? t.length : 0);
    }).catch(() => {});
  }, []);

  const recentMeetings = useMemo(() =>
    [...meetings]
      .sort((a, b) => {
        const ad = effectiveDate(a) ? new Date(effectiveDate(a)!).getTime() : 0;
        const bd = effectiveDate(b) ? new Date(effectiveDate(b)!).getTime() : 0;
        return bd - ad;
      })
      .slice(0, 30),
    [meetings],
  );

  // Excluded-name set: include both full name and first-name token so a contact
  // marked "excluded" filters out items whose assignee is just the first name.
  const excludedAssignees = useMemo(() => {
    const s = new Set<string>();
    for (const c of contacts) {
      if (!c.excludeFromTasks || !c.fullName) continue;
      const full = c.fullName.toLowerCase().trim();
      s.add(full);
      const first = full.split(/\s+/)[0];
      if (first) s.add(first);
    }
    return s;
  }, [contacts]);

  const isExcludedAssignee = useCallback((assignee: string | null | undefined) => {
    if (!assignee) return false;
    const a = assignee.toLowerCase().trim();
    if (excludedAssignees.has(a)) return true;
    const first = a.split(/\s+/)[0];
    return !!first && excludedAssignees.has(first);
  }, [excludedAssignees]);

  const openActions = useMemo(() =>
    actionItems
      .filter((a) => a.status !== 'done' && a.status !== 'cancelled')
      .filter((a) => !isExcludedAssignee(a.assignee))
      .slice(0, 60),
    [actionItems, isExcludedAssignee],
  );

  const actionCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of actionItems) if (a.meetingId && a.status !== 'done') c[a.meetingId] = (c[a.meetingId] ?? 0) + 1;
    return c;
  }, [actionItems]);

  const sortedRecentMeetings = useMemo(() => {
    if (!mtgSort) return recentMeetings;
    const sign = mtgDir === 'asc' ? 1 : -1;
    const v = (m: Meeting): number | string => {
      switch (mtgSort) {
        case 'date':  { const d = effectiveDate(m); return d ? new Date(d).getTime() : 0; }
        case 'title': return m.title.toLowerCase();
        case 'act':   return actionCounts[m.id] ?? 0;
        default:      return '';
      }
    };
    return [...recentMeetings].sort((a, b) => {
      const av = v(a), bv = v(b);
      if (av < bv) return -1 * sign;
      if (av > bv) return 1 * sign;
      return 0;
    });
  }, [recentMeetings, mtgSort, mtgDir, actionCounts]);

  const sortedOpenActions = useMemo(() => {
    if (!actSort) return openActions;
    const sign = actDir === 'asc' ? 1 : -1;
    const STATUS_ORDER: Record<string, number> = {
      blocked: 0, in_progress: 1, open: 2, deferred: 3, done: 4, cancelled: 5,
    };
    const v = (a: ActionItem): number | string => {
      switch (actSort) {
        case 'status':  return STATUS_ORDER[a.status ?? 'open'] ?? 99;
        case 'owner':   return (a.assignee ?? '~~~').toLowerCase();
        case 'task':    return a.title.toLowerCase();
        case 'due':     return a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        case 'created': { const d = effectiveCreatedDate(a); return d ? new Date(d).getTime() : 0; }
        case 'days':    return daysOutstanding(effectiveCreatedDate(a)) ?? -1;
        default:        return '';
      }
    };
    return [...openActions].sort((a, b) => {
      const av = v(a), bv = v(b);
      if (av < bv) return -1 * sign;
      if (av > bv) return 1 * sign;
      return 0;
    });
  }, [openActions, actSort, actDir]);

  const onMtgSort = (k: NonNullable<MtgSortKey>) => {
    if (mtgSort === k) {
      if (mtgDir === 'asc') setMtgDir('desc');
      else { setMtgSort(null); setMtgDir('asc'); }
    } else { setMtgSort(k); setMtgDir('asc'); }
  };
  const onActSort = (k: NonNullable<ActSortKey>) => {
    if (actSort === k) {
      if (actDir === 'asc') setActDir('desc');
      else { setActSort(null); setActDir('asc'); }
    } else { setActSort(k); setActDir('asc'); }
  };

  const stats = useMemo(() => {
    const visible = actionItems.filter((a) => !isExcludedAssignee(a.assignee));
    return {
      week: meetings.filter((m) => isThisWeek(m.meetingDate)).length,
      month: meetings.filter((m) => isThisMonth(m.meetingDate)).length,
      open: visible.filter((a) => a.status !== 'done' && a.status !== 'cancelled').length,
      overdue: visible.filter((a) => a.status !== 'done' && isOverdue(a.dueDate)).length,
      contacts: contacts.length,
    };
  }, [meetings, actionItems, contacts, isExcludedAssignee]);

  const handleStatusCycle = useCallback(async (item: ActionItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = cycleStatus(item.status);
    setActionItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: newStatus } : i));
    try {
      await fetch(`/api/action-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      setActionItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: item.status } : i));
    }
  }, []);

  // Per-row patch: optimistically update one action item, revert on failure.
  const patchAction = useCallback(async (id: string, body: Record<string, unknown>) => {
    const prev = actionItems;
    setActionItems((items) => items.map((i) => i.id === id ? { ...i, ...body } as ActionItem : i));
    try {
      const res = await fetch(`/api/action-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch {
      setActionItems(prev);
    }
  }, [actionItems]);

  // Bulk: apply a body to every selected id sequentially (optimistic, no rollback on partial failure).
  const applyBulk = useCallback(async (body: Record<string, unknown>) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setActionItems((items) => items.map((i) => ids.includes(i.id) ? { ...i, ...body } as ActionItem : i));
    await Promise.all(ids.map((id) =>
      fetch(`/api/action-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => null),
    ));
    setSelected(new Set());
  }, [selected]);

  const toggleSelected = useCallback((id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Left pane — recent meetings
  const leftPane = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--apex-bg)', minWidth: 0 }}>
      <div className="apex-page-header">
        <span className="apex-page-title">Recent Meetings</span>
        <Link href="/meetings" className="filter-btn">View all</Link>
      </div>

      <div className="apex-grid-header" style={{ gridTemplateColumns: '70px 1fr 50px' }}>
        <SortHeader label="Date"  k="date"  sortKey={mtgSort} sortDir={mtgDir} onSort={onMtgSort} />
        <SortHeader label="Title" k="title" sortKey={mtgSort} sortDir={mtgDir} onSort={onMtgSort} />
        <SortHeader label="Act"   k="act"   sortKey={mtgSort} sortDir={mtgDir} onSort={onMtgSort} align="right" />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sortedRecentMeetings.length === 0 ? (
          <EmptyState message="No meetings yet" />
        ) : (
          sortedRecentMeetings.map((m) => {
            const ac = actionCounts[m.id] ?? 0;
            return (
              <Link
                key={m.id}
                href={`/meetings/${m.id}`}
                className="apex-grid-row"
                style={{ gridTemplateColumns: '70px 1fr 50px' }}
              >
                <span className="cell-meta">{formatDate(effectiveDate(m))}</span>
                <span className="cell-primary">{m.title}</span>
                <span className="cell-meta" style={{ textAlign: 'right', color: ac > 0 ? 'var(--apex-primary-bright)' : undefined }}>
                  {ac > 0 ? ac : '—'}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );

  // Right pane — open actions
  const allVisibleIds = sortedOpenActions.map((a) => a.id);
  const allChecked = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  // Layout: checkbox | status | priority | owner avatar | task | created | days | due
  const cols = '20px 38px 38px 22px 1fr 60px 38px 75px';

  const rightPane = (
    <div className="detail-pane" style={{ background: 'var(--apex-panel)' }}>
      <div className="detail-pane-header">
        <span className="apex-page-title">Open Actions</span>
        <Link href="/action-items" className="filter-btn">View all</Link>
      </div>

      {/* Bulk action bar — appears when rows are selected. */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
          background: 'rgba(46,98,255,0.08)', borderBottom: '1px solid var(--apex-border)',
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--apex-text)' }}>{selected.size} selected</span>
          <span style={{ width: 1, height: 16, background: 'var(--apex-border-bright)' }} />
          <select
            className="inline-select"
            value=""
            onChange={(e) => { const v = e.target.value; if (v) applyBulk({ status: v }); e.currentTarget.value = ''; }}
            style={{ height: 24, fontSize: 11 }}
          >
            <option value="">Status…</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="deferred">Deferred</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            className="inline-select"
            value=""
            onChange={(e) => { const v = e.target.value; if (v) applyBulk({ priority: v }); e.currentTarget.value = ''; }}
            style={{ height: 24, fontSize: 11 }}
          >
            <option value="">Priority…</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <input
            type="date"
            onChange={(e) => { if (e.target.value) applyBulk({ dueDate: e.target.value }); e.currentTarget.value = ''; }}
            title="Set due date for selected"
            style={{ height: 24, fontSize: 11, padding: '0 6px', background: 'var(--apex-panel)', color: 'var(--apex-text)', border: '1px solid var(--apex-border)', borderRadius: 4 }}
          />
          <button
            className="btn btn-ghost"
            onClick={() => setSelected(new Set())}
            style={{ height: 24, fontSize: 11, marginLeft: 'auto' }}
          >
            Clear
          </button>
        </div>
      )}

      <div className="apex-grid-header" style={{ gridTemplateColumns: cols }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(e) => {
              if (e.target.checked) setSelected(new Set(allVisibleIds));
              else setSelected(new Set());
            }}
            title="Select all visible"
          />
        </span>
        <SortHeader label="Status"  k="status" sortKey={actSort} sortDir={actDir} onSort={onActSort} />
        <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--apex-text-muted)', textTransform: 'uppercase' }}>Pri</span>
        <SortHeader label="Who"     k="owner"  sortKey={actSort} sortDir={actDir} onSort={onActSort} />
        <SortHeader label="Task"    k="task"   sortKey={actSort} sortDir={actDir} onSort={onActSort} />
        <SortHeader label="Created" k="created" sortKey={actSort} sortDir={actDir} onSort={onActSort} align="right" />
        <SortHeader label="Days"    k="days"   sortKey={actSort} sortDir={actDir} onSort={onActSort} align="right" />
        <SortHeader label="Due"     k="due"    sortKey={actSort} sortDir={actDir} onSort={onActSort} align="right" />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sortedOpenActions.length === 0 ? (
          <EmptyState message="No open actions" />
        ) : (
          sortedOpenActions.map((a) => {
            const status = a.status ?? 'open';
            const priority = a.priority ?? 'medium';
            const overdue = isOverdue(a.dueDate);
            const isSel = selected.has(a.id);
            return (
              <div
                key={a.id}
                className="apex-grid-row"
                style={{
                  gridTemplateColumns: cols,
                  background: isSel ? 'rgba(46,98,255,0.06)' : undefined,
                  alignItems: 'center',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggleSelected(a.id)}
                  />
                </span>
                <select
                  className="inline-select"
                  value={status}
                  onChange={(e) => patchAction(a.id, { status: e.target.value })}
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
                  onChange={(e) => patchAction(a.id, { priority: e.target.value })}
                  title={`Priority: ${priority}`}
                  style={{ height: 22, fontSize: 11, padding: '0 4px', textAlign: 'center' }}
                >
                  <option value="critical">C</option>
                  <option value="high">H</option>
                  <option value="medium">M</option>
                  <option value="low">L</option>
                </select>
                <span title={a.assignee ?? ''} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="avatar" style={{ width: 18, height: 18, fontSize: 8 }}>{initials(a.assignee)}</span>
                </span>
                <Link href="/action-items" className="cell-primary" title={a.title} style={{ textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.title}
                </Link>
                <span className="cell-meta" style={{ fontSize: 10.5, textAlign: 'right' }}>
                  {(() => { const d = effectiveCreatedDate(a); return d ? formatDate(d) : '—'; })()}
                </span>
                <span className="cell-meta" style={{ fontSize: 10.5, textAlign: 'right' }}>
                  {(() => { const d = daysOutstanding(effectiveCreatedDate(a)); return d === null ? '—' : `${d}d`; })()}
                </span>
                <input
                  type="date"
                  value={a.dueDate ?? ''}
                  onChange={(e) => patchAction(a.id, { dueDate: e.target.value || null })}
                  style={{
                    height: 22, fontSize: 10.5, padding: '0 4px', textAlign: 'right',
                    background: 'transparent',
                    color: overdue ? 'var(--apex-error)' : 'var(--apex-text-muted)',
                    border: '1px solid transparent',
                    borderRadius: 3,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--apex-border)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--apex-bg)' }}>
      {/* Stat strip */}
      <div className="apex-statbar">
        <div className="apex-stat">
          <span className="apex-stat-value">{stats.week}</span>
          <span className="apex-stat-label">This Week</span>
        </div>
        <div className="apex-stat">
          <span className="apex-stat-value">{stats.month}</span>
          <span className="apex-stat-label">This Month</span>
        </div>
        <div className="apex-stat">
          <span className={`apex-stat-value${todayCount > 0 ? ' accent' : ''}`}>{todayCount}</span>
          <span className="apex-stat-label">Today</span>
        </div>
        <div className="apex-stat">
          <span className={`apex-stat-value${stats.open > 0 ? ' accent' : ''}`}>{stats.open}</span>
          <span className="apex-stat-label">Open</span>
        </div>
        <div className="apex-stat">
          <span className={`apex-stat-value${stats.overdue > 0 ? ' error' : ''}`}>{stats.overdue}</span>
          <span className="apex-stat-label">Overdue</span>
        </div>
        <div className="apex-stat">
          <span className="apex-stat-value">{stats.contacts}</span>
          <span className="apex-stat-label">Contacts</span>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span className="apex-stat-label" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--apex-text-muted)' }}>{today}</span>
        </div>
      </div>

      {todayCount > 0 && (
        <div style={{ flexShrink: 0, padding: '0 16px 12px' }}>
          <TodayMeetingsPanel />
        </div>
      )}

      {/* Two panes */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <ResizableSplit
          left={leftPane}
          right={rightPane}
          defaultLeftPct={58}
          minLeftPx={400}
          minRightPx={380}
          storageKey="dashboard-split"
        />
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--apex-text-faint)', fontSize: 12 }}>
      {message}
    </div>
  );
}

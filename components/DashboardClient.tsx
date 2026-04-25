'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import ResizableSplit from '@/components/ResizableSplit';

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
}

interface Contact {
  id: string;
  fullName: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dateStr));
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

export default function DashboardClient() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [today] = useState(() =>
    new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())
  );

  useEffect(() => {
    Promise.all([
      fetch('/api/meetings').then((r) => r.ok ? r.json() : []),
      fetch('/api/action-items').then((r) => r.ok ? r.json() : []),
      fetch('/api/contacts').then((r) => r.ok ? r.json() : []),
    ]).then(([m, a, c]) => {
      setMeetings(Array.isArray(m) ? m as Meeting[] : []);
      setActionItems(Array.isArray(a) ? a as ActionItem[] : []);
      setContacts(Array.isArray(c) ? c as Contact[] : []);
    }).catch(() => {});
  }, []);

  const recentMeetings = useMemo(() =>
    [...meetings]
      .sort((a, b) => {
        const ad = a.meetingDate ? new Date(a.meetingDate).getTime() : 0;
        const bd = b.meetingDate ? new Date(b.meetingDate).getTime() : 0;
        return bd - ad;
      })
      .slice(0, 30),
    [meetings],
  );

  const openActions = useMemo(() =>
    actionItems.filter((a) => a.status !== 'done' && a.status !== 'cancelled').slice(0, 60),
    [actionItems],
  );

  const actionCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of actionItems) if (a.meetingId && a.status !== 'done') c[a.meetingId] = (c[a.meetingId] ?? 0) + 1;
    return c;
  }, [actionItems]);

  const stats = useMemo(() => ({
    week: meetings.filter((m) => isThisWeek(m.meetingDate)).length,
    month: meetings.filter((m) => isThisMonth(m.meetingDate)).length,
    open: actionItems.filter((a) => a.status !== 'done' && a.status !== 'cancelled').length,
    overdue: actionItems.filter((a) => a.status !== 'done' && isOverdue(a.dueDate)).length,
    contacts: contacts.length,
  }), [meetings, actionItems, contacts]);

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

  // Left pane — recent meetings
  const leftPane = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--apex-bg)', minWidth: 0 }}>
      <div className="apex-page-header">
        <span className="apex-page-title">Recent Meetings</span>
        <Link href="/meetings" className="filter-btn">View all</Link>
      </div>

      <div className="apex-grid-header" style={{ gridTemplateColumns: '64px 1fr 130px 50px 50px' }}>
        <span>Date</span>
        <span>Title</span>
        <span>Company</span>
        <span style={{ textAlign: 'right' }}>Ppl</span>
        <span style={{ textAlign: 'right' }}>Act</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {recentMeetings.length === 0 ? (
          <EmptyState message="No meetings yet" />
        ) : (
          recentMeetings.map((m) => {
            const parts = Array.isArray(m.participants) ? m.participants : [];
            const ac = actionCounts[m.id] ?? 0;
            return (
              <Link
                key={m.id}
                href={`/meetings/${m.id}`}
                className="apex-grid-row"
                style={{ gridTemplateColumns: '64px 1fr 130px 50px 50px' }}
              >
                <span className="cell-meta">{formatDate(m.meetingDate)}</span>
                <span className="cell-primary">{m.title}</span>
                <span className="cell-secondary">{m.companyName ?? '—'}</span>
                <span className="cell-meta" style={{ textAlign: 'right' }}>{parts.length || '—'}</span>
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
  const rightPane = (
    <div className="detail-pane" style={{ background: 'var(--apex-panel)' }}>
      <div className="detail-pane-header">
        <span className="apex-page-title">Open Actions</span>
        <Link href="/action-items" className="filter-btn">View all</Link>
      </div>

      <div className="apex-grid-header" style={{ gridTemplateColumns: '64px 90px 1fr 80px' }}>
        <span>Status</span>
        <span>Owner</span>
        <span>Task</span>
        <span style={{ textAlign: 'right' }}>Due</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {openActions.length === 0 ? (
          <EmptyState message="No open actions" />
        ) : (
          openActions.map((a) => {
            const status = a.status ?? 'open';
            const overdue = isOverdue(a.dueDate);
            return (
              <Link
                key={a.id}
                href="/action-items"
                className="apex-grid-row"
                style={{ gridTemplateColumns: '64px 90px 1fr 80px' }}
              >
                <span
                  className={`badge badge-${status}`}
                  onClick={(e) => { e.preventDefault(); handleStatusCycle(a, e); }}
                  title="Click to cycle"
                >
                  {status.replace('_', ' ')}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span className="avatar" style={{ width: 18, height: 18, fontSize: 8 }}>{initials(a.assignee)}</span>
                  <span className="cell-secondary" style={{ fontSize: 11 }}>{a.assignee?.split(' ')[0] ?? '—'}</span>
                </span>
                <span className="cell-primary">{a.title}</span>
                <span className="cell-meta" style={{ textAlign: 'right', color: overdue ? 'var(--apex-error)' : undefined }}>
                  {a.dueDate ? formatDate(a.dueDate) : '—'}
                </span>
              </Link>
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

'use client';

import { useState, useCallback, useEffect } from 'react';
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
}

interface Contact {
  id: string;
  fullName: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dateStr));
}

function cycleStatus(current: string | null): string {
  if (current === 'open') return 'in_progress';
  if (current === 'in_progress') return 'done';
  return 'open';
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

export default function DashboardClient() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);
  const [today] = useState(() =>
    new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())
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

  const recentMeetings = meetings.slice(0, 10);
  const openActions = actionItems.filter((a) => a.status !== 'done').slice(0, 12);

  const actionCounts: Record<string, number> = {};
  for (const a of actionItems) {
    if (a.meetingId) actionCounts[a.meetingId] = (actionCounts[a.meetingId] ?? 0) + 1;
  }

  const weekMeetings = meetings.filter((m) => isThisWeek(m.meetingDate)).length;
  const monthMeetings = meetings.filter((m) => isThisMonth(m.meetingDate)).length;
  const openCount = actionItems.filter((a) => a.status !== 'done').length;
  const overdueCount = 0; // no dueDate in this interface

  const handleStatusCycle = useCallback(async (item: ActionItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = cycleStatus(item.status);
    setActionItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: newStatus } : i));
    if (selectedAction?.id === item.id) setSelectedAction((prev) => prev ? { ...prev, status: newStatus } : null);
    try {
      await fetch(`/api/action-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      setActionItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: item.status } : i));
    }
  }, [selectedAction]);

  const leftPane = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a' }}>
      {/* Page header */}
      <div className="page-header">
        <span className="page-title">Pine Lake · Meeting Intelligence</span>
        <span className="cell-meta">{today}</span>
      </div>

      {/* Stat bar */}
      <div className="stat-bar">
        <div className="stat-bar-item">
          <span className="stat-bar-value">{weekMeetings}</span>
          <span className="stat-bar-label">This Week</span>
        </div>
        <div className="stat-bar-item">
          <span className="stat-bar-value">{monthMeetings}</span>
          <span className="stat-bar-label">This Month</span>
        </div>
        <div className="stat-bar-item">
          <span className={`stat-bar-value${openCount > 0 ? ' amber' : ''}`}>{openCount}</span>
          <span className="stat-bar-label">Open Actions</span>
        </div>
        <div className="stat-bar-item">
          <span className={`stat-bar-value${overdueCount > 0 ? ' amber' : ''}`}>{overdueCount}</span>
          <span className="stat-bar-label">Overdue</span>
        </div>
        <div className="stat-bar-item">
          <span className="stat-bar-value">{contacts.length}</span>
          <span className="stat-bar-label">Contacts</span>
        </div>
      </div>

      {/* Group header */}
      <div className="group-header">
        <span>Recent Meetings</span>
        <Link href="/meetings" style={{ textDecoration: 'none', color: '#52525b', fontSize: 9 }}>View all →</Link>
      </div>

      {/* Grid header */}
      <div className="grid-header" style={{ gridTemplateColumns: '70px 1fr 110px 40px 40px' }}>
        <span>DATE</span>
        <span>TITLE</span>
        <span>COMPANY</span>
        <span>PPL</span>
        <span>ACT</span>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {recentMeetings.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <span className="cell-meta">No meetings yet</span>
          </div>
        ) : (
          recentMeetings.map((m) => {
            const parts = Array.isArray(m.participants) ? m.participants : [];
            return (
              <div
                key={m.id}
                className="grid-row"
                style={{ gridTemplateColumns: '70px 1fr 110px 40px 40px' }}
              >
                <span className="cell-meta">{formatDate(m.meetingDate)}</span>
                <span className="cell-primary">{m.title}</span>
                <span className="cell-secondary">{m.companyName ?? '—'}</span>
                <span className="cell-meta" style={{ textAlign: 'center' }}>{parts.length || '—'}</span>
                <span className="cell-meta" style={{ textAlign: 'center' }}>
                  {(actionCounts[m.id] ?? 0) > 0
                    ? <span style={{ color: '#d97706' }}>{actionCounts[m.id]}</span>
                    : '—'}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const rightPane = selectedAction ? (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#111111' }}>
      {/* Back button header */}
      <div className="page-header" style={{ background: '#111111' }}>
        <button
          className="action-btn"
          onClick={() => setSelectedAction(null)}
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ← Back
        </button>
        <span className="cell-meta">Action Detail</span>
      </div>

      {/* Detail content */}
      <div className="detail-panel-body">
        <div>
          <div className="detail-section-label">Task</div>
          <div className="detail-section-value">{selectedAction.title}</div>
        </div>
        {selectedAction.assignee && (
          <div>
            <div className="detail-section-label">Assignee</div>
            <div className="detail-section-value">{selectedAction.assignee}</div>
          </div>
        )}
        <div>
          <div className="detail-section-label">Status</div>
          <span className={`badge badge-${selectedAction.status ?? 'open'}`}>
            {selectedAction.status ?? 'open'}
          </span>
        </div>
        {selectedAction.meetingTitle && (
          <div>
            <div className="detail-section-label">Meeting</div>
            <div className="cell-secondary">{selectedAction.meetingTitle}</div>
          </div>
        )}
        <div style={{ paddingTop: 8 }}>
          <Link href="/action-items" style={{ textDecoration: 'none' }}>
            <button className="action-btn amber">View All Actions →</button>
          </Link>
        </div>
      </div>
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#111111' }}>
      {/* Open Actions group header */}
      <div className="group-header" style={{ background: 'rgba(255,255,255,0.025)' }}>
        <span>Open Actions</span>
        <Link href="/action-items" style={{ textDecoration: 'none', color: '#52525b', fontSize: 9 }}>View all →</Link>
      </div>

      {/* Grid header */}
      <div className="grid-header" style={{ gridTemplateColumns: '64px 90px 1fr 100px' }}>
        <span>STATUS</span>
        <span>ASSIGNEE</span>
        <span>TASK</span>
        <span>MEETING</span>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {openActions.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <span className="cell-meta">No open actions</span>
          </div>
        ) : (
          openActions.map((a) => {
            const status = a.status ?? 'open';
            return (
              <div
                key={a.id}
                className="grid-row"
                style={{ gridTemplateColumns: '64px 90px 1fr 100px' }}
                onClick={() => setSelectedAction(a)}
              >
                <span
                  className={`badge badge-${status}`}
                  onClick={(e) => handleStatusCycle(a, e)}
                  title="Click to cycle status"
                >
                  {status}
                </span>
                <span className="cell-secondary">{a.assignee ?? '—'}</span>
                <span className="cell-primary">{a.title}</span>
                <span className="cell-meta">{a.meetingTitle ?? '—'}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a' }}>
      <ResizableSplit
        left={leftPane}
        right={rightPane}
        defaultLeftPct={60}
        storageKey="dashboard-split"
      />
    </div>
  );
}

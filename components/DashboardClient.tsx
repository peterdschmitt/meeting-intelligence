'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import DetailPanel from './DetailPanel';

interface Meeting {
  id: string;
  title: string;
  meetingDate: string | null;
  participants: string[] | string | null;
  aiSummary: string | null;
  companyName?: string | null;
  source?: string | null;
}

interface ActionItem {
  id: string;
  title: string;
  status: string | null;
  assignee: string | null;
  dueDate: string | null;
  meetingId: string | null;
  meetingTitle?: string | null;
}

interface Contact {
  id: string;
  fullName: string;
}

interface Props {
  meetings: Meeting[];
  actionItems: ActionItem[];
  contacts: Contact[];
  stats: { weekMeetings: number; monthMeetings: number; openActions: number; overdueActions: number };
  today: string;
}

function parseParticipants(raw: string[] | string | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw) as string[]; } catch { return []; }
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

export default function DashboardClient({ meetings, actionItems, contacts, stats, today }: Props) {
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);
  const [panelType, setPanelType] = useState<'meeting' | 'action' | null>(null);
  const [items, setItems] = useState<ActionItem[]>(actionItems);

  const recentMeetings = meetings.slice(0, 10);
  const openActions = items.filter((a) => a.status !== 'done').slice(0, 12);

  // Action counts per meeting
  const actionCounts: Record<string, number> = {};
  for (const a of items) {
    if (a.meetingId) actionCounts[a.meetingId] = (actionCounts[a.meetingId] ?? 0) + 1;
  }

  const handleStatusCycle = useCallback(async (item: ActionItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = cycleStatus(item.status);
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: newStatus } : i));
    try {
      await fetch(`/api/action-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: item.status } : i));
    }
  }, []);

  const openMeetingPanel = (m: Meeting) => {
    setSelectedMeeting(m);
    setSelectedAction(null);
    setPanelType('meeting');
  };

  const openActionPanel = (a: ActionItem) => {
    setSelectedAction(a);
    setSelectedMeeting(null);
    setPanelType('action');
  };

  const closePanel = () => {
    setPanelType(null);
    setSelectedMeeting(null);
    setSelectedAction(null);
  };

  // Meeting items for panel
  const meetingActionItems = selectedMeeting
    ? items.filter((a) => a.meetingId === selectedMeeting.id)
    : [];

  const panelOpen = panelType !== null;
  const panelTitle = panelType === 'meeting'
    ? (selectedMeeting?.title ?? '')
    : (selectedAction?.title ?? '');

  return (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="page-header">
        <span className="page-title">Pine Lake · Meeting Intelligence</span>
        <span className="cell-meta">{today}</span>
      </div>

      {/* Stat bar */}
      <div className="stat-bar">
        <div className="stat-bar-item">
          <span className={`stat-bar-value${stats.weekMeetings > 0 ? '' : ''}`}>{stats.weekMeetings}</span>
          <span className="stat-bar-label">This Week</span>
        </div>
        <div className="stat-bar-item">
          <span className="stat-bar-value">{stats.monthMeetings}</span>
          <span className="stat-bar-label">This Month</span>
        </div>
        <div className="stat-bar-item">
          <span className={`stat-bar-value${stats.openActions > 0 ? ' amber' : ''}`}>{stats.openActions}</span>
          <span className="stat-bar-label">Open Actions</span>
        </div>
        <div className="stat-bar-item">
          <span className={`stat-bar-value${stats.overdueActions > 0 ? ' amber' : ''}`}>{stats.overdueActions}</span>
          <span className="stat-bar-label">Overdue</span>
        </div>
        <div className="stat-bar-item">
          <span className="stat-bar-value">{contacts.length}</span>
          <span className="stat-bar-label">Contacts</span>
        </div>
      </div>

      {/* Two-panel split */}
      <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', flex: 1, overflow: 'hidden' }}>
        {/* Recent Meetings */}
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto' }}>
          <div className="group-header">
            <span>Recent Meetings</span>
            <Link href="/meetings" style={{ textDecoration: 'none', color: '#52525b', fontSize: 9 }}>View all →</Link>
          </div>
          {/* Table header */}
          <div className="table-header" style={{ gridTemplateColumns: '48px 1fr 90px 48px 48px' }}>
            <span>Date</span>
            <span>Title</span>
            <span>Company</span>
            <span>Ppl</span>
            <span>Act</span>
          </div>
          {recentMeetings.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <span className="cell-meta">No meetings yet</span>
            </div>
          ) : (
            recentMeetings.map((m) => {
              const parts = parseParticipants(m.participants);
              const isSelected = selectedMeeting?.id === m.id && panelType === 'meeting';
              return (
                <div
                  key={m.id}
                  className={`table-row${isSelected ? ' selected' : ''}`}
                  style={{ gridTemplateColumns: '48px 1fr 90px 48px 48px' }}
                  onClick={() => openMeetingPanel(m)}
                >
                  <span className="cell-meta" style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>
                    {formatDate(m.meetingDate)}
                  </span>
                  <span className="cell-primary">{m.title}</span>
                  <span className="cell-secondary">{m.companyName ?? '—'}</span>
                  <span className="cell-meta" style={{ textAlign: 'center' }}>{parts.length || '—'}</span>
                  <span className="cell-meta" style={{ textAlign: 'center' }}>
                    {(actionCounts[m.id] ?? 0) > 0 ? (
                      <span style={{ color: '#d97706' }}>{actionCounts[m.id]}</span>
                    ) : '—'}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Open Action Items */}
        <div style={{ overflowY: 'auto' }}>
          <div className="group-header">
            <span>Open Actions</span>
            <Link href="/action-items" style={{ textDecoration: 'none', color: '#52525b', fontSize: 9 }}>View all →</Link>
          </div>
          {/* Table header */}
          <div className="table-header" style={{ gridTemplateColumns: '64px 80px 1fr 80px' }}>
            <span>Status</span>
            <span>Assignee</span>
            <span>Task</span>
            <span>Meeting</span>
          </div>
          {openActions.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <span className="cell-meta">No open actions</span>
            </div>
          ) : (
            openActions.map((a) => {
              const status = a.status ?? 'open';
              const isSelected = selectedAction?.id === a.id && panelType === 'action';
              return (
                <div
                  key={a.id}
                  className={`table-row${isSelected ? ' selected' : ''}`}
                  style={{ gridTemplateColumns: '64px 80px 1fr 80px' }}
                  onClick={() => openActionPanel(a)}
                >
                  <span
                    className={`badge-${status}`}
                    onClick={(e) => handleStatusCycle(a, e)}
                    title="Click to cycle status"
                  >
                    {status}
                  </span>
                  <span className="cell-meta">{a.assignee ?? '—'}</span>
                  <span className="cell-primary">{a.title}</span>
                  <span className="cell-meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.meetingTitle ?? '—'}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <DetailPanel open={panelOpen} onClose={closePanel} title={panelTitle}>
        {panelType === 'meeting' && selectedMeeting && (
          <MeetingDetail meeting={selectedMeeting} actionItems={meetingActionItems} onStatusChange={(id, status) => {
            setItems((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
          }} />
        )}
        {panelType === 'action' && selectedAction && (
          <ActionDetail item={selectedAction} onSave={(updated) => {
            setItems((prev) => prev.map((i) => i.id === updated.id ? { ...i, ...updated } : i));
            setSelectedAction(updated);
          }} />
        )}
      </DetailPanel>
    </div>
  );
}

function MeetingDetail({ meeting, actionItems, onStatusChange }: {
  meeting: Meeting;
  actionItems: ActionItem[];
  onStatusChange: (id: string, status: string) => void;
}) {
  const parts = parseParticipants(meeting.participants);

  const handleCycle = async (item: ActionItem) => {
    const newStatus = cycleStatus(item.status);
    onStatusChange(item.id, newStatus);
    try {
      await fetch(`/api/action-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch { /* ignore */ }
  };

  return (
    <>
      <div>
        <div className="detail-section-label">Date</div>
        <div className="detail-section-value">{formatDate(meeting.meetingDate)}</div>
      </div>
      {meeting.companyName && (
        <div>
          <div className="detail-section-label">Company</div>
          <div className="detail-section-value">{meeting.companyName}</div>
        </div>
      )}
      {meeting.source && (
        <div>
          <div className="detail-section-label">Source</div>
          <div className="detail-section-value">{meeting.source}</div>
        </div>
      )}
      {parts.length > 0 && (
        <div>
          <div className="detail-section-label">Participants ({parts.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {parts.map((p, i) => (
              <div key={i} style={{
                width: 24, height: 24, background: '#27272a', border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, fontWeight: 700, color: '#a1a1aa',
              }} title={p}>
                {p.slice(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      )}
      {meeting.aiSummary && (
        <div>
          <div className="detail-section-label">AI Summary</div>
          <div className="detail-section-value" style={{ color: '#a1a1aa', fontStyle: 'italic', lineHeight: 1.6 }}>
            {meeting.aiSummary}
          </div>
        </div>
      )}
      <div>
        <div className="detail-section-label">Action Items ({actionItems.length})</div>
        {actionItems.length === 0 ? (
          <div className="cell-meta" style={{ marginTop: 4 }}>No actions for this meeting</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 4 }}>
            {actionItems.map((a) => {
              const status = a.status ?? 'open';
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className={`badge-${status}`} onClick={() => handleCycle(a)} style={{ flexShrink: 0 }}>{status}</span>
                  <span className="cell-primary" style={{ flex: 1 }}>{a.title}</span>
                  {a.assignee && <span className="cell-meta">{a.assignee}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div style={{ paddingTop: 8 }}>
        <Link href={`/meetings/${meeting.id}`} style={{ textDecoration: 'none' }}>
          <button className="action-btn amber">Open Full Detail →</button>
        </Link>
      </div>
    </>
  );
}

function ActionDetail({ item, onSave }: {
  item: ActionItem;
  onSave: (updated: ActionItem) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [assignee, setAssignee] = useState(item.assignee ?? '');
  const [status, setStatus] = useState(item.status ?? 'open');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/action-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, assignee: assignee || null, status }),
      });
      if (res.ok) {
        const updated = await res.json() as ActionItem;
        onSave({ ...item, ...updated });
      }
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div>
        <div className="detail-section-label">Task</div>
        <textarea
          className="inline-textarea"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ marginTop: 4 }}
        />
      </div>
      <div>
        <div className="detail-section-label">Assignee</div>
        <input className="inline-input" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Unassigned" style={{ marginTop: 4 }} />
      </div>
      <div>
        <div className="detail-section-label">Status</div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', color: '#e5e5e7', fontSize: 11, padding: '4px 8px', marginTop: 4, outline: 'none' }}
        >
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </div>
      {item.meetingTitle && (
        <div>
          <div className="detail-section-label">Meeting</div>
          <div className="detail-section-value">{item.meetingTitle}</div>
        </div>
      )}
      <div style={{ paddingTop: 4 }}>
        <button className="action-btn amber" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </>
  );
}

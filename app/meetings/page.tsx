'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import DetailPanel from '@/components/DetailPanel';

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
  meetingId: string | null;
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

function getWeekLabel(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `Week of ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(monday)}`;
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

function cycleStatus(current: string | null): string {
  if (current === 'open') return 'in_progress';
  if (current === 'in_progress') return 'done';
  return 'open';
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/meetings').then((r) => r.ok ? r.json() : []),
      fetch('/api/action-items').then((r) => r.ok ? r.json() : []),
    ])
      .then(([m, a]) => {
        setMeetings(Array.isArray(m) ? m as Meeting[] : []);
        setActionItems(Array.isArray(a) ? a as ActionItem[] : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return meetings;
    const q = search.toLowerCase();
    return meetings.filter((m) =>
      m.title.toLowerCase().includes(q) ||
      (m.companyName?.toLowerCase().includes(q) ?? false)
    );
  }, [meetings, search]);

  // Group by week
  const grouped = useMemo(() => {
    const groups: Map<string, Meeting[]> = new Map();
    for (const m of filtered) {
      const label = getWeekLabel(m.meetingDate);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(m);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  const actionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of actionItems) {
      if (a.meetingId) counts[a.meetingId] = (counts[a.meetingId] ?? 0) + 1;
    }
    return counts;
  }, [actionItems]);

  const meetingActions = useMemo(() =>
    selected ? actionItems.filter((a) => a.meetingId === selected.id) : [],
    [actionItems, selected]
  );

  const stats = useMemo(() => ({
    total: meetings.length,
    week: meetings.filter((m) => isThisWeek(m.meetingDate)).length,
    month: meetings.filter((m) => isThisMonth(m.meetingDate)).length,
  }), [meetings]);

  const openPanel = (m: Meeting) => {
    setSelected(m);
    setEditTitle(m.title);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setSelected(null);
  };

  const handleSaveTitle = async () => {
    if (!selected || editTitle === selected.title) return;
    setSaving(true);
    try {
      await fetch(`/api/meetings/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle }),
      });
      setMeetings((prev) => prev.map((m) => m.id === selected.id ? { ...m, title: editTitle } : m));
      setSelected((prev) => prev ? { ...prev, title: editTitle } : null);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const handleCycleStatus = useCallback(async (item: ActionItem) => {
    const newStatus = cycleStatus(item.status);
    setActionItems((prev) => prev.map((a) => a.id === item.id ? { ...a, status: newStatus } : a));
    try {
      await fetch(`/api/action-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      setActionItems((prev) => prev.map((a) => a.id === item.id ? { ...a, status: item.status } : a));
    }
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="page-header">
        <span className="page-title">Meetings</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#e5e5e7',
              fontSize: 11,
              padding: '5px 10px',
              outline: 'none',
              width: 180,
            }}
          />
          <Link href="/import" style={{ textDecoration: 'none' }}>
            <button className="action-btn amber">+ New</button>
          </Link>
        </div>
      </div>

      {/* Stat bar */}
      <div className="stat-bar">
        <div className="stat-bar-item">
          <span className="stat-bar-value">{stats.total}</span>
          <span className="stat-bar-label">Total Meetings</span>
        </div>
        <div className="stat-bar-item">
          <span className="stat-bar-value">{stats.week}</span>
          <span className="stat-bar-label">This Week</span>
        </div>
        <div className="stat-bar-item">
          <span className="stat-bar-value">{stats.month}</span>
          <span className="stat-bar-label">This Month</span>
        </div>
      </div>

      {/* Table header */}
      <div className="table-header" style={{ gridTemplateColumns: '40px 1fr 120px 80px 60px 60px' }}>
        <span>Date</span>
        <span>Title</span>
        <span>Company</span>
        <span>People</span>
        <span>Actions</span>
        <span>Source</span>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: '32px 16px', textAlign: 'center' }}>
          <span className="cell-meta">Loading…</span>
        </div>
      ) : grouped.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center' }}>
          <span className="cell-meta">No meetings found</span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {grouped.map(([weekLabel, weekMeetings]) => (
            <div key={weekLabel}>
              <div className="group-header">
                <span>{weekLabel}</span>
                <span>{weekMeetings.length} meeting{weekMeetings.length !== 1 ? 's' : ''}</span>
              </div>
              {weekMeetings.map((m) => {
                const parts = parseParticipants(m.participants);
                const isSelected = selected?.id === m.id && panelOpen;
                return (
                  <div
                    key={m.id}
                    className={`table-row${isSelected ? ' selected' : ''}`}
                    style={{ gridTemplateColumns: '40px 1fr 120px 80px 60px 60px' }}
                    onClick={() => openPanel(m)}
                  >
                    <span className="cell-meta" style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}>
                      {formatDate(m.meetingDate)}
                    </span>
                    <span className="cell-primary">{m.title}</span>
                    <span className="cell-secondary">{m.companyName ?? '—'}</span>
                    <span className="cell-meta" style={{ textAlign: 'center' }}>{parts.length || '—'}</span>
                    <span className="cell-meta" style={{ textAlign: 'center' }}>
                      {(actionCounts[m.id] ?? 0) > 0
                        ? <span style={{ color: '#d97706' }}>{actionCounts[m.id]}</span>
                        : '—'}
                    </span>
                    <span className="cell-meta">{m.source ?? '—'}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Detail Panel */}
      <DetailPanel open={panelOpen} onClose={closePanel} title={selected?.title ?? ''}>
        {selected && (
          <>
            <div>
              <div className="detail-section-label">Title</div>
              <input
                className="inline-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleSaveTitle}
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <div className="detail-section-label">Date</div>
              <div className="detail-section-value">{formatDate(selected.meetingDate)}</div>
            </div>
            {selected.companyName && (
              <div>
                <div className="detail-section-label">Company</div>
                <div className="detail-section-value">{selected.companyName}</div>
              </div>
            )}
            {selected.source && (
              <div>
                <div className="detail-section-label">Source</div>
                <div className="detail-section-value">{selected.source}</div>
              </div>
            )}
            {parseParticipants(selected.participants).length > 0 && (
              <div>
                <div className="detail-section-label">Participants</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {parseParticipants(selected.participants).map((p, i) => (
                    <div key={i} style={{
                      padding: '2px 6px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)',
                      fontSize: 10, color: '#a1a1aa',
                    }}>
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selected.aiSummary && (
              <div>
                <div className="detail-section-label">AI Summary</div>
                <div className="detail-section-value" style={{ color: '#a1a1aa', fontStyle: 'italic', lineHeight: 1.6 }}>
                  {selected.aiSummary}
                </div>
              </div>
            )}
            <div>
              <div className="detail-section-label">Action Items ({meetingActions.length})</div>
              {meetingActions.length === 0 ? (
                <div className="cell-meta" style={{ marginTop: 4 }}>None</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 4 }}>
                  {meetingActions.map((a) => {
                    const s = a.status ?? 'open';
                    return (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span className={`badge-${s}`} onClick={() => handleCycleStatus(a)} style={{ flexShrink: 0 }}>{s}</span>
                        <span className="cell-primary" style={{ flex: 1 }}>{a.title}</span>
                        {a.assignee && <span className="cell-meta">{a.assignee}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button className="action-btn amber" onClick={handleSaveTitle} disabled={saving}>
                {saving ? 'Saving…' : 'Save Title'}
              </button>
              <Link href={`/meetings/${selected.id}`} style={{ textDecoration: 'none' }}>
                <button className="action-btn">Full Detail →</button>
              </Link>
            </div>
          </>
        )}
      </DetailPanel>
    </div>
  );
}

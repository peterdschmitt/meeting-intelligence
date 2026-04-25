'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import ResizableSplit from '@/components/ResizableSplit';

interface Meeting {
  id: string;
  title: string;
  meetingDate: string | null;
  participants: string[] | string | null;
  aiSummary?: string | null;
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [selectedActions, setSelectedActions] = useState<ActionItem[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/meetings')
      .then((r) => r.ok ? r.json() : [])
      .then((m) => setMeetings(Array.isArray(m) ? m as Meeting[] : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch action items when a meeting is selected
  useEffect(() => {
    if (!selected) { setSelectedActions([]); return; }
    fetch(`/api/meetings/${selected.id}/action-items`)
      .then((r) => r.ok ? r.json() : [])
      .then((a) => setSelectedActions(Array.isArray(a) ? a as ActionItem[] : []))
      .catch(() => setSelectedActions([]));
  }, [selected]);

  const filtered = useMemo(() => {
    if (!search.trim()) return meetings;
    const q = search.toLowerCase();
    return meetings.filter((m) =>
      m.title.toLowerCase().includes(q) ||
      (m.companyName?.toLowerCase().includes(q) ?? false)
    );
  }, [meetings, search]);

  const grouped = useMemo(() => {
    const groups: Map<string, Meeting[]> = new Map();
    for (const m of filtered) {
      const label = getWeekLabel(m.meetingDate);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(m);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  // Action counts from all meetings (pre-load for display)
  const [allActionItems, setAllActionItems] = useState<ActionItem[]>([]);
  useEffect(() => {
    fetch('/api/action-items')
      .then((r) => r.ok ? r.json() : [])
      .then((a) => setAllActionItems(Array.isArray(a) ? a as ActionItem[] : []))
      .catch(() => {});
  }, []);

  const actionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of allActionItems) {
      if (a.meetingId) counts[a.meetingId] = (counts[a.meetingId] ?? 0) + 1;
    }
    return counts;
  }, [allActionItems]);

  const stats = useMemo(() => ({
    total: meetings.length,
    week: meetings.filter((m) => isThisWeek(m.meetingDate)).length,
    month: meetings.filter((m) => isThisMonth(m.meetingDate)).length,
  }), [meetings]);

  const handleCycleStatus = useCallback(async (item: ActionItem) => {
    const newStatus = cycleStatus(item.status);
    setSelectedActions((prev) => prev.map((a) => a.id === item.id ? { ...a, status: newStatus } : a));
    try {
      await fetch(`/api/action-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      setSelectedActions((prev) => prev.map((a) => a.id === item.id ? { ...a, status: item.status } : a));
    }
  }, []);

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const leftPane = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a' }}>
      {/* Page header */}
      <div className="page-header" style={{ background: '#0a0a0a' }}>
        <span className="page-title">MEETINGS</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="search-input"
          />
          <Link href="/import" style={{ textDecoration: 'none' }}>
            <button className="action-btn amber">NEW</button>
          </Link>
        </div>
      </div>

      {/* Stat bar */}
      <div className="stat-bar">
        <div className="stat-bar-item">
          <span className="stat-bar-value">{stats.total}</span>
          <span className="stat-bar-label">Total</span>
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

      {/* Grid header */}
      <div className="grid-header" style={{ gridTemplateColumns: '70px 1fr 110px 50px 50px' }}>
        <span>DATE</span>
        <span>TITLE</span>
        <span>COMPANY</span>
        <span>PPL</span>
        <span>ACT</span>
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
          {grouped.map(([weekLabel, weekMeetings]) => {
            const isCollapsed = collapsed.has(weekLabel);
            return (
              <div key={weekLabel}>
                <div className="group-header" onClick={() => toggleCollapse(weekLabel)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 8, color: '#52525b' }}>{isCollapsed ? '▶' : '▼'}</span>
                    {weekLabel}
                  </span>
                  <span>{weekMeetings.length} meeting{weekMeetings.length !== 1 ? 's' : ''}</span>
                </div>
                {!isCollapsed && weekMeetings.map((m) => {
                  const parts = parseParticipants(m.participants);
                  const isSelected = selected?.id === m.id;
                  return (
                    <div
                      key={m.id}
                      className={`grid-row${isSelected ? ' selected' : ''}`}
                      style={{ gridTemplateColumns: '70px 1fr 110px 50px 50px' }}
                      onClick={() => setSelected(isSelected ? null : m)}
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
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const rightPane = selected ? (
    <div className="detail-panel" style={{ background: '#111111' }}>
      <div className="detail-panel-header">
        <span className="detail-panel-title">{selected.title}</span>
        <button
          className="action-btn"
          onClick={() => setSelected(null)}
          style={{ flexShrink: 0, padding: '2px 8px' }}
        >
          ×
        </button>
      </div>
      <div className="detail-panel-body">
        {/* DATE */}
        <div>
          <div className="detail-section-label">DATE</div>
          <div className="detail-section-value">{formatDate(selected.meetingDate)}</div>
        </div>

        {/* COMPANY */}
        {selected.companyName && (
          <div>
            <div className="detail-section-label">COMPANY</div>
            <div className="detail-section-value">{selected.companyName}</div>
          </div>
        )}

        {/* SOURCE */}
        {selected.source && (
          <div>
            <div className="detail-section-label">SOURCE</div>
            <div className="detail-section-value">{selected.source}</div>
          </div>
        )}

        {/* PARTICIPANTS */}
        {parseParticipants(selected.participants).length > 0 && (
          <div>
            <div className="detail-section-label">PARTICIPANTS</div>
            <div className="avatar-row" style={{ marginTop: 6 }}>
              {parseParticipants(selected.participants).map((p, i) => (
                <div key={i} className="avatar" title={p}>
                  {p.slice(0, 2).toUpperCase()}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI SUMMARY */}
        {selected.aiSummary && (
          <div>
            <div className="detail-section-label">AI SUMMARY</div>
            <div className="detail-section-value" style={{ fontStyle: 'italic', lineHeight: 1.6 }}>
              {selected.aiSummary}
            </div>
          </div>
        )}

        {/* ACTION ITEMS */}
        <div>
          <div className="detail-section-label">ACTION ITEMS ({selectedActions.length})</div>
          {selectedActions.length === 0 ? (
            <div className="cell-meta" style={{ marginTop: 4 }}>None</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 6 }}>
              {selectedActions.map((a) => {
                const status = a.status ?? 'open';
                return (
                  <div
                    key={a.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <span
                      className={`badge badge-${status}`}
                      onClick={() => handleCycleStatus(a)}
                      style={{ flexShrink: 0 }}
                    >
                      {status}
                    </span>
                    <span className="cell-primary" style={{ flex: 1 }}>{a.title}</span>
                    {a.assignee && <span className="cell-meta">{a.assignee}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Full detail link */}
        <div style={{ paddingTop: 4 }}>
          <Link href={`/meetings/${selected.id}`} style={{ textDecoration: 'none' }}>
            <button className="action-btn amber">Open Full Detail →</button>
          </Link>
        </div>
      </div>
    </div>
  ) : (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111111' }}>
      <span className="cell-meta">← Select a meeting</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a' }}>
      <ResizableSplit
        left={leftPane}
        right={rightPane}
        defaultLeftPct={58}
        storageKey="meetings-split"
      />
    </div>
  );
}

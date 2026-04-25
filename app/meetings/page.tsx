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

function formatLong(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateStr));
}

function getWeekLabel(dateStr: string | null): string {
  if (!dateStr) return 'Undated';
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

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '·';
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [selectedActions, setSelectedActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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
    return meetings.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.companyName?.toLowerCase().includes(q) ?? false) ||
        (m.aiSummary?.toLowerCase().includes(q) ?? false),
    );
  }, [meetings, search]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Meeting[]>();
    const sorted = [...filtered].sort((a, b) => {
      const ad = a.meetingDate ? new Date(a.meetingDate).getTime() : 0;
      const bd = b.meetingDate ? new Date(b.meetingDate).getTime() : 0;
      return bd - ad;
    });
    for (const m of sorted) {
      const key = getWeekLabel(m.meetingDate);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  const actionCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of actionItems) {
      if (a.meetingId && a.status !== 'done') c[a.meetingId] = (c[a.meetingId] ?? 0) + 1;
    }
    return c;
  }, [actionItems]);

  const stats = useMemo(() => ({
    total: meetings.length,
    week: meetings.filter((m) => isThisWeek(m.meetingDate)).length,
    month: meetings.filter((m) => isThisMonth(m.meetingDate)).length,
    showing: filtered.length,
  }), [meetings, filtered]);

  const toggleCollapse = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const leftPane = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--apex-bg)', minWidth: 0 }}>
      <div className="apex-page-header">
        <span className="apex-page-title">All Meetings</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="inline-input"
            style={{ width: 200, height: 26 }}
          />
          <Link href="/import" className="btn btn-primary">
            <span className="material-symbols-outlined">add</span>
            Import
          </Link>
        </div>
      </div>

      <div className="apex-statbar">
        <div className="apex-stat"><span className="apex-stat-value">{stats.total}</span><span className="apex-stat-label">Total</span></div>
        <div className="apex-stat"><span className="apex-stat-value">{stats.week}</span><span className="apex-stat-label">This Week</span></div>
        <div className="apex-stat"><span className="apex-stat-value">{stats.month}</span><span className="apex-stat-label">This Month</span></div>
        <div className="apex-stat"><span className="apex-stat-value accent">{stats.showing}</span><span className="apex-stat-label">Showing</span></div>
      </div>

      <div className="apex-grid-header" style={{ gridTemplateColumns: '64px 1fr 130px 50px 50px' }}>
        <span>Date</span>
        <span>Title</span>
        <span>Company</span>
        <span style={{ textAlign: 'right' }}>Ppl</span>
        <span style={{ textAlign: 'right' }}>Act</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Empty msg="Loading…" />
        ) : grouped.length === 0 ? (
          <Empty msg="No meetings found" />
        ) : (
          grouped.map(([weekLabel, ms]) => {
            const isCollapsed = collapsed.has(weekLabel);
            return (
              <div key={weekLabel}>
                <div className="apex-group-header" onClick={() => toggleCollapse(weekLabel)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--apex-text-faint)' }}>{isCollapsed ? '▶' : '▼'}</span>
                    {weekLabel}
                  </span>
                  <span>{ms.length} {ms.length === 1 ? 'meeting' : 'meetings'}</span>
                </div>
                {!isCollapsed && ms.map((m) => {
                  const parts = parseParticipants(m.participants);
                  const isSelected = selected?.id === m.id;
                  const ac = actionCounts[m.id] ?? 0;
                  return (
                    <div
                      key={m.id}
                      className={`apex-grid-row${isSelected ? ' selected' : ''}`}
                      style={{ gridTemplateColumns: '64px 1fr 130px 50px 50px' }}
                      onClick={() => setSelected(isSelected ? null : m)}
                    >
                      <span className="cell-meta">{formatDate(m.meetingDate)}</span>
                      <span className="cell-primary">{m.title}</span>
                      <span className="cell-secondary">{m.companyName ?? '—'}</span>
                      <span className="cell-meta" style={{ textAlign: 'right' }}>{parts.length || '—'}</span>
                      <span className="cell-meta" style={{ textAlign: 'right', color: ac > 0 ? 'var(--apex-primary-bright)' : undefined }}>
                        {ac > 0 ? ac : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const rightPane = selected ? (
    <div className="detail-pane">
      <div className="detail-pane-header">
        <span className="apex-page-title" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected.title}
        </span>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <Link href={`/meetings/${selected.id}`} className="btn btn-ghost">
            Open
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
          <button className="btn-icon" onClick={() => setSelected(null)} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>

      <div className="detail-pane-body">
        {/* Meta */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <Meta label="Date" value={formatLong(selected.meetingDate)} />
          {selected.companyName && <Meta label="Company" value={selected.companyName} />}
          {selected.source && <Meta label="Source" value={selected.source} />}
        </div>

        {/* Participants */}
        {parseParticipants(selected.participants).length > 0 && (
          <div>
            <div className="detail-section-label">Participants ({parseParticipants(selected.participants).length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {parseParticipants(selected.participants).map((p, i) => (
                <Link key={i} href={`/contacts?q=${encodeURIComponent(p)}`} title={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px 3px 4px', background: 'rgba(255,255,255,0.025)', border: '1px solid var(--apex-border)', borderRadius: 12 }}>
                  <span className="avatar" style={{ width: 18, height: 18, fontSize: 8 }}>{initials(p)}</span>
                  <span style={{ fontSize: 11, color: 'var(--apex-text-secondary)' }}>{p}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* AI Summary */}
        {selected.aiSummary && (
          <div>
            <div className="detail-section-label">AI Summary</div>
            <p className="detail-section-value" style={{ fontSize: 12, color: 'var(--apex-text-secondary)', lineHeight: 1.6 }}>
              {selected.aiSummary}
            </p>
          </div>
        )}

        {/* Action items */}
        <div>
          <div className="detail-section-label">Action Items ({selectedActions.length})</div>
          {selectedActions.length === 0 ? (
            <span style={{ fontSize: 11, color: 'var(--apex-text-faint)' }}>None</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              {selectedActions.map((a) => {
                const status = a.status ?? 'open';
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--apex-border)' }}>
                    <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>
                    <span className={status === 'done' ? 'cell-done' : 'cell-primary'} style={{ flex: 1 }}>{a.title}</span>
                    {a.assignee && <span className="cell-meta" style={{ fontSize: 10 }}>{a.assignee.split(' ')[0]}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--apex-panel)', borderLeft: '1px solid var(--apex-border)' }}>
      <span style={{ fontSize: 11, color: 'var(--apex-text-faint)' }}>Select a meeting to preview</span>
    </div>
  );

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <ResizableSplit
        left={leftPane}
        right={rightPane}
        defaultLeftPct={60}
        minLeftPx={500}
        minRightPx={340}
        storageKey="meetings-split"
      />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="detail-section-label">{label}</div>
      <div className="detail-section-value" style={{ fontSize: 12 }}>{value}</div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--apex-text-faint)', fontSize: 12 }}>{msg}</div>;
}

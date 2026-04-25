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
  description?: string | null;
  status: string | null;
  assignee: string | null;
  meetingId: string | null;
  dueDate?: string | null;
  meetingTimestamp?: string | null;
}

const STATUS_OPTIONS = [
  { value: 'open',        label: 'OPEN',     color: '#f59e0b', bg: 'rgba(217,119,6,0.18)',  border: 'rgba(217,119,6,0.4)'  },
  { value: 'in_progress', label: 'IN PROG',  color: '#60a5fa', bg: 'rgba(59,130,246,0.18)', border: 'rgba(59,130,246,0.35)' },
  { value: 'done',        label: 'DONE',     color: '#4ade80', bg: 'rgba(74,222,128,0.15)', border: 'rgba(74,222,128,0.3)'  },
  { value: 'blocked',     label: 'BLOCKED',  color: '#f87171', bg: 'rgba(239,68,68,0.18)',  border: 'rgba(239,68,68,0.35)'  },
];

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

// ── Collapsible Section ───────────────────────────────────────────
function Section({
  label,
  count,
  defaultOpen = true,
  children,
}: {
  label: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rp-section">
      <div className="rp-section-header" onClick={() => setOpen((o) => !o)}>
        <span className="rp-section-title">
          {label}
          {count !== undefined && (
            <span className="rp-section-count">{count}</span>
          )}
        </span>
        <span className="rp-chevron" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
      </div>
      {open && <div className="rp-section-body">{children}</div>}
    </div>
  );
}

// ── Status Button Group ───────────────────────────────────────────
function StatusButtons({
  current,
  onChange,
}: {
  current: string | null;
  onChange: (v: string) => void;
}) {
  const active = current ?? 'open';
  return (
    <div className="status-btn-group">
      {STATUS_OPTIONS.map((opt) => {
        const isActive = active === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="status-btn"
            style={{
              color: isActive ? opt.color : 'rgba(255,255,255,0.25)',
              borderColor: isActive ? opt.border : 'rgba(255,255,255,0.07)',
              background: isActive ? opt.bg : 'transparent',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Task Row with Tooltip ─────────────────────────────────────────
function TaskRow({
  item,
  onStatusChange,
}: {
  item: ActionItem;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [hovering, setHovering] = useState(false);
  const hasDetail = !!(item.description || item.assignee || item.dueDate || item.meetingTimestamp);

  return (
    <div className="task-row">
      <div className="task-row-top">
        <div
          className="task-title-wrap"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          style={{ position: 'relative', flex: 1 }}
        >
          <span className="cell-primary">{item.title}</span>
          {hasDetail && hovering && (
            <div className="task-tooltip">
              {item.description && (
                <div className="task-tooltip-desc">{item.description}</div>
              )}
              {item.assignee && (
                <div className="task-tooltip-meta">
                  <span className="task-tooltip-label">ASSIGNEE</span> {item.assignee}
                </div>
              )}
              {item.dueDate && (
                <div className="task-tooltip-meta">
                  <span className="task-tooltip-label">DUE</span> {formatDate(item.dueDate)}
                </div>
              )}
              {item.meetingTimestamp && (
                <div className="task-tooltip-meta">
                  <span className="task-tooltip-label">TIMESTAMP</span> {item.meetingTimestamp}
                </div>
              )}
            </div>
          )}
        </div>
        {item.assignee && (
          <span className="cell-meta" style={{ flexShrink: 0, marginLeft: 8 }}>{item.assignee}</span>
        )}
      </div>
      <div style={{ marginTop: 5 }}>
        <StatusButtons
          current={item.status}
          onChange={(v) => onStatusChange(item.id, v)}
        />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [selectedActions, setSelectedActions] = useState<ActionItem[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [allActionItems, setAllActionItems] = useState<ActionItem[]>([]);

  useEffect(() => {
    fetch('/api/meetings')
      .then((r) => r.ok ? r.json() : [])
      .then((m) => setMeetings(Array.isArray(m) ? m as Meeting[] : []))
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

  useEffect(() => {
    fetch('/api/action-items')
      .then((r) => r.ok ? r.json() : [])
      .then((a) => setAllActionItems(Array.isArray(a) ? a as ActionItem[] : []))
      .catch(() => {});
  }, []);

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

  const handleStatusChange = useCallback(async (id: string, newStatus: string) => {
    setSelectedActions((prev) => prev.map((a) => a.id === id ? { ...a, status: newStatus } : a));
    try {
      await fetch(`/api/action-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      // revert not implemented — optimistic is fine here
    }
  }, []);

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Group action items by status for right panel
  const actionsByStatus = useMemo(() => {
    const open = selectedActions.filter((a) => !a.status || a.status === 'open');
    const inProg = selectedActions.filter((a) => a.status === 'in_progress');
    const done = selectedActions.filter((a) => a.status === 'done');
    const blocked = selectedActions.filter((a) => a.status === 'blocked');
    return { open, inProg, done, blocked };
  }, [selectedActions]);

  // ── Left pane ──────────────────────────────────────────────────
  const leftPane = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a' }}>
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

      <div className="grid-header" style={{ gridTemplateColumns: '70px 1fr 110px 50px 50px' }}>
        <span>DATE</span>
        <span>TITLE</span>
        <span>COMPANY</span>
        <span>PPL</span>
        <span>ACT</span>
      </div>

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

  // ── Right pane ─────────────────────────────────────────────────
  const rightPane = selected ? (
    <div className="detail-panel" style={{ background: '#111111', overflowY: 'auto' }}>
      {/* Header */}
      <div className="detail-panel-header">
        <span className="detail-panel-title">{selected.title}</span>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Link href={`/meetings/${selected.id}`} style={{ textDecoration: 'none' }}>
            <button className="action-btn amber" style={{ fontSize: 10 }}>FULL DETAIL →</button>
          </Link>
          <button className="action-btn" onClick={() => setSelected(null)} style={{ padding: '2px 8px' }}>×</button>
        </div>
      </div>

      <div className="detail-panel-body" style={{ padding: '0 0 32px 0' }}>

        {/* Meta strip */}
        <div className="rp-meta-strip">
          <div className="rp-meta-item">
            <span className="rp-meta-label">DATE</span>
            <span className="rp-meta-value">{formatDate(selected.meetingDate)}</span>
          </div>
          {selected.companyName && (
            <div className="rp-meta-item">
              <span className="rp-meta-label">COMPANY</span>
              <Link href={`/companies?q=${encodeURIComponent(selected.companyName)}`} style={{ textDecoration: 'none' }}>
                <span className="rp-meta-value rp-link">{selected.companyName}</span>
              </Link>
            </div>
          )}
          {selected.source && (
            <div className="rp-meta-item">
              <span className="rp-meta-label">SOURCE</span>
              <span className="rp-meta-value">{selected.source}</span>
            </div>
          )}
        </div>

        {/* Participants */}
        {parseParticipants(selected.participants).length > 0 && (
          <Section label="PARTICIPANTS" count={parseParticipants(selected.participants).length}>
            <div className="avatar-row" style={{ paddingBottom: 4 }}>
              {parseParticipants(selected.participants).map((p, i) => (
                <Link key={i} href={`/contacts?q=${encodeURIComponent(p)}`} style={{ textDecoration: 'none' }}>
                  <div className="avatar avatar-link" title={p}>
                    {p.slice(0, 2).toUpperCase()}
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* AI Summary */}
        {selected.aiSummary && (
          <Section label="AI SUMMARY" defaultOpen={true}>
            <p className="rp-summary-text">{selected.aiSummary}</p>
          </Section>
        )}

        {/* Action Items */}
        <Section label="ACTION ITEMS" count={selectedActions.length} defaultOpen={true}>
          {selectedActions.length === 0 ? (
            <span className="cell-meta">None</span>
          ) : (
            <>
              {/* Quick status filter pills */}
              <div className="rp-status-summary">
                {actionsByStatus.open.length > 0 && (
                  <span className="badge badge-open">{actionsByStatus.open.length} open</span>
                )}
                {actionsByStatus.inProg.length > 0 && (
                  <span className="badge badge-in_progress">{actionsByStatus.inProg.length} in progress</span>
                )}
                {actionsByStatus.blocked.length > 0 && (
                  <span className="badge badge-blocked">{actionsByStatus.blocked.length} blocked</span>
                )}
                {actionsByStatus.done.length > 0 && (
                  <span className="badge badge-done">{actionsByStatus.done.length} done</span>
                )}
              </div>
              <div className="task-list">
                {selectedActions.map((a) => (
                  <TaskRow key={a.id} item={a} onStatusChange={handleStatusChange} />
                ))}
              </div>
            </>
          )}
        </Section>

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

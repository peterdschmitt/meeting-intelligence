'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DetailPanel from '@/components/DetailPanel';

interface ActionItem {
  id: string;
  title: string;
  status: string | null;
  assignee: string | null;
  dueDate: string | null;
  priority: string | null;
  meetingId: string | null;
  meetingTitle?: string | null;
  description?: string | null;
}

type Filter = 'all' | 'open' | 'in_progress' | 'done';

function formatDue(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < 0) return `${Math.abs(diffDays)}d ago`;
  if (diffDays <= 7) return `In ${diffDays}d`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
}

function cycleStatus(current: string | null): string {
  if (current === 'open') return 'in_progress';
  if (current === 'in_progress') return 'done';
  return 'open';
}

export default function ActionItemsPage() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Detail panel state
  const [selected, setSelected] = useState<ActionItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editStatus, setEditStatus] = useState('open');
  const [editDue, setEditDue] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/action-items');
      if (!res.ok) throw new Error();
      const data: ActionItem[] = await res.json();
      setItems(data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const assignees = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.assignee) set.add(item.assignee);
    }
    return Array.from(set).sort();
  }, [items]);

  const visible = useMemo(() => {
    let result = items;
    if (filter === 'open') result = result.filter((i) => i.status === 'open' || i.status === null);
    else if (filter === 'in_progress') result = result.filter((i) => i.status === 'in_progress');
    else if (filter === 'done') result = result.filter((i) => i.status === 'done');
    if (assigneeFilter !== 'all') result = result.filter((i) => i.assignee === assigneeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        (i.assignee?.toLowerCase().includes(q) ?? false) ||
        (i.meetingTitle?.toLowerCase().includes(q) ?? false)
      );
    }
    return result;
  }, [items, filter, assigneeFilter, search]);

  const counts = useMemo(() => ({
    all: items.length,
    open: items.filter((i) => i.status === 'open' || i.status === null).length,
    in_progress: items.filter((i) => i.status === 'in_progress').length,
    done: items.filter((i) => i.status === 'done').length,
  }), [items]);

  // Group by meeting
  const grouped = useMemo(() => {
    const groups = new Map<string, ActionItem[]>();
    for (const item of visible) {
      const key = item.meetingTitle ?? '(No Meeting)';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries());
  }, [visible]);

  const handleCycleStatus = useCallback(async (item: ActionItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = cycleStatus(item.status);
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: newStatus } : i));
    if (selected?.id === item.id) setEditStatus(newStatus);
    try {
      await fetch(`/api/action-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: item.status } : i));
    }
  }, [selected]);

  const openPanel = (item: ActionItem) => {
    setSelected(item);
    setEditTitle(item.title);
    setEditAssignee(item.assignee ?? '');
    setEditStatus(item.status ?? 'open');
    setEditDue(item.dueDate ?? '');
    setEditNotes(item.description ?? '');
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setSelected(null);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/action-items/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          assignee: editAssignee || null,
          status: editStatus,
          dueDate: editDue || null,
          description: editNotes || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json() as ActionItem;
        setItems((prev) => prev.map((i) => i.id === selected.id ? { ...i, ...updated } : i));
        setSelected((prev) => prev ? { ...prev, ...updated } : null);
      }
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'open', label: `Open (${counts.open})` },
    { key: 'in_progress', label: `In Progress (${counts.in_progress})` },
    { key: 'done', label: `Done (${counts.done})` },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="page-header">
        <span className="page-title">Action Items</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
              width: 160,
            }}
          />
          {/* Filter buttons */}
          <div style={{ display: 'flex', gap: 4 }}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`action-btn${filter === f.key ? ' amber' : ''}`}
                style={{ padding: '4px 8px' }}
              >
                {f.label}
              </button>
            ))}
          </div>
          {/* Assignee filter */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            style={{
              background: '#111',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#a1a1aa',
              fontSize: 10,
              padding: '4px 8px',
              outline: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            <option value="all">All Assignees</option>
            {assignees.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stat bar */}
      <div className="stat-bar">
        <div className="stat-bar-item">
          <span className={`stat-bar-value${counts.open > 0 ? ' amber' : ''}`}>{counts.open}</span>
          <span className="stat-bar-label">Open</span>
        </div>
        <div className="stat-bar-item">
          <span className="stat-bar-value">{counts.in_progress}</span>
          <span className="stat-bar-label">In Progress</span>
        </div>
        <div className="stat-bar-item">
          <span className="stat-bar-value">{counts.done}</span>
          <span className="stat-bar-label">Done</span>
        </div>
        <div className="stat-bar-item">
          <span className="stat-bar-value">{counts.all}</span>
          <span className="stat-bar-label">Total</span>
        </div>
      </div>

      {/* Table header */}
      <div className="table-header" style={{ gridTemplateColumns: '70px 1fr 120px 80px 140px' }}>
        <span>Status</span>
        <span>Task</span>
        <span>Assignee</span>
        <span>Due</span>
        <span>Meeting</span>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: '32px 16px', textAlign: 'center' }}>
          <span className="cell-meta">Loading…</span>
        </div>
      ) : grouped.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center' }}>
          <span className="cell-meta">No items in this view</span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {grouped.map(([meetingTitle, groupItems]) => {
            const isCollapsed = collapsed.has(meetingTitle);
            return (
              <div key={meetingTitle}>
                <div
                  className="group-header"
                  onClick={() => toggleCollapse(meetingTitle)}
                  style={{ cursor: 'pointer' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 8, color: '#52525b' }}>{isCollapsed ? '▶' : '▼'}</span>
                    {meetingTitle}
                  </span>
                  <span>{groupItems.length} item{groupItems.length !== 1 ? 's' : ''}</span>
                </div>
                {!isCollapsed && groupItems.map((item) => {
                  const status = item.status ?? 'open';
                  const isSelected = selected?.id === item.id && panelOpen;
                  const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && status !== 'done';
                  return (
                    <div
                      key={item.id}
                      className={`table-row${isSelected ? ' selected' : ''}`}
                      style={{ gridTemplateColumns: '70px 1fr 120px 80px 140px' }}
                      onClick={() => openPanel(item)}
                    >
                      <span
                        className={`badge-${status}`}
                        onClick={(e) => handleCycleStatus(item, e)}
                        title="Click to cycle status"
                      >
                        {status}
                      </span>
                      <span
                        className="cell-primary"
                        style={{ textDecoration: status === 'done' ? 'line-through' : 'none', color: status === 'done' ? '#52525b' : '#e5e5e7' }}
                      >
                        {item.title}
                      </span>
                      <span className="cell-meta">{item.assignee ?? '—'}</span>
                      <span className="cell-meta" style={{ color: isOverdue ? '#d97706' : undefined }}>
                        {formatDue(item.dueDate)}
                      </span>
                      <span className="cell-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.meetingTitle ?? '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Panel */}
      <DetailPanel open={panelOpen} onClose={closePanel} title={selected?.title ?? ''}>
        {selected && (
          <>
            <div>
              <div className="detail-section-label">Task</div>
              <textarea
                className="inline-textarea"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <div className="detail-section-label">Assignee</div>
              <input
                className="inline-input"
                value={editAssignee}
                onChange={(e) => setEditAssignee(e.target.value)}
                placeholder="Unassigned"
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <div className="detail-section-label">Status</div>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                style={{
                  background: '#111',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e5e5e7',
                  fontSize: 11,
                  padding: '4px 8px',
                  marginTop: 4,
                  outline: 'none',
                }}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div>
              <div className="detail-section-label">Due Date</div>
              <input
                type="date"
                className="inline-input"
                value={editDue}
                onChange={(e) => setEditDue(e.target.value)}
                style={{ marginTop: 4, colorScheme: 'dark' }}
              />
            </div>
            {selected.meetingTitle && (
              <div>
                <div className="detail-section-label">Meeting</div>
                <div className="detail-section-value">{selected.meetingTitle}</div>
              </div>
            )}
            <div>
              <div className="detail-section-label">Notes</div>
              <textarea
                className="inline-textarea"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add notes…"
                style={{ marginTop: 4 }}
              />
            </div>
            <div style={{ paddingTop: 4 }}>
              <button className="action-btn amber" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </DetailPanel>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ResizableSplit from '@/components/ResizableSplit';

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
  notes?: string | null;
  createdAt?: string | null;
}

interface HistoryEntry {
  id: string;
  oldStatus: string | null;
  newStatus: string;
  note: string | null;
  changedAt: string;
}

interface OutreachEntry {
  id: string;
  assignee: string | null;
  messageSent: string;
  sentAt: string;
  responseReceived: string | null;
}

type Filter = 'all' | 'open' | 'in_progress' | 'done';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dateStr));
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
  const [editTitle, setEditTitle] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editStatus, setEditStatus] = useState('open');
  const [originalStatus, setOriginalStatus] = useState('open');
  const [statusNote, setStatusNote] = useState('');
  const [editDue, setEditDue] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [applyingStatus, setApplyingStatus] = useState(false);

  // History + outreach
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [outreach, setOutreach] = useState<OutreachEntry[]>([]);
  const [generatedMsg, setGeneratedMsg] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loggedMsgId, setLoggedMsgId] = useState<string | null>(null);

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

  // Fetch history + outreach when item selected
  useEffect(() => {
    if (!selected) {
      setHistory([]);
      setOutreach([]);
      setGeneratedMsg('');
      return;
    }
    fetch(`/api/action-items/${selected.id}/history`)
      .then((r) => r.ok ? r.json() : [])
      .then((h) => setHistory(Array.isArray(h) ? h : []))
      .catch(() => setHistory([]));
    fetch(`/api/action-items/${selected.id}/outreach`)
      .then((r) => r.ok ? r.json() : [])
      .then((o) => setOutreach(Array.isArray(o) ? o : []))
      .catch(() => setOutreach([]));
  }, [selected]);

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

  const openDetail = (item: ActionItem) => {
    setSelected(item);
    setEditTitle(item.title);
    setEditAssignee(item.assignee ?? '');
    setEditStatus(item.status ?? 'open');
    setOriginalStatus(item.status ?? 'open');
    setStatusNote('');
    setEditDue(item.dueDate ?? '');
    setEditNotes(item.notes ?? item.description ?? '');
    setGeneratedMsg('');
    setLoggedMsgId(null);
  };

  const closeDetail = () => setSelected(null);

  const handleApplyStatus = async () => {
    if (!selected) return;
    setApplyingStatus(true);
    try {
      await fetch(`/api/action-items/${selected.id}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus: editStatus, oldStatus: originalStatus, note: statusNote }),
      });
      setItems((prev) => prev.map((i) => i.id === selected.id ? { ...i, status: editStatus } : i));
      setSelected((prev) => prev ? { ...prev, status: editStatus } : null);
      setOriginalStatus(editStatus);
      setStatusNote('');
      // Refresh history
      const h = await fetch(`/api/action-items/${selected.id}/history`).then((r) => r.ok ? r.json() : []);
      setHistory(Array.isArray(h) ? h : []);
    } catch { /* ignore */ } finally {
      setApplyingStatus(false);
    }
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
          notes: editNotes || null,
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

  const handleGenerate = async () => {
    if (!selected) return;
    setGenerating(true);
    setGeneratedMsg('');
    setLoggedMsgId(null);
    try {
      const res = await fetch(`/api/action-items/${selected.id}/outreach`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (res.ok) {
        const data = await res.json();
        setGeneratedMsg(data.message ?? '');
        setLoggedMsgId(data.logId ?? null);
        // Refresh outreach log
        const o = await fetch(`/api/action-items/${selected.id}/outreach`).then((r) => r.ok ? r.json() : []);
        setOutreach(Array.isArray(o) ? o : []);
      }
    } catch { /* ignore */ } finally {
      setGenerating(false);
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
    { key: 'all', label: 'ALL' },
    { key: 'open', label: 'OPEN' },
    { key: 'in_progress', label: 'IN PROGRESS' },
    { key: 'done', label: 'DONE' },
  ];

  const leftPane = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a' }}>
      {/* Page header */}
      <div className="page-header" style={{ background: '#0a0a0a' }}>
        <span className="page-title">ACTION ITEMS</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="search-input"
          />
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`filter-btn${filter === f.key ? ' active' : ''}`}
            >
              {f.label}
            </button>
          ))}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="inline-select"
            style={{ width: 130 }}
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

      {/* Grid header */}
      <div className="grid-header" style={{ gridTemplateColumns: '64px 70px 110px 1fr 120px' }}>
        <span>STATUS</span>
        <span>DATE</span>
        <span>ASSIGNEE</span>
        <span>TASK</span>
        <span>MEETING</span>
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
                <div className="group-header" onClick={() => toggleCollapse(meetingTitle)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 8, color: '#52525b' }}>{isCollapsed ? '▶' : '▼'}</span>
                    {meetingTitle}
                  </span>
                  <span>{groupItems.length} item{groupItems.length !== 1 ? 's' : ''}</span>
                </div>
                {!isCollapsed && groupItems.map((item) => {
                  const status = item.status ?? 'open';
                  const isSelected = selected?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`grid-row${isSelected ? ' selected' : ''}`}
                      style={{ gridTemplateColumns: '64px 70px 110px 1fr 120px' }}
                      onClick={() => openDetail(item)}
                    >
                      <span
                        className={`badge badge-${status}`}
                        onClick={(e) => handleCycleStatus(item, e)}
                        title="Click to cycle status"
                      >
                        {status}
                      </span>
                      <span className="cell-meta">{formatDate(item.createdAt)}</span>
                      <span className="cell-secondary">{item.assignee ?? '—'}</span>
                      <span className={status === 'done' ? 'cell-done' : 'cell-primary'}>{item.title}</span>
                      <span className="cell-meta">{item.meetingTitle ?? '—'}</span>
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
          onClick={closeDetail}
          style={{ flexShrink: 0, padding: '2px 8px' }}
        >
          ×
        </button>
      </div>
      <div className="detail-panel-body">
        {/* 1. TASK */}
        <div>
          <div className="detail-section-label">TASK</div>
          <textarea
            className="inline-textarea"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            style={{ marginTop: 4 }}
          />
        </div>

        {/* 2. ASSIGNEE */}
        <div>
          <div className="detail-section-label">ASSIGNEE</div>
          <input
            className="inline-input"
            value={editAssignee}
            onChange={(e) => setEditAssignee(e.target.value)}
            placeholder="Unassigned"
            style={{ marginTop: 4 }}
          />
        </div>

        {/* 3. STATUS */}
        <div>
          <div className="detail-section-label">STATUS</div>
          <select
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value)}
            className="inline-select"
            style={{ marginTop: 4 }}
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
            <option value="blocked">Blocked</option>
            <option value="deferred">Deferred</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* 4. NOTE ON CHANGE */}
        {editStatus !== originalStatus && (
          <div>
            <div className="detail-section-label">NOTE ON CHANGE</div>
            <textarea
              className="inline-textarea"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="Why is the status changing?"
              style={{ marginTop: 4, minHeight: 56 }}
            />
          </div>
        )}

        {/* 5. APPLY STATUS CHANGE */}
        {editStatus !== originalStatus && (
          <button
            className="action-btn amber"
            onClick={handleApplyStatus}
            disabled={applyingStatus}
          >
            {applyingStatus ? 'Applying…' : 'Apply Status Change'}
          </button>
        )}

        {/* 6. DUE DATE */}
        <div>
          <div className="detail-section-label">DUE DATE</div>
          <input
            type="date"
            className="inline-input"
            value={editDue}
            onChange={(e) => setEditDue(e.target.value)}
            style={{ marginTop: 4, colorScheme: 'dark' }}
          />
        </div>

        {/* 7. MEETING */}
        {selected.meetingTitle && (
          <div>
            <div className="detail-section-label">MEETING</div>
            <div className="cell-secondary" style={{ marginTop: 4 }}>{selected.meetingTitle}</div>
          </div>
        )}

        {/* 8. NOTES */}
        <div>
          <div className="detail-section-label">NOTES</div>
          <textarea
            className="inline-textarea"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="Add notes…"
            style={{ marginTop: 4 }}
          />
        </div>

        {/* 9. SAVE CHANGES */}
        <button
          className="action-btn amber"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        <div className="divider" />

        {/* 10. STATUS HISTORY */}
        <div>
          <div className="detail-section-label">Status History</div>
          {history.length === 0 ? (
            <div className="cell-meta" style={{ marginTop: 4 }}>No history yet</div>
          ) : (
            <div style={{ marginTop: 6 }}>
              <div className="history-row" style={{ marginBottom: 2 }}>
                <span className="cell-meta" style={{ fontWeight: 600 }}>WHEN</span>
                <span className="cell-meta" style={{ fontWeight: 600 }}>FROM</span>
                <span className="cell-meta" style={{ fontWeight: 600 }}>TO</span>
                <span className="cell-meta" style={{ fontWeight: 600 }}>NOTE</span>
              </div>
              {history.map((h) => (
                <div key={h.id} className="history-row">
                  <span className="cell-meta">{formatDate(h.changedAt)}</span>
                  <span className={`badge badge-${h.oldStatus ?? 'open'}`} style={{ fontSize: 8 }}>{h.oldStatus ?? '—'}</span>
                  <span className={`badge badge-${h.newStatus}`} style={{ fontSize: 8 }}>{h.newStatus}</span>
                  <span className="cell-meta">{h.note ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="divider" />

        {/* 11. AI OUTREACH */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="detail-section-label" style={{ marginBottom: 0 }}>AI Outreach</div>
            <button
              className="action-btn amber"
              onClick={handleGenerate}
              disabled={generating}
              style={{ fontSize: 9, padding: '3px 8px' }}
            >
              {generating ? 'Generating…' : '⚡ Generate'}
            </button>
          </div>

          {/* Generated message for review */}
          {generatedMsg && (
            <div style={{ marginBottom: 10 }}>
              <div className="detail-section-label" style={{ marginBottom: 4 }}>GENERATED MESSAGE</div>
              <textarea
                className="inline-textarea"
                value={generatedMsg}
                onChange={(e) => setGeneratedMsg(e.target.value)}
                style={{ minHeight: 120 }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button
                  className="action-btn amber"
                  onClick={() => setGeneratedMsg('')}
                  style={{ fontSize: 9 }}
                >
                  Discard
                </button>
                {loggedMsgId && (
                  <span className="cell-meta" style={{ lineHeight: '24px' }}>✓ Logged as outreach</span>
                )}
              </div>
            </div>
          )}

          {/* Outreach log */}
          {outreach.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {outreach.map((o) => (
                <div key={o.id} className="outreach-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className="cell-secondary">{o.assignee ?? '—'}</span>
                    <span className="cell-meta">{formatDate(o.sentAt)}</span>
                  </div>
                  <div className="detail-section-value" style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>{o.messageSent}</div>
                  {o.responseReceived && (
                    <div style={{ marginTop: 8 }}>
                      <div className="detail-section-label">RESPONSE</div>
                      <div className="detail-section-value" style={{ fontSize: 11 }}>{o.responseReceived}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111111' }}>
      <span className="cell-meta">← Select an action item</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a' }}>
      <ResizableSplit
        left={leftPane}
        right={rightPane}
        defaultLeftPct={58}
        storageKey="actions-split"
      />
    </div>
  );
}

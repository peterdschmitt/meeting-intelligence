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
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
];

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(d));
}

function isOverdue(d: string | null | undefined): boolean {
  if (!d) return false;
  return new Date(d).getTime() < Date.now() - 24 * 60 * 60 * 1000;
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

export default function ActionItemsPage() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    if (!selected) { setHistory([]); setOutreach([]); setGeneratedMsg(''); return; }
    fetch(`/api/action-items/${selected.id}/history`).then((r) => r.ok ? r.json() : []).then((h) => setHistory(Array.isArray(h) ? h : [])).catch(() => setHistory([]));
    fetch(`/api/action-items/${selected.id}/outreach`).then((r) => r.ok ? r.json() : []).then((o) => setOutreach(Array.isArray(o) ? o : [])).catch(() => setOutreach([]));
  }, [selected]);

  const assignees = useMemo(() => {
    const s = new Set<string>();
    for (const i of items) if (i.assignee) s.add(i.assignee);
    return Array.from(s).sort();
  }, [items]);

  const visible = useMemo(() => {
    let r = items;
    if (filter === 'open') r = r.filter((i) => !i.status || i.status === 'open');
    else if (filter === 'in_progress') r = r.filter((i) => i.status === 'in_progress');
    else if (filter === 'done') r = r.filter((i) => i.status === 'done');
    if (assigneeFilter !== 'all') r = r.filter((i) => i.assignee === assigneeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        (i.assignee?.toLowerCase().includes(q) ?? false) ||
        (i.meetingTitle?.toLowerCase().includes(q) ?? false),
      );
    }
    return r;
  }, [items, filter, assigneeFilter, search]);

  const counts = useMemo(() => ({
    all: items.length,
    open: items.filter((i) => !i.status || i.status === 'open').length,
    in_progress: items.filter((i) => i.status === 'in_progress').length,
    done: items.filter((i) => i.status === 'done').length,
    overdue: items.filter((i) => i.status !== 'done' && isOverdue(i.dueDate)).length,
  }), [items]);

  const grouped = useMemo(() => {
    const g = new Map<string, ActionItem[]>();
    for (const i of visible) {
      const key = i.meetingTitle ?? '(No Meeting)';
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(i);
    }
    return Array.from(g.entries());
  }, [visible]);

  const toggleCollapse = (key: string) => {
    setCollapsed((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  const handleCycle = useCallback(async (item: ActionItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const ns = cycleStatus(item.status);
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: ns } : i));
    if (selected?.id === item.id) setEditStatus(ns);
    try {
      await fetch(`/api/action-items/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: ns }) });
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

  const handleApplyStatus = async () => {
    if (!selected) return;
    setApplyingStatus(true);
    try {
      await fetch(`/api/action-items/${selected.id}/history`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus: editStatus, oldStatus: originalStatus, note: statusNote }),
      });
      setItems((prev) => prev.map((i) => i.id === selected.id ? { ...i, status: editStatus } : i));
      setSelected((p) => p ? { ...p, status: editStatus } : null);
      setOriginalStatus(editStatus);
      setStatusNote('');
      const h = await fetch(`/api/action-items/${selected.id}/history`).then((r) => r.ok ? r.json() : []);
      setHistory(Array.isArray(h) ? h : []);
    } catch { /* ignore */ } finally { setApplyingStatus(false); }
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/action-items/${selected.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, assignee: editAssignee || null, status: editStatus, dueDate: editDue || null, notes: editNotes || null }),
      });
      if (res.ok) {
        const u = await res.json() as ActionItem;
        setItems((prev) => prev.map((i) => i.id === selected.id ? { ...i, ...u } : i));
        setSelected((p) => p ? { ...p, ...u } : null);
      }
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const handleGenerate = async () => {
    if (!selected) return;
    setGenerating(true); setGeneratedMsg(''); setLoggedMsgId(null);
    try {
      const res = await fetch(`/api/action-items/${selected.id}/outreach`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (res.ok) {
        const data = await res.json();
        setGeneratedMsg(data.message ?? '');
        setLoggedMsgId(data.logId ?? null);
        const o = await fetch(`/api/action-items/${selected.id}/outreach`).then((r) => r.ok ? r.json() : []);
        setOutreach(Array.isArray(o) ? o : []);
      }
    } catch { /* ignore */ } finally { setGenerating(false); }
  };

  // Left pane — dense table
  const leftPane = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--apex-bg)', minWidth: 0 }}>
      <div className="apex-page-header">
        <span className="apex-page-title">Action Items</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input className="inline-input" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 180, height: 26 }} />
          <select className="inline-select" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} style={{ width: 130 }}>
            <option value="all">All Assignees</option>
            {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="apex-statbar">
        <div className="apex-stat"><span className={`apex-stat-value${counts.open > 0 ? ' warn' : ''}`}>{counts.open}</span><span className="apex-stat-label">Open</span></div>
        <div className="apex-stat"><span className="apex-stat-value accent">{counts.in_progress}</span><span className="apex-stat-label">In Progress</span></div>
        <div className="apex-stat"><span className="apex-stat-value">{counts.done}</span><span className="apex-stat-label">Done</span></div>
        <div className="apex-stat"><span className={`apex-stat-value${counts.overdue > 0 ? ' error' : ''}`}>{counts.overdue}</span><span className="apex-stat-label">Overdue</span></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {FILTERS.map((f) => (
            <button key={f.key} className={`filter-btn${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
        </div>
      </div>

      <div className="apex-grid-header" style={{ gridTemplateColumns: '64px 70px 110px 1fr 110px 70px' }}>
        <span>Status</span>
        <span>Pri</span>
        <span>Owner</span>
        <span>Task</span>
        <span>Meeting</span>
        <span style={{ textAlign: 'right' }}>Due</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>Loading…</div>
        ) : grouped.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>No items</div>
        ) : (
          grouped.map(([key, list]) => {
            const isC = collapsed.has(key);
            return (
              <div key={key}>
                <div className="apex-group-header" onClick={() => toggleCollapse(key)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--apex-text-faint)' }}>{isC ? '▶' : '▼'}</span>
                    {key}
                  </span>
                  <span>{list.length}</span>
                </div>
                {!isC && list.map((i) => {
                  const status = i.status ?? 'open';
                  const priority = i.priority ?? 'medium';
                  const isSel = selected?.id === i.id;
                  const overdue = i.status !== 'done' && isOverdue(i.dueDate);
                  return (
                    <div
                      key={i.id}
                      className={`apex-grid-row${isSel ? ' selected' : ''}`}
                      style={{ gridTemplateColumns: '64px 70px 110px 1fr 110px 70px' }}
                      onClick={() => openDetail(i)}
                    >
                      <span className={`badge badge-${status}`} onClick={(e) => handleCycle(i, e)} title="Click to cycle">{status.replace('_', ' ')}</span>
                      <span className={`badge priority-${priority}`}>{priority.slice(0, 4)}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span className="avatar" style={{ width: 18, height: 18, fontSize: 8 }}>{initials(i.assignee)}</span>
                        <span className="cell-secondary" style={{ fontSize: 11 }}>{i.assignee?.split(' ')[0] ?? '—'}</span>
                      </span>
                      <span className={status === 'done' ? 'cell-done' : 'cell-primary'}>{i.title}</span>
                      <span className="cell-meta" style={{ fontSize: 10.5 }}>{i.meetingTitle ?? '—'}</span>
                      <span className="cell-meta" style={{ textAlign: 'right', color: overdue ? 'var(--apex-error)' : undefined }}>
                        {i.dueDate ? formatDate(i.dueDate) : '—'}
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

  // Right pane — detail
  const rightPane = selected ? (
    <div className="detail-pane">
      <div className="detail-pane-header">
        <span className="apex-page-title" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected.title}
        </span>
        <button className="btn-icon" onClick={() => setSelected(null)} aria-label="Close">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      </div>

      <div className="detail-pane-body">
        <Field label="Task">
          <textarea className="inline-input inline-textarea" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} rows={2} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Assignee">
            <input className="inline-input" value={editAssignee} onChange={(e) => setEditAssignee(e.target.value)} placeholder="Unassigned" />
          </Field>
          <Field label="Due Date">
            <input type="date" className="inline-input" value={editDue} onChange={(e) => setEditDue(e.target.value)} style={{ colorScheme: 'dark' }} />
          </Field>
        </div>

        <Field label="Status">
          <select className="inline-select" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
            <option value="blocked">Blocked</option>
            <option value="deferred">Deferred</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>

        {editStatus !== originalStatus && (
          <>
            <Field label="Note on Change">
              <textarea className="inline-input inline-textarea" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} rows={2} placeholder="Why is this changing?" />
            </Field>
            <button className="btn btn-primary" onClick={handleApplyStatus} disabled={applyingStatus}>
              {applyingStatus ? 'Applying…' : 'Apply Status'}
            </button>
          </>
        )}

        {selected.meetingTitle && (
          <Field label="Meeting">
            <span className="cell-secondary">{selected.meetingTitle}</span>
          </Field>
        )}

        <Field label="Notes">
          <textarea className="inline-input inline-textarea" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} placeholder="Add notes…" />
        </Field>

        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ width: '100%' }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        <div className="divider" />

        {/* History */}
        <div>
          <div className="detail-section-label">Status History ({history.length})</div>
          {history.length === 0 ? (
            <span style={{ fontSize: 11, color: 'var(--apex-text-faint)' }}>No history yet</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              {history.map((h) => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--apex-border)', fontSize: 11 }}>
                  <span className="cell-meta" style={{ minWidth: 56, fontSize: 10 }}>{formatDate(h.changedAt)}</span>
                  <span className={`badge badge-${h.oldStatus ?? 'open'}`}>{h.oldStatus ?? '—'}</span>
                  <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'var(--apex-text-faint)' }}>arrow_forward</span>
                  <span className={`badge badge-${h.newStatus}`}>{h.newStatus}</span>
                  {h.note && <span style={{ flex: 1, fontSize: 11, color: 'var(--apex-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>“{h.note}”</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="divider" />

        {/* Outreach */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div className="detail-section-label" style={{ marginBottom: 0 }}>AI Outreach ({outreach.length})</div>
            <button className="btn btn-ghost" onClick={handleGenerate} disabled={generating} style={{ height: 22, padding: '0 8px', fontSize: 10.5 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>auto_awesome</span>
              {generating ? 'Generating…' : 'Generate'}
            </button>
          </div>

          {generatedMsg && (
            <div style={{ marginBottom: 6 }}>
              <textarea className="inline-input inline-textarea" value={generatedMsg} onChange={(e) => setGeneratedMsg(e.target.value)} rows={5} />
              {loggedMsgId && <p style={{ fontSize: 10, color: 'var(--apex-emerald)', marginTop: 3 }}>✓ Logged to outreach</p>}
            </div>
          )}

          {outreach.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {outreach.map((o) => (
                <div key={o.id} className="apex-panel-flat" style={{ padding: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--apex-text)' }}>{o.assignee ?? '—'}</span>
                    <span className="cell-meta" style={{ fontSize: 10 }}>{formatDate(o.sentAt)}</span>
                  </div>
                  <p style={{ fontSize: 11.5, color: 'var(--apex-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{o.messageSent}</p>
                  {o.responseReceived && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--apex-border)' }}>
                      <div className="detail-section-label" style={{ marginBottom: 2 }}>Response</div>
                      <p style={{ fontSize: 11.5, color: 'var(--apex-text-secondary)' }}>{o.responseReceived}</p>
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
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--apex-panel)', borderLeft: '1px solid var(--apex-border)' }}>
      <span style={{ fontSize: 11, color: 'var(--apex-text-faint)' }}>Select an action to edit</span>
    </div>
  );

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <ResizableSplit
        left={leftPane}
        right={rightPane}
        defaultLeftPct={62}
        minLeftPx={520}
        minRightPx={360}
        storageKey="actions-split"
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="detail-section-label">{label}</div>
      {children}
    </div>
  );
}

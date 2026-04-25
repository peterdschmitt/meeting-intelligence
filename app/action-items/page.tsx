'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

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

type Filter = 'all' | 'pending' | 'done';

const STATUS_CHIP: Record<string, string> = {
  open: 'apex-chip-primary',
  in_progress: 'apex-chip-violet',
  done: 'apex-chip-emerald',
  blocked: 'apex-chip-error',
  deferred: 'apex-chip-violet',
  cancelled: 'apex-chip-error',
};

const PRIORITY_CHIP: Record<string, string> = {
  critical: 'apex-chip-error',
  high: 'apex-chip-error',
  medium: 'apex-chip-violet',
  low: 'apex-chip-primary',
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dateStr));
}

function relativeDue(dateStr: string | null | undefined): { label: string; tone: 'overdue' | 'soon' | 'normal' | 'none' } {
  if (!dateStr) return { label: 'No due date', tone: 'none' };
  const due = new Date(dateStr).getTime();
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  if (due < now - oneDay) {
    const days = Math.floor((now - due) / oneDay);
    return { label: `${days}d overdue`, tone: 'overdue' };
  }
  if (due < now + 2 * oneDay) {
    return { label: 'Due soon', tone: 'soon' };
  }
  return { label: formatDate(dateStr), tone: 'normal' };
}

function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function initials(name: string | null | undefined): string {
  if (!name) return '·';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '·';
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

  useEffect(() => {
    if (!selected) {
      setHistory([]);
      setOutreach([]);
      setGeneratedMsg('');
      return;
    }
    fetch(`/api/action-items/${selected.id}/history`).then((r) => r.ok ? r.json() : []).then((h) => setHistory(Array.isArray(h) ? h : [])).catch(() => setHistory([]));
    fetch(`/api/action-items/${selected.id}/outreach`).then((r) => r.ok ? r.json() : []).then((o) => setOutreach(Array.isArray(o) ? o : [])).catch(() => setOutreach([]));
  }, [selected]);

  const assignees = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) if (item.assignee) set.add(item.assignee);
    return Array.from(set).sort();
  }, [items]);

  const counts = useMemo(() => ({
    total: items.length,
    open: items.filter((i) => i.status !== 'done').length,
    done: items.filter((i) => i.status === 'done').length,
    dueToday: items.filter((i) => i.status !== 'done' && isToday(i.dueDate)).length,
    overdue: items.filter((i) => {
      if (i.status === 'done' || !i.dueDate) return false;
      return new Date(i.dueDate).getTime() < Date.now() - 24 * 60 * 60 * 1000;
    }).length,
  }), [items]);

  const completionRate = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

  const visible = useMemo(() => {
    let result = items;
    if (filter === 'pending') result = result.filter((i) => i.status !== 'done');
    if (filter === 'done') result = result.filter((i) => i.status === 'done');
    if (assigneeFilter !== 'all') result = result.filter((i) => i.assignee === assigneeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        (i.assignee?.toLowerCase().includes(q) ?? false) ||
        (i.meetingTitle?.toLowerCase().includes(q) ?? false),
      );
    }
    return result;
  }, [items, filter, assigneeFilter, search]);

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
        const o = await fetch(`/api/action-items/${selected.id}/outreach`).then((r) => r.ok ? r.json() : []);
        setOutreach(Array.isArray(o) ? o : []);
      }
    } catch { /* ignore */ } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '2rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <p className="apex-label-caps" style={{ marginBottom: '0.5rem' }}>Action Terminal</p>
          <h1 className="apex-h1" style={{ marginBottom: '0.375rem' }}>Action Items</h1>
          <p style={{ color: 'var(--apex-text-secondary)', fontSize: '0.9375rem' }}>
            Tracking {counts.total} action items across all meetings.
          </p>
        </div>
      </header>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <BigStat label="Total Items" value={counts.total} accent="primary" subtitle={`${counts.done} closed`} />
        <BigStat label="In Progress" value={counts.open} accent="violet" />
        <BigStat label="Due Today" value={counts.dueToday} accent={counts.dueToday > 0 ? 'error' : 'muted'} subtitle={counts.overdue > 0 ? `Overdue: ${counts.overdue}` : undefined} />
        <BigStat label="Completion Rate" value={`${completionRate}%`} accent="emerald" />
      </div>

      {/* Filter row */}
      <div className="apex-card" style={{ padding: '0.875rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          {(['all', 'pending', 'done'] as Filter[]).map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={active ? 'apex-btn-primary' : 'apex-btn-ghost'}
                style={{ fontSize: '0.75rem', padding: '0.375rem 0.875rem', textTransform: 'capitalize' }}
              >
                {f}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--apex-text-muted)' }}>search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search task, assignee, meeting..."
            className="apex-search"
            style={{ width: '100%' }}
          />
        </div>

        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--apex-border)',
            color: 'var(--apex-text)',
            padding: '0.375rem 0.75rem',
            borderRadius: '0.5rem',
            fontSize: '0.8125rem',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        >
          <option value="all">All Assignees</option>
          {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* List + side detail */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: '1.25rem', alignItems: 'flex-start' }}>
        <div className="apex-card" style={{ padding: '0.5rem', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 140px 110px 90px 32px', gap: '0.75rem', padding: '0.625rem 0.875rem', borderBottom: '1px solid var(--apex-border)' }}>
            <span />
            <span className="apex-label-caps">Task</span>
            <span className="apex-label-caps">Priority</span>
            <span className="apex-label-caps">Due</span>
            <span className="apex-label-caps">Owner</span>
            <span />
          </div>

          {loading ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--apex-text-muted)', fontSize: '0.8125rem' }}>Loading…</p>
          ) : visible.length === 0 ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--apex-text-muted)', fontSize: '0.8125rem' }}>No items match this view.</p>
          ) : (
            <div>
              {visible.map((item) => {
                const status = item.status ?? 'open';
                const due = relativeDue(item.dueDate);
                const isSelected = selected?.id === item.id;
                const isDone = status === 'done';
                const priorityChip = PRIORITY_CHIP[item.priority ?? 'medium'] ?? PRIORITY_CHIP.medium;

                return (
                  <button
                    key={item.id}
                    onClick={() => openDetail(item)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '24px 1fr 140px 110px 90px 32px',
                      gap: '0.75rem',
                      padding: '0.75rem 0.875rem',
                      width: '100%',
                      background: isSelected ? 'rgba(46,98,255,0.06)' : 'transparent',
                      border: 'none',
                      borderLeft: isSelected ? '2px solid var(--apex-primary)' : '2px solid transparent',
                      borderBottom: '1px solid var(--apex-border)',
                      color: 'var(--apex-text)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      alignItems: 'center',
                      transition: 'background 0.12s ease',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.025)'; }}
                    onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <span
                      onClick={(e) => handleCycleStatus(item, e)}
                      title="Click to cycle status"
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '9999px',
                        border: `1.5px solid ${isDone ? 'var(--apex-emerald)' : 'var(--apex-border-bright)'}`,
                        background: isDone ? 'var(--apex-emerald-soft)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isDone && <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'var(--apex-emerald)' }}>check</span>}
                    </span>

                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--apex-text)', textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.6 : 1, margin: 0, marginBottom: '0.125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                      </p>
                      {item.meetingTitle && (
                        <p className="apex-mono" style={{ fontSize: '0.6875rem', color: 'var(--apex-text-muted)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.meetingTitle}
                        </p>
                      )}
                    </div>

                    <span className={`apex-chip ${priorityChip}`}>{(item.priority ?? 'medium').toUpperCase()}</span>

                    <span
                      className="apex-mono"
                      style={{
                        fontSize: '0.75rem',
                        color: due.tone === 'overdue' ? 'var(--apex-error)' : due.tone === 'soon' ? 'var(--apex-violet)' : 'var(--apex-text-secondary)',
                      }}
                    >
                      {due.label}
                    </span>

                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', minWidth: 0 }}>
                      <Avatar name={item.assignee} />
                      <span style={{ fontSize: '0.6875rem', color: 'var(--apex-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.assignee?.split(' ')[0] ?? '—'}
                      </span>
                    </span>

                    <span className={`apex-chip ${STATUS_CHIP[status] ?? 'apex-chip-primary'}`} style={{ justifySelf: 'end', fontSize: '0.625rem' }}>
                      {status.replace('_', ' ').toUpperCase().slice(0, 3)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <p className="apex-label-caps" style={{ padding: '0.875rem', textAlign: 'center', color: 'var(--apex-text-muted)' }}>
            Showing {visible.length} of {counts.total}
          </p>
        </div>

        {/* Detail drawer */}
        {selected && (
          <aside className="apex-card-elevated" style={{ padding: '1.25rem', position: 'sticky', top: '1.5rem', maxHeight: 'calc(100vh - 8rem)', overflow: 'auto' }}>
            <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ minWidth: 0 }}>
                <p className="apex-label-caps" style={{ marginBottom: '0.25rem' }}>Action Detail</p>
                <h3 className="apex-h3" style={{ fontSize: '1rem', lineHeight: 1.3 }}>{selected.title}</h3>
              </div>
              <button
                onClick={closeDetail}
                aria-label="Close"
                style={{
                  width: 28, height: 28, borderRadius: '0.5rem',
                  background: 'transparent', border: '1px solid var(--apex-border)',
                  color: 'var(--apex-text-secondary)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <Field label="Task">
                <textarea
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  rows={2}
                  style={textareaStyle}
                />
              </Field>

              <Field label="Assignee">
                <input
                  value={editAssignee}
                  onChange={(e) => setEditAssignee(e.target.value)}
                  placeholder="Unassigned"
                  style={inputStyle}
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="Status">
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                    <option value="blocked">Blocked</option>
                    <option value="deferred">Deferred</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </Field>
                <Field label="Due Date">
                  <input
                    type="date"
                    value={editDue}
                    onChange={(e) => setEditDue(e.target.value)}
                    style={{ ...inputStyle, colorScheme: 'dark' }}
                  />
                </Field>
              </div>

              {editStatus !== originalStatus && (
                <>
                  <Field label="Note on Change">
                    <textarea
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="Why is the status changing?"
                      rows={2}
                      style={textareaStyle}
                    />
                  </Field>
                  <button onClick={handleApplyStatus} disabled={applyingStatus} className="apex-btn-primary">
                    {applyingStatus ? 'Applying…' : 'Apply Status Change'}
                  </button>
                </>
              )}

              <Field label="Notes">
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add notes…"
                  rows={3}
                  style={textareaStyle}
                />
              </Field>

              <button onClick={handleSave} disabled={saving} className="apex-btn-primary" style={{ width: '100%' }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>

              {/* History */}
              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--apex-border)' }}>
                <p className="apex-label-caps" style={{ marginBottom: '0.5rem' }}>Status History</p>
                {history.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: 'var(--apex-text-muted)' }}>No history yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {history.map((h) => (
                      <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                        <span className="apex-mono" style={{ color: 'var(--apex-text-muted)', minWidth: 64 }}>{formatDate(h.changedAt)}</span>
                        <span className={`apex-chip ${STATUS_CHIP[h.oldStatus ?? 'open'] ?? 'apex-chip-primary'}`} style={{ fontSize: '0.5625rem' }}>
                          {(h.oldStatus ?? '—').slice(0, 4).toUpperCase()}
                        </span>
                        <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--apex-text-muted)' }}>arrow_forward</span>
                        <span className={`apex-chip ${STATUS_CHIP[h.newStatus] ?? 'apex-chip-primary'}`} style={{ fontSize: '0.5625rem' }}>
                          {h.newStatus.slice(0, 4).toUpperCase()}
                        </span>
                        {h.note && (
                          <span style={{ fontSize: '0.6875rem', color: 'var(--apex-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                            “{h.note}”
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Outreach */}
              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--apex-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <p className="apex-label-caps">AI Outreach</p>
                  <button onClick={handleGenerate} disabled={generating} className="apex-btn-ghost" style={{ fontSize: '0.6875rem', padding: '0.25rem 0.625rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
                    {generating ? 'Generating…' : 'Generate'}
                  </button>
                </div>

                {generatedMsg && (
                  <div style={{ marginBottom: '0.625rem' }}>
                    <textarea
                      value={generatedMsg}
                      onChange={(e) => setGeneratedMsg(e.target.value)}
                      rows={6}
                      style={textareaStyle}
                    />
                    {loggedMsgId && (
                      <p style={{ fontSize: '0.6875rem', color: 'var(--apex-emerald)', marginTop: '0.25rem' }}>
                        ✓ Logged to outreach
                      </p>
                    )}
                  </div>
                )}

                {outreach.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {outreach.map((o) => (
                      <div key={o.id} className="apex-card-flat" style={{ padding: '0.625rem 0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--apex-text-secondary)', fontWeight: 600 }}>{o.assignee ?? '—'}</span>
                          <span className="apex-mono" style={{ fontSize: '0.625rem', color: 'var(--apex-text-muted)' }}>{formatDate(o.sentAt)}</span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--apex-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{o.messageSent}</p>
                        {o.responseReceived && (
                          <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--apex-border)' }}>
                            <p className="apex-label-caps" style={{ marginBottom: '0.25rem' }}>Response</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--apex-text-secondary)' }}>{o.responseReceived}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--apex-border)',
  color: 'var(--apex-text)',
  padding: '0.5rem 0.75rem',
  borderRadius: '0.5rem',
  fontSize: '0.8125rem',
  outline: 'none',
  fontFamily: 'inherit',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  fontFamily: 'inherit',
  lineHeight: 1.5,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="apex-label-caps" style={{ marginBottom: '0.375rem' }}>{label}</p>
      {children}
    </div>
  );
}

function BigStat({ label, value, accent, subtitle }: { label: string; value: number | string; accent: 'primary' | 'violet' | 'emerald' | 'error' | 'muted'; subtitle?: string }) {
  const colorMap = {
    primary: 'var(--apex-primary-bright)',
    violet: 'var(--apex-violet)',
    emerald: 'var(--apex-emerald)',
    error: 'var(--apex-error)',
    muted: 'var(--apex-text)',
  } as const;
  return (
    <div className="apex-card" style={{ padding: '1.125rem 1.25rem' }}>
      <p className="apex-label-caps" style={{ marginBottom: '0.5rem' }}>{label}</p>
      <p className="apex-mono" style={{ fontSize: '1.875rem', fontWeight: 700, color: colorMap[accent], lineHeight: 1, letterSpacing: '-0.02em' }}>
        {value}
      </p>
      {subtitle && (
        <p style={{ fontSize: '0.6875rem', color: 'var(--apex-text-muted)', marginTop: '0.5rem' }}>{subtitle}</p>
      )}
    </div>
  );
}

function Avatar({ name }: { name: string | null | undefined }) {
  return (
    <div
      style={{
        width: 22, height: 22,
        borderRadius: '9999px',
        background: 'var(--apex-primary-soft)',
        border: '1px solid var(--apex-border-bright)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.5625rem', fontWeight: 700, color: 'var(--apex-primary-bright)',
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  );
}

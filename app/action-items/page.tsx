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
}

type Filter = 'all' | 'open' | 'done';

function formatDueDate(dateStr: string | null): string {
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

export default function ActionItemsPage() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/action-items');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ActionItem[] = await res.json();
      setItems(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const visible = useMemo(() => {
    if (filter === 'open') return items.filter((i) => i.status !== 'done');
    if (filter === 'done') return items.filter((i) => i.status === 'done');
    return items;
  }, [items, filter]);

  const counts = useMemo(() => ({
    all: items.length,
    open: items.filter((i) => i.status !== 'done').length,
    done: items.filter((i) => i.status === 'done').length,
  }), [items]);

  const handleToggle = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newStatus = item.status === 'done' ? 'open' : 'done';

    // Optimistic update
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: newStatus } : i));
    setTogglingId(id);

    try {
      await fetch(`/api/action-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      // Revert
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: item.status } : i));
    } finally {
      setTogglingId(null);
    }
  }, [items]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'open', label: `Open (${counts.open})` },
    { key: 'done', label: `Done (${counts.done})` },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#050505' }}>
      {/* Top nav */}
      <div className="top-nav">
        <div className="amber-line">
          <span className="amber-tag">Action Items</span>
        </div>
        <button onClick={fetchItems} disabled={loading} className="btn-primary">
          Refresh
        </button>
      </div>

      <div className="main-content">
        {/* Heading */}
        <div style={{ marginBottom: '48px' }}>
          <h1 className="page-heading">Action Items.</h1>
          <p className="micro-label" style={{ marginTop: '12px' }}>
            {counts.open} open · {counts.done} completed
          </p>
        </div>

        {/* Filter tabs */}
        <div className="filter-tabs" style={{ marginBottom: '32px' }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`filter-tab${filter === f.key ? ' active' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <p className="micro-label">Loading…</p>
          </div>
        ) : (
          <div className="glass-panel">
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 140px 100px 140px',
                padding: '12px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <span className="micro-label">Task</span>
              <span className="micro-label">Assignee</span>
              <span className="micro-label">Status</span>
              <span className="micro-label">Meeting</span>
            </div>

            {visible.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <p className="micro-label">No items in this view</p>
              </div>
            ) : (
              visible.map((item) => {
                const isDone = item.status === 'done';
                const statusClass = isDone ? 'status-done' : (item.status === 'in_progress' ? 'status-in_progress' : 'status-open');
                return (
                  <div
                    key={item.id}
                    className="data-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 140px 100px 140px',
                      padding: '16px 24px',
                      alignItems: 'center',
                      opacity: isDone ? 0.6 : 1,
                    }}
                  >
                    {/* Task */}
                    <p
                      style={{
                        color: isDone ? '#52525b' : '#e5e5e7',
                        fontSize: '13px',
                        fontWeight: 500,
                        textDecoration: isDone ? 'line-through' : 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        paddingRight: '16px',
                      }}
                    >
                      {item.title}
                    </p>

                    {/* Assignee */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {item.assignee ? (
                        <>
                          <div
                            style={{
                              width: '22px', height: '22px',
                              background: '#27272a',
                              border: '1px solid rgba(255,255,255,0.08)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '8px', fontWeight: 700, color: '#a1a1aa', flexShrink: 0,
                            }}
                          >
                            {item.assignee.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="micro-label" style={{ color: '#71717a' }}>{item.assignee}</span>
                        </>
                      ) : (
                        <span className="micro-label">—</span>
                      )}
                    </div>

                    {/* Status — click to toggle */}
                    <button
                      onClick={() => handleToggle(item.id)}
                      disabled={togglingId === item.id}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                    >
                      <span className={statusClass}>{item.status ?? 'open'}</span>
                    </button>

                    {/* Meeting source */}
                    <span className="micro-label" style={{ color: '#52525b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.meetingTitle ?? '—'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

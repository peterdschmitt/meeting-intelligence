'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { isOverdue } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActionItemWithMeeting {
  id: string;
  title: string;
  priority: string | null;
  dueDate: string | null;
  status: string | null;
  assignee: string | null;
  meetingId: string | null;
  meetingTitle?: string | null;
}

type Filter = 'all' | 'pending' | 'done';
type SortKey = 'due_date' | 'priority' | 'meeting';

const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function isThisWeek(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
  if (diffDays <= 7) return `In ${diffDays} days`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
}

// ─── Priority badge colors ────────────────────────────────────────────────────

function priorityBadgeStyle(priority: string | null): React.CSSProperties {
  switch (priority?.toLowerCase()) {
    case 'critical':
    case 'high':
      return { background: 'rgba(255,180,171,0.15)', color: '#ffb4ab' };
    case 'medium':
      return { background: 'rgba(183,196,255,0.15)', color: '#b7c4ff' };
    case 'low':
    default:
      return { background: '#27272a', color: '#71717a' };
  }
}

// ─── Row animations ──────────────────────────────────────────────────────────

const rowVariants = {
  hidden:  { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
  exit:    { opacity: 0, x: -12, transition: { duration: 0.15 } },
};

// ─── Action Item Row ─────────────────────────────────────────────────────────

function ActionRow({
  item,
  onToggle,
  isToggling,
}: {
  item: ActionItemWithMeeting;
  onToggle: (id: string) => void;
  isToggling: boolean;
}) {
  const isDone = item.status === 'done';
  const overdue = !isDone && isOverdue(item.dueDate);

  return (
    <motion.div
      variants={rowVariants}
      layout
      className="action-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '2.5rem 1fr 9rem 9rem 6rem',
        alignItems: 'center',
        padding: '0.875rem 1.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        opacity: isDone ? 0.5 : 1,
        transition: 'background 150ms',
      }}
    >
      {/* Status checkbox */}
      <div>
        <button
          onClick={() => onToggle(item.id)}
          disabled={isToggling}
          title={isDone ? 'Completed' : 'Mark done'}
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            border: isDone ? 'none' : '1px solid rgba(255,255,255,0.2)',
            background: isDone ? '#2563eb' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'border-color 150ms',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (!isDone) (e.currentTarget as HTMLButtonElement).style.borderColor = '#3b82f6';
          }}
          onMouseLeave={(e) => {
            if (!isDone) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.2)';
          }}
        >
          {isDone ? (
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '13px',
                color: '#ffffff',
                fontVariationSettings: "'FILL' 1",
              }}
            >
              check
            </span>
          ) : (
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '13px', color: 'transparent' }}
            >
              check
            </span>
          )}
        </button>
      </div>

      {/* Title & source */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <span
          style={{
            fontSize: '0.9375rem',
            color: isDone ? '#71717a' : '#e4e4e7',
            fontWeight: 500,
            textDecoration: isDone ? 'line-through' : 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.title}
        </span>
        {item.meetingTitle && (
          <span
            style={{
              fontSize: '11px',
              color: isDone ? '#3f3f46' : '#52525b',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              textDecoration: isDone ? 'line-through' : 'none',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
              link
            </span>
            {item.meetingTitle}
          </span>
        )}
      </div>

      {/* Priority */}
      <div>
        <span
          className="badge"
          style={{
            ...priorityBadgeStyle(item.priority),
            fontSize: '9px',
          }}
        >
          {item.priority ?? 'medium'}
        </span>
      </div>

      {/* Due date */}
      <div>
        <span
          className="text-mono-data"
          style={{
            fontSize: '0.75rem',
            color: overdue ? '#ffb4ab' : '#71717a',
            textDecoration: isDone ? 'line-through' : 'none',
          }}
        >
          {formatDueDate(item.dueDate)}
        </span>
      </div>

      {/* Assignee */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {item.assignee ? (
          <div
            title={item.assignee}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#2e62ff',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '8px',
              fontWeight: 700,
              color: '#ffffff',
            }}
          >
            {item.assignee.slice(0, 2).toUpperCase()}
          </div>
        ) : (
          <div style={{ width: '24px' }} />
        )}
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ActionItemsPage() {
  const [items, setItems] = useState<ActionItemWithMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<SortKey>('due_date');
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  // Fetch
  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/action-items');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ActionItemWithMeeting[] = await res.json();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load action items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Counts
  const counts = useMemo(() => ({
    all:     items.length,
    pending: items.filter((i) => i.status !== 'done').length,
    done:    items.filter((i) => i.status === 'done').length,
    overdue: items.filter((i) => isOverdue(i.dueDate) && i.status !== 'done').length,
    week:    items.filter((i) => isThisWeek(i.dueDate) && i.status !== 'done').length,
  }), [items]);

  // Filter + sort
  const visible = useMemo(() => {
    let list = [...items];
    if (filter === 'pending') list = list.filter((i) => i.status !== 'done');
    else if (filter === 'done') list = list.filter((i) => i.status === 'done');

    list.sort((a, b) => {
      if (sort === 'due_date') {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sort === 'priority') {
        return (PRIORITY_RANK[a.priority ?? ''] ?? 99) - (PRIORITY_RANK[b.priority ?? ''] ?? 99);
      }
      if (sort === 'meeting') {
        return (a.meetingTitle ?? '').localeCompare(b.meetingTitle ?? '');
      }
      return 0;
    });
    return list;
  }, [items, filter, sort]);

  // Optimistic toggle
  const handleToggle = useCallback(async (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: item.status === 'done' ? 'open' : 'done' }
          : item
      )
    );
    setTogglingIds((s) => new Set(s).add(id));

    try {
      const current = items.find((i) => i.id === id);
      const newStatus = current?.status === 'done' ? 'open' : 'done';
      const res = await fetch(`/api/action-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      // revert
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: item.status === 'done' ? 'open' : 'done' }
            : item
        )
      );
    } finally {
      setTogglingIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }, [items]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all',     label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'done',    label: 'Completed' },
  ];

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'due_date',  label: 'Due Date' },
    { key: 'priority',  label: 'Priority' },
    { key: 'meeting',   label: 'Meeting' },
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '1440px' }}>
      {/* ── Metric Cards ───────────────────────────────────────── */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          marginBottom: '2rem',
        }}
      >
        {/* Total */}
        <div className="metric-card">
          <p className="text-label-caps" style={{ color: '#71717a', marginBottom: '0.5rem' }}>
            Total Tasks
          </p>
          <div className="flex items-end justify-between">
            <span className="text-h2" style={{ color: '#ffffff' }}>{counts.all}</span>
            <span className="text-xs font-medium" style={{ color: '#60a5fa' }}>
              +{counts.week} this week
            </span>
          </div>
        </div>

        {/* Pending */}
        <div className="metric-card">
          <p className="text-label-caps" style={{ color: '#71717a', marginBottom: '0.5rem' }}>
            Pending
          </p>
          <div className="flex items-end justify-between">
            <span className="text-h2" style={{ color: '#ffffff' }}>{counts.pending}</span>
            <span className="text-xs font-medium" style={{ color: '#71717a' }}>
              Open items
            </span>
          </div>
        </div>

        {/* Overdue */}
        <div className="metric-card">
          <p className="text-label-caps" style={{ color: '#71717a', marginBottom: '0.5rem' }}>
            Overdue
          </p>
          <div className="flex items-end justify-between">
            <span
              className="text-h2"
              style={{ color: counts.overdue > 0 ? '#ffb4ab' : '#34d399' }}
            >
              {counts.overdue}
            </span>
            <span
              className="text-xs font-medium"
              style={{ color: counts.overdue > 0 ? '#ffb4ab' : '#71717a' }}
            >
              {counts.overdue > 0 ? 'Needs attention' : 'All clear'}
            </span>
          </div>
        </div>

        {/* Completion */}
        <div className="metric-card">
          <p className="text-label-caps" style={{ color: '#71717a', marginBottom: '0.5rem' }}>
            Completion Rate
          </p>
          <div className="flex items-end justify-between">
            <span className="text-h2" style={{ color: '#b7c4ff' }}>
              {counts.all > 0 ? Math.round((counts.done / counts.all) * 100) : 0}%
            </span>
            <div
              style={{
                width: '60px',
                background: '#27272a',
                height: '6px',
                borderRadius: '999px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  background: '#2563eb',
                  height: '100%',
                  width: `${counts.all > 0 ? Math.round((counts.done / counts.all) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter + Sort bar ──────────────────────────────────── */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: '1rem' }}
      >
        {/* Tabs */}
        <div className="filter-tabs">
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

        {/* Sort + Refresh */}
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            style={{
              background: 'rgba(18,18,18,0.8)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '0.5rem',
              color: '#d4d4d8',
              fontSize: '0.75rem',
              padding: '0.375rem 0.75rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                Sort: {o.label}
              </option>
            ))}
          </select>

          <button
            onClick={fetchItems}
            disabled={loading}
            className="btn-ghost"
            style={{ padding: '0.375rem 0.625rem' }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '16px', animation: loading ? 'spin 1s linear infinite' : 'none' }}
            >
              refresh
            </span>
          </button>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div
        style={{
          backdropFilter: 'blur(12px)',
          background: 'rgba(18,18,18,0.8)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '0.75rem',
          overflow: 'hidden',
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2.5rem 1fr 9rem 9rem 6rem',
            padding: '0.625rem 1.5rem',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div />
          <span className="text-label-caps" style={{ color: '#52525b', fontSize: '10px' }}>
            Task &amp; Source
          </span>
          <span className="text-label-caps" style={{ color: '#52525b', fontSize: '10px' }}>
            Priority
          </span>
          <span className="text-label-caps" style={{ color: '#52525b', fontSize: '10px' }}>
            Due Date
          </span>
          <span
            className="text-label-caps"
            style={{ color: '#52525b', fontSize: '10px', textAlign: 'right' }}
          >
            Owner
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse"
                style={{
                  height: '60px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}
              />
            ))}
          </>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              padding: '1.5rem',
              color: '#ffb4ab',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              error
            </span>
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && visible.length === 0 && (
          <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '40px', color: '#27272a', marginBottom: '0.75rem', display: 'block' }}
            >
              checklist
            </span>
            <p style={{ color: '#52525b', fontSize: '0.875rem' }}>
              {filter === 'done'
                ? 'No completed items yet'
                : filter === 'pending'
                  ? 'All caught up!'
                  : 'No action items found'}
            </p>
          </div>
        )}

        {/* Rows */}
        {!loading && !error && visible.length > 0 && (
          <motion.div
            key={`${filter}-${sort}`}
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.03 } } }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((item) => (
                <ActionRow
                  key={item.id}
                  item={item}
                  onToggle={handleToggle}
                  isToggling={togglingIds.has(item.id)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Footer pagination */}
        {!loading && visible.length > 0 && (
          <div
            style={{
              padding: '0.875rem 1.5rem',
              background: 'rgba(255,255,255,0.01)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <p style={{ color: '#52525b', fontSize: '0.75rem' }}>
              Showing {visible.length} of {counts.all} tasks
            </p>
          </div>
        )}
      </div>

      {/* ── Focus Workflow Suggestion ──────────────────────────── */}
      {counts.overdue > 0 && (
        <div
          style={{
            marginTop: '2rem',
            backdropFilter: 'blur(12px)',
            background: 'rgba(59,130,246,0.03)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: '0.75rem',
            padding: '1.5rem 2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(59,130,246,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ color: '#3b82f6', fontSize: '28px' }}
              >
                psychology_alt
              </span>
            </div>
            <div>
              <h3 className="text-h3" style={{ color: '#ffffff', marginBottom: '0.25rem' }}>
                Recommended Focus
              </h3>
              <p style={{ color: '#71717a', fontSize: '0.8125rem', maxWidth: '480px' }}>
                You have {counts.overdue} overdue item
                {counts.overdue !== 1 ? 's' : ''} that need attention. Focus on high-priority
                tasks first.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilter('pending')}
            className="btn-primary"
            style={{ flexShrink: 0 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              bolt
            </span>
            Focus Mode
          </button>
        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, CheckSquare, RefreshCw } from 'lucide-react';
import { cn, isOverdue } from '@/lib/utils';
import ActionItemCard, { ActionItemWithMeeting } from '@/components/ActionItemCard';

// ─── types ────────────────────────────────────────────────────────────────────
type Filter = 'all' | 'overdue' | 'this_week' | 'done';
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
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return d >= startOfWeek && d < endOfWeek;
}

// ─── component ────────────────────────────────────────────────────────────────
export default function ActionItemsPage() {
  const [items, setItems] = useState<ActionItemWithMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<SortKey>('due_date');
  const [sortOpen, setSortOpen] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  // ── fetch ──────────────────────────────────────────────────────────────────
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

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // ── counts ─────────────────────────────────────────────────────────────────
  const counts = useMemo(
    () => ({
      all: items.length,
      overdue: items.filter((i) => isOverdue(i.dueDate) && i.status !== 'done').length,
      this_week: items.filter((i) => isThisWeek(i.dueDate) && i.status !== 'done').length,
      done: items.filter((i) => i.status === 'done').length,
    }),
    [items],
  );

  // ── filtered + sorted ──────────────────────────────────────────────────────
  const visible = useMemo(() => {
    let list = [...items];
    if (filter === 'all') {
      // keep everything
    } else if (filter === 'overdue') {
      list = list.filter((i) => isOverdue(i.dueDate) && i.status !== 'done');
    } else if (filter === 'this_week') {
      list = list.filter((i) => isThisWeek(i.dueDate) && i.status !== 'done');
    } else if (filter === 'done') {
      list = list.filter((i) => i.status === 'done');
    }

    list.sort((a, b) => {
      if (sort === 'due_date') {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sort === 'priority') {
        return (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99);
      }
      if (sort === 'meeting') {
        return (a.meetingTitle ?? '').localeCompare(b.meetingTitle ?? '');
      }
      return 0;
    });

    return list;
  }, [items, filter, sort]);

  // ── toggle done ────────────────────────────────────────────────────────────
  const handleToggleDone = useCallback(async (id: string) => {
    // optimistic
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'done' } : item)),
    );
    setTogglingIds((s) => new Set(s).add(id));

    try {
      const res = await fetch(`/api/action-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      // revert optimistic update on failure
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'open' } : item)),
      );
    } finally {
      setTogglingIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }, []);

  // ─── render ─────────────────────────────────────────────────────────────────
  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'this_week', label: 'This Week' },
    { key: 'done', label: 'Done' },
  ];

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'due_date', label: 'Due Date' },
    { key: 'priority', label: 'Priority' },
    { key: 'meeting', label: 'Meeting' },
  ];

  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? 'Sort';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-20">
      {/* ── header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-600/20 border border-violet-500/20 flex items-center justify-center">
            <CheckSquare className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white/90">Action Items</h1>
            <p className="text-xs text-white/40">{counts.all} total</p>
          </div>
        </div>
        <button
          onClick={fetchItems}
          disabled={loading}
          className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-colors disabled:opacity-40"
          aria-label="Refresh"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* ── filter tabs + sort ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-navy-800/80 border border-white/[0.06]">
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                  active
                    ? 'text-white bg-violet-600/30 border border-violet-500/30'
                    : 'text-white/45 hover:text-white/70',
                )}
              >
                {label}
                {counts[key] > 0 && (
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold',
                      active
                        ? 'bg-violet-500/40 text-violet-200'
                        : key === 'overdue' && counts.overdue > 0
                          ? 'bg-red-500/30 text-red-300'
                          : 'bg-white/10 text-white/50',
                    )}
                  >
                    {counts[key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => setSortOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-800/80 border border-white/[0.06] text-xs text-white/60 hover:text-white/80 hover:border-white/10 transition-all"
          >
            <span>Sort: {sortLabel}</span>
            <ChevronDown
              className={cn('w-3.5 h-3.5 transition-transform', sortOpen && 'rotate-180')}
            />
          </button>
          <AnimatePresence>
            {sortOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-1.5 w-40 rounded-xl glass border border-white/[0.08] shadow-2xl z-30 overflow-hidden"
              >
                {SORT_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSort(key);
                      setSortOpen(false);
                    }}
                    className={cn(
                      'w-full text-left px-4 py-2.5 text-xs transition-colors',
                      sort === key
                        ? 'text-violet-300 bg-violet-500/10'
                        : 'text-white/60 hover:text-white/90 hover:bg-white/[0.05]',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── content ── */}
      {loading && items.length === 0 ? (
        /* skeleton */
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="glass rounded-xl p-4 h-[76px] animate-pulse border-l-[3px] border-l-white/10"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-sm text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchItems}
            className="px-4 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : visible.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <CheckSquare className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-sm text-white/30">
            {filter === 'done'
              ? 'No completed items yet'
              : filter === 'overdue'
                ? 'No overdue items 🎉'
                : filter === 'this_week'
                  ? 'Nothing due this week'
                  : 'No action items found'}
          </p>
        </motion.div>
      ) : (
        <motion.ul layout className="space-y-3 list-none p-0">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((item) => (
              <li key={item.id} className="m-0 p-0">
                <ActionItemCard
                  item={item}
                  onToggleDone={handleToggleDone}
                  isLoading={togglingIds.has(item.id)}
                />
              </li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}

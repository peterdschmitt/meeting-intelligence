'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ResizableSplit from '@/components/ResizableSplit';
import ActionDetailPane, { type ActionItemDetail } from '@/components/ActionDetailPane';

interface ActionItem {
  id: string;
  title: string;
  status: string | null;
  assignee: string | null;
  dueDate: string | null;
  priority: string | null;
  meetingId: string | null;
  meetingTitle?: string | null;
  meetingTimestamp?: string | null;
  description?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  snoozedUntil?: string | null;
}

const ME_PATTERNS = ['peter schmitt', 'peter', 'pschmitt', 'p. schmitt'];
const isMe = (assignee: string | null | undefined): boolean => {
  if (!assignee) return false;
  const a = assignee.toLowerCase();
  return ME_PATTERNS.some((p) => a.includes(p));
};

type Tab = 'today' | 'mine' | 'theirs' | 'untriaged' | 'snoozed' | 'done';
type Group = 'urgency' | 'meeting' | 'owner' | 'priority' | 'status' | 'none';

const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: 'today',     label: 'Today',         hint: 'Overdue + due today + just created' },
  { key: 'mine',      label: 'My queue',      hint: 'Assigned to you' },
  { key: 'theirs',    label: 'Awaiting them', hint: 'Assigned to others, not done' },
  { key: 'untriaged', label: 'Untriaged',     hint: 'No assignee yet' },
  { key: 'snoozed',   label: 'Snoozed',       hint: 'Snoozed for later' },
  { key: 'done',      label: 'Done',          hint: 'Completed or cancelled' },
];

const GROUPS: { key: Group; label: string }[] = [
  { key: 'urgency',  label: 'By urgency' },
  { key: 'meeting',  label: 'By meeting' },
  { key: 'owner',    label: 'By owner' },
  { key: 'priority', label: 'By priority' },
  { key: 'status',   label: 'By status' },
  { key: 'none',     label: 'No grouping' },
];

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const URGENCY_KEYS = {
  ovr7:    'Overdue 7d+',
  overdue: 'Overdue',
  today:   'Due today',
  week:    'Due this week',
  stale:   'Stale · no due date',
  month:   'Due this month',
  later:   'Due later',
  none:    'No due date',
} as const;

const URGENCY_ORDER: string[] = [
  URGENCY_KEYS.ovr7,
  URGENCY_KEYS.overdue,
  URGENCY_KEYS.today,
  URGENCY_KEYS.week,
  URGENCY_KEYS.stale,
  URGENCY_KEYS.month,
  URGENCY_KEYS.later,
  URGENCY_KEYS.none,
];

function startOfDay(d: Date): number { const c = new Date(d); c.setHours(0, 0, 0, 0); return c.getTime(); }

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(d));
}

function relativeDue(d: string | null | undefined): { label: string; tone: 'overdue' | 'today' | 'soon' | 'normal' | 'none' } {
  if (!d) return { label: '—', tone: 'none' };
  const due = startOfDay(new Date(d));
  const today = startOfDay(new Date());
  const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));
  if (diff < 0)   return { label: `${diff}d`,    tone: 'overdue' };
  if (diff === 0) return { label: 'Today',      tone: 'today'   };
  if (diff === 1) return { label: 'Tomorrow',   tone: 'soon'    };
  if (diff <= 7)  return { label: `+${diff}d`,  tone: 'soon'    };
  return { label: formatDate(d), tone: 'normal' };
}

function isOverdue(d: string | null | undefined): boolean {
  if (!d) return false;
  return startOfDay(new Date(d)) < startOfDay(new Date());
}

function isDueToday(d: string | null | undefined): boolean {
  if (!d) return false;
  return startOfDay(new Date(d)) === startOfDay(new Date());
}

function isCreatedToday(c: string | null | undefined): boolean {
  if (!c) return false;
  return startOfDay(new Date(c)) === startOfDay(new Date());
}

function isSnoozedNow(item: ActionItem): boolean {
  if (!item.snoozedUntil) return false;
  return new Date(item.snoozedUntil).getTime() > Date.now();
}

function ageDays(createdAt: string | null | undefined): number | null {
  if (!createdAt) return null;
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

function ageDotClass(days: number | null): string {
  if (days === null) return 'age-dot fresh';
  if (days < 4)  return 'age-dot fresh';
  if (days < 8)  return 'age-dot warm';
  if (days < 15) return 'age-dot hot';
  return 'age-dot stale';
}

function severityClass(priority: string | null | undefined): string {
  if (priority === 'critical') return 'sev-critical';
  if (priority === 'high')     return 'sev-high';
  if (priority === 'medium')   return 'sev-medium';
  return 'sev-low';
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

function displayTitle(title: string, assignee: string | null | undefined): string {
  if (!assignee) return title;
  const owner = assignee.trim();
  if (!owner) return title;
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const verbs = '(will|has|have|had|to|should|must|is going to|needs to|plans to)';
  const candidates = [
    new RegExp(`^${escape(owner).replace(/\s+/g, '\\s+')}\\s+${verbs}\\s+`, 'i'),
  ];
  const first = owner.split(/\s+/)[0];
  if (first && first.length > 2 && first.toLowerCase() !== owner.toLowerCase()) {
    candidates.push(new RegExp(`^${escape(first)}\\s+${verbs}\\s+`, 'i'));
  }
  for (const rx of candidates) {
    const m = title.match(rx);
    if (m) {
      const stripped = title.slice(m[0].length).trim();
      if (stripped.length === 0) return title;
      return stripped.charAt(0).toUpperCase() + stripped.slice(1);
    }
  }
  return title;
}

function urgencyOf(item: ActionItem): string {
  if (!item.dueDate) {
    const age = ageDays(item.createdAt) ?? 0;
    return age >= 14 ? URGENCY_KEYS.stale : URGENCY_KEYS.none;
  }
  const due = startOfDay(new Date(item.dueDate));
  const today = startOfDay(new Date());
  const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));
  if (diff <= -7) return URGENCY_KEYS.ovr7;
  if (diff < 0)   return URGENCY_KEYS.overdue;
  if (diff === 0) return URGENCY_KEYS.today;
  if (diff <= 7)  return URGENCY_KEYS.week;
  if (diff <= 30) return URGENCY_KEYS.month;
  return URGENCY_KEYS.later;
}

function urgencyTone(label: string): string {
  if (label === URGENCY_KEYS.ovr7 || label === URGENCY_KEYS.overdue) return 'var(--apex-error)';
  if (label === URGENCY_KEYS.today) return 'var(--apex-amber)';
  if (label === URGENCY_KEYS.week)  return 'var(--apex-primary-bright)';
  if (label === URGENCY_KEYS.stale) return 'var(--apex-violet)';
  return 'var(--apex-text-muted)';
}

function groupKeyOf(item: ActionItem, group: Group): string {
  switch (group) {
    case 'urgency':  return urgencyOf(item);
    case 'meeting':  return item.meetingTitle ?? '(No meeting)';
    case 'owner':    return item.assignee ?? '(Unassigned)';
    case 'priority': return (item.priority ?? 'medium').toUpperCase();
    case 'status':   return (item.status ?? 'open').replace('_', ' ').toUpperCase();
    case 'none':     return '';
  }
}

function snoozeOptions(): { label: string; date: string }[] {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const sat = new Date(today); sat.setDate(today.getDate() + (6 - today.getDay() + 7) % 7 || 7);
  const monday = new Date(today); monday.setDate(today.getDate() + (8 - today.getDay()) % 7 || 7);
  const inAWeek = new Date(today); inAWeek.setDate(today.getDate() + 7);
  const inAMonth = new Date(today); inAMonth.setMonth(today.getMonth() + 1);
  return [
    { label: 'Tomorrow',      date: fmt(tomorrow) },
    { label: 'This weekend',  date: fmt(sat) },
    { label: 'Next Monday',   date: fmt(monday) },
    { label: 'In a week',     date: fmt(inAWeek) },
    { label: 'In a month',    date: fmt(inAMonth) },
  ];
}

export default function ActionItemsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, fontSize: 12, color: 'var(--apex-text-faint)' }}>Loading…</div>}>
      <ActionItemsInner />
    </Suspense>
  );
}

function ActionItemsInner() {
  const searchParams = useSearchParams();
  const search = searchParams?.get('q') ?? '';

  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('today');
  const [group, setGroup] = useState<Group>(() => {
    if (typeof window === 'undefined') return 'urgency';
    return (localStorage.getItem('actions-group') as Group) || 'urgency';
  });
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Inline / row menus
  const [snoozeMenuFor, setSnoozeMenuFor] = useState<string | null>(null);
  const [priorityMenuFor, setPriorityMenuFor] = useState<string | null>(null);
  const [dueEditFor, setDueEditFor] = useState<string | null>(null);
  const dueInputRef = useRef<HTMLInputElement | null>(null);

  // Bulk select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSnoozeOpen, setBulkSnoozeOpen] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkPriorityOpen, setBulkPriorityOpen] = useState(false);
  const [reassignTo, setReassignTo] = useState('');
  const [reassignOpen, setReassignOpen] = useState(false);

  // Selected row (drives the detail pane on the right)
  const [selectedItem, setSelectedItem] = useState<ActionItem | null>(null);

  // Hover preview (shows full task + description + notes on row hover)
  const [hoverPreview, setHoverPreview] = useState<{ id: string; rect: DOMRect } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('actions-group', group);
  }, [group]);

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
    if (dueEditFor && dueInputRef.current) dueInputRef.current.focus();
  }, [dueEditFor]);

  // Clear hover preview on any scroll (the cached rect would otherwise drift)
  useEffect(() => {
    if (!hoverPreview) return;
    const clear = () => setHoverPreview(null);
    window.addEventListener('scroll', clear, true);
    return () => window.removeEventListener('scroll', clear, true);
  }, [hoverPreview]);

  const assignees = useMemo(() => {
    const s = new Set<string>();
    for (const i of items) if (i.assignee) s.add(i.assignee);
    return Array.from(s).sort();
  }, [items]);

  const segCounts = useMemo(() => {
    const c = { today: 0, mine: 0, theirs: 0, untriaged: 0, snoozed: 0, done: 0 };
    for (const i of items) {
      const snoozed = isSnoozedNow(i);
      const done = i.status === 'done' || i.status === 'cancelled';
      if (done) { c.done++; continue; }
      if (snoozed) { c.snoozed++; continue; }
      if (isOverdue(i.dueDate) || isDueToday(i.dueDate) || isCreatedToday(i.createdAt)) c.today++;
      if (!i.assignee) c.untriaged++;
      else if (isMe(i.assignee)) c.mine++;
      else c.theirs++;
    }
    return c;
  }, [items]);

  const overdueCount = useMemo(() => items.filter((i) =>
    i.status !== 'done' && i.status !== 'cancelled' && !isSnoozedNow(i) && isOverdue(i.dueDate),
  ).length, [items]);

  const tabFiltered = useMemo(() => {
    return items.filter((i) => {
      const snoozed = isSnoozedNow(i);
      const done = i.status === 'done' || i.status === 'cancelled';
      switch (tab) {
        case 'today':     return !done && !snoozed && (isOverdue(i.dueDate) || isDueToday(i.dueDate) || isCreatedToday(i.createdAt));
        case 'mine':      return !done && !snoozed && isMe(i.assignee);
        case 'theirs':    return !done && !snoozed && i.assignee && !isMe(i.assignee);
        case 'untriaged': return !done && !snoozed && !i.assignee;
        case 'snoozed':   return !done && snoozed;
        case 'done':      return done;
      }
    });
  }, [items, tab]);

  const visible = useMemo(() => {
    let r = tabFiltered;
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
  }, [tabFiltered, assigneeFilter, search]);

  const grouped = useMemo(() => {
    if (group === 'none') return [['', visible]] as [string, ActionItem[]][];
    const g = new Map<string, ActionItem[]>();
    for (const i of visible) {
      const key = groupKeyOf(i, group);
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(i);
    }
    let entries = Array.from(g.entries());

    if (group === 'urgency') {
      entries = entries.sort((a, b) => URGENCY_ORDER.indexOf(a[0]) - URGENCY_ORDER.indexOf(b[0]));
    } else if (group === 'priority') {
      entries = entries.sort((a, b) =>
        (PRIORITY_ORDER[a[0].toLowerCase()] ?? 9) - (PRIORITY_ORDER[b[0].toLowerCase()] ?? 9),
      );
    } else if (group === 'meeting') {
      entries = entries.sort((a, b) => {
        const aMax = Math.max(...a[1].map((i) => i.createdAt ? new Date(i.createdAt).getTime() : 0));
        const bMax = Math.max(...b[1].map((i) => i.createdAt ? new Date(i.createdAt).getTime() : 0));
        return bMax - aMax;
      });
    } else {
      entries = entries.sort((a, b) => a[0].localeCompare(b[0]));
    }

    for (const [, list] of entries) {
      list.sort((a, b) => {
        const ap = PRIORITY_ORDER[a.priority ?? 'medium'] ?? 9;
        const bp = PRIORITY_ORDER[b.priority ?? 'medium'] ?? 9;
        if (ap !== bp) return ap - bp;
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        if (ad !== bd) return ad - bd;
        return (ageDays(b.createdAt) ?? 0) - (ageDays(a.createdAt) ?? 0);
      });
    }
    return entries;
  }, [visible, group]);

  const showOwnerCol = tab !== 'mine' && tab !== 'untriaged';
  const gridCols = showOwnerCol
    ? '24px 64px 70px 110px 1fr 110px 70px 28px'
    : '24px 64px 70px 1fr 110px 70px 28px';

  const visibleIds = useMemo(() => visible.map((v) => v.id), [visible]);
  const allSelected = selected.size > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleCollapse = (key: string) =>
    setCollapsed((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleSelect = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleSelectAll = () =>
    setSelected((p) => allSelected ? new Set() : new Set(visibleIds));

  const clearSelection = () => setSelected(new Set());

  const patchItem = useCallback(async (id: string, body: Partial<ActionItem>) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...body } : i));
    if (selectedItem?.id === id) setSelectedItem((p) => p ? { ...p, ...body } : null);
    try {
      await fetch(`/api/action-items/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch { /* optimistic */ }
  }, [selectedItem]);

  // Bulk operations
  const bulkPatch = useCallback(async (body: Partial<ActionItem>) => {
    const ids = Array.from(selected);
    setItems((prev) => prev.map((i) => ids.includes(i.id) ? { ...i, ...body } : i));
    await Promise.allSettled(
      ids.map((id) => fetch(`/api/action-items/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })),
    );
  }, [selected]);

  const handleBulkDone = async () => { await bulkPatch({ status: 'done' }); clearSelection(); };
  const handleBulkStatus = async (status: string) => {
    await bulkPatch({ status });
    setBulkStatusOpen(false);
    clearSelection();
  };
  const handleBulkPriority = async (priority: string) => {
    await bulkPatch({ priority });
    setBulkPriorityOpen(false);
    clearSelection();
  };
  const handleBulkSnooze = async (date: string | null) => {
    await bulkPatch({ snoozedUntil: date });
    setBulkSnoozeOpen(false);
    clearSelection();
  };
  const handleBulkReassign = async () => {
    if (!reassignTo.trim()) return;
    await bulkPatch({ assignee: reassignTo.trim() });
    setReassignTo('');
    setReassignOpen(false);
    clearSelection();
  };
  const closeBulkMenus = () => {
    setBulkStatusOpen(false);
    setBulkPriorityOpen(false);
    setBulkSnoozeOpen(false);
    setReassignOpen(false);
  };

  const handleCycle = useCallback((item: ActionItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const ns = cycleStatus(item.status);
    patchItem(item.id, { status: ns });
  }, [patchItem]);

  const handleSnooze = useCallback((id: string, date: string | null) => {
    patchItem(id, { snoozedUntil: date });
    setSnoozeMenuFor(null);
  }, [patchItem]);

  const handleSetPriority = useCallback((id: string, p: string) => {
    patchItem(id, { priority: p });
    setPriorityMenuFor(null);
  }, [patchItem]);

  const handleSetDue = useCallback((id: string, value: string | null) => {
    patchItem(id, { dueDate: value });
    setDueEditFor(null);
  }, [patchItem]);

  const openDetail = (item: ActionItem) => setSelectedItem(item);

  const closeAllMenus = () => {
    setSnoozeMenuFor(null);
    setPriorityMenuFor(null);
    setBulkSnoozeOpen(false);
    setReassignOpen(false);
  };

  // ── Left pane (table) ──────────────────────────────
  const leftPane = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--apex-bg)', minWidth: 0, position: 'relative' }}>
      <div className="apex-page-header">
        <span className="apex-page-title">Action Items</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select className="inline-select" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} style={{ width: 130 }}>
            <option value="all">All Assignees</option>
            {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px', borderBottom: '1px solid var(--apex-border)', background: 'rgba(255,255,255,0.012)', flexShrink: 0 }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          const count = segCounts[t.key];
          const isToday = t.key === 'today';
          const todayHasOverdue = isToday && count > 0;
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); clearSelection(); }}
              title={t.hint}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 26, padding: '0 10px',
                background: active ? 'var(--apex-primary-soft)' : 'transparent',
                border: '1px solid',
                borderColor: active ? 'rgba(46,98,255,0.4)' : 'transparent',
                borderRadius: 5,
                color: active ? 'var(--apex-primary-bright)'
                  : todayHasOverdue ? 'var(--apex-amber)'
                  : 'var(--apex-text-secondary)',
                fontSize: 12, fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {isToday && <span className="material-symbols-outlined" style={{ fontSize: 13 }}>today</span>}
              {t.label}
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5, fontWeight: 700,
                padding: '0 5px', borderRadius: 3,
                background: active ? 'rgba(46,98,255,0.18)'
                  : todayHasOverdue ? 'var(--apex-amber-soft)'
                  : 'rgba(255,255,255,0.05)',
                color: active ? 'var(--apex-primary-bright)'
                  : todayHasOverdue ? 'var(--apex-amber)'
                  : 'var(--apex-text-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}>{count}</span>
            </button>
          );
        })}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {overdueCount > 0 && tab !== 'today' && (
            <span style={{ fontSize: 11, color: 'var(--apex-error)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>
              {overdueCount} overdue
            </span>
          )}
          <select
            className="inline-select"
            value={group}
            onChange={(e) => setGroup(e.target.value as Group)}
            style={{ height: 26, fontSize: 11 }}
            title="Group rows by"
          >
            {GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
        </div>
      </div>

      {/* Column header */}
      <div className="apex-grid-header" style={{ gridTemplateColumns: gridCols }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Checkbox checked={allSelected} onChange={toggleSelectAll} aria-label="Select all" />
        </span>
        <span>Status</span>
        <span>Pri</span>
        {showOwnerCol && <span>Owner</span>}
        <span>Task</span>
        <span>Meeting</span>
        <span style={{ textAlign: 'right' }}>Due</span>
        <span></span>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative', paddingBottom: someSelected ? 56 : 0 }}>
        {loading ? (
          <Empty msg="Loading…" />
        ) : visible.length === 0 ? (
          <Empty msg={
            tab === 'today' ? 'Nothing pressing today. ✨'
            : tab === 'mine' ? 'Nothing on your queue. Nice.'
            : tab === 'theirs' ? 'Nothing waiting on others.'
            : tab === 'untriaged' ? 'All items have an owner.'
            : tab === 'snoozed' ? 'Nothing snoozed.'
            : 'No items'
          } />
        ) : (
          grouped.map(([key, list]) => {
            const isC = collapsed.has(key);
            const groupLabelColor = group === 'urgency' ? urgencyTone(key) : undefined;
            return (
              <div key={key || '__none'}>
                {key && (
                  <div className="apex-group-header" onClick={() => toggleCollapse(key)} style={{ color: groupLabelColor }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--apex-text-faint)' }}>{isC ? '▶' : '▼'}</span>
                      {key}
                    </span>
                    <span>{list.length}</span>
                  </div>
                )}
                {!isC && list.map((i) => {
                  const status = i.status ?? 'open';
                  const priority = i.priority ?? 'medium';
                  const isSel = selectedItem?.id === i.id;
                  const isChecked = selected.has(i.id);
                  const snoozed = isSnoozedNow(i);
                  const days = ageDays(i.createdAt);
                  const due = relativeDue(i.dueDate);
                  const dueColor = due.tone === 'overdue' ? 'var(--apex-error)'
                    : due.tone === 'today' ? 'var(--apex-amber)'
                    : due.tone === 'soon' ? 'var(--apex-primary-bright)'
                    : 'var(--apex-text-muted)';
                  const display = displayTitle(i.title, i.assignee);
                  return (
                    <div
                      key={i.id}
                      className={`apex-grid-row ${severityClass(priority)}${isSel ? ' selected' : ''}${snoozed ? ' snoozed' : ''}${isChecked ? ' checked' : ''}`}
                      style={{ gridTemplateColumns: gridCols, paddingLeft: 16, background: isChecked ? 'var(--apex-primary-soft)' : undefined }}
                      onClick={() => openDetail(i)}
                    >
                      <span
                        onClick={(e) => { e.stopPropagation(); toggleSelect(i.id); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <Checkbox checked={isChecked} onChange={() => toggleSelect(i.id)} />
                      </span>
                      <span className={`badge badge-${status}`} onClick={(e) => handleCycle(i, e)} title="Click to cycle">{status.replace('_', ' ')}</span>

                      {/* Inline priority */}
                      <span style={{ position: 'relative' }}>
                        <button
                          className={`badge priority-${priority}`}
                          onClick={(e) => { e.stopPropagation(); setPriorityMenuFor(priorityMenuFor === i.id ? null : i.id); setSnoozeMenuFor(null); setDueEditFor(null); }}
                          style={{ cursor: 'pointer' }}
                          title="Click to change priority"
                        >
                          {priority.slice(0, 4)}
                        </button>
                        {priorityMenuFor === i.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute', left: 0, top: 24, zIndex: 100,
                              background: 'var(--apex-elevated)',
                              border: '1px solid var(--apex-border-bright)',
                              borderRadius: 6,
                              boxShadow: '0 12px 24px rgba(0,0,0,0.5)',
                              padding: 4, minWidth: 100,
                            }}
                          >
                            {PRIORITIES.map((p) => (
                              <button
                                key={p}
                                onClick={() => handleSetPriority(i.id, p)}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '5px 8px', background: priority === p ? 'var(--apex-hover)' : 'transparent', border: 'none', color: 'var(--apex-text)', fontSize: 11, cursor: 'pointer', borderRadius: 4, textTransform: 'capitalize' }}
                                onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'var(--apex-hover)'}
                                onMouseLeave={(e) => { if (priority !== p) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                              >
                                <span className={`badge priority-${p}`} style={{ fontSize: 9 }}>{p.slice(0, 4)}</span>
                                <span>{p}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </span>

                      {showOwnerCol && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <span className={`avatar${isMe(i.assignee) ? ' accent' : ''}`} style={{ width: 18, height: 18, fontSize: 8 }}>
                            {initials(i.assignee)}
                          </span>
                          <span className="cell-secondary" style={{ fontSize: 11 }}>{i.assignee?.split(' ')[0] ?? '—'}</span>
                        </span>
                      )}
                      <span
                        style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}
                        onMouseEnter={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setHoverPreview({ id: i.id, rect });
                        }}
                        onMouseLeave={() => setHoverPreview((h) => (h?.id === i.id ? null : h))}
                      >
                        <span className={ageDotClass(days)} />
                        <span className={status === 'done' ? 'cell-done' : 'cell-primary'} style={{ fontSize: 11.5 }}>{display}</span>
                        {snoozed && i.snoozedUntil && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--apex-text-faint)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>snooze</span>
                            {formatDate(i.snoozedUntil)}
                          </span>
                        )}
                      </span>
                      <span className="cell-meta" style={{ fontSize: 10.5 }}>{i.meetingTitle ?? '—'}</span>

                      {/* Inline due edit */}
                      <span style={{ textAlign: 'right' }}>
                        {dueEditFor === i.id ? (
                          <input
                            ref={dueInputRef}
                            type="date"
                            defaultValue={i.dueDate ?? ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleSetDue(i.id, e.target.value || null)}
                            onBlur={() => setDueEditFor(null)}
                            onKeyDown={(e) => { if (e.key === 'Escape') setDueEditFor(null); }}
                            style={{
                              background: 'var(--apex-panel)',
                              border: '1px solid var(--apex-primary)',
                              borderRadius: 4, padding: '2px 4px',
                              color: 'var(--apex-text)', fontSize: 11, colorScheme: 'dark',
                              width: 120,
                            }}
                          />
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDueEditFor(i.id); setSnoozeMenuFor(null); setPriorityMenuFor(null); }}
                            className="mono"
                            style={{
                              background: 'transparent', border: '1px solid transparent',
                              padding: '2px 6px', borderRadius: 3,
                              fontSize: 11, color: dueColor,
                              fontWeight: due.tone === 'overdue' || due.tone === 'today' ? 600 : 400,
                              cursor: 'pointer', textAlign: 'right',
                            }}
                            onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--apex-border)'}
                            onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'}
                          >
                            {due.label}
                          </button>
                        )}
                      </span>

                      {/* Snooze button */}
                      <span style={{ position: 'relative' }}>
                        <button
                          className="btn-icon"
                          onClick={(e) => { e.stopPropagation(); setSnoozeMenuFor(snoozeMenuFor === i.id ? null : i.id); setPriorityMenuFor(null); setDueEditFor(null); }}
                          title="Snooze"
                          aria-label="Snooze"
                          style={{ width: 22, height: 22 }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                        </button>
                        {snoozeMenuFor === i.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute', right: 0, top: 28, zIndex: 100,
                              background: 'var(--apex-elevated)',
                              border: '1px solid var(--apex-border-bright)',
                              borderRadius: 6,
                              boxShadow: '0 12px 24px rgba(0,0,0,0.5)',
                              padding: 4, minWidth: 180,
                            }}
                          >
                            <p className="label-caps" style={{ padding: '4px 8px' }}>Snooze until…</p>
                            {snoozeOptions().map((opt) => (
                              <button
                                key={opt.label}
                                onClick={() => handleSnooze(i.id, opt.date)}
                                style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '5px 8px', background: 'transparent', border: 'none', color: 'var(--apex-text)', fontSize: 12, cursor: 'pointer', borderRadius: 4 }}
                                onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'var(--apex-hover)'}
                                onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                              >
                                <span>{opt.label}</span>
                                <span className="cell-meta" style={{ fontSize: 10 }}>{formatDate(opt.date)}</span>
                              </button>
                            ))}
                            {i.snoozedUntil && (
                              <>
                                <div className="divider" style={{ margin: '4px 0' }} />
                                <button
                                  onClick={() => handleSnooze(i.id, null)}
                                  style={{ width: '100%', padding: '5px 8px', background: 'transparent', border: 'none', color: 'var(--apex-error)', fontSize: 12, cursor: 'pointer', textAlign: 'left', borderRadius: 4 }}
                                  onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'var(--apex-hover)'}
                                  onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                                >
                                  Wake up now
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--apex-elevated)',
            border: '1px solid var(--apex-border-bright)',
            borderRadius: 8,
            padding: 4,
            boxShadow: '0 16px 32px rgba(0,0,0,0.6)',
          }}
        >
          <span style={{ padding: '0 10px', fontSize: 12, fontWeight: 600, color: 'var(--apex-text)' }}>
            {selected.size} selected
          </span>
          <span style={{ width: 1, height: 18, background: 'var(--apex-border-bright)' }} />

          <button className="btn btn-ghost" onClick={handleBulkDone} style={{ height: 26, fontSize: 11.5 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
            Mark done
          </button>

          {/* Bulk status */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-ghost"
              onClick={() => { closeBulkMenus(); setBulkStatusOpen(true); }}
              style={{ height: 26, fontSize: 11.5 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>flag</span>
              Status
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>arrow_drop_up</span>
            </button>
            {bulkStatusOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute', bottom: 32, left: 0, zIndex: 60,
                  background: 'var(--apex-elevated)',
                  border: '1px solid var(--apex-border-bright)',
                  borderRadius: 6, boxShadow: '0 12px 24px rgba(0,0,0,0.5)',
                  padding: 4, minWidth: 180,
                }}
              >
                <p className="label-caps" style={{ padding: '4px 8px' }}>Set {selected.size} to…</p>
                {[
                  { value: 'open',         label: 'Open' },
                  { value: 'in_progress',  label: 'In Progress' },
                  { value: 'blocked',      label: 'Blocked' },
                  { value: 'deferred',     label: 'Deferred' },
                  { value: 'done',         label: 'Done' },
                  { value: 'cancelled',    label: 'Cancelled' },
                ].map((s) => (
                  <button
                    key={s.value}
                    onClick={() => handleBulkStatus(s.value)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '5px 8px', background: 'transparent', border: 'none', color: 'var(--apex-text)', fontSize: 12, cursor: 'pointer', borderRadius: 4, textAlign: 'left' }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'var(--apex-hover)'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                  >
                    <span className={`badge badge-${s.value}`} style={{ fontSize: 9 }}>{s.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bulk priority */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-ghost"
              onClick={() => { closeBulkMenus(); setBulkPriorityOpen(true); }}
              style={{ height: 26, fontSize: 11.5 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>priority_high</span>
              Priority
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>arrow_drop_up</span>
            </button>
            {bulkPriorityOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute', bottom: 32, left: 0, zIndex: 60,
                  background: 'var(--apex-elevated)',
                  border: '1px solid var(--apex-border-bright)',
                  borderRadius: 6, boxShadow: '0 12px 24px rgba(0,0,0,0.5)',
                  padding: 4, minWidth: 140,
                }}
              >
                <p className="label-caps" style={{ padding: '4px 8px' }}>Priority for {selected.size}…</p>
                {(['critical', 'high', 'medium', 'low'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => handleBulkPriority(p)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '5px 8px', background: 'transparent', border: 'none', color: 'var(--apex-text)', fontSize: 12, cursor: 'pointer', borderRadius: 4, textAlign: 'left', textTransform: 'capitalize' }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'var(--apex-hover)'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                  >
                    <span className={`badge priority-${p}`} style={{ fontSize: 9 }}>{p.slice(0, 4)}</span>
                    <span>{p}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bulk snooze */}
          <div style={{ position: 'relative' }}>
            <button className="btn btn-ghost" onClick={() => { closeBulkMenus(); setBulkSnoozeOpen(true); }} style={{ height: 26, fontSize: 11.5 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
              Snooze
            </button>
            {bulkSnoozeOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute', bottom: 32, left: 0, zIndex: 60,
                  background: 'var(--apex-elevated)',
                  border: '1px solid var(--apex-border-bright)',
                  borderRadius: 6, boxShadow: '0 12px 24px rgba(0,0,0,0.5)',
                  padding: 4, minWidth: 180,
                }}
              >
                <p className="label-caps" style={{ padding: '4px 8px' }}>Snooze {selected.size} until…</p>
                {snoozeOptions().map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => handleBulkSnooze(opt.date)}
                    style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '5px 8px', background: 'transparent', border: 'none', color: 'var(--apex-text)', fontSize: 12, cursor: 'pointer', borderRadius: 4 }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'var(--apex-hover)'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                  >
                    <span>{opt.label}</span>
                    <span className="cell-meta" style={{ fontSize: 10 }}>{formatDate(opt.date)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bulk reassign */}
          <div style={{ position: 'relative' }}>
            <button className="btn btn-ghost" onClick={() => { closeBulkMenus(); setReassignOpen(true); }} style={{ height: 26, fontSize: 11.5 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>person</span>
              Reassign
            </button>
            {reassignOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute', bottom: 32, left: 0, zIndex: 60,
                  background: 'var(--apex-elevated)',
                  border: '1px solid var(--apex-border-bright)',
                  borderRadius: 6, boxShadow: '0 12px 24px rgba(0,0,0,0.5)',
                  padding: 8, minWidth: 220,
                }}
              >
                <p className="label-caps" style={{ marginBottom: 6 }}>Assign {selected.size} to…</p>
                <input
                  className="inline-input"
                  list="assignee-suggestions"
                  placeholder="Name…"
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleBulkReassign(); if (e.key === 'Escape') setReassignOpen(false); }}
                  autoFocus
                  style={{ marginBottom: 6 }}
                />
                <datalist id="assignee-suggestions">
                  {assignees.map((a) => <option key={a} value={a} />)}
                </datalist>
                <button className="btn btn-primary" onClick={handleBulkReassign} disabled={!reassignTo.trim()} style={{ width: '100%', height: 26, fontSize: 11.5 }}>Assign</button>
              </div>
            )}
          </div>

          <span style={{ width: 1, height: 18, background: 'var(--apex-border-bright)' }} />
          <button className="btn-icon" onClick={clearSelection} aria-label="Clear selection" title="Clear (Esc)">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
          </button>
        </div>
      )}
    </div>
  );

  // ── Right pane (detail) ────────────────────────────
  const rightPane = selectedItem ? (
    <ActionDetailPane
      item={selectedItem as ActionItemDetail}
      onClose={() => setSelectedItem(null)}
      onPatch={async (id, body) => { await patchItem(id, body as Partial<ActionItem>); }}
    />
  ) : (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--apex-panel)', borderLeft: '1px solid var(--apex-border)' }}>
      <span style={{ fontSize: 11, color: 'var(--apex-text-faint)' }}>Select an action to view its context</span>
    </div>
  );

  // Floating hover preview — placed at the top level so it can escape
  // the row's overflow / scroll container via position: fixed.
  const previewItem = hoverPreview ? items.find((x) => x.id === hoverPreview.id) ?? null : null;

  return (
    <div
      style={{ height: '100%', overflow: 'hidden' }}
      onClick={closeAllMenus}
      onKeyDown={(e) => { if (e.key === 'Escape') { clearSelection(); closeAllMenus(); } }}
      tabIndex={-1}
    >
      <ResizableSplit
        left={leftPane}
        right={rightPane}
        defaultLeftPct={62}
        minLeftPx={520}
        minRightPx={360}
        storageKey="actions-split"
      />
      {hoverPreview && previewItem && (
        <HoverPreview rect={hoverPreview.rect} item={previewItem} />
      )}
    </div>
  );
}

const PREVIEW_WIDTH = 520;
const PREVIEW_MAX_HEIGHT = 480;

function HoverPreview({ rect, item }: { rect: DOMRect; item: ActionItem }) {
  // Decide above/below
  const spaceBelow = (typeof window !== 'undefined' ? window.innerHeight : 800) - rect.bottom;
  const placeAbove = spaceBelow < PREVIEW_MAX_HEIGHT && rect.top > spaceBelow;
  const top = placeAbove
    ? Math.max(8, rect.top - 6 - PREVIEW_MAX_HEIGHT)
    : Math.min((typeof window !== 'undefined' ? window.innerHeight : 800) - 16 - PREVIEW_MAX_HEIGHT, rect.bottom + 6);

  let left = rect.left + 24;
  if (typeof window !== 'undefined' && left + PREVIEW_WIDTH > window.innerWidth - 16) {
    left = Math.max(16, window.innerWidth - PREVIEW_WIDTH - 16);
  }

  const display = displayTitle(item.title, item.assignee);
  const titleDiffers = display !== item.title;
  const ageD = ageDays(item.createdAt);
  const due = item.dueDate ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(item.dueDate)) : null;

  return (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        top, left,
        zIndex: 1000,
        width: PREVIEW_WIDTH,
        maxWidth: '92vw',
        maxHeight: PREVIEW_MAX_HEIGHT,
        background: 'var(--apex-elevated)',
        border: '1px solid var(--apex-border-bright)',
        borderRadius: 8,
        boxShadow: '0 24px 48px rgba(0,0,0,0.75)',
        padding: '14px 16px',
        pointerEvents: 'none',
        overflowY: 'auto',
        animation: 'apex-fade-in 120ms ease-out',
      }}
    >
      {/* Status pills strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        <span className={`badge badge-${item.status ?? 'open'}`} style={{ fontSize: 10 }}>
          {(item.status ?? 'open').replace('_', ' ')}
        </span>
        <span className={`badge priority-${item.priority ?? 'medium'}`} style={{ fontSize: 10 }}>
          {(item.priority ?? 'medium')}
        </span>
        {item.assignee && (
          <span className="badge" style={{ fontSize: 10, background: 'rgba(255,255,255,0.04)', borderColor: 'var(--apex-border)', color: 'var(--apex-text-secondary)' }}>
            {item.assignee}
          </span>
        )}
        {due && (
          <span className="badge" style={{ fontSize: 10, background: 'rgba(255,255,255,0.04)', borderColor: 'var(--apex-border)', color: 'var(--apex-text-secondary)' }}>
            Due {due}
          </span>
        )}
      </div>

      {/* Title — full text, larger font */}
      <p style={{
        fontSize: 14.5,
        lineHeight: 1.45,
        fontWeight: 600,
        color: 'var(--apex-text)',
        margin: 0,
        whiteSpace: 'normal',
        wordBreak: 'break-word',
      }}>
        {display}
      </p>

      {titleDiffers && (
        <p style={{
          fontSize: 11.5,
          fontStyle: 'italic',
          color: 'var(--apex-text-faint)',
          marginTop: 4,
        }}>
          From transcript: “{item.title}”
        </p>
      )}

      {/* Description */}
      {item.description && (
        <>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--apex-text-muted)', marginTop: 14, marginBottom: 4 }}>
            Description
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--apex-text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>
            {item.description}
          </p>
        </>
      )}

      {/* Notes */}
      {item.notes && item.notes !== item.description && (
        <>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--apex-text-muted)', marginTop: 14, marginBottom: 4 }}>
            Notes
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--apex-text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>
            {item.notes}
          </p>
        </>
      )}

      {/* Footer: meta */}
      <div style={{
        marginTop: 14,
        paddingTop: 10,
        borderTop: '1px solid var(--apex-border)',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 10,
        fontSize: 11.5,
        color: 'var(--apex-text-muted)',
        flexWrap: 'wrap',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>event_note</span>
          {item.meetingTitle ?? 'No meeting'}
          {item.meetingTimestamp && <span className="mono" style={{ marginLeft: 4, color: 'var(--apex-primary-bright)' }}>@{item.meetingTimestamp}</span>}
        </span>
        {ageD !== null && (
          <span className="mono">{ageD}d open</span>
        )}
      </div>
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

function Empty({ msg }: { msg: string }) {
  return <div style={{ padding: 32, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>{msg}</div>;
}

function Checkbox({ checked, onChange, ...rest }: { checked: boolean; onChange: () => void } & Omit<React.HTMLAttributes<HTMLSpanElement>, 'onChange'>) {
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(); } }}
      style={{
        width: 14, height: 14,
        borderRadius: 3,
        border: `1.5px solid ${checked ? 'var(--apex-primary)' : 'var(--apex-border-bright)'}`,
        background: checked ? 'var(--apex-primary)' : 'transparent',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.1s, border-color 0.1s',
      }}
      {...rest}
    >
      {checked && (
        <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#fff', fontWeight: 800 }}>check</span>
      )}
    </span>
  );
}

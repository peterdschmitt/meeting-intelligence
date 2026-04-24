'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Loader2, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import MeetingCard, { type MeetingCardData } from '@/components/MeetingCard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeetingListItem extends MeetingCardData {}

interface NewMeetingForm {
  title: string;
  meetingDate: string;
  participants: string;
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

type FilterTab = 'all' | 'week' | 'month';

function isThisWeek(date: string | null): boolean {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return d >= startOfWeek && d <= endOfWeek;
}

function isThisMonth(date: string | null): boolean {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="glass rounded-xl p-5 border border-white/[0.07] animate-pulse">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="h-4 bg-white/10 rounded w-2/3" />
        <div className="h-5 bg-white/10 rounded-full w-16" />
      </div>
      <div className="flex gap-4 mb-3">
        <div className="h-3 bg-white/10 rounded w-24" />
        <div className="h-3 bg-white/10 rounded w-28" />
      </div>
      <div className="h-3 bg-white/10 rounded w-1/2 mb-3" />
      <div className="space-y-1.5">
        <div className="h-3 bg-white/10 rounded w-full" />
        <div className="h-3 bg-white/10 rounded w-4/5" />
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="col-span-full flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-4">
        <CalendarDays className="w-7 h-7 text-white/20" />
      </div>
      <p className="text-white/50 text-sm mb-1">No meetings found</p>
      <p className="text-white/25 text-xs mb-5">Create your first meeting to get started</p>
      <button
        onClick={onNew}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
      >
        <Plus className="w-4 h-4" />
        New Meeting
      </button>
    </motion.div>
  );
}

// ─── New Meeting Inline Form ──────────────────────────────────────────────────

interface NewMeetingFormProps {
  onClose: () => void;
  onCreated: (meeting: MeetingListItem) => void;
}

function NewMeetingInlineForm({ onClose, onCreated }: NewMeetingFormProps) {
  const [form, setForm] = useState<NewMeetingForm>({
    title: '',
    meetingDate: new Date().toISOString().slice(0, 16),
    participants: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          meetingDate: form.meetingDate || null,
          participants: form.participants
            ? form.participants.split(',').map((p) => p.trim()).filter(Boolean)
            : [],
        }),
      });
      if (!res.ok) throw new Error('Failed to create meeting');
      const created: MeetingListItem = await res.json();
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="glass rounded-xl p-5 border border-violet-500/30 mb-6"
    >
      <h3 className="text-sm font-semibold text-white/80 mb-4">New Meeting</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            autoFocus
            type="text"
            placeholder="Meeting title *"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="datetime-local"
            value={form.meetingDate}
            onChange={(e) => setForm((f) => ({ ...f, meetingDate: e.target.value }))}
            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition"
          />
          <input
            type="text"
            placeholder="Participants (comma-separated)"
            value={form.participants}
            onChange={(e) => setForm((f) => ({ ...f, participants: e.target.value }))}
            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={saving || !form.title.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {saving ? 'Creating…' : 'Create Meeting'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white/70 hover:bg-white/[0.05] transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// ─── List container animation variants ───────────────────────────────────────

const listVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => {
    async function fetchMeetings() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/meetings');
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data: MeetingListItem[] = await res.json();
        setMeetings(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load meetings');
      } finally {
        setLoading(false);
      }
    }
    fetchMeetings();
  }, []);

  const filtered = useMemo(() => {
    let list = meetings;
    if (activeTab === 'week') list = list.filter((m) => isThisWeek(m.meetingDate));
    if (activeTab === 'month') list = list.filter((m) => isThisMonth(m.meetingDate));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.participants?.some((p) => p.toLowerCase().includes(q)) ||
          m.companyName?.toLowerCase().includes(q) ||
          m.aiSummary?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [meetings, activeTab, search]);

  function handleCreated(meeting: MeetingListItem) {
    setMeetings((prev) => [meeting, ...prev]);
    setShowNewForm(false);
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Meetings</h1>
          <p className="text-sm text-white/40 mt-0.5">Track and review your meeting notes</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowNewForm((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors shadow-lg shadow-violet-900/40"
        >
          <Plus className="w-4 h-4" />
          New Meeting
        </motion.button>
      </div>

      {/* Inline new meeting form */}
      <AnimatePresence>
        {showNewForm && (
          <NewMeetingInlineForm
            onClose={() => setShowNewForm(false)}
            onCreated={handleCreated}
          />
        )}
      </AnimatePresence>

      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          <input
            type="text"
            placeholder="Search meetings…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.05] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 p-1 bg-white/[0.04] border border-white/[0.07] rounded-xl">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                activeTab === tab.key
                  ? 'text-white'
                  : 'text-white/40 hover:text-white/60'
              )}
            >
              {activeTab === tab.key && (
                <motion.div
                  layoutId="tabIndicator"
                  className="absolute inset-0 rounded-lg bg-violet-600/80"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="glass rounded-xl p-4 border border-red-500/20 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Meetings grid */}
      {!loading && (
        <motion.div
          key={`${activeTab}-${search}`}
          variants={listVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {filtered.length === 0 ? (
            <EmptyState onNew={() => setShowNewForm(true)} />
          ) : (
            filtered.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))
          )}
        </motion.div>
      )}
    </div>
  );
}

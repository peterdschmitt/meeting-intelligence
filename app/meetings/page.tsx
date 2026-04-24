'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Loader2, CalendarDays, Calendar, Users, Building2, FileText, Mic, Cloud } from 'lucide-react';
import { cn, formatRelativeDate } from '@/lib/utils';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MeetingCardData {
  id: string;
  title: string;
  meetingDate: string | null;
  participants: string[] | null;
  aiSummary: string | null;
  source: string | null;
  companyName?: string | null;
}

interface MeetingListItem extends MeetingCardData {}

interface NewMeetingForm {
  title: string;
  meetingDate: string;
  participants: string;
}

type FilterTab = 'all' | 'week' | 'month';

// ─── Filter helpers ───────────────────────────────────────────────────────────

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

// ─── Source badge ──────────────────────────────────────────────────────────────

const sourceConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  manual: { label: 'Manual', icon: FileText },
  gdrive: { label: 'Google Drive', icon: Cloud },
  voice:  { label: 'Voice', icon: Mic },
};

function SourceBadge({ source }: { source: string | null }) {
  const key = (source ?? 'manual') as keyof typeof sourceConfig;
  const cfg = sourceConfig[key] ?? sourceConfig.manual;
  const Icon = cfg.icon;
  return (
    <span className="badge badge-gray" style={{ fontSize: '0.6rem' }}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

// ─── Row item ─────────────────────────────────────────────────────────────────

const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
};

function MeetingRow({ meeting }: { meeting: MeetingListItem }) {
  const initials = (meeting.participants?.[0] ?? 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Link href={`/meetings/${meeting.id}`} className="block">
      <motion.div
        variants={rowVariants}
        className="flex items-center gap-4 px-4 py-3 transition-colors cursor-pointer"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = 'transparent';
        }}
      >
        {/* Checkbox placeholder */}
        <div
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.15)',
            flexShrink: 0,
          }}
        />

        {/* Title + source */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: '#e6edf3' }}>
            {meeting.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <SourceBadge source={meeting.source} />
            {meeting.companyName && (
              <span className="flex items-center gap-1 text-xs" style={{ color: '#7d8590' }}>
                <Building2 className="w-3 h-3" />
                {meeting.companyName}
              </span>
            )}
          </div>
        </div>

        {/* Date */}
        <div className="shrink-0 flex items-center gap-1.5 text-xs" style={{ color: '#7d8590', minWidth: '100px' }}>
          <Calendar className="w-3.5 h-3.5" />
          {meeting.meetingDate ? formatRelativeDate(meeting.meetingDate) : '—'}
        </div>

        {/* Participants */}
        <div className="shrink-0 flex items-center gap-1.5 text-xs" style={{ color: '#7d8590', minWidth: '120px' }}>
          <Users className="w-3.5 h-3.5" />
          {meeting.participants && meeting.participants.length > 0
            ? meeting.participants.slice(0, 2).join(', ') +
              (meeting.participants.length > 2 ? ` +${meeting.participants.length - 2}` : '')
            : '—'}
        </div>

        {/* Assignee avatar */}
        <div
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{ background: '#2563eb', color: '#ffffff' }}
          title={meeting.participants?.[0] ?? ''}
        >
          {initials}
        </div>
      </motion.div>
    </Link>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div
      className="flex items-center gap-4 px-4 py-3 animate-pulse"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'rgba(255,255,255,0.07)' }} />
      <div className="flex-1">
        <div style={{ height: '12px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', width: '55%' }} />
        <div style={{ height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', width: '30%', marginTop: '6px' }} />
      </div>
      <div style={{ height: '10px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', width: '80px' }} />
      <div style={{ height: '10px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', width: '100px' }} />
      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
    </div>
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
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="card"
      style={{ padding: '20px', marginBottom: '16px', borderColor: 'rgba(37,99,235,0.3)' }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ color: '#e6edf3' }}>New Meeting</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          autoFocus
          type="text"
          placeholder="Meeting title *"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="w-full rounded-md px-3 py-2 text-sm focus:outline-none transition"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#e6edf3',
          }}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="datetime-local"
            value={form.meetingDate}
            onChange={(e) => setForm((f) => ({ ...f, meetingDate: e.target.value }))}
            className="w-full rounded-md px-3 py-2 text-sm focus:outline-none transition"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#7d8590',
            }}
          />
          <input
            type="text"
            placeholder="Participants (comma-separated)"
            value={form.participants}
            onChange={(e) => setForm((f) => ({ ...f, participants: e.target.value }))}
            className="w-full rounded-md px-3 py-2 text-sm focus:outline-none transition"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#e6edf3',
            }}
          />
        </div>
        {error && <p className="text-xs" style={{ color: '#f85149' }}>{error}</p>}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={saving || !form.title.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#2563eb', color: '#ffffff' }}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {saving ? 'Creating…' : 'Create Meeting'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm transition-colors"
            style={{ color: '#7d8590' }}
          >
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// ─── Tab counts ───────────────────────────────────────────────────────────────

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

  const counts = useMemo(() => ({
    all: meetings.length,
    week: meetings.filter((m) => isThisWeek(m.meetingDate)).length,
    month: meetings.filter((m) => isThisMonth(m.meetingDate)).length,
  }), [meetings]);

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
    <div style={{ padding: '32px 36px', maxWidth: '1100px' }}>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold" style={{ fontSize: '1.5rem', color: '#e6edf3' }}>Meetings</h1>
          <p className="text-sm mt-0.5" style={{ color: '#7d8590' }}>
            Track and review your meeting notes
          </p>
        </div>
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors"
          style={{ background: '#2563eb', color: '#ffffff' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#3b82f6'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#2563eb'; }}
        >
          <Plus className="w-4 h-4" />
          New Meeting
        </button>
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

      {/* Filter tabs + search */}
      <div className="flex items-center justify-between gap-4 mb-4">
        {/* Tabs */}
        <div
          className="flex items-center gap-0"
          style={{
            background: '#161b22',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: '4px',
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{
                background: activeTab === tab.key ? '#1c2128' : 'transparent',
                color: activeTab === tab.key ? '#e6edf3' : '#7d8590',
              }}
            >
              {tab.label}
              <span
                className="badge"
                style={
                  activeTab === tab.key
                    ? { background: '#2563eb', color: '#ffffff', border: 'none', padding: '1px 6px' }
                    : { background: 'rgba(255,255,255,0.06)', color: '#7d8590', border: 'none', padding: '1px 6px' }
                }
              >
                {counts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative" style={{ width: '260px' }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: '#484f58' }} />
          <input
            type="text"
            placeholder="Search meetings…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none transition"
            style={{
              background: '#161b22',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#e6edf3',
            }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="card mb-4 text-sm"
          style={{ padding: '12px 16px', color: '#f85149', borderColor: 'rgba(248,81,73,0.2)' }}
        >
          {error}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {/* Table header */}
        <div
          className="flex items-center gap-4 px-4 py-2"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#1c2128' }}
        >
          <div style={{ width: '16px', flexShrink: 0 }} />
          <div className="flex-1 section-label">Title</div>
          <div className="section-label" style={{ minWidth: '100px' }}>Date</div>
          <div className="section-label" style={{ minWidth: '120px' }}>Participants</div>
          <div style={{ width: '24px', flexShrink: 0 }} />
        </div>

        {/* Loading */}
        {loading && (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        )}

        {/* Rows */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="w-8 h-8 mb-3" style={{ color: '#484f58' }} />
            <p className="text-sm" style={{ color: '#7d8590' }}>No meetings found</p>
            <p className="text-xs mt-1" style={{ color: '#484f58' }}>
              Create your first meeting to get started
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <motion.div
            key={`${activeTab}-${search}`}
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.03 } } }}
          >
            {filtered.map((meeting) => (
              <MeetingRow key={meeting.id} meeting={meeting} />
            ))}
          </motion.div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="text-xs mt-3" style={{ color: '#484f58' }}>
          {filtered.length} meeting{filtered.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

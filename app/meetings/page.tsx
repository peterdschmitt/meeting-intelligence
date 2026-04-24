'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { formatRelativeDate } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeetingItem {
  id: string;
  title: string;
  meetingDate: string | null;
  participants: string[] | null;
  aiSummary: string | null;
  source: string | null;
  companyName?: string | null;
}

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
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return d >= start && d <= end;
}

function isThisMonth(date: string | null): boolean {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',   label: 'All' },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

// ─── New Meeting Form ─────────────────────────────────────────────────────────

function NewMeetingInlineForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (m: MeetingItem) => void;
}) {
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
      const created: MeetingItem = await res.json();
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
      style={{
        background: '#121212',
        border: '1px solid rgba(46,98,255,0.3)',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        marginBottom: '1rem',
      }}
    >
      <h3
        className="text-sm font-semibold"
        style={{ color: '#f4f4f5', marginBottom: '1rem' }}
      >
        New Meeting
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          autoFocus
          type="text"
          placeholder="Meeting title *"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="stitch-input"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="datetime-local"
            value={form.meetingDate}
            onChange={(e) => setForm((f) => ({ ...f, meetingDate: e.target.value }))}
            className="stitch-input"
            style={{ color: '#71717a' }}
          />
          <input
            type="text"
            placeholder="Participants (comma-separated)"
            value={form.participants}
            onChange={(e) => setForm((f) => ({ ...f, participants: e.target.value }))}
            className="stitch-input"
          />
        </div>
        {error && (
          <p style={{ color: '#ffb4ab', fontSize: '0.75rem' }}>{error}</p>
        )}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={saving || !form.title.trim()}
            className="btn-primary"
            style={{ fontSize: '0.75rem', opacity: saving || !form.title.trim() ? 0.5 : 1 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              {saving ? 'hourglass_empty' : 'add'}
            </span>
            {saving ? 'Creating…' : 'Create Meeting'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              background: 'none',
              border: 'none',
              color: '#71717a',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// ─── Meeting Card (grid tile) ─────────────────────────────────────────────────

function MeetingCard({ meeting }: { meeting: MeetingItem }) {
  const category = meeting.source ?? 'Manual';

  return (
    <Link href={`/meetings/${meeting.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <motion.div
        whileHover={{ borderColor: 'rgba(59,130,246,0.3)' }}
        className="meeting-card-sm"
        style={{ cursor: 'pointer' }}
      >
        {/* Top */}
        <div className="flex justify-between items-start" style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              background: '#18181b',
              borderRadius: '0.5rem',
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ color: '#60a5fa', fontSize: '20px' }}
            >
              event_note
            </span>
          </div>
          <span
            className="text-mono-data"
            style={{ color: '#71717a', fontSize: '10px', textTransform: 'uppercase' }}
          >
            {category}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-h3" style={{ color: '#ffffff', marginBottom: '0.75rem' }}>
          {meeting.title}
        </h3>

        {/* Summary */}
        {meeting.aiSummary ? (
          <p
            style={{
              color: '#71717a',
              fontSize: '0.8125rem',
              lineHeight: '1.5',
              marginBottom: '1.5rem',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {meeting.aiSummary}
          </p>
        ) : (
          <p
            style={{
              color: '#3f3f46',
              fontSize: '0.8125rem',
              fontStyle: 'italic',
              marginBottom: '1.5rem',
            }}
          >
            No summary yet
          </p>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '1rem',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Participants */}
          <div style={{ display: 'flex', gap: '-0.5rem' }}>
            {meeting.participants && meeting.participants.length > 0 ? (
              meeting.participants.slice(0, 3).map((p, i) => (
                <div
                  key={i}
                  title={p}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: '#2e62ff',
                    border: '2px solid #121212',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 700,
                    color: '#ffffff',
                    marginLeft: i > 0 ? '-8px' : '0',
                    position: 'relative',
                    zIndex: 3 - i,
                  }}
                >
                  {p.slice(0, 2).toUpperCase()}
                </div>
              ))
            ) : (
              <span style={{ color: '#3f3f46', fontSize: '11px' }}>No attendees</span>
            )}
          </div>
          <span style={{ color: '#71717a', fontSize: '11px' }}>
            {meeting.meetingDate ? formatRelativeDate(meeting.meetingDate) : '—'}
          </span>
        </div>
      </motion.div>
    </Link>
  );
}

// ─── Featured Meeting Card ────────────────────────────────────────────────────

function FeaturedMeetingCard({ meeting }: { meeting: MeetingItem }) {
  return (
    <Link href={`/meetings/${meeting.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div className="meeting-card-featured" style={{ height: '100%' }}>
        {/* Live badge */}
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>
          <span
            className="badge"
            style={{
              background: 'rgba(16,185,129,0.1)',
              color: '#34d399',
              border: '1px solid rgba(16,185,129,0.2)',
              gap: '6px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#10b981',
                display: 'inline-block',
                animation: 'pulse 2s infinite',
              }}
            />
            Latest
          </span>
        </div>

        <div style={{ marginBottom: 'auto' }}>
          {meeting.companyName && (
            <span
              className="text-mono-data"
              style={{ color: '#3b82f6', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}
            >
              {meeting.companyName}
            </span>
          )}
          <h2
            style={{
              fontSize: '2rem',
              fontWeight: 600,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              marginBottom: '1rem',
              maxWidth: '36rem',
            }}
          >
            {meeting.title}
          </h2>

          {/* Meta */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              color: '#71717a',
              fontSize: '0.875rem',
              marginBottom: '2rem',
            }}
          >
            {meeting.meetingDate && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  calendar_today
                </span>
                {formatRelativeDate(meeting.meetingDate)}
              </span>
            )}
            {meeting.participants && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  group
                </span>
                {meeting.participants.length} participants
              </span>
            )}
          </div>

          {/* AI Summary callout */}
          {meeting.aiSummary && (
            <div
              style={{
                borderLeft: '2px solid #3b82f6',
                paddingLeft: '1rem',
                marginBottom: '2rem',
                background: 'rgba(255,255,255,0.03)',
                padding: '1rem',
                borderRadius: '0 0.5rem 0.5rem 0',
              }}
            >
              <p
                style={{
                  color: '#d4d4d8',
                  fontSize: '0.9375rem',
                  lineHeight: '1.6',
                  fontStyle: 'italic',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                &ldquo;{meeting.aiSummary}&rdquo;
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '0.75rem',
                }}
              >
                <span
                  style={{
                    padding: '1px 6px',
                    background: 'rgba(59,130,246,0.2)',
                    color: '#60a5fa',
                    borderRadius: '2px',
                    fontSize: '9px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  AI Insight
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '1rem',
          }}
        >
          <div style={{ display: 'flex', marginLeft: '-8px' }}>
            {meeting.participants?.slice(0, 4).map((p, i) => (
              <div
                key={i}
                title={p}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#2e62ff',
                  border: '2px solid #121212',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#ffffff',
                  marginLeft: i > 0 ? '-10px' : '8px',
                  position: 'relative',
                  zIndex: 4 - i,
                }}
              >
                {p.slice(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.875rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            View Full Report
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              arrow_forward
            </span>
          </button>
        </div>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
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
        const data: MeetingItem[] = await res.json();
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
    all:   meetings.length,
    week:  meetings.filter((m) => isThisWeek(m.meetingDate)).length,
    month: meetings.filter((m) => isThisMonth(m.meetingDate)).length,
  }), [meetings]);

  const filtered = useMemo(() => {
    let list = meetings;
    if (activeTab === 'week')  list = list.filter((m) => isThisWeek(m.meetingDate));
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

  function handleCreated(meeting: MeetingItem) {
    setMeetings((prev) => [meeting, ...prev]);
    setShowNewForm(false);
  }

  const [featured, ...rest] = filtered;

  return (
    <div style={{ padding: '2rem', maxWidth: '1440px' }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        className="flex flex-col md:flex-row md:items-end justify-between gap-6"
        style={{ marginBottom: '3rem' }}
      >
        <div>
          <h1 className="text-h2" style={{ color: '#ffffff', marginBottom: '0.5rem' }}>
            Meeting Intelligence
          </h1>
          <p style={{ color: '#71717a', fontSize: '0.8125rem' }}>
            Review synthesized transcripts and key deliverables from your latest deal flow
            interactions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter tabs */}
          <div className="filter-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`filter-tab${activeTab === tab.key ? ' active' : ''}`}
              >
                {tab.label}
                <span
                  style={{
                    marginLeft: '4px',
                    fontSize: '10px',
                    color: activeTab === tab.key ? '#ffffff' : '#52525b',
                  }}
                >
                  ({counts[tab.key]})
                </span>
              </button>
            ))}
          </div>

          {/* New Meeting button */}
          <button
            onClick={() => setShowNewForm((v) => !v)}
            className="btn-primary"
            style={{ fontSize: '0.8125rem' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
            New Meeting
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ position: 'relative', maxWidth: '400px', marginBottom: '1.5rem' }}>
        <span
          className="material-symbols-outlined"
          style={{
            position: 'absolute',
            left: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#52525b',
            fontSize: '18px',
          }}
        >
          search
        </span>
        <input
          type="text"
          placeholder="Search meetings…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="stitch-input"
          style={{ paddingLeft: '2.5rem' }}
        />
      </div>

      {/* New meeting form */}
      <AnimatePresence>
        {showNewForm && (
          <NewMeetingInlineForm
            onClose={() => setShowNewForm(false)}
            onCreated={handleCreated}
          />
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'rgba(255,180,171,0.1)',
            border: '1px solid rgba(255,180,171,0.2)',
            borderRadius: '0.5rem',
            color: '#ffb4ab',
            fontSize: '0.875rem',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-12 gap-6">
          <div
            className="col-span-12 lg:col-span-8 animate-pulse"
            style={{
              background: '#121212',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '0.75rem',
              height: '320px',
            }}
          />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="col-span-12 md:col-span-6 lg:col-span-4 animate-pulse"
              style={{
                background: '#121212',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '0.75rem',
                height: '180px',
              }}
            />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '48px', color: '#27272a', marginBottom: '1rem', display: 'block' }}
          >
            event_note
          </span>
          <p style={{ color: '#52525b', fontSize: '0.9375rem' }}>No meetings found</p>
          <p style={{ color: '#3f3f46', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
            {search ? 'Try a different search term' : 'Create your first meeting to get started'}
          </p>
        </div>
      )}

      {/* Meeting grid — asymmetric Stitch layout */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-12 gap-6">
          {/* Featured card (first meeting) */}
          {featured && (
            <div className="col-span-12 lg:col-span-8">
              <FeaturedMeetingCard meeting={featured} />
            </div>
          )}

          {/* Side cards */}
          {rest.slice(0, 4).map((meeting) => (
            <div key={meeting.id} className="col-span-12 md:col-span-6 lg:col-span-4">
              <MeetingCard meeting={meeting} />
            </div>
          ))}
        </div>
      )}

      {/* Pagination footer */}
      {!loading && filtered.length > 0 && (
        <div
          style={{
            marginTop: '4rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            paddingTop: '2rem',
          }}
        >
          <p style={{ color: '#71717a', fontSize: '0.75rem' }}>
            Showing{' '}
            <span style={{ color: '#ffffff' }}>
              {Math.min(filtered.length, 5)}
            </span>{' '}
            of <span style={{ color: '#ffffff' }}>{filtered.length}</span> meetings
          </p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

interface Meeting {
  id: string;
  title: string;
  meetingDate: string | null;
  participants: string[] | string | null;
  aiSummary?: string | null;
  companyName?: string | null;
  source?: string | null;
}

interface ActionItem {
  id: string;
  meetingId: string | null;
  status: string | null;
}

type Tab = 'recent' | 'upcoming' | 'archived';

function parseParticipants(raw: string[] | string | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateStr));
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(dateStr));
}

function isPast(dateStr: string | null): boolean {
  if (!dateStr) return true;
  return new Date(dateStr).getTime() < Date.now() - 24 * 60 * 60 * 1000;
}

function isUpcoming(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr).getTime();
  const now = Date.now();
  return d > now - 60 * 60 * 1000; // within the last hour or future
}

function summaryExcerpt(s: string | null | undefined, max = 200): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trimEnd() + '…';
}

const SOURCE_CHIP: Record<string, { label: string; cls: string }> = {
  manual: { label: 'Manual',       cls: 'apex-chip-primary' },
  gdrive: { label: 'Google Drive', cls: 'apex-chip-primary' },
  voice:  { label: 'Voice Note',   cls: 'apex-chip-violet' },
};

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('recent');

  useEffect(() => {
    Promise.all([
      fetch('/api/meetings').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/action-items').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([m, a]) => {
        setMeetings(Array.isArray(m) ? (m as Meeting[]) : []);
        setActionItems(Array.isArray(a) ? (a as ActionItem[]) : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const actionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of actionItems) {
      if (a.meetingId && a.status !== 'done') {
        counts[a.meetingId] = (counts[a.meetingId] ?? 0) + 1;
      }
    }
    return counts;
  }, [actionItems]);

  const filtered = useMemo(() => {
    let list = meetings;
    if (tab === 'recent')   list = list.filter((m) => isPast(m.meetingDate));
    if (tab === 'upcoming') list = list.filter((m) => isUpcoming(m.meetingDate));
    // archived: catch-all = everything older than 60 days
    if (tab === 'archived') {
      const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
      list = list.filter((m) => m.meetingDate && new Date(m.meetingDate).getTime() < cutoff);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          (m.companyName?.toLowerCase().includes(q) ?? false) ||
          (m.aiSummary?.toLowerCase().includes(q) ?? false),
      );
    }

    return [...list].sort((a, b) => {
      const ad = a.meetingDate ? new Date(a.meetingDate).getTime() : 0;
      const bd = b.meetingDate ? new Date(b.meetingDate).getTime() : 0;
      return bd - ad;
    });
  }, [meetings, search, tab]);

  const [hero, ...rest] = filtered;

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '2rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          gap: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <p
            className="apex-label-caps"
            style={{ marginBottom: '0.5rem', color: 'var(--apex-text-muted)' }}
          >
            Navigation / Meetings
          </p>
          <h1 className="apex-h1" style={{ marginBottom: '0.375rem' }}>
            Meeting Intelligence
          </h1>
          <p style={{ color: 'var(--apex-text-secondary)', fontSize: '0.9375rem' }}>
            Review synthesized transcripts and AI deliverables for your latest deal-flow interactions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {(['recent', 'upcoming', 'archived'] as Tab[]).map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={active ? 'apex-btn-primary' : 'apex-btn-ghost'}
                style={{
                  textTransform: 'capitalize',
                  fontSize: '0.75rem',
                  padding: '0.375rem 0.875rem',
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </header>

      {/* Search row */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 480 }}>
          <span
            className="material-symbols-outlined"
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 18,
              color: 'var(--apex-text-muted)',
              pointerEvents: 'none',
            }}
          >
            search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, company, summary..."
            className="apex-search"
            style={{ width: '100%' }}
          />
        </div>
        <Link href="/import" className="apex-btn-primary">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          Import Meeting
        </Link>
      </div>

      {/* Hero card + grid */}
      {loading ? (
        <p style={{ color: 'var(--apex-text-muted)', fontSize: '0.875rem', padding: '2rem' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div
          className="apex-card"
          style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--apex-text-muted)' }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 36, opacity: 0.4, display: 'block', margin: '0 auto 0.75rem' }}
          >
            event_busy
          </span>
          <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>No meetings match this view.</p>
          <p style={{ fontSize: '0.75rem' }}>
            Try a different tab or{' '}
            <Link href="/import" style={{ color: 'var(--apex-primary-bright)' }}>
              import a new meeting
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          {/* Hero */}
          {hero && <HeroCard meeting={hero} actionCount={actionCounts[hero.id] ?? 0} />}

          {/* Grid */}
          {rest.length > 0 && (
            <div
              style={{
                marginTop: '1.5rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {rest.map((m) => (
                <MeetingCard key={m.id} meeting={m} actionCount={actionCounts[m.id] ?? 0} />
              ))}
            </div>
          )}

          <p
            className="apex-label-caps"
            style={{ marginTop: '2rem', color: 'var(--apex-text-muted)' }}
          >
            Showing {filtered.length} of {meetings.length} meetings
          </p>
        </>
      )}
    </div>
  );
}

function HeroCard({ meeting, actionCount }: { meeting: Meeting; actionCount: number }) {
  const parts = parseParticipants(meeting.participants);
  const summary = summaryExcerpt(meeting.aiSummary, 320);
  const sourceCfg = SOURCE_CHIP[meeting.source ?? 'manual'] ?? SOURCE_CHIP.manual;

  return (
    <Link href={`/meetings/${meeting.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <article
        className="apex-card"
        style={{
          padding: '1.75rem',
          borderColor: 'var(--apex-border-bright)',
          background: 'linear-gradient(180deg, rgba(46,98,255,0.06) 0%, rgba(24,24,27,0.4) 60%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: 3,
            background: 'var(--apex-primary)',
          }}
        />

        <header style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
          <span className="apex-label-caps" style={{ color: 'var(--apex-primary-bright)' }}>
            {meeting.companyName ?? 'Latest meeting'}
          </span>
          {actionCount > 0 && <span className="apex-chip apex-chip-violet">{actionCount} OPEN ACTIONS</span>}
          <span className={`apex-chip ${sourceCfg.cls}`}>{sourceCfg.label}</span>
        </header>

        <h2 className="apex-h2" style={{ marginBottom: '0.875rem', maxWidth: '70ch' }}>
          {meeting.title}
        </h2>

        {summary && (
          <p
            style={{
              color: 'var(--apex-text-secondary)',
              fontSize: '0.9375rem',
              lineHeight: 1.55,
              marginBottom: '1.25rem',
              fontStyle: 'italic',
              maxWidth: '78ch',
            }}
          >
            “{summary}”
          </p>
        )}

        <footer
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div
            className="apex-mono"
            style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', color: 'var(--apex-text-muted)', fontSize: '0.8125rem' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>calendar_today</span>
              {formatDate(meeting.meetingDate)}
            </span>
            {meeting.meetingDate && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>schedule</span>
                {formatTime(meeting.meetingDate)}
              </span>
            )}
            {parts.length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>group</span>
                {parts.length} participants
              </span>
            )}
          </div>
          <span
            className="apex-label-caps"
            style={{ color: 'var(--apex-primary-bright)', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
          >
            View Full Report
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
          </span>
        </footer>
      </article>
    </Link>
  );
}

function MeetingCard({ meeting, actionCount }: { meeting: Meeting; actionCount: number }) {
  const parts = parseParticipants(meeting.participants);
  const summary = summaryExcerpt(meeting.aiSummary, 110);
  const sourceCfg = SOURCE_CHIP[meeting.source ?? 'manual'] ?? SOURCE_CHIP.manual;

  return (
    <Link href={`/meetings/${meeting.id}`} style={{ textDecoration: 'none' }}>
      <article
        className="apex-card"
        style={{
          padding: '1.25rem',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
          <p
            className="apex-label-caps"
            style={{ color: 'var(--apex-text-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {meeting.companyName ?? 'No company'}
          </p>
          <span className={`apex-chip ${sourceCfg.cls}`}>{sourceCfg.label}</span>
        </header>

        <h3 className="apex-h3" style={{ fontSize: '1rem', lineHeight: 1.35 }}>
          {meeting.title}
        </h3>

        {summary && (
          <p
            style={{
              color: 'var(--apex-text-muted)',
              fontSize: '0.8125rem',
              lineHeight: 1.55,
              flex: 1,
            }}
          >
            {summary}
          </p>
        )}

        <footer
          style={{
            marginTop: 'auto',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--apex-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span className="apex-mono" style={{ color: 'var(--apex-text-muted)', fontSize: '0.75rem' }}>
            {formatDate(meeting.meetingDate)}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {parts.length > 0 && (
              <span
                style={{ color: 'var(--apex-text-muted)', fontSize: '0.6875rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>group</span>
                {parts.length}
              </span>
            )}
            {actionCount > 0 && (
              <span
                className="apex-chip apex-chip-violet"
                style={{ fontSize: '0.625rem', padding: '0.125rem 0.4375rem' }}
              >
                {actionCount} ACT
              </span>
            )}
          </div>
        </footer>
      </article>
    </Link>
  );
}

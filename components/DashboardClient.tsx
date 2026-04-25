'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface Meeting {
  id: string;
  title: string;
  meetingDate: string | null;
  participants: string[] | null;
  companyName?: string | null;
  aiSummary?: string | null;
}

interface ActionItem {
  id: string;
  title: string;
  status: string | null;
  assignee: string | null;
  meetingId: string | null;
  meetingTitle?: string | null;
  dueDate?: string | null;
  priority?: string | null;
}

interface Contact {
  id: string;
  fullName: string;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(dateStr));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dateStr));
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function relativeOverdue(dateStr: string | null): { label: string; severe: boolean } | null {
  if (!dateStr) return null;
  const due = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - due.getTime();
  if (diffMs <= 0) return null;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days >= 1) return { label: `${days} DAY${days > 1 ? 'S' : ''} OVERDUE`, severe: days >= 2 };
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  return { label: `${hours} HOUR${hours !== 1 ? 'S' : ''} OVERDUE`, severe: false };
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function initials(name: string | null | undefined): string {
  if (!name) return '·';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '·';
}

export default function DashboardClient() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(new Date()),
    [],
  );

  useEffect(() => {
    Promise.all([
      fetch('/api/meetings').then((r) => (r.ok ? r.json() : Promise.reject(r.statusText))),
      fetch('/api/action-items').then((r) => (r.ok ? r.json() : Promise.reject(r.statusText))),
      fetch('/api/contacts').then((r) => (r.ok ? r.json() : Promise.reject(r.statusText))),
    ])
      .then(([m, a, c]) => {
        setMeetings(Array.isArray(m) ? (m as Meeting[]) : []);
        setActionItems(Array.isArray(a) ? (a as ActionItem[]) : []);
        setContacts(Array.isArray(c) ? (c as Contact[]) : []);
      })
      .catch((err) => setLoadError(String(err)));
  }, []);

  const todaysMeetings = meetings.filter((m) => isToday(m.meetingDate)).slice(0, 4);
  const overdue = actionItems
    .filter((a) => a.status !== 'done' && relativeOverdue(a.dueDate ?? null))
    .slice(0, 4);
  const openActions = actionItems.filter((a) => a.status !== 'done');
  const completedToday = actionItems.filter((a) => a.status === 'done').length;
  const completionRate = actionItems.length > 0
    ? Math.round((completedToday / actionItems.length) * 100)
    : 0;

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '2rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Hero */}
      <section style={{ marginBottom: '2rem' }}>
        <h1 className="apex-h1" style={{ marginBottom: '0.5rem' }}>
          {greeting()}, Peter.
        </h1>
        <p style={{ color: 'var(--apex-text-secondary)', fontSize: '0.9375rem' }}>
          {todayLabel} — {todaysMeetings.length} meetings and {overdue.length} overdue actions requiring your attention.
        </p>
        {loadError && (
          <p style={{ color: 'var(--apex-error)', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
            Couldn&apos;t load data: {loadError}
          </p>
        )}
      </section>

      {/* Bento grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gap: '1.5rem',
        }}
      >
        {/* Today's Schedule — 8 cols */}
        <div className="apex-card" style={{ gridColumn: 'span 8', padding: '1.5rem' }}>
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--apex-primary-bright)' }}>
                event
              </span>
              <h3 className="apex-h3">Today&apos;s Schedule</h3>
            </div>
            <Link
              href="/meetings"
              className="apex-label-caps"
              style={{ color: 'var(--apex-primary-bright)', textDecoration: 'none' }}
            >
              View Calendar →
            </Link>
          </header>

          {todaysMeetings.length === 0 ? (
            <EmptyState icon="event_available" message="No meetings scheduled today." />
          ) : (
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="apex-timeline-line" />
              {todaysMeetings.map((m, idx) => {
                const parts = Array.isArray(m.participants) ? m.participants : [];
                return (
                  <Link
                    key={m.id}
                    href={`/meetings/${m.id}`}
                    style={{ position: 'relative', paddingLeft: '2.75rem', textDecoration: 'none', display: 'block' }}
                  >
                    <div className={`apex-timeline-node${idx === 0 ? ' active' : ''}`} />
                    <div
                      className="apex-card-flat"
                      style={{
                        padding: '1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span
                            className="apex-mono"
                            style={{ fontSize: '0.75rem', color: 'var(--apex-primary-bright)' }}
                          >
                            {formatTime(m.meetingDate)}
                          </span>
                          {idx === 0 && <span className="apex-chip apex-chip-emerald">Active</span>}
                        </div>
                        <h4
                          style={{
                            color: 'var(--apex-text)',
                            fontSize: '0.9375rem',
                            fontWeight: 600,
                            marginBottom: '0.25rem',
                          }}
                        >
                          {m.title}
                        </h4>
                        <p style={{ color: 'var(--apex-text-muted)', fontSize: '0.8125rem' }}>
                          {parts.length > 0
                            ? `${parts.slice(0, 2).join(', ')}${parts.length > 2 ? ` + ${parts.length - 2} others` : ''}`
                            : m.companyName ?? 'No participants listed'}
                        </p>
                      </div>
                      <span
                        className="material-symbols-outlined"
                        style={{ color: 'var(--apex-text-muted)', fontSize: 18, flexShrink: 0 }}
                      >
                        arrow_forward
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Overdue Actions — 4 cols */}
        <div className="apex-card" style={{ gridColumn: 'span 4', padding: '1.5rem' }}>
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--apex-error)' }}>
                assignment_late
              </span>
              <h3 className="apex-h3">Overdue Actions</h3>
            </div>
            <span className="apex-chip apex-chip-error">{overdue.length} TOTAL</span>
          </header>

          {overdue.length === 0 ? (
            <EmptyState icon="task_alt" message="Nothing overdue. Nice." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {overdue.map((a) => {
                const od = relativeOverdue(a.dueDate ?? null);
                return (
                  <Link
                    key={a.id}
                    href="/action-items"
                    className="apex-card-flat"
                    style={{
                      padding: '0.875rem',
                      textDecoration: 'none',
                      display: 'block',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <p
                      className="apex-label-caps"
                      style={{
                        color: od?.severe ? 'var(--apex-error)' : 'var(--apex-text-muted)',
                        marginBottom: '0.25rem',
                      }}
                    >
                      {od?.label ?? 'PENDING'}
                    </p>
                    <h4
                      style={{
                        color: 'var(--apex-text)',
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        marginBottom: '0.5rem',
                      }}
                    >
                      {a.title}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Avatar name={a.assignee} />
                      <span style={{ fontSize: '0.6875rem', color: 'var(--apex-text-muted)' }}>
                        {a.assignee ?? 'Unassigned'}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <Link
            href="/action-items"
            className="apex-btn-ghost"
            style={{ width: '100%', marginTop: '1rem', fontSize: '0.75rem' }}
          >
            Show All Actions
          </Link>
        </div>

        {/* Pipeline Health — 6 cols */}
        <div className="apex-card" style={{ gridColumn: 'span 6', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--apex-violet)' }}>
              psychology
            </span>
            <h3 className="apex-h3">Deal Intelligence</h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <ScoreRing pct={completionRate || 82} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ color: 'var(--apex-text)', fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                Action Completion Rate
              </h4>
              <p style={{ color: 'var(--apex-text-secondary)', fontSize: '0.8125rem', lineHeight: 1.55, marginBottom: '0.875rem' }}>
                {completedToday} of {actionItems.length} action items closed. {openActions.length} remain open across {meetings.length} meetings.
              </p>
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                <span className="apex-chip apex-chip-violet">Bullish</span>
                <span className="apex-chip apex-chip-primary">Active Pipeline</span>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Stats — 6 cols */}
        <div className="apex-card" style={{ gridColumn: 'span 6', padding: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--apex-text-secondary)' }}>
                insights
              </span>
              <h3 className="apex-h3">Network Activity</h3>
            </div>
            <span className="apex-mono apex-chip apex-chip-emerald" style={{ fontSize: '0.6875rem' }}>
              + {todaysMeetings.length} today
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            <StatTile label="Meetings" value={meetings.length} />
            <StatTile label="People" value={contacts.length} />
            <StatTile label="Open" value={openActions.length} accent="primary" />
            <StatTile label="Overdue" value={overdue.length} accent={overdue.length > 0 ? 'error' : 'muted'} />
          </div>
        </div>
      </div>

      {/* Floating Command Bar */}
      <div className="apex-cmdbar">
        <Link
          href="/import"
          className="apex-btn-primary"
          style={{ background: '#fff', color: '#09090b', borderRadius: '9999px', padding: '0.5rem 0.875rem' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          New Action
        </Link>
        <div style={{ width: 1, height: 16, background: 'var(--apex-border-bright)', margin: '0 0.25rem' }} />
        <CmdIcon icon="mic" label="Voice note" />
        <CmdIcon icon="description" label="New meeting" />
        <CmdIcon icon="mail" label="Outreach" />
        <div style={{ width: 1, height: 16, background: 'var(--apex-border-bright)', margin: '0 0.25rem' }} />
        <span
          className="apex-mono"
          style={{
            fontSize: '0.6875rem',
            color: 'var(--apex-text-muted)',
            padding: '0 0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
          }}
        >
          Press{' '}
          <kbd
            style={{
              background: 'rgba(255,255,255,0.08)',
              padding: '0.0625rem 0.375rem',
              borderRadius: '0.25rem',
              color: 'var(--apex-text-secondary)',
              marginLeft: '0.25rem',
            }}
          >
            ⌘K
          </kbd>
        </span>
      </div>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div
      style={{
        padding: '2.5rem 1rem',
        textAlign: 'center',
        color: 'var(--apex-text-muted)',
        fontSize: '0.8125rem',
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 32, opacity: 0.4, display: 'block', margin: '0 auto 0.5rem' }}>
        {icon}
      </span>
      {message}
    </div>
  );
}

function Avatar({ name }: { name: string | null | undefined }) {
  return (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: '9999px',
        background: 'var(--apex-primary-soft)',
        border: '1px solid var(--apex-border-bright)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.625rem',
        fontWeight: 700,
        color: 'var(--apex-primary-bright)',
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  );
}

function ScoreRing({ pct }: { pct: number }) {
  const safe = Math.max(0, Math.min(100, pct));
  const circumference = 2 * Math.PI * 36;
  const dash = (safe / 100) * circumference;
  return (
    <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
      <svg width={96} height={96} viewBox="0 0 96 96">
        <circle cx={48} cy={48} r={36} stroke="rgba(167, 139, 250, 0.15)" strokeWidth={6} fill="none" />
        <circle
          cx={48}
          cy={48}
          r={36}
          stroke="var(--apex-violet)"
          strokeWidth={6}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          fill="none"
          transform="rotate(-90 48 48)"
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--apex-text)',
          fontSize: '1.25rem',
          fontWeight: 800,
          letterSpacing: '-0.02em',
        }}
      >
        {safe}%
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'primary' | 'error' | 'muted';
}) {
  const valueColor =
    accent === 'primary'
      ? 'var(--apex-primary-bright)'
      : accent === 'error'
      ? 'var(--apex-error)'
      : 'var(--apex-text)';
  return (
    <div
      className="apex-card-flat"
      style={{
        padding: '0.875rem',
        textAlign: 'center',
      }}
    >
      <p className="apex-label-caps" style={{ marginBottom: '0.375rem' }}>
        {label}
      </p>
      <p
        className="apex-mono"
        style={{ fontSize: '1.375rem', fontWeight: 700, color: valueColor, lineHeight: 1 }}
      >
        {value}
      </p>
    </div>
  );
}

function CmdIcon({ icon, label }: { icon: string; label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      style={{
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: '9999px',
        color: 'var(--apex-text-secondary)',
        cursor: 'pointer',
        transition: 'background 0.15s ease, color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--apex-text)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--apex-text-secondary)';
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
        {icon}
      </span>
    </button>
  );
}

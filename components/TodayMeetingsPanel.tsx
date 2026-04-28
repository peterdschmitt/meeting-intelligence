'use client';

import { useEffect, useMemo, useState } from 'react';

interface PrepGuide {
  background: string[];
  updates_to_request: { person: string; item: string; question_to_ask: string }[];
  your_prep: string[];
  suggested_agenda: { topic: string; talking_points: string[]; time_estimate_min: number }[];
  desired_outcomes: string[];
  watch_out_for: string[];
}

interface TodayMeeting {
  id: string;
  title: string;
  startAt: string | null;
  endAt: string | null;
  calendarSource: string | null;
  joinUrl: string | null;
  platform: string | null;
  companyName: string | null;
  attendees: { name: string; email: string | null; roleAtMeeting: string | null }[];
  openActions: { id: string; title: string }[];
  externalActions: { id: string; title: string; assignee: string | null }[];
  peterActions: { id: string; title: string }[];
  prepGuide: PrepGuide | null;
  prepGuideGeneratedAt: string | null;
  prepGuideModel: string | null;
}

function fmtTimeRange(startISO: string | null, endISO: string | null): string {
  if (!startISO) return 'Time TBD';
  const start = new Date(startISO);
  const end = endISO ? new Date(endISO) : null;
  const opt: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' };
  const fmt = new Intl.DateTimeFormat('en-US', opt);
  return end ? `${fmt.format(start)} – ${fmt.format(end)}` : fmt.format(start);
}

function fmtGeneratedAt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  });
  return `Generated ${fmt.format(d)} ET`;
}

// "Today" / "Tomorrow" / "Mon, Apr 27" — used as a section heading between days.
function dayBucket(iso: string | null): string {
  if (!iso) return 'No date';
  const d = new Date(iso);
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const tomorrowKey = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const dayKey = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  if (dayKey === todayKey) return 'Today';
  if (dayKey === tomorrowKey) return 'Tomorrow';
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York',
  });
}

interface TodayMeetingsPanelProps {
  initialMeetings?: TodayMeeting[];
  /** How many days starting today to fetch+render. Defaults to 1 (today only). */
  days?: number;
}

export default function TodayMeetingsPanel({ initialMeetings, days = 1 }: TodayMeetingsPanelProps = {}) {
  const [meetings, setMeetings] = useState<TodayMeeting[]>(initialMeetings ?? []);
  const [loading, setLoading] = useState(initialMeetings === undefined);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (initialMeetings !== undefined) return;
    fetch(`/api/meetings/today?days=${days}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: TodayMeeting[]) => {
        setMeetings(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [initialMeetings, days]);

  // Default-expand if 1-2 meetings; collapse if 3+
  useEffect(() => {
    if (meetings.length === 0 || meetings.length > 2) return;
    setExpanded(new Set(meetings.map((m) => m.id)));
  }, [meetings]);

  const toggle = (id: string) => {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const regenerate = async (id: string) => {
    setRegenerating((s) => new Set(s).add(id));
    try {
      const res = await fetch(`/api/meetings/${id}/regenerate-prep`, { method: 'POST' });
      if (res.ok) {
        const fresh = await res.json();
        setMeetings((prev) =>
          prev.map((m) =>
            m.id === id
              ? {
                  ...m,
                  prepGuide: fresh.prepGuide,
                  prepGuideGeneratedAt: fresh.prepGuideGeneratedAt,
                  prepGuideModel: fresh.prepGuideModel,
                }
              : m
          )
        );
      }
    } finally {
      setRegenerating((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  };

  const sortedMeetings = useMemo(
    () =>
      [...meetings].sort((a, b) => {
        const at = a.startAt ? new Date(a.startAt).getTime() : Infinity;
        const bt = b.startAt ? new Date(b.startAt).getTime() : Infinity;
        return at - bt;
      }),
    [meetings]
  );

  if (loading) return null;
  if (sortedMeetings.length === 0) return null;

  return (
    <section
      style={{
        background: 'var(--apex-panel)',
        border: '1px solid var(--apex-border)',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--apex-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--apex-primary-bright)' }}>
          today
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--apex-text)' }}>
          Today
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--apex-text-muted)' }}>
          {sortedMeetings.length} meeting{sortedMeetings.length === 1 ? '' : 's'}
        </span>
      </header>

      {sortedMeetings.map((m, idx) => {
        const isOpen = expanded.has(m.id);
        const isRegen = regenerating.has(m.id);
        const myDay = dayBucket(m.startAt);
        const prevDay = idx > 0 ? dayBucket(sortedMeetings[idx - 1].startAt) : null;
        const showDayHeader = days > 1 && myDay !== prevDay;
        return (
          <div key={m.id} style={{ borderBottom: '1px solid var(--apex-border)' }}>
            {showDayHeader && (
              <div
                style={{
                  padding: '8px 12px 6px',
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: myDay === 'Today' ? 'var(--apex-primary-bright)' : 'var(--apex-text-muted)',
                  background: 'rgba(255,255,255,0.02)',
                  borderBottom: '1px solid var(--apex-border)',
                }}
              >
                {myDay}
              </div>
            )}
            <button
              onClick={() => toggle(m.id)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                color: 'var(--apex-text)',
                textAlign: 'left',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--apex-text-muted)', minWidth: 130 }}>
                {fmtTimeRange(m.startAt, m.endAt)}
              </span>
              <span style={{ flex: 1, fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.title}
              </span>
              <span style={{ fontSize: 11, color: 'var(--apex-text-muted)' }}>
                {m.attendees.length} att · {m.openActions.length} act
              </span>
              {m.joinUrl && (
                <a
                  href={m.joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="btn btn-primary"
                  style={{ height: 24, fontSize: 11, padding: '0 10px' }}
                >
                  Join
                </a>
              )}
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--apex-text-muted)' }}>
                {isOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {isOpen && (
              <div style={{ padding: '0 16px 14px', fontSize: 12, color: 'var(--apex-text)' }}>
                {m.prepGuide ? (
                  <PrepSections guide={m.prepGuide} />
                ) : (
                  <div style={{ padding: '12px 0', color: 'var(--apex-text-muted)' }}>
                    No prep guide yet.{' '}
                    <button
                      onClick={() => regenerate(m.id)}
                      disabled={isRegen}
                      className="btn btn-ghost"
                      style={{ height: 22, fontSize: 11 }}
                    >
                      {isRegen ? 'Generating…' : 'Generate guide'}
                    </button>
                  </div>
                )}
                {m.prepGuide && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 10.5, color: 'var(--apex-text-faint)' }}>
                    <button
                      onClick={() => regenerate(m.id)}
                      disabled={isRegen}
                      className="btn btn-ghost"
                      style={{ height: 22, fontSize: 11 }}
                    >
                      {isRegen ? 'Regenerating…' : '↻ Regenerate'}
                    </button>
                    <span>{fmtGeneratedAt(m.prepGuideGeneratedAt)}{m.prepGuideModel ? ` · ${m.prepGuideModel}` : ''}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'var(--apex-text-muted)',
        marginTop: 12,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function PrepSections({ guide }: { guide: PrepGuide }) {
  return (
    <>
      {guide.background?.length > 0 && (
        <>
          <SectionLabel>Background</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {guide.background.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </>
      )}
      {guide.updates_to_request?.length > 0 && (
        <>
          <SectionLabel>Updates to Request</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {guide.updates_to_request.map((u, i) => (
              <li key={i}>
                <strong>{u.person}</strong> — {u.item}
                <div style={{ color: 'var(--apex-text-muted)', fontStyle: 'italic' }}>&quot;{u.question_to_ask}&quot;</div>
              </li>
            ))}
          </ul>
        </>
      )}
      {guide.your_prep?.length > 0 && (
        <>
          <SectionLabel>Your Prep</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {guide.your_prep.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </>
      )}
      {guide.suggested_agenda?.length > 0 && (
        <>
          <SectionLabel>Suggested Agenda</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {guide.suggested_agenda.map((a, i) => (
              <li key={i}>
                <strong>{a.topic}</strong> ({a.time_estimate_min} min)
                {a.talking_points?.length > 0 && (
                  <ul style={{ marginTop: 2, paddingLeft: 18 }}>
                    {a.talking_points.map((tp, j) => <li key={j}>{tp}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {guide.desired_outcomes?.length > 0 && (
        <>
          <SectionLabel>Desired Outcomes</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {guide.desired_outcomes.map((o, i) => <li key={i}>{o}</li>)}
          </ul>
        </>
      )}
      {guide.watch_out_for?.length > 0 && (
        <>
          <SectionLabel>Watch Out For</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {guide.watch_out_for.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </>
      )}
    </>
  );
}

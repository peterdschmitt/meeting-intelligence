'use client';

import { useEffect, useMemo, useState } from 'react';
import ResizableSplit from '@/components/ResizableSplit';

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
  prepGuide: PrepGuide | null;
  prepGuideGeneratedAt: string | null;
  prepGuideModel: string | null;
}

const ET_FMT = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return ET_FMT.format(new Date(iso));
}

function fmtTimeRange(start: string | null, end: string | null): string {
  if (!start) return 'Time TBD';
  const s = ET_FMT.format(new Date(start));
  return end ? `${s} – ${ET_FMT.format(new Date(end))}` : s;
}

function fmtGenerated(iso: string | null): string {
  if (!iso) return '';
  return `Generated ${ET_FMT.format(new Date(iso))} ET`;
}

export default function TodayInboxPanel() {
  const [meetings, setMeetings] = useState<TodayMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/meetings/today')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: TodayMeeting[]) => {
        const list = Array.isArray(data) ? data : [];
        setMeetings(list);
        // Auto-select the next meeting (first one whose end_at is in the future,
        // or the first one if all are over).
        const now = Date.now();
        const next = list.find((m) => m.endAt && new Date(m.endAt).getTime() > now) ?? list[0] ?? null;
        if (next) setSelectedId(next.id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const sorted = useMemo(
    () =>
      [...meetings].sort((a, b) => {
        const at = a.startAt ? new Date(a.startAt).getTime() : Infinity;
        const bt = b.startAt ? new Date(b.startAt).getTime() : Infinity;
        return at - bt;
      }),
    [meetings]
  );

  const selected = sorted.find((m) => m.id === selectedId) ?? null;

  const regenerate = async (id: string) => {
    setRegenerating((s) => new Set(s).add(id));
    try {
      const res = await fetch(`/api/meetings/${id}/regenerate-prep`, { method: 'POST' });
      if (res.ok) {
        const fresh = await res.json();
        setMeetings((prev) =>
          prev.map((m) =>
            m.id === id
              ? { ...m, prepGuide: fresh.prepGuide, prepGuideGeneratedAt: fresh.prepGuideGeneratedAt, prepGuideModel: fresh.prepGuideModel }
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

  if (loading) return null;
  if (sorted.length === 0) return null;

  // ---------- Left pane: compact list ----------
  const leftPane = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--apex-bg)', minWidth: 0 }}>
      <div className="apex-page-header">
        <span className="apex-page-title">Today</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--apex-text-muted)' }}>
          {sorted.length} meeting{sorted.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="apex-grid-header" style={{ gridTemplateColumns: '90px 1fr 130px' }}>
        <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--apex-text-muted)', textTransform: 'uppercase' }}>Time</span>
        <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--apex-text-muted)', textTransform: 'uppercase' }}>Title</span>
        <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--apex-text-muted)', textTransform: 'uppercase' }}>Company</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sorted.map((m) => {
          const isSel = m.id === selectedId;
          return (
            <div
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`apex-grid-row${isSel ? ' selected' : ''}`}
              style={{
                gridTemplateColumns: '90px 1fr 130px',
                cursor: 'pointer',
                background: isSel ? 'rgba(46,98,255,0.08)' : undefined,
                borderLeft: isSel ? '2px solid var(--apex-primary-bright)' : '2px solid transparent',
              }}
            >
              <span className="cell-meta" style={{ fontFamily: 'var(--font-mono)' }}>{fmtTime(m.startAt)}</span>
              <span className="cell-primary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
              <span className="cell-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.companyName ?? '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ---------- Right pane: prep detail ----------
  const isRegen = selected ? regenerating.has(selected.id) : false;

  const rightPane = (
    <div className="detail-pane" style={{ background: 'var(--apex-panel)' }}>
      {selected ? (
        <>
          <div className="detail-pane-header" style={{ alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="apex-page-title" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selected.title}
              </span>
              <span style={{ fontSize: 11, color: 'var(--apex-text-muted)', fontFamily: 'var(--font-mono)' }}>
                {fmtTimeRange(selected.startAt, selected.endAt)}
                {selected.companyName ? ` · ${selected.companyName}` : ''}
                {selected.attendees.length > 0 ? ` · ${selected.attendees.length} att` : ''}
              </span>
            </div>
            {selected.joinUrl && (
              <a
                href={selected.joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ height: 26, fontSize: 11, padding: '0 12px' }}
              >
                Join
              </a>
            )}
            <button
              onClick={() => regenerate(selected.id)}
              disabled={isRegen}
              className="btn btn-ghost"
              style={{ height: 26, fontSize: 11 }}
              title="Regenerate prep guide"
            >
              {isRegen ? '…' : '↻'}
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px', fontSize: 12, color: 'var(--apex-text)' }}>
            {selected.prepGuide ? (
              <PrepSections guide={selected.prepGuide} />
            ) : (
              <div style={{ padding: '20px 0', color: 'var(--apex-text-muted)' }}>
                No prep guide yet.{' '}
                <button onClick={() => regenerate(selected.id)} disabled={isRegen} className="btn btn-ghost" style={{ height: 22, fontSize: 11, marginLeft: 4 }}>
                  {isRegen ? 'Generating…' : 'Generate'}
                </button>
              </div>
            )}
            {selected.prepGuide && selected.prepGuideGeneratedAt && (
              <div style={{ marginTop: 14, fontSize: 10.5, color: 'var(--apex-text-faint)' }}>
                {fmtGenerated(selected.prepGuideGeneratedAt)}
                {selected.prepGuideModel ? ` · ${selected.prepGuideModel}` : ''}
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--apex-text-faint)', fontSize: 12 }}>
          Select a meeting to see its prep guide
        </div>
      )}
    </div>
  );

  return (
    <div style={{ height: '100%', minHeight: 0 }}>
      <ResizableSplit
        left={leftPane}
        right={rightPane}
        defaultLeftPct={42}
        minLeftPx={320}
        minRightPx={360}
        storageKey="today-inbox-split"
      />
    </div>
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
        marginTop: 14,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function PrepSections({ guide }: { guide: PrepGuide }) {
  const empty =
    !guide.background?.length &&
    !guide.updates_to_request?.length &&
    !guide.your_prep?.length &&
    !guide.suggested_agenda?.length &&
    !guide.desired_outcomes?.length &&
    !guide.watch_out_for?.length;

  if (empty) {
    return (
      <div style={{ padding: '20px 0', color: 'var(--apex-text-muted)' }}>
        Prep guide was generated but contains no content (likely no prior meeting context to draw from). Try Regenerate after the meeting has a prior occurrence.
      </div>
    );
  }

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

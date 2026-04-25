'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Chapter {
  title: string;
  timestamp: string;
  bullets: string[];
}

interface ActionItem {
  id: string;
  title: string;
  assignee: string | null;
  status: string | null;
  meetingTimestamp: string | null;
}

interface Meeting {
  id: string;
  title: string;
  meetingDate: string | null;
  meetingTime: string | null;
  platform: string | null;
  participants: string[] | null;
  aiSummary: string | null;
  transcript: string | null;
  chapters: string | null;
  keyQuestions: string[] | null;
  companyName: string | null;
  source: string | null;
}

const STATUS_CHIP: Record<string, string> = {
  open: 'apex-chip-primary',
  in_progress: 'apex-chip-violet',
  done: 'apex-chip-emerald',
  blocked: 'apex-chip-error',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(dateStr));
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '·';
}

function parseChapters(raw: string | null): Chapter[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as Chapter[] : [];
  } catch { return []; }
}

function parseTranscript(raw: string): { timestamp: string; speaker: string; text: string }[] {
  const lines = raw.split('\n').filter((l) => l.trim());
  return lines.map((line) => {
    const m = line.match(/^\((\d{2}:\d{2})\)\s+([^:]+?):\s+(.+)$/);
    if (m) return { timestamp: m[1], speaker: m[2].trim(), text: m[3].trim() };
    const m2 = line.match(/^\((\d{2}:\d{2})\)\s+(.+)$/);
    if (m2) return { timestamp: m2[1], speaker: '', text: m2[2].trim() };
    return { timestamp: '', speaker: '', text: line.trim() };
  });
}

function cycleStatusValue(current: string | null): string {
  if (current === 'open') return 'in_progress';
  if (current === 'in_progress') return 'done';
  return 'open';
}

export default function MeetingDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightedTimestamp, setHighlightedTimestamp] = useState<string>('');
  const [addingAction, setAddingAction] = useState(false);
  const [newActionText, setNewActionText] = useState('');
  const [newActionAssignee, setNewActionAssignee] = useState('');

  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/meetings/${id}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/meetings/${id}/action-items`).then((r) => r.ok ? r.json() : []),
    ])
      .then(([m, a]) => {
        setMeeting(m as Meeting | null);
        setActionItems(Array.isArray(a) ? a as ActionItem[] : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const scrollTranscriptTo = useCallback((timestamp: string) => {
    setHighlightedTimestamp(timestamp);
    const el = transcriptRef.current?.querySelector(`[data-timestamp="${timestamp}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const cycleStatus = useCallback(async (ai: ActionItem) => {
    const newStatus = cycleStatusValue(ai.status);
    setActionItems((prev) => prev.map((a) => a.id === ai.id ? { ...a, status: newStatus } : a));
    try {
      await fetch(`/api/action-items/${ai.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      setActionItems((prev) => prev.map((a) => a.id === ai.id ? { ...a, status: ai.status } : a));
    }
  }, []);

  const handleSaveNewAction = useCallback(async () => {
    if (!newActionText.trim()) return;
    try {
      const res = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newActionText, assignee: newActionAssignee || null, meetingId: id, status: 'open' }),
      });
      if (res.ok) {
        const created = await res.json() as ActionItem;
        setActionItems((prev) => [...prev, created]);
        setNewActionText('');
        setNewActionAssignee('');
        setAddingAction(false);
      }
    } catch { /* ignore */ }
  }, [newActionText, newActionAssignee, id]);

  if (loading) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--apex-text-muted)' }}>
        Loading meeting…
      </div>
    );
  }

  if (!meeting) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--apex-text-muted)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 32, opacity: 0.4, display: 'block', margin: '0 auto 0.75rem' }}>
          event_busy
        </span>
        <p style={{ fontSize: '0.875rem' }}>Meeting not found.</p>
        <Link href="/meetings" className="apex-btn-ghost" style={{ marginTop: '1rem', display: 'inline-flex' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
          Back to Meetings
        </Link>
      </div>
    );
  }

  const chapters = parseChapters(meeting.chapters);
  const parsedTranscript = meeting.transcript ? parseTranscript(meeting.transcript) : [];
  const participants = meeting.participants ?? [];
  const keyQuestions = meeting.keyQuestions ?? [];

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '2rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Breadcrumb + header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href="/meetings"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            color: 'var(--apex-text-muted)',
            fontSize: '0.75rem',
            textDecoration: 'none',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            fontWeight: 600,
            marginBottom: '0.875rem',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
          Meetings
        </Link>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="apex-label-caps" style={{ marginBottom: '0.5rem', color: 'var(--apex-primary-bright)' }}>
              {meeting.companyName ?? 'AI Executive Summary'}
            </p>
            <h1 className="apex-h1" style={{ marginBottom: '0.625rem', fontSize: '2rem' }}>
              {meeting.title}
            </h1>
            <div className="apex-mono" style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', color: 'var(--apex-text-muted)', fontSize: '0.8125rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>calendar_today</span>
                {formatDate(meeting.meetingDate)}
              </span>
              {meeting.meetingTime && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>schedule</span>
                  {meeting.meetingTime}
                </span>
              )}
              {meeting.platform && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>videocam</span>
                  {meeting.platform}
                </span>
              )}
              {participants.length > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>group</span>
                  {participants.length} participants
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button className="apex-btn-ghost">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>share</span>
              Share
            </button>
            <button className="apex-btn-primary">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
              Re-summarize
            </button>
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.4fr) minmax(280px, 1fr)', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* AI Summary */}
          <div className="apex-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--apex-violet)' }}>psychology</span>
              <h3 className="apex-h3">AI Executive Summary</h3>
            </div>
            {meeting.aiSummary ? (
              <p style={{ color: 'var(--apex-text-secondary)', fontSize: '0.9375rem', lineHeight: 1.7 }}>
                {meeting.aiSummary}
              </p>
            ) : (
              <p style={{ color: 'var(--apex-text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                No AI summary available yet.
              </p>
            )}
          </div>

          {/* Chapters TOC */}
          {chapters.length > 0 && (
            <div className="apex-card" style={{ padding: '1.25rem' }}>
              <p className="apex-label-caps" style={{ marginBottom: '0.875rem' }}>Chapters · {chapters.length}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {chapters.map((ch, i) => (
                  <button
                    key={i}
                    onClick={() => scrollTranscriptTo(ch.timestamp)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      background: 'transparent',
                      border: '1px solid transparent',
                      borderRadius: '0.5rem',
                      color: 'var(--apex-text-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      transition: 'background 0.12s, border-color 0.12s, color 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--apex-border)';
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--apex-text)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--apex-text-secondary)';
                    }}
                  >
                    <span className="apex-mono" style={{ fontSize: '0.75rem', color: 'var(--apex-primary-bright)', minWidth: 50 }}>{ch.timestamp}</span>
                    <span style={{ fontSize: '0.8125rem' }}>{ch.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Transcript */}
          <div className="apex-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="apex-h3">Transcript</h3>
              <span className="apex-label-caps">{parsedTranscript.length} lines</span>
            </header>

            {parsedTranscript.length === 0 ? (
              <p style={{ color: 'var(--apex-text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                No transcript available.
              </p>
            ) : (
              <div ref={transcriptRef} style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', maxHeight: 720, overflowY: 'auto', position: 'relative' }}>
                {parsedTranscript.map((line, i) => {
                  const isHighlighted = highlightedTimestamp && highlightedTimestamp === line.timestamp;
                  return (
                    <div
                      key={i}
                      data-timestamp={line.timestamp || undefined}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '60px 1fr',
                        gap: '0.875rem',
                        padding: '0.625rem 0.75rem',
                        borderRadius: '0.5rem',
                        background: isHighlighted ? 'var(--apex-primary-soft)' : 'transparent',
                        borderLeft: isHighlighted ? '2px solid var(--apex-primary)' : '2px solid transparent',
                        transition: 'background 0.18s ease',
                      }}
                    >
                      <span className="apex-mono" style={{ fontSize: '0.6875rem', color: 'var(--apex-text-muted)', paddingTop: 2 }}>
                        {line.timestamp}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        {line.speaker && (
                          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--apex-primary-bright)', marginBottom: '0.125rem' }}>
                            {line.speaker}
                          </p>
                        )}
                        <p style={{ fontSize: '0.875rem', color: 'var(--apex-text-secondary)', lineHeight: 1.55, margin: 0 }}>
                          {line.text}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'sticky', top: '1.5rem' }}>
          {/* Action items */}
          <div className="apex-card" style={{ padding: '1.25rem' }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 className="apex-h3">Action Items</h3>
              <button
                onClick={() => setAddingAction(true)}
                className="apex-btn-ghost"
                style={{ fontSize: '0.6875rem', padding: '0.25rem 0.625rem' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                Add
              </button>
            </header>

            {actionItems.length === 0 ? (
              <p style={{ color: 'var(--apex-text-muted)', fontSize: '0.8125rem', fontStyle: 'italic' }}>
                No action items captured.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {actionItems.map((ai) => {
                  const status = ai.status ?? 'open';
                  const isDone = status === 'done';
                  return (
                    <button
                      key={ai.id}
                      onClick={() => ai.meetingTimestamp && scrollTranscriptTo(ai.meetingTimestamp)}
                      className="apex-card-flat"
                      style={{
                        padding: '0.75rem 0.875rem',
                        textAlign: 'left',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--apex-border)',
                        cursor: ai.meetingTimestamp ? 'pointer' : 'default',
                        fontFamily: 'inherit',
                        color: 'var(--apex-text)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span
                          className={`apex-chip ${STATUS_CHIP[status] ?? 'apex-chip-primary'}`}
                          onClick={(e) => { e.stopPropagation(); cycleStatus(ai); }}
                          title="Click to cycle status"
                          style={{ cursor: 'pointer' }}
                        >
                          {status.replace('_', ' ').toUpperCase()}
                        </span>
                        {ai.meetingTimestamp && (
                          <span className="apex-mono" style={{ fontSize: '0.6875rem', color: 'var(--apex-primary-bright)' }}>
                            @{ai.meetingTimestamp}
                          </span>
                        )}
                      </div>
                      <p style={{
                        fontSize: '0.8125rem',
                        color: 'var(--apex-text)',
                        textDecoration: isDone ? 'line-through' : 'none',
                        opacity: isDone ? 0.6 : 1,
                        margin: 0,
                        marginBottom: ai.assignee ? '0.375rem' : 0,
                        lineHeight: 1.4,
                      }}>
                        {ai.title}
                      </p>
                      {ai.assignee && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <Avatar name={ai.assignee} size={20} />
                          <span style={{ fontSize: '0.6875rem', color: 'var(--apex-text-muted)' }}>{ai.assignee}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {addingAction && (
              <div style={{ marginTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input
                  placeholder="New action item…"
                  value={newActionText}
                  onChange={(e) => setNewActionText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveNewAction()}
                  autoFocus
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--apex-border)',
                    color: 'var(--apex-text)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.8125rem',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <input
                  placeholder="Assignee"
                  value={newActionAssignee}
                  onChange={(e) => setNewActionAssignee(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveNewAction()}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--apex-border)',
                    color: 'var(--apex-text)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.8125rem',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  <button onClick={handleSaveNewAction} className="apex-btn-primary" style={{ flex: 1, fontSize: '0.75rem' }}>Add</button>
                  <button onClick={() => setAddingAction(false)} className="apex-btn-ghost" style={{ fontSize: '0.75rem' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Participants */}
          {participants.length > 0 && (
            <div className="apex-card" style={{ padding: '1.25rem' }}>
              <h3 className="apex-h3" style={{ marginBottom: '1rem' }}>Participants</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {participants.map((p, i) => (
                  <Link
                    key={i}
                    href={`/contacts?q=${encodeURIComponent(p)}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.625rem',
                      padding: '0.5rem 0.625rem',
                      borderRadius: '0.375rem',
                      textDecoration: 'none',
                      color: 'var(--apex-text-secondary)',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
                  >
                    <Avatar name={p} size={28} />
                    <span style={{ fontSize: '0.8125rem' }}>{p}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Key Questions */}
          {keyQuestions.length > 0 && (
            <div className="apex-card" style={{ padding: '1.25rem' }}>
              <h3 className="apex-h3" style={{ marginBottom: '0.875rem' }}>Key Questions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {keyQuestions.map((q, i) => (
                  <p
                    key={i}
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--apex-text-secondary)',
                      lineHeight: 1.5,
                      paddingLeft: '0.75rem',
                      borderLeft: '2px solid var(--apex-violet)',
                    }}
                  >
                    {q}
                  </p>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <div
      style={{
        width: size, height: size,
        borderRadius: '9999px',
        background: 'var(--apex-primary-soft)',
        border: '1px solid var(--apex-border-bright)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size >= 32 ? '0.75rem' : '0.625rem',
        fontWeight: 700,
        color: 'var(--apex-primary-bright)',
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ResizableSplit from '@/components/ResizableSplit';

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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateStr));
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '·';
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
  const [activeChapter, setActiveChapter] = useState<number>(-1);
  const [highlightedTimestamp, setHighlightedTimestamp] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
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
    return <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>Loading…</div>;
  }
  if (!meeting) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--apex-text-muted)', marginBottom: 12 }}>Meeting not found.</p>
        <Link href="/meetings" className="btn btn-ghost">← Meetings</Link>
      </div>
    );
  }

  const chapters = parseChapters(meeting.chapters);
  const parsedTranscript = meeting.transcript ? parseTranscript(meeting.transcript) : [];
  const participants = meeting.participants ?? [];
  const keyQuestions = meeting.keyQuestions ?? [];

  // LEFT — chapters + key questions (slim rail)
  const leftPane = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--apex-bg)', minWidth: 0 }}>
      <div className="apex-page-header">
        <span className="apex-page-title">Chapters</span>
        <span className="cell-meta">{chapters.length}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {chapters.length === 0 ? (
          <div style={{ padding: '20px 14px', fontSize: 11, color: 'var(--apex-text-faint)' }}>No chapters</div>
        ) : (
          chapters.map((ch, i) => (
            <div
              key={i}
              className={`apex-grid-row${activeChapter === i ? ' selected' : ''}`}
              style={{ gridTemplateColumns: '52px 1fr', minHeight: 32, padding: '6px 14px', alignItems: 'flex-start' }}
              onClick={() => { setActiveChapter(i); scrollTranscriptTo(ch.timestamp); }}
            >
              <span className="cell-meta" style={{ fontSize: 10.5 }}>{ch.timestamp}</span>
              <span style={{ fontSize: 11.5, color: 'var(--apex-text-secondary)', whiteSpace: 'normal', lineHeight: 1.35 }}>{ch.title}</span>
            </div>
          ))
        )}

        {keyQuestions.length > 0 && (
          <>
            <div className="apex-group-header" style={{ marginTop: 8 }}>Key Questions</div>
            {keyQuestions.map((q, i) => (
              <div key={i} style={{ padding: '7px 14px', borderBottom: '1px solid var(--apex-border)', fontSize: 11.5, color: 'var(--apex-text-secondary)', lineHeight: 1.45 }}>
                {q}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );

  // CENTER — summary + transcript
  const centerPane = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--apex-panel)', borderLeft: '1px solid var(--apex-border)' }}>
      {/* Summary */}
      {meeting.aiSummary && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--apex-border)', background: 'rgba(46,98,255,0.04)', flexShrink: 0 }}>
          <div className="detail-section-label" style={{ marginBottom: 4 }}>AI Summary</div>
          <p style={{ fontSize: 12, color: 'var(--apex-text-secondary)', lineHeight: 1.55, maxHeight: 120, overflowY: 'auto' }}>
            {meeting.aiSummary}
          </p>
        </div>
      )}

      <div className="apex-group-header" style={{ cursor: 'default' }}>
        <span>Transcript</span>
        <span>{parsedTranscript.length} lines</span>
      </div>

      <div ref={transcriptRef} style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
        {parsedTranscript.length === 0 ? (
          <div style={{ padding: '20px 0', fontSize: 11, color: 'var(--apex-text-faint)' }}>No transcript</div>
        ) : (
          parsedTranscript.map((line, i) => (
            <div
              key={i}
              data-timestamp={line.timestamp || undefined}
              style={{
                display: 'grid',
                gridTemplateColumns: '46px 96px 1fr',
                gap: 8,
                padding: '4px 0',
                borderBottom: '1px solid rgba(255,255,255,0.025)',
                background: highlightedTimestamp && highlightedTimestamp === line.timestamp ? 'var(--apex-primary-soft)' : 'transparent',
                transition: 'background 0.18s',
              }}
            >
              <span className="cell-meta" style={{ fontSize: 10, paddingTop: 2 }}>{line.timestamp}</span>
              <span style={{ fontSize: 10.5, color: 'var(--apex-primary-bright)', fontWeight: 600, paddingTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line.speaker}</span>
              <span style={{ fontSize: 11.5, color: 'var(--apex-text-secondary)', lineHeight: 1.45 }}>{line.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // RIGHT — actions + participants
  const rightPane = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--apex-bg)', borderLeft: '1px solid var(--apex-border)' }}>
      <div className="apex-page-header">
        <span className="apex-page-title">Actions ({actionItems.length})</span>
        <button className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 11 }} onClick={() => setAddingAction(true)}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
          Add
        </button>
      </div>

      <div className="apex-grid-header" style={{ gridTemplateColumns: '64px 1fr 70px' }}>
        <span>Status</span><span>Task</span><span style={{ textAlign: 'right' }}>Owner</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {actionItems.length === 0 ? (
          <div style={{ padding: '20px 14px', fontSize: 11, color: 'var(--apex-text-faint)' }}>No action items</div>
        ) : (
          actionItems.map((ai) => {
            const status = ai.status ?? 'open';
            return (
              <div
                key={ai.id}
                className={`apex-grid-row${selectedAction === ai.id ? ' selected' : ''}`}
                style={{ gridTemplateColumns: '64px 1fr 70px', minHeight: 30, padding: '5px 14px' }}
                onClick={() => {
                  setSelectedAction(ai.id);
                  if (ai.meetingTimestamp) scrollTranscriptTo(ai.meetingTimestamp);
                }}
              >
                <span
                  className={`badge badge-${status}`}
                  onClick={(e) => { e.stopPropagation(); cycleStatus(ai); }}
                  title="Click to cycle status"
                >
                  {status.replace('_', ' ')}
                </span>
                <span className={status === 'done' ? 'cell-done' : 'cell-primary'} style={{ fontSize: 11.5 }}>{ai.title}</span>
                <span className="cell-meta" style={{ fontSize: 10, textAlign: 'right' }}>{(ai.assignee ?? '').split(' ')[0]}</span>
              </div>
            );
          })
        )}
      </div>

      {addingAction && (
        <div style={{ padding: 8, borderTop: '1px solid var(--apex-border)', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          <input
            className="inline-input"
            placeholder="Action item…"
            value={newActionText}
            onChange={(e) => setNewActionText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveNewAction()}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              className="inline-input"
              placeholder="Assignee"
              value={newActionAssignee}
              onChange={(e) => setNewActionAssignee(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveNewAction()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={handleSaveNewAction}>Add</button>
            <button className="btn btn-ghost" onClick={() => setAddingAction(false)}>×</button>
          </div>
        </div>
      )}

      {participants.length > 0 && (
        <>
          <div className="apex-group-header" style={{ cursor: 'default' }}>
            <span>Participants</span>
            <span>{participants.length}</span>
          </div>
          <div style={{ padding: 8, display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0 }}>
            {participants.slice(0, 24).map((p, i) => (
              <Link key={i} href={`/contacts?q=${encodeURIComponent(p)}`} title={p} style={{ display: 'inline-flex' }}>
                <span className="avatar">{initials(p)}</span>
              </Link>
            ))}
            {participants.length > 24 && <span className="avatar accent" title={`${participants.length - 24} more`}>+{participants.length - 24}</span>}
          </div>
        </>
      )}
    </div>
  );

  const centerRight = (
    <ResizableSplit
      left={centerPane}
      right={rightPane}
      defaultLeftPct={66}
      minLeftPx={400}
      minRightPx={280}
      storageKey="meeting-detail-cr"
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--apex-bg)' }}>
      {/* Title + meta strip */}
      <div className="apex-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          <Link href="/meetings" className="btn-icon" aria-label="Back" style={{ flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
          </Link>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--apex-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
            {meeting.title}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button className="btn btn-ghost"><span className="material-symbols-outlined">share</span>Share</button>
          <button className="btn btn-primary"><span className="material-symbols-outlined">auto_awesome</span>Re-summarize</button>
        </div>
      </div>

      <div className="apex-statbar">
        <div className="apex-stat"><span className="apex-stat-value mono" style={{ fontSize: 12 }}>{formatDate(meeting.meetingDate)}</span></div>
        {meeting.meetingTime && <div className="apex-stat"><span className="cell-meta">{meeting.meetingTime}</span></div>}
        {meeting.platform && <div className="apex-stat"><span className="cell-meta">{meeting.platform}</span></div>}
        {meeting.companyName && <div className="apex-stat"><span className="cell-secondary" style={{ fontSize: 11.5 }}>{meeting.companyName}</span></div>}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          {participants.slice(0, 8).map((p, i) => (
            <span key={i} className="avatar" title={p}>{initials(p)}</span>
          ))}
          {participants.length > 8 && (
            <span className="avatar accent">+{participants.length - 8}</span>
          )}
        </div>
      </div>

      {/* 3-pane */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <ResizableSplit
          left={leftPane}
          right={centerRight}
          defaultLeftPct={20}
          minLeftPx={180}
          minRightPx={520}
          storageKey="meeting-detail-lc"
        />
      </div>
    </div>
  );
}

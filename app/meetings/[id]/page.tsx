'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
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

function parseChapters(raw: string | null): Chapter[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as Chapter[] : [];
  } catch { return []; }
}

function parseTranscript(raw: string): { timestamp: string; speaker: string; text: string }[] {
  const lines = raw.split('\n').filter(l => l.trim());
  return lines.map(line => {
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
      fetch(`/api/meetings/${id}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/meetings/${id}/action-items`).then(r => r.ok ? r.json() : []),
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
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const cycleStatus = useCallback(async (ai: ActionItem) => {
    const newStatus = cycleStatusValue(ai.status);
    setActionItems(prev => prev.map(a => a.id === ai.id ? { ...a, status: newStatus } : a));
    try {
      await fetch(`/api/action-items/${ai.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      setActionItems(prev => prev.map(a => a.id === ai.id ? { ...a, status: ai.status } : a));
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
        setActionItems(prev => [...prev, created]);
        setNewActionText('');
        setNewActionAssignee('');
        setAddingAction(false);
      }
    } catch { /* ignore */ }
  }, [newActionText, newActionAssignee, id]);

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <span className="cell-meta">Loading…</span>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div style={{ height: '100%', background: '#0a0a0a', padding: 32 }}>
        <span className="cell-meta">Meeting not found.</span>
        <a href="/meetings" style={{ display: 'block', marginTop: 12, fontSize: 11, color: '#d97706' }}>← Back to Meetings</a>
      </div>
    );
  }

  const chapters = parseChapters(meeting.chapters);
  const parsedTranscript = meeting.transcript ? parseTranscript(meeting.transcript) : [];
  const participants = meeting.participants ?? [];

  // LEFT PANE
  const leftPane = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a', overflow: 'hidden' }}>
      <div className="page-header">
        <span className="page-title">Chapters</span>
        <span className="cell-meta">{chapters.length}</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {chapters.length === 0 ? (
          <div style={{ padding: '16px 12px' }}>
            <span className="cell-meta">No chapters</span>
          </div>
        ) : (
          chapters.map((ch, i) => (
            <div
              key={i}
              className={`grid-row${activeChapter === i ? ' selected' : ''}`}
              style={{ gridTemplateColumns: '44px 1fr', height: 'auto', minHeight: 30, padding: '6px 12px', alignItems: 'start', cursor: 'pointer' }}
              onClick={() => {
                setActiveChapter(i);
                scrollTranscriptTo(ch.timestamp);
              }}
            >
              <span className="cell-meta" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{ch.timestamp}</span>
              <span className="cell-secondary" style={{ fontSize: 11, whiteSpace: 'normal', lineHeight: 1.3 }}>{ch.title}</span>
            </div>
          ))
        )}

        {(meeting.keyQuestions ?? []).length > 0 && (
          <>
            <div className="group-header" style={{ marginTop: 8 }}>Key Questions</div>
            {(meeting.keyQuestions ?? []).map((q, i) => (
              <div key={i} style={{ padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11, color: '#b4b4bc', lineHeight: 1.4 }}>
                {q}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );

  // CENTER PANE
  const centerPane = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#111111', overflow: 'hidden' }}>
      {/* AI Summary */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(217,119,6,0.04)', flexShrink: 0 }}>
        <div className="detail-section-label" style={{ marginBottom: 6 }}>AI Summary</div>
        <p style={{ fontSize: 12, color: '#d4d4d8', lineHeight: 1.6 }}>
          {meeting.aiSummary ?? <span className="cell-meta">No summary available</span>}
        </p>
      </div>

      {/* Transcript header */}
      <div className="group-header" style={{ cursor: 'default' }}>
        <span>Transcript</span>
        <span>{parsedTranscript.length} lines</span>
      </div>

      {/* Transcript feed */}
      <div ref={transcriptRef} style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
        {parsedTranscript.length === 0 ? (
          <div style={{ padding: '24px 0' }}>
            <span className="cell-meta">No transcript available</span>
          </div>
        ) : (
          parsedTranscript.map((line, i) => (
            <div
              key={i}
              data-timestamp={line.timestamp || undefined}
              style={{
                display: 'grid',
                gridTemplateColumns: '44px 90px 1fr',
                gap: '0 8px',
                padding: '3px 0',
                borderBottom: '1px solid rgba(255,255,255,0.025)',
                alignItems: 'start',
                background: highlightedTimestamp && highlightedTimestamp === line.timestamp ? 'rgba(217,119,6,0.08)' : 'transparent',
              }}
            >
              <span style={{ fontSize: 9, color: '#555560', fontFamily: 'var(--font-mono)', paddingTop: 2 }}>{line.timestamp || ''}</span>
              <span style={{ fontSize: 10, color: '#d97706', fontWeight: 600, paddingTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line.speaker || ''}</span>
              <span style={{ fontSize: 11, color: '#c4c4cc', lineHeight: 1.4 }}>{line.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // RIGHT PANE
  const rightPane = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d0d0d' }}>
      <div className="page-header">
        <span className="page-title">Actions ({actionItems.length})</span>
        <button className="action-btn" style={{ fontSize: 9, padding: '2px 8px' }} onClick={() => setAddingAction(true)}>+ Add</button>
      </div>
      <div className="grid-header" style={{ gridTemplateColumns: '56px 1fr 80px' }}>
        <span>Status</span><span>Task</span><span>Who</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {actionItems.length === 0 ? (
          <div style={{ padding: '24px 12px' }}>
            <span className="cell-meta">No action items</span>
          </div>
        ) : (
          actionItems.map(ai => (
            <div
              key={ai.id}
              className="grid-row"
              style={{
                gridTemplateColumns: '56px 1fr 80px',
                cursor: 'pointer',
                background: selectedAction === ai.id ? 'rgba(217,119,6,0.08)' : undefined,
                height: 'auto',
                minHeight: 30,
                padding: '5px 12px',
                alignItems: 'center',
              }}
              onClick={() => {
                setSelectedAction(ai.id);
                if (ai.meetingTimestamp) scrollTranscriptTo(ai.meetingTimestamp);
              }}
            >
              <span
                className={`badge badge-${ai.status || 'open'}`}
                onClick={(e) => { e.stopPropagation(); cycleStatus(ai); }}
                title="Click to cycle status"
              >{ai.status || 'open'}</span>
              <span
                className={ai.status === 'done' ? 'cell-done' : 'cell-primary'}
                style={{ fontSize: 11 }}
              >{ai.title}</span>
              <span className="cell-meta" style={{ fontSize: 10 }}>{(ai.assignee || '').split(' ')[0]}</span>
            </div>
          ))
        )}
      </div>
      {addingAction && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 6, flexShrink: 0 }}>
          <input
            className="inline-input"
            placeholder="New action item..."
            value={newActionText}
            onChange={e => setNewActionText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveNewAction()}
            autoFocus
            style={{ flex: 1, fontSize: 11 }}
          />
          <input
            className="inline-input"
            placeholder="Assignee"
            value={newActionAssignee}
            onChange={e => setNewActionAssignee(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveNewAction()}
            style={{ width: 90, fontSize: 11 }}
          />
          <button className="action-btn amber" style={{ fontSize: 9, padding: '2px 8px' }} onClick={handleSaveNewAction}>Add</button>
          <button className="action-btn" style={{ fontSize: 9, padding: '2px 8px' }} onClick={() => setAddingAction(false)}>×</button>
        </div>
      )}
    </div>
  );

  // Inner split: center + right
  const centerRightSplit = (
    <ResizableSplit
      left={centerPane}
      right={rightPane}
      defaultLeftPct={68}
      minLeftPx={300}
      minRightPx={220}
      storageKey="meeting-detail-cr"
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a' }}>
      {/* Header strip */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', height: 42, borderBottom: '1px solid rgba(255,255,255,0.08)', gap: 16, flexShrink: 0, background: '#0a0a0a' }}>
        <a href="/meetings" style={{ color: '#888892', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', textDecoration: 'none' }}>← Meetings</a>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16, color: '#f0f0f2', margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meeting.title}</h1>
        <span style={{ fontSize: 10, color: '#888892', flexShrink: 0 }}>{meeting.platform}</span>
      </div>

      {/* Metadata strip */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', height: 36, borderBottom: '1px solid rgba(255,255,255,0.06)', gap: 20, flexShrink: 0, background: 'rgba(255,255,255,0.015)' }}>
        <span className="cell-meta">{formatDate(meeting.meetingDate)}</span>
        {meeting.meetingTime && <span className="cell-meta">{meeting.meetingTime}</span>}
        {meeting.companyName && <span className="cell-meta">{meeting.companyName}</span>}
        <div className="avatar-row" style={{ marginLeft: 'auto' }}>
          {participants.slice(0, 8).map((p, i) => (
            <div key={i} className="avatar" title={p}>{p.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
          ))}
          {participants.length > 8 && (
            <div className="avatar" style={{ background: 'rgba(217,119,6,0.15)', color: '#d97706' }}>+{participants.length - 8}</div>
          )}
        </div>
      </div>

      {/* 3-pane: left + (center+right) */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <ResizableSplit
          left={leftPane}
          right={centerRightSplit}
          defaultLeftPct={20}
          minLeftPx={160}
          minRightPx={400}
          storageKey="meeting-detail-lc"
        />
      </div>
    </div>
  );
}

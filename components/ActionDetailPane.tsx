'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export interface ActionItemDetail {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  assignee: string | null;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
  meetingId: string | null;
  meetingTimestamp: string | null;
  snoozedUntil: string | null;
  createdAt: string | null;
}

interface MeetingContext {
  id: string;
  title: string;
  meetingDate: string | null;
  aiSummary: string | null;
  platform: string | null;
}

interface TranscriptLine {
  timestamp: string;
  speaker: string;
  text: string;
  isMatch?: boolean;
}

interface HistoryEntry {
  id: string;
  oldStatus: string | null;
  newStatus: string;
  note: string | null;
  changedAt: string;
}

interface OutreachEntry {
  id: string;
  assignee: string | null;
  messageSent: string;
  sentAt: string;
  responseReceived: string | null;
}

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const STATUSES = [
  { value: 'open',         label: 'Open' },
  { value: 'in_progress',  label: 'In Progress' },
  { value: 'done',         label: 'Done' },
  { value: 'blocked',      label: 'Blocked' },
  { value: 'deferred',     label: 'Deferred' },
  { value: 'cancelled',    label: 'Cancelled' },
];

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(d));
}

function formatDateLong(d: string | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d));
}

function initials(name: string | null | undefined): string {
  if (!name) return '·';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '·';
}

function snoozeOptions(): { label: string; date: string }[] {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const sat = new Date(today); sat.setDate(today.getDate() + (6 - today.getDay() + 7) % 7 || 7);
  const monday = new Date(today); monday.setDate(today.getDate() + (8 - today.getDay()) % 7 || 7);
  const inAWeek = new Date(today); inAWeek.setDate(today.getDate() + 7);
  const inAMonth = new Date(today); inAMonth.setMonth(today.getMonth() + 1);
  return [
    { label: 'Tomorrow',     date: fmt(tomorrow) },
    { label: 'This weekend', date: fmt(sat) },
    { label: 'Next Monday',  date: fmt(monday) },
    { label: 'In a week',    date: fmt(inAWeek) },
    { label: 'In a month',   date: fmt(inAMonth) },
  ];
}

interface Props {
  item: ActionItemDetail;
  onClose: () => void;
  onPatch: (id: string, body: Partial<ActionItemDetail>) => Promise<void> | void;
}

export default function ActionDetailPane({ item, onClose, onPatch }: Props) {
  const [meeting, setMeeting] = useState<MeetingContext | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [outreach, setOutreach] = useState<OutreachEntry[]>([]);

  // Inline edit state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [openMenu, setOpenMenu] = useState<null | 'status' | 'priority' | 'snooze' | 'owner' | 'due'>(null);
  const [ownerDraft, setOwnerDraft] = useState(item.assignee ?? '');
  const [dueDraft, setDueDraft] = useState(item.dueDate ?? '');
  const [notesDraft, setNotesDraft] = useState(item.notes ?? item.description ?? '');
  const [savingNotes, setSavingNotes] = useState(false);

  // Status-change-with-note state
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [applyingStatus, setApplyingStatus] = useState(false);

  // Outreach
  const [generatedMsg, setGeneratedMsg] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Reset drafts whenever item changes
  useEffect(() => {
    setTitleDraft(item.title);
    setOwnerDraft(item.assignee ?? '');
    setDueDraft(item.dueDate ?? '');
    setNotesDraft(item.notes ?? item.description ?? '');
    setPendingStatus(null);
    setStatusNote('');
    setGeneratedMsg('');
    setEditingTitle(false);
    setOpenMenu(null);
  }, [item.id]);

  // Fetch context bundle + history + outreach
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/action-items/${item.id}/context`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/action-items/${item.id}/history`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/action-items/${item.id}/outreach`).then((r) => r.ok ? r.json() : []),
    ]).then(([ctx, h, o]) => {
      if (cancelled) return;
      if (ctx) {
        setMeeting(ctx.meeting ?? null);
        setTranscript(Array.isArray(ctx.transcriptSnippet) ? ctx.transcriptSnippet : []);
      } else {
        setMeeting(null);
        setTranscript([]);
      }
      setHistory(Array.isArray(h) ? h : []);
      setOutreach(Array.isArray(o) ? o : []);
    });
    return () => { cancelled = true; };
  }, [item.id]);

  const status = item.status ?? 'open';
  const priority = item.priority ?? 'medium';
  const display = displayTitle(item.title, item.assignee);
  const titleDiffers = display !== item.title;

  const closeMenus = () => setOpenMenu(null);

  const setStatus = async (next: string) => {
    setOpenMenu(null);
    if (next === item.status) return;
    // Status changes should log to history with optional note. Use prompt flow.
    setPendingStatus(next);
  };

  const applyStatusChange = async () => {
    if (!pendingStatus) return;
    setApplyingStatus(true);
    try {
      await fetch(`/api/action-items/${item.id}/history`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus: pendingStatus, oldStatus: item.status, note: statusNote }),
      });
      await onPatch(item.id, { status: pendingStatus });
      const h = await fetch(`/api/action-items/${item.id}/history`).then((r) => r.ok ? r.json() : []);
      setHistory(Array.isArray(h) ? h : []);
      setPendingStatus(null);
      setStatusNote('');
    } finally {
      setApplyingStatus(false);
    }
  };

  const setPriority = async (p: string) => { setOpenMenu(null); await onPatch(item.id, { priority: p }); };
  const setSnoozeDate = async (d: string | null) => { setOpenMenu(null); await onPatch(item.id, { snoozedUntil: d }); };
  const saveOwner = async () => { setOpenMenu(null); await onPatch(item.id, { assignee: ownerDraft.trim() || null }); };
  const saveDue = async () => { setOpenMenu(null); await onPatch(item.id, { dueDate: dueDraft || null }); };

  const saveNotes = async () => {
    if (notesDraft === (item.notes ?? '')) return;
    setSavingNotes(true);
    try { await onPatch(item.id, { notes: notesDraft || null }); }
    finally { setSavingNotes(false); }
  };

  const saveTitle = async () => {
    setEditingTitle(false);
    if (titleDraft.trim() && titleDraft !== item.title) {
      await onPatch(item.id, { title: titleDraft });
    }
  };

  const handleGenerate = async () => {
    setGenerating(true); setGeneratedMsg('');
    try {
      const res = await fetch(`/api/action-items/${item.id}/outreach`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedMsg(data.message ?? '');
        const o = await fetch(`/api/action-items/${item.id}/outreach`).then((r) => r.ok ? r.json() : []);
        setOutreach(Array.isArray(o) ? o : []);
      }
    } finally { setGenerating(false); }
  };

  const sendOutreach = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/action-items/${item.id}/outreach`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ send: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedMsg('');
        const o = await fetch(`/api/action-items/${item.id}/outreach`).then((r) => r.ok ? r.json() : []);
        setOutreach(Array.isArray(o) ? o : []);
        if (data?.note) {
          // could display as toast; for now just append to outreach UI flow
        }
      }
    } finally { setGenerating(false); }
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="detail-pane" onClick={closeMenus}>
      {/* ── Action bar ── */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '8px 10px',
          borderBottom: '1px solid var(--apex-border)',
          background: 'var(--apex-bg)',
          flexShrink: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className={status === 'done' ? 'btn btn-ghost' : 'btn btn-primary'}
          onClick={() => setStatus(status === 'done' ? 'open' : 'done')}
          style={{ height: 28, fontSize: 11.5 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            {status === 'done' ? 'undo' : 'check_circle'}
          </span>
          {status === 'done' ? 'Reopen' : 'Mark Done'}
        </button>

        {/* Snooze */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-ghost"
            onClick={() => setOpenMenu(openMenu === 'snooze' ? null : 'snooze')}
            style={{ height: 28, fontSize: 11.5 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
            {item.snoozedUntil ? `until ${formatDate(item.snoozedUntil)}` : 'Snooze'}
          </button>
          {openMenu === 'snooze' && (
            <Popover>
              <p className="label-caps" style={{ padding: '4px 8px' }}>Snooze until…</p>
              {snoozeOptions().map((opt) => (
                <PopoverItem key={opt.label} onClick={() => setSnoozeDate(opt.date)}>
                  <span>{opt.label}</span>
                  <span className="cell-meta" style={{ fontSize: 10 }}>{formatDate(opt.date)}</span>
                </PopoverItem>
              ))}
              {item.snoozedUntil && (
                <>
                  <div className="divider" style={{ margin: '4px 0' }} />
                  <PopoverItem onClick={() => setSnoozeDate(null)} danger>Wake up now</PopoverItem>
                </>
              )}
            </Popover>
          )}
        </div>

        <button
          className="btn btn-ghost"
          onClick={handleGenerate}
          disabled={generating}
          style={{ height: 28, fontSize: 11.5 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
          {generating ? 'Generating…' : 'Send Follow-up'}
        </button>

        <div style={{ marginLeft: 'auto' }}>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="detail-pane-body" onClick={(e) => e.stopPropagation()} style={{ gap: 16 }}>
        {/* Title */}
        {editingTitle ? (
          <textarea
            className="inline-input inline-textarea"
            value={titleDraft}
            autoFocus
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveTitle(); if (e.key === 'Escape') { setTitleDraft(item.title); setEditingTitle(false); } }}
            style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, minHeight: 48 }}
            rows={2}
          />
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            title="Click to rename. ⌘+Enter to save."
            style={{
              textAlign: 'left',
              background: 'transparent', border: 'none', cursor: 'text',
              fontSize: 15, fontWeight: 600, lineHeight: 1.4, color: 'var(--apex-text)',
              padding: '4px 8px', marginLeft: -8, borderRadius: 4,
              whiteSpace: 'normal', wordBreak: 'break-word',
            }}
            onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'var(--apex-hover)'}
            onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
          >
            {display}
          </button>
        )}

        {titleDiffers && (
          <p style={{ fontSize: 11, color: 'var(--apex-text-faint)', fontStyle: 'italic', margin: 0, marginTop: -10 }}>
            From transcript: “{item.title}”
          </p>
        )}

        {/* Pills row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Status — native dropdown (drives the confirm-with-note flow) */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`badge badge-${status}`}
            title="Change status"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Priority — native dropdown */}
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={`badge priority-${priority}`}
            title="Change priority"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
            ))}
          </select>

          {/* Owner pill */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setOpenMenu(openMenu === 'owner' ? null : 'owner')}
              className="badge"
              style={{
                cursor: 'pointer', height: 22, padding: '0 8px', fontSize: 10,
                background: 'rgba(255,255,255,0.04)', borderColor: 'var(--apex-border)',
                color: 'var(--apex-text-secondary)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              <span className="avatar" style={{ width: 14, height: 14, fontSize: 7 }}>{initials(item.assignee)}</span>
              {item.assignee ?? 'Unassigned'}
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>arrow_drop_down</span>
            </button>
            {openMenu === 'owner' && (
              <Popover wide>
                <p className="label-caps" style={{ padding: '4px 8px' }}>Assign to…</p>
                <input
                  className="inline-input"
                  value={ownerDraft}
                  onChange={(e) => setOwnerDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveOwner(); if (e.key === 'Escape') setOpenMenu(null); }}
                  placeholder="Name…"
                  autoFocus
                  style={{ margin: '0 4px 4px' }}
                />
                <button className="btn btn-primary" onClick={saveOwner} style={{ width: 'calc(100% - 8px)', margin: '0 4px 4px', height: 24, fontSize: 11 }}>
                  Save
                </button>
              </Popover>
            )}
          </div>

          {/* Due date pill */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setOpenMenu(openMenu === 'due' ? null : 'due')}
              className="badge"
              style={{
                cursor: 'pointer', height: 22, padding: '0 8px', fontSize: 10,
                background: 'rgba(255,255,255,0.04)', borderColor: 'var(--apex-border)',
                color: 'var(--apex-text-secondary)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>event</span>
              {item.dueDate ? formatDate(item.dueDate) : 'No due date'}
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>arrow_drop_down</span>
            </button>
            {openMenu === 'due' && (
              <Popover wide>
                <p className="label-caps" style={{ padding: '4px 8px' }}>Due date</p>
                <input
                  type="date"
                  className="inline-input"
                  value={dueDraft}
                  onChange={(e) => setDueDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveDue(); if (e.key === 'Escape') setOpenMenu(null); }}
                  autoFocus
                  style={{ margin: '0 4px 4px', colorScheme: 'dark' }}
                />
                <div style={{ display: 'flex', gap: 4, padding: '0 4px 4px' }}>
                  <button className="btn btn-ghost" onClick={() => { setDueDraft(''); }} style={{ flex: 1, height: 22, fontSize: 10.5 }}>Clear</button>
                  <button className="btn btn-primary" onClick={saveDue} style={{ flex: 1, height: 22, fontSize: 10.5 }}>Save</button>
                </div>
              </Popover>
            )}
          </div>
        </div>

        {/* Pending status change banner */}
        {pendingStatus && (
          <div style={{ background: 'var(--apex-primary-soft)', border: '1px solid rgba(46,98,255,0.3)', borderRadius: 6, padding: 10 }}>
            <p className="label-caps" style={{ marginBottom: 6 }}>
              Change status to <span className={`badge badge-${pendingStatus}`}>{pendingStatus.replace('_', ' ')}</span> ?
            </p>
            <textarea
              className="inline-input inline-textarea"
              placeholder="Optional note about why…"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              rows={2}
              style={{ marginBottom: 6 }}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost" onClick={() => { setPendingStatus(null); setStatusNote(''); }} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={applyStatusChange} disabled={applyingStatus} style={{ flex: 2 }}>
                {applyingStatus ? 'Applying…' : 'Apply change'}
              </button>
            </div>
          </div>
        )}

        {/* Snoozed banner */}
        {item.snoozedUntil && new Date(item.snoozedUntil).getTime() > Date.now() && (
          <div style={{ padding: '6px 10px', background: 'var(--apex-violet-soft)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--apex-violet)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>snooze</span>
              Snoozed until {formatDate(item.snoozedUntil)}
            </span>
            <button className="btn btn-ghost" onClick={() => setSnoozeDate(null)} style={{ height: 22, padding: '0 8px', fontSize: 10.5 }}>Wake</button>
          </div>
        )}

        {/* Meeting context */}
        {meeting && (
          <div className="apex-panel-flat" style={{ padding: 10 }}>
            <div className="detail-section-label" style={{ marginBottom: 6 }}>From the meeting</div>
            <Link href={`/meetings/${meeting.id}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--apex-primary-bright)', marginTop: 1, flexShrink: 0 }}>event_note</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12.5, color: 'var(--apex-text)', fontWeight: 500, margin: 0 }}>
                  {meeting.title}
                </p>
                <p style={{ fontSize: 11, color: 'var(--apex-text-muted)', margin: 0, marginTop: 2 }}>
                  {formatDateLong(meeting.meetingDate)}
                  {item.meetingTimestamp && (
                    <> · <span className="mono" style={{ color: 'var(--apex-primary-bright)' }}>@{item.meetingTimestamp}</span></>
                  )}
                  {meeting.platform && <> · {meeting.platform}</>}
                </p>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--apex-text-muted)', flexShrink: 0 }}>arrow_forward</span>
            </Link>
          </div>
        )}

        {/* Transcript snippet */}
        {transcript.length > 0 && (
          <div>
            <div className="detail-section-label" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>record_voice_over</span>
              Said in the meeting
            </div>
            <div className="apex-panel-flat" style={{ padding: '8px 10px' }}>
              {transcript.map((line, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '46px 1fr',
                    gap: 8,
                    padding: '4px 6px',
                    borderRadius: 4,
                    background: line.isMatch ? 'var(--apex-primary-soft)' : 'transparent',
                    borderLeft: line.isMatch ? '2px solid var(--apex-primary)' : '2px solid transparent',
                    paddingLeft: line.isMatch ? 4 : 6,
                  }}
                >
                  <span className="cell-meta" style={{ fontSize: 10, paddingTop: 1 }}>{line.timestamp}</span>
                  <div style={{ minWidth: 0 }}>
                    {line.speaker && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: line.isMatch ? 'var(--apex-primary-bright)' : 'var(--apex-text-muted)', marginRight: 6 }}>
                        {line.speaker}
                      </span>
                    )}
                    <span style={{ fontSize: 11.5, color: line.isMatch ? 'var(--apex-text)' : 'var(--apex-text-secondary)', lineHeight: 1.5 }}>
                      {line.text}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Meeting AI summary, collapsible */}
        {meeting?.aiSummary && (
          <div>
            <button
              onClick={() => setShowSummary((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                background: 'transparent', border: 'none', color: 'var(--apex-text-muted)',
                cursor: 'pointer', padding: 0, marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 9, color: 'var(--apex-text-faint)' }}>{showSummary ? '▼' : '▶'}</span>
              <span className="detail-section-label" style={{ marginBottom: 0 }}>Meeting summary</span>
            </button>
            {showSummary && (
              <p style={{ fontSize: 11.5, color: 'var(--apex-text-secondary)', lineHeight: 1.55, margin: 0, padding: '8px 10px', background: 'rgba(167,139,250,0.04)', border: '1px solid var(--apex-border)', borderRadius: 6 }}>
                {meeting.aiSummary}
              </p>
            )}
          </div>
        )}

        {/* AI-extracted description */}
        {item.description && item.description !== item.notes && (
          <div>
            <div className="detail-section-label" style={{ marginBottom: 4 }}>Extracted description</div>
            <p style={{ fontSize: 11.5, color: 'var(--apex-text-secondary)', lineHeight: 1.55, margin: 0 }}>
              {item.description}
            </p>
          </div>
        )}

        {/* Notes — user editable */}
        <div>
          <div className="detail-section-label" style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span>Notes</span>
            {savingNotes && <span style={{ fontSize: 9, color: 'var(--apex-text-muted)' }}>saving…</span>}
          </div>
          <textarea
            className="inline-input inline-textarea"
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={saveNotes}
            placeholder="Add private notes — saves on blur"
            rows={3}
          />
        </div>

        {/* Follow-up section — prominent */}
        <div>
          <div className="detail-section-label" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>mail</span>
            Follow-up
          </div>

          {generatedMsg ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea
                className="inline-input inline-textarea"
                value={generatedMsg}
                onChange={(e) => setGeneratedMsg(e.target.value)}
                rows={6}
                style={{ fontSize: 11.5 }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-ghost" onClick={() => setGeneratedMsg('')} style={{ flex: 1 }}>Discard</button>
                <button className="btn btn-primary" onClick={sendOutreach} disabled={generating} style={{ flex: 2 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>send</span>
                  {generating ? 'Sending…' : 'Send to ' + (item.assignee?.split(' ')[0] ?? 'recipient')}
                </button>
              </div>
            </div>
          ) : outreach.length === 0 ? (
            <button className="btn btn-primary" onClick={handleGenerate} disabled={generating} style={{ width: '100%' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
              {generating ? 'Generating…' : 'Generate AI follow-up'}
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={handleGenerate} disabled={generating} style={{ width: '100%' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
              {generating ? 'Generating…' : 'Generate another follow-up'}
            </button>
          )}

          {outreach.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <p className="label-caps" style={{ fontSize: 9 }}>Past outreach ({outreach.length})</p>
              {outreach.map((o) => (
                <div key={o.id} className="apex-panel-flat" style={{ padding: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--apex-text)' }}>To {o.assignee ?? '—'}</span>
                    <span className="cell-meta" style={{ fontSize: 10 }}>{formatDate(o.sentAt)}</span>
                  </div>
                  <p style={{ fontSize: 11.5, color: 'var(--apex-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{o.messageSent}</p>
                  {o.responseReceived && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--apex-border)' }}>
                      <div className="detail-section-label" style={{ marginBottom: 2 }}>Response</div>
                      <p style={{ fontSize: 11.5, color: 'var(--apex-text-secondary)' }}>{o.responseReceived}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* History (collapsible) */}
        {history.length > 0 && (
          <div>
            <button
              onClick={() => setShowHistory((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                background: 'transparent', border: 'none', color: 'var(--apex-text-muted)',
                cursor: 'pointer', padding: 0,
              }}
            >
              <span style={{ fontSize: 9, color: 'var(--apex-text-faint)' }}>{showHistory ? '▼' : '▶'}</span>
              <span className="detail-section-label" style={{ marginBottom: 0 }}>Status history ({history.length})</span>
            </button>
            {showHistory && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                {history.map((h) => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--apex-border)' }}>
                    <span className="cell-meta" style={{ minWidth: 56, fontSize: 10 }}>{formatDate(h.changedAt)}</span>
                    <span className={`badge badge-${h.oldStatus ?? 'open'}`}>{h.oldStatus ?? '—'}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'var(--apex-text-faint)' }}>arrow_forward</span>
                    <span className={`badge badge-${h.newStatus}`}>{h.newStatus}</span>
                    {h.note && <span style={{ flex: 1, fontSize: 11, color: 'var(--apex-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>“{h.note}”</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Local helpers ─────────────────────────────────────────────────

function Popover({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', top: 26, left: 0, zIndex: 100,
        background: 'var(--apex-elevated)',
        border: '1px solid var(--apex-border-bright)',
        borderRadius: 6, boxShadow: '0 12px 24px rgba(0,0,0,0.5)',
        padding: 4, minWidth: wide ? 220 : 140,
      }}
    >
      {children}
    </div>
  );
}

function PopoverItem({
  children, onClick, active, danger,
}: { children: React.ReactNode; onClick: () => void; active?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        width: '100%', padding: '5px 8px',
        background: active ? 'var(--apex-hover)' : 'transparent',
        border: 'none',
        color: danger ? 'var(--apex-error)' : 'var(--apex-text)',
        fontSize: 12, cursor: 'pointer', borderRadius: 4,
        textAlign: 'left', justifyContent: 'space-between',
      }}
      onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'var(--apex-hover)'}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

function displayTitle(title: string, assignee: string | null | undefined): string {
  if (!assignee) return title;
  const owner = assignee.trim();
  if (!owner) return title;
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const verbs = '(will|has|have|had|to|should|must|is going to|needs to|plans to)';
  const candidates = [
    new RegExp(`^${escape(owner).replace(/\s+/g, '\\s+')}\\s+${verbs}\\s+`, 'i'),
  ];
  const first = owner.split(/\s+/)[0];
  if (first && first.length > 2 && first.toLowerCase() !== owner.toLowerCase()) {
    candidates.push(new RegExp(`^${escape(first)}\\s+${verbs}\\s+`, 'i'));
  }
  for (const rx of candidates) {
    const m = title.match(rx);
    if (m) {
      const stripped = title.slice(m[0].length).trim();
      if (stripped.length === 0) return title;
      return stripped.charAt(0).toUpperCase() + stripped.slice(1);
    }
  }
  return title;
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Meeting {
  id: string;
  title: string;
  meetingDate: string | null;
  participants: string[] | string | null;
  rawNotes: string | null;
  aiSummary: string | null;
  source: string | null;
  companyName?: string | null;
}

interface ActionItem {
  id: string;
  title: string;
  assignee: string | null;
  dueDate: string | null;
  status: string | null;
  priority: string | null;
}

function parseParticipants(raw: string[] | string | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateStr));
}

function getInitials(name: string): string {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function cycleStatus(current: string | null): string {
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
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [inlineEdits, setInlineEdits] = useState<Record<string, { title?: string; assignee?: string }>>({});

  useEffect(() => {
    Promise.all([
      fetch(`/api/meetings/${id}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/action-items?meetingId=${id}`).then((r) => r.ok ? r.json() : []),
    ])
      .then(([m, a]) => {
        const meeting = m as (Meeting & { actionItems?: ActionItem[] }) | null;
        setMeeting(meeting);
        setEditTitle(meeting?.title ?? '');
        setEditNotes(meeting?.rawNotes ?? '');
        // Prefer dedicated action items query, fallback to embedded
        const items = Array.isArray(a) && (a as ActionItem[]).length > 0
          ? a as ActionItem[]
          : (meeting?.actionItems ?? []);
        setActionItems(items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleSaveTitle = useCallback(async () => {
    if (!meeting || editTitle === meeting.title) return;
    await fetch(`/api/meetings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle }),
    });
    setMeeting((prev) => prev ? { ...prev, title: editTitle } : null);
  }, [meeting, editTitle, id]);

  const handleSaveNotes = useCallback(async () => {
    if (!meeting) return;
    await fetch(`/api/meetings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawNotes: editNotes }),
    });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }, [meeting, editNotes, id]);

  const handleCycleStatus = useCallback(async (item: ActionItem) => {
    const newStatus = cycleStatus(item.status);
    setActionItems((prev) => prev.map((a) => a.id === item.id ? { ...a, status: newStatus } : a));
    try {
      await fetch(`/api/action-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      setActionItems((prev) => prev.map((a) => a.id === item.id ? { ...a, status: item.status } : a));
    }
  }, []);

  const handleInlineEdit = useCallback(async (itemId: string, field: 'title' | 'assignee', value: string) => {
    setInlineEdits((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  }, []);

  const handleInlineSave = useCallback(async (item: ActionItem) => {
    const edits = inlineEdits[item.id];
    if (!edits) return;
    const updates: Record<string, string> = {};
    if (edits.title !== undefined && edits.title !== item.title) updates.title = edits.title;
    if (edits.assignee !== undefined && edits.assignee !== (item.assignee ?? '')) updates.assignee = edits.assignee;
    if (Object.keys(updates).length === 0) return;
    try {
      await fetch(`/api/action-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      setActionItems((prev) => prev.map((a) => a.id === item.id ? { ...a, ...updates } : a));
      setInlineEdits((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } catch { /* ignore */ }
  }, [inlineEdits]);

  const handleAddAction = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    setAddingTask(true);
    try {
      const res = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTask, assignee: newAssignee || null, meetingId: id }),
      });
      if (res.ok) {
        const created = await res.json() as ActionItem;
        setActionItems((prev) => [...prev, created]);
        setNewTask('');
        setNewAssignee('');
      }
    } catch { /* ignore */ } finally {
      setAddingTask(false);
    }
  }, [newTask, newAssignee, id]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="cell-meta">Loading…</span>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div style={{ minHeight: '100vh', background: '#050505', padding: '32px' }}>
        <span className="cell-meta">Meeting not found.</span>
        <Link href="/meetings" style={{ textDecoration: 'none', display: 'block', marginTop: 12 }}>
          <span style={{ fontSize: 11, color: '#d97706' }}>← Back to Meetings</span>
        </Link>
      </div>
    );
  }

  const participants = parseParticipants(meeting.participants);
  const openCount = actionItems.filter((a) => a.status !== 'done').length;

  return (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/meetings" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: 10, color: '#52525b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>← Meetings</span>
          </Link>
          <span style={{ color: '#27272a' }}>/</span>
          <span className="page-title" style={{ fontWeight: 400, color: '#a1a1aa' }}>{meeting.title}</span>
        </div>
        <span className="cell-meta">{formatDate(meeting.meetingDate)}</span>
      </div>

      {/* Title + metadata strip */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <input
          className="inline-input"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleSaveTitle}
          style={{
            fontFamily: '"Playfair Display", serif',
            fontStyle: 'italic',
            fontSize: 18,
            marginBottom: 12,
            borderBottomColor: 'transparent',
          }}
        />
        {/* Metadata strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          {meeting.meetingDate && (
            <div>
              <div className="detail-section-label">Date</div>
              <div className="cell-meta" style={{ color: '#a1a1aa', marginTop: 2 }}>{formatDate(meeting.meetingDate)}</div>
            </div>
          )}
          {meeting.companyName && (
            <div>
              <div className="detail-section-label">Company</div>
              <div className="cell-meta" style={{ color: '#d97706', marginTop: 2 }}>{meeting.companyName}</div>
            </div>
          )}
          {meeting.source && (
            <div>
              <div className="detail-section-label">Source</div>
              <div className="cell-meta" style={{ color: '#a1a1aa', marginTop: 2 }}>{meeting.source}</div>
            </div>
          )}
          {participants.length > 0 && (
            <div>
              <div className="detail-section-label">Participants</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {participants.map((p, i) => (
                  <div key={i} style={{
                    width: 22, height: 22,
                    background: '#27272a',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 7, fontWeight: 700, color: '#a1a1aa',
                  }} title={p}>
                    {getInitials(p)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, overflow: 'hidden', gap: 0 }}>
        {/* Left: AI Summary + Notes */}
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {meeting.aiSummary && (
            <div>
              <div className="detail-section-label" style={{ marginBottom: 8 }}>AI Summary</div>
              <div style={{
                borderLeft: '2px solid #d97706',
                paddingLeft: 12,
                fontSize: 12,
                color: '#a1a1aa',
                fontStyle: 'italic',
                lineHeight: 1.7,
              }}>
                {meeting.aiSummary}
              </div>
            </div>
          )}

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="detail-section-label">Notes</div>
              {notesSaved && <span style={{ fontSize: 9, color: '#52525b' }}>Saved ✓</span>}
            </div>
            <textarea
              className="inline-textarea"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="Add free-form notes… (auto-saves on blur)"
              style={{ minHeight: 200, resize: 'vertical' }}
            />
          </div>
        </div>

        {/* Right: Action Items table */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div className="group-header">
            <span>Action Items ({actionItems.length})</span>
            <span style={{ color: '#d97706' }}>{openCount} open</span>
          </div>

          {/* Action items table header */}
          <div className="table-header" style={{ gridTemplateColumns: '64px 1fr 100px' }}>
            <span>Status</span>
            <span>Task</span>
            <span>Assignee</span>
          </div>

          {actionItems.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <span className="cell-meta">No action items yet</span>
            </div>
          ) : (
            actionItems.map((item) => {
              const status = item.status ?? 'open';
              const editedTitle = inlineEdits[item.id]?.title ?? item.title;
              const editedAssignee = inlineEdits[item.id]?.assignee ?? (item.assignee ?? '');
              return (
                <div
                  key={item.id}
                  className="table-row"
                  style={{ gridTemplateColumns: '64px 1fr 100px', height: 'auto', minHeight: 34, padding: '4px 16px' }}
                >
                  <span
                    className={`badge-${status}`}
                    onClick={() => handleCycleStatus(item)}
                    title="Click to cycle status"
                    style={{ alignSelf: 'center' }}
                  >
                    {status}
                  </span>
                  <input
                    className="inline-input"
                    value={editedTitle}
                    onChange={(e) => handleInlineEdit(item.id, 'title', e.target.value)}
                    onBlur={() => handleInlineSave(item)}
                    style={{
                      fontSize: 12,
                      textDecoration: status === 'done' ? 'line-through' : 'none',
                      color: status === 'done' ? '#52525b' : '#e5e5e7',
                      alignSelf: 'center',
                    }}
                  />
                  <input
                    className="inline-input"
                    value={editedAssignee}
                    onChange={(e) => handleInlineEdit(item.id, 'assignee', e.target.value)}
                    onBlur={() => handleInlineSave(item)}
                    placeholder="—"
                    style={{ fontSize: 11, color: '#71717a', alignSelf: 'center' }}
                  />
                </div>
              );
            })
          )}

          {/* Add action item form */}
          <form
            onSubmit={handleAddAction}
            style={{
              display: 'flex',
              gap: 0,
              borderTop: '1px solid rgba(255,255,255,0.06)',
              marginTop: 'auto',
            }}
          >
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Add action item…"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                borderRight: '1px solid rgba(255,255,255,0.06)',
                color: '#e5e5e7',
                fontSize: 11,
                padding: '8px 16px',
                outline: 'none',
              }}
            />
            <input
              type="text"
              value={newAssignee}
              onChange={(e) => setNewAssignee(e.target.value)}
              placeholder="Assignee"
              style={{
                width: 100,
                background: 'transparent',
                border: 'none',
                borderRight: '1px solid rgba(255,255,255,0.06)',
                color: '#a1a1aa',
                fontSize: 11,
                padding: '8px 12px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!newTask.trim() || addingTask}
              className="action-btn amber"
              style={{ borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderRight: 'none' }}
            >
              {addingTask ? '…' : 'Add'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

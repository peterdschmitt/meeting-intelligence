'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Meeting {
  id: string;
  title: string;
  meetingDate: string | null;
  participants: string | null;
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

function parseParticipants(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(dateStr));
}

function getInitials(name: string): string {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

export default function MeetingDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/meetings/${id}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/action-items?meetingId=${id}`).then((r) => r.ok ? r.json() : []),
    ])
      .then(([m, a]) => {
        setMeeting(m as Meeting | null);
        setActionItems(Array.isArray(a) ? (a as ActionItem[]) : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleAction(itemId: string, isDone: boolean) {
    setTogglingId(itemId);
    try {
      await fetch(`/api/action-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: isDone ? 'open' : 'done' }),
      });
      setActionItems((prev) =>
        prev.map((a) =>
          a.id === itemId ? { ...a, status: isDone ? 'open' : 'done' } : a
        )
      );
    } catch {
      // ignore
    } finally {
      setTogglingId(null);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="micro-label">Loading…</p>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div style={{ minHeight: '100vh', background: '#050505', padding: '48px' }}>
        <p className="micro-label">Meeting not found.</p>
        <Link href="/meetings" style={{ textDecoration: 'none' }}>
          <span className="micro-label amber-accent" style={{ cursor: 'pointer', marginTop: '16px', display: 'block' }}>← Back to Meetings</span>
        </Link>
      </div>
    );
  }

  const participants = parseParticipants(meeting.participants);

  return (
    <div style={{ minHeight: '100vh', background: '#050505' }}>
      {/* Top nav */}
      <div className="top-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/meetings" style={{ textDecoration: 'none' }}>
            <span className="micro-label" style={{ color: '#52525b', cursor: 'pointer' }}>← Meetings</span>
          </Link>
          <span className="micro-label" style={{ color: '#27272a' }}>/</span>
          <span className="micro-label">{meeting.title}</span>
        </div>
        <span className="micro-label">{formatDate(meeting.meetingDate)}</span>
      </div>

      <div className="main-content">
        {/* Heading */}
        <div style={{ marginBottom: '48px' }}>
          <div className="amber-line">
            {meeting.companyName && <span className="amber-tag">{meeting.companyName}</span>}
          </div>
          <h1 className="page-heading" style={{ fontSize: '36px' }}>{meeting.title}</h1>
          <p className="micro-label" style={{ marginTop: '12px' }}>
            {formatDate(meeting.meetingDate)}
            {meeting.source && ` · ${meeting.source}`}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '48px' }}>
          {/* Left column */}
          <div>
            {/* AI Summary */}
            {meeting.aiSummary && (
              <div style={{ marginBottom: '48px' }}>
                <span className="micro-label amber-accent" style={{ display: 'block', marginBottom: '16px' }}>
                  AI Summary
                </span>
                <div
                  style={{
                    borderLeft: '2px solid #d97706',
                    paddingLeft: '24px',
                    background: 'rgba(217,119,6,0.04)',
                    padding: '24px',
                  }}
                >
                  <p style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: '1.7', fontStyle: 'italic' }}>
                    {meeting.aiSummary}
                  </p>
                </div>
              </div>
            )}

            {/* Action Items */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <span className="micro-label amber-accent">Action Items</span>
                <span className="micro-label">{actionItems.length} total</span>
              </div>

              {actionItems.length === 0 ? (
                <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
                  <p className="micro-label">No action items extracted yet</p>
                </div>
              ) : (
                <div className="glass-panel">
                  {/* Table header */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 120px 80px',
                      padding: '12px 24px',
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <span className="micro-label">Task</span>
                    <span className="micro-label">Assignee</span>
                    <span className="micro-label" style={{ textAlign: 'right' }}>Status</span>
                  </div>

                  {actionItems.map((item) => {
                    const isDone = item.status === 'done';
                    return (
                      <div
                        key={item.id}
                        className="data-row"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 120px 80px',
                          padding: '16px 24px',
                          alignItems: 'center',
                          opacity: isDone ? 0.5 : 1,
                        }}
                      >
                        <p
                          style={{
                            color: '#e5e5e7',
                            fontSize: '13px',
                            fontWeight: 500,
                            textDecoration: isDone ? 'line-through' : 'none',
                          }}
                        >
                          {item.title}
                        </p>
                        <span className="micro-label">{item.assignee ?? '—'}</span>
                        <div style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => toggleAction(item.id, isDone)}
                            disabled={togglingId === item.id}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            <span className={`status-${item.status ?? 'open'}`}>
                              {item.status ?? 'open'}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar — participants */}
          <div>
            <span className="micro-label amber-accent" style={{ display: 'block', marginBottom: '16px' }}>
              Participants
            </span>
            {participants.length === 0 ? (
              <p className="micro-label">No participants recorded</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {participants.map((p, i) => (
                  <div
                    key={i}
                    className="data-row"
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0' }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        background: '#27272a',
                        border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#e5e5e7',
                        flexShrink: 0,
                      }}
                    >
                      {getInitials(p)}
                    </div>
                    <span style={{ color: '#e5e5e7', fontSize: '13px' }}>{p}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

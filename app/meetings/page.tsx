'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

interface Meeting {
  id: string;
  title: string;
  meetingDate: string | null;
  participants: string | null;
  aiSummary: string | null;
  companyName?: string | null;
}

function parseParticipants(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateStr));
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionCounts, setActionCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch('/api/meetings')
      .then((r) => r.json())
      .then((data: Meeting[]) => setMeetings(data))
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch('/api/action-items')
      .then((r) => r.json())
      .then((data: Array<{ meetingId: string | null }>) => {
        const counts: Record<string, number> = {};
        for (const a of data) {
          if (a.meetingId) counts[a.meetingId] = (counts[a.meetingId] ?? 0) + 1;
        }
        setActionCounts(counts);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return meetings;
    const q = search.toLowerCase();
    return meetings.filter((m) => m.title.toLowerCase().includes(q));
  }, [meetings, search]);

  return (
    <div style={{ minHeight: '100vh', background: '#050505' }}>
      {/* Top nav */}
      <div className="top-nav">
        <div className="amber-line">
          <span className="amber-tag">Meetings</span>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search meetings…"
          style={{
            background: 'rgba(24,24,27,0.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#e5e5e7',
            fontSize: '11px',
            padding: '8px 16px',
            outline: 'none',
            width: '240px',
          }}
        />
      </div>

      <div className="main-content">
        <div style={{ marginBottom: '48px' }}>
          <h1 className="page-heading">Meetings.</h1>
          <p className="micro-label" style={{ marginTop: '12px' }}>
            {meetings.length} total meetings
          </p>
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <p className="micro-label">Loading…</p>
          </div>
        ) : (
          <div className="glass-panel">
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr 160px 80px',
                padding: '12px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <span className="micro-label">Date</span>
              <span className="micro-label">Title</span>
              <span className="micro-label">Participants</span>
              <span className="micro-label" style={{ textAlign: 'right' }}>Actions</span>
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <p className="micro-label">No meetings found</p>
              </div>
            ) : (
              filtered.map((m) => {
                const parts = parseParticipants(m.participants);
                return (
                  <Link key={m.id} href={`/meetings/${m.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                    <div
                      className="data-row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '140px 1fr 160px 80px',
                        padding: '16px 24px',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        className="micro-label"
                        style={{ color: '#52525b', fontFamily: '"JetBrains Mono", monospace' }}
                      >
                        {formatDate(m.meetingDate)}
                      </span>

                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            color: '#e5e5e7',
                            fontSize: '13px',
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginBottom: '4px',
                          }}
                        >
                          {m.title}
                        </p>
                        {m.companyName && (
                          <span className="micro-label amber-accent">{m.companyName}</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {parts.slice(0, 3).map((p, i) => (
                          <div
                            key={i}
                            title={p}
                            style={{
                              width: '24px',
                              height: '24px',
                              background: '#27272a',
                              border: '1px solid rgba(255,255,255,0.08)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '8px',
                              fontWeight: 700,
                              color: '#a1a1aa',
                            }}
                          >
                            {p.slice(0, 2).toUpperCase()}
                          </div>
                        ))}
                        {parts.length > 3 && (
                          <span className="micro-label">+{parts.length - 3}</span>
                        )}
                        {parts.length === 0 && (
                          <span className="micro-label">—</span>
                        )}
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        {(actionCounts[m.id] ?? 0) > 0 ? (
                          <span className="status-open">{actionCounts[m.id]}</span>
                        ) : (
                          <span className="micro-label">—</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

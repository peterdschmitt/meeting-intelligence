'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DetailPanel from '@/components/DetailPanel';

interface Contact {
  id: string;
  fullName: string;
  email: string | null;
  role: string | null;
  companyId: string | null;
  companyName: string | null;
}

interface Meeting {
  id: string;
  title: string;
  meetingDate: string | null;
  participants: string[] | string | null;
}

interface ActionItem {
  id: string;
  title: string;
  status: string | null;
  assignee: string | null;
  meetingTitle?: string | null;
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateStr));
}

function parseParticipants(raw: string[] | string | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Contact | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [c, m, a] = await Promise.all([
        fetch('/api/contacts').then((r) => r.ok ? r.json() : []),
        fetch('/api/meetings').then((r) => r.ok ? r.json() : []),
        fetch('/api/action-items').then((r) => r.ok ? r.json() : []),
      ]);
      setContacts(Array.isArray(c) ? c as Contact[] : []);
      setMeetings(Array.isArray(m) ? m as Meeting[] : []);
      setActionItems(Array.isArray(a) ? a as ActionItem[] : []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        (c.role?.toLowerCase().includes(q) ?? false) ||
        (c.companyName?.toLowerCase().includes(q) ?? false)
    );
  }, [contacts, search]);

  // Meeting counts by participant name
  const meetingsByParticipant = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of meetings) {
      const parts = parseParticipants(m.participants);
      for (const p of parts) {
        const key = p.toLowerCase();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(m);
      }
    }
    return map;
  }, [meetings]);

  const openPanel = (c: Contact) => {
    setSelected(c);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setSelected(null);
  };

  // Get meetings and actions for selected contact
  const contactMeetings = useMemo(() => {
    if (!selected) return [];
    const key = selected.fullName.toLowerCase();
    return meetingsByParticipant.get(key) ?? [];
  }, [selected, meetingsByParticipant]);

  const contactActions = useMemo(() => {
    if (!selected) return [];
    return actionItems.filter((a) =>
      a.assignee?.toLowerCase() === selected.fullName.toLowerCase() ||
      a.assignee?.toLowerCase().includes(selected.fullName.split(' ')[0].toLowerCase())
    );
  }, [selected, actionItems]);

  const getMeetingCount = (c: Contact) => {
    const key = c.fullName.toLowerCase();
    return meetingsByParticipant.get(key)?.length ?? 0;
  };

  const getLastSeen = (c: Contact): string => {
    const key = c.fullName.toLowerCase();
    const ms = meetingsByParticipant.get(key) ?? [];
    if (ms.length === 0) return '—';
    const sorted = ms
      .filter((m) => m.meetingDate)
      .sort((a, b) => new Date(b.meetingDate!).getTime() - new Date(a.meetingDate!).getTime());
    return sorted.length > 0 ? formatDate(sorted[0].meetingDate) : '—';
  };

  return (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="page-header">
        <span className="page-title">People</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#e5e5e7',
            fontSize: 11,
            padding: '5px 10px',
            outline: 'none',
            width: 200,
          }}
        />
      </div>

      {/* Stat bar */}
      <div className="stat-bar">
        <div className="stat-bar-item">
          <span className="stat-bar-value">{contacts.length}</span>
          <span className="stat-bar-label">Total Contacts</span>
        </div>
        <div className="stat-bar-item">
          <span className="stat-bar-value">{filtered.length}</span>
          <span className="stat-bar-label">Showing</span>
        </div>
      </div>

      {/* Table header */}
      <div className="table-header" style={{ gridTemplateColumns: '40px 1fr 140px 120px 60px 80px' }}>
        <span></span>
        <span>Name</span>
        <span>Company</span>
        <span>Role</span>
        <span>Meetings</span>
        <span>Last Seen</span>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: '32px 16px', textAlign: 'center' }}>
          <span className="cell-meta">Loading…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center' }}>
          <span className="cell-meta">No contacts found</span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.map((c) => {
            const isSelected = selected?.id === c.id && panelOpen;
            const meetingCount = getMeetingCount(c);
            const lastSeen = getLastSeen(c);
            return (
              <div
                key={c.id}
                className={`table-row${isSelected ? ' selected' : ''}`}
                style={{ gridTemplateColumns: '40px 1fr 140px 120px 60px 80px' }}
                onClick={() => openPanel(c)}
              >
                <div style={{
                  width: 24, height: 24,
                  background: '#27272a',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, fontWeight: 700, color: '#a1a1aa',
                }}>
                  {getInitials(c.fullName)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="cell-primary">{c.fullName}</div>
                  {c.email && <div className="cell-meta" style={{ fontSize: 9 }}>{c.email}</div>}
                </div>
                <span className="cell-secondary">{c.companyName ?? '—'}</span>
                <span className="cell-meta">{c.role ?? '—'}</span>
                <span className="cell-meta" style={{ textAlign: 'center' }}>
                  {meetingCount > 0 ? meetingCount : '—'}
                </span>
                <span className="cell-meta">{lastSeen}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Panel */}
      <DetailPanel open={panelOpen} onClose={closePanel} title={selected?.fullName ?? ''}>
        {selected && (
          <>
            {/* Avatar + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40,
                background: '#d97706',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: '#000', flexShrink: 0,
              }}>
                {getInitials(selected.fullName)}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e5e7' }}>{selected.fullName}</div>
                {selected.email && <div className="cell-meta" style={{ marginTop: 2 }}>{selected.email}</div>}
              </div>
            </div>

            {selected.role && (
              <div>
                <div className="detail-section-label">Role</div>
                <div className="detail-section-value">{selected.role}</div>
              </div>
            )}
            {selected.companyName && (
              <div>
                <div className="detail-section-label">Company</div>
                <div className="detail-section-value">{selected.companyName}</div>
              </div>
            )}

            <div>
              <div className="detail-section-label">Meetings ({contactMeetings.length})</div>
              {contactMeetings.length === 0 ? (
                <div className="cell-meta" style={{ marginTop: 4 }}>No meetings recorded</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 4 }}>
                  {contactMeetings.slice(0, 8).map((m) => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span className="cell-primary" style={{ flex: 1 }}>{m.title}</span>
                      <span className="cell-meta">{formatDate(m.meetingDate)}</span>
                    </div>
                  ))}
                  {contactMeetings.length > 8 && (
                    <div className="cell-meta" style={{ marginTop: 4 }}>+{contactMeetings.length - 8} more</div>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="detail-section-label">Assigned Actions ({contactActions.length})</div>
              {contactActions.length === 0 ? (
                <div className="cell-meta" style={{ marginTop: 4 }}>No assigned actions</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 4 }}>
                  {contactActions.slice(0, 6).map((a) => {
                    const s = a.status ?? 'open';
                    return (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span className={`badge-${s}`} style={{ flexShrink: 0 }}>{s}</span>
                        <span className="cell-primary" style={{ flex: 1, textDecoration: s === 'done' ? 'line-through' : 'none' }}>{a.title}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </DetailPanel>
    </div>
  );
}

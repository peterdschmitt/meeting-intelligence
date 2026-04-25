'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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
  aiSummary?: string | null;
}

interface ActionItem {
  id: string;
  title: string;
  status: string | null;
  assignee: string | null;
  meetingTitle?: string | null;
  dueDate?: string | null;
}

const STATUS_CHIP: Record<string, string> = {
  open: 'apex-chip-primary',
  in_progress: 'apex-chip-violet',
  done: 'apex-chip-emerald',
  blocked: 'apex-chip-error',
};

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '·';
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

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        (c.role?.toLowerCase().includes(q) ?? false) ||
        (c.companyName?.toLowerCase().includes(q) ?? false),
    );
  }, [contacts, search]);

  const getMeetingsFor = useCallback((c: Contact) => {
    return meetingsByParticipant.get(c.fullName.toLowerCase()) ?? [];
  }, [meetingsByParticipant]);

  const getActionsFor = useCallback((c: Contact) => {
    const first = c.fullName.split(' ')[0]?.toLowerCase() ?? '';
    return actionItems.filter((a) =>
      a.assignee?.toLowerCase() === c.fullName.toLowerCase() ||
      (first && a.assignee?.toLowerCase().includes(first)),
    );
  }, [actionItems]);

  const selectedMeetings = selected ? getMeetingsFor(selected) : [];
  const selectedActions = selected ? getActionsFor(selected) : [];
  const selectedLastSeen = selectedMeetings
    .filter((m) => m.meetingDate)
    .sort((a, b) => new Date(b.meetingDate!).getTime() - new Date(a.meetingDate!).getTime())[0];

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '2rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <p className="apex-label-caps" style={{ marginBottom: '0.5rem' }}>Network</p>
          <h1 className="apex-h1" style={{ marginBottom: '0.375rem' }}>People</h1>
          <p style={{ color: 'var(--apex-text-secondary)', fontSize: '0.9375rem' }}>
            {contacts.length} contacts across {new Set(contacts.map((c) => c.companyName).filter(Boolean)).size} companies.
          </p>
        </div>
      </header>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 480, marginBottom: '1.5rem' }}>
        <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--apex-text-muted)' }}>search</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, role, or company..."
          className="apex-search"
          style={{ width: '100%' }}
        />
      </div>

      {/* List + dossier */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '320px 1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem', alignItems: 'flex-start' }}>
        {/* Contact list */}
        {selected ? (
          <aside className="apex-card" style={{ padding: '0.5rem', position: 'sticky', top: '1.5rem', maxHeight: 'calc(100vh - 8rem)', overflow: 'auto' }}>
            {filtered.map((c) => {
              const isSelected = selected?.id === c.id;
              const meetingCount = getMeetingsFor(c).length;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.625rem',
                    width: '100%', padding: '0.625rem 0.75rem',
                    background: isSelected ? 'rgba(46,98,255,0.08)' : 'transparent',
                    border: 'none',
                    borderLeft: isSelected ? '2px solid var(--apex-primary)' : '2px solid transparent',
                    borderRadius: '0.375rem',
                    color: 'var(--apex-text)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.025)'; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  <Avatar name={c.fullName} size={28} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--apex-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
                      {c.fullName}
                    </p>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--apex-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
                      {c.role ?? c.companyName ?? '—'}
                    </p>
                  </div>
                  {meetingCount > 0 && (
                    <span className="apex-mono" style={{ fontSize: '0.6875rem', color: 'var(--apex-text-muted)', flexShrink: 0 }}>
                      {meetingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </aside>
        ) : (
          <>
            {loading ? (
              <p style={{ color: 'var(--apex-text-muted)', fontSize: '0.875rem', padding: '2rem', gridColumn: '1 / -1' }}>Loading…</p>
            ) : filtered.length === 0 ? (
              <p style={{ color: 'var(--apex-text-muted)', fontSize: '0.875rem', padding: '2rem', gridColumn: '1 / -1' }}>No contacts found.</p>
            ) : (
              filtered.map((c) => (
                <ContactCard
                  key={c.id}
                  contact={c}
                  meetingCount={getMeetingsFor(c).length}
                  actionCount={getActionsFor(c).filter((a) => a.status !== 'done').length}
                  onSelect={() => setSelected(c)}
                />
              ))
            )}
          </>
        )}

        {/* Dossier panel */}
        {selected && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="apex-card-elevated" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
                  <Avatar name={selected.fullName} size={64} highlight />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <h2 className="apex-h2" style={{ fontSize: '1.5rem', margin: 0 }}>
                        {selected.fullName}
                      </h2>
                      {selectedMeetings.length >= 5 && <span className="apex-chip apex-chip-violet">Key Contact</span>}
                    </div>
                    <p style={{ color: 'var(--apex-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                      {[selected.role, selected.companyName].filter(Boolean).join(' · ') || '—'}
                    </p>
                    {selected.email && (
                      <p className="apex-mono" style={{ color: 'var(--apex-text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        {selected.email}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                  style={{
                    width: 32, height: 32, borderRadius: '0.5rem',
                    background: 'transparent', border: '1px solid var(--apex-border)',
                    color: 'var(--apex-text-secondary)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
              </div>

              {/* Snapshot stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                <SnapshotTile label="Meetings" value={selectedMeetings.length} />
                <SnapshotTile label="Open Actions" value={selectedActions.filter((a) => a.status !== 'done').length} />
                <SnapshotTile label="Last Seen" value={selectedLastSeen ? formatDate(selectedLastSeen.meetingDate) : '—'} />
              </div>
            </div>

            {/* Unified history */}
            <div className="apex-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--apex-primary-bright)' }}>timeline</span>
                  <h3 className="apex-h3">Unified History</h3>
                </div>
              </div>

              {selectedMeetings.length === 0 ? (
                <p style={{ color: 'var(--apex-text-muted)', fontSize: '0.8125rem' }}>No interactions recorded.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {selectedMeetings
                    .filter((m) => m.meetingDate)
                    .sort((a, b) => new Date(b.meetingDate!).getTime() - new Date(a.meetingDate!).getTime())
                    .slice(0, 10)
                    .map((m) => (
                      <Link
                        key={m.id}
                        href={`/meetings/${m.id}`}
                        className="apex-card-flat"
                        style={{ padding: '0.875rem 1rem', textDecoration: 'none', display: 'block' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p className="apex-label-caps" style={{ marginBottom: '0.25rem', color: 'var(--apex-text-muted)' }}>
                              Meeting
                            </p>
                            <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--apex-text)', margin: 0 }}>
                              {m.title}
                            </p>
                            {m.aiSummary && (
                              <p style={{ fontSize: '0.75rem', color: 'var(--apex-text-muted)', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {m.aiSummary.slice(0, 140)}
                                {m.aiSummary.length > 140 ? '…' : ''}
                              </p>
                            )}
                          </div>
                          <span className="apex-mono" style={{ fontSize: '0.75rem', color: 'var(--apex-text-muted)', flexShrink: 0 }}>
                            {formatDate(m.meetingDate)}
                          </span>
                        </div>
                      </Link>
                    ))}
                </div>
              )}
            </div>

            {/* Assigned actions */}
            <div className="apex-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--apex-violet)' }}>checklist</span>
                <h3 className="apex-h3">Assigned Actions</h3>
                <span className="apex-chip apex-chip-violet" style={{ marginLeft: 'auto' }}>{selectedActions.length} TOTAL</span>
              </div>

              {selectedActions.length === 0 ? (
                <p style={{ color: 'var(--apex-text-muted)', fontSize: '0.8125rem' }}>No assigned actions.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedActions.slice(0, 8).map((a) => {
                    const status = a.status ?? 'open';
                    const isDone = status === 'done';
                    return (
                      <div
                        key={a.id}
                        className="apex-card-flat"
                        style={{ padding: '0.625rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                      >
                        <span className={`apex-chip ${STATUS_CHIP[status] ?? 'apex-chip-primary'}`}>{status.replace('_', ' ').toUpperCase()}</span>
                        <p style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--apex-text)', textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.6 : 1, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.title}
                        </p>
                        {a.dueDate && (
                          <span className="apex-mono" style={{ fontSize: '0.6875rem', color: 'var(--apex-text-muted)', flexShrink: 0 }}>
                            {formatDate(a.dueDate)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {selectedActions.length > 8 && (
                    <p style={{ fontSize: '0.6875rem', color: 'var(--apex-text-muted)', textAlign: 'center', marginTop: '0.25rem' }}>
                      + {selectedActions.length - 8} more
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ContactCard({ contact, meetingCount, actionCount, onSelect }: { contact: Contact; meetingCount: number; actionCount: number; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="apex-card"
      style={{
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        color: 'var(--apex-text)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Avatar name={contact.fullName} size={40} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--apex-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
            {contact.fullName}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--apex-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
            {contact.role ?? '—'}
          </p>
        </div>
      </div>

      {contact.companyName && (
        <p style={{ fontSize: '0.75rem', color: 'var(--apex-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--apex-text-muted)' }}>business</span>
          {contact.companyName}
        </p>
      )}

      <footer style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: 'auto' }}>
        {meetingCount > 0 && (
          <span className="apex-chip apex-chip-primary">{meetingCount} MEETINGS</span>
        )}
        {actionCount > 0 && (
          <span className="apex-chip apex-chip-violet">{actionCount} OPEN</span>
        )}
      </footer>
    </button>
  );
}

function SnapshotTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="apex-card-flat" style={{ padding: '0.75rem 1rem' }}>
      <p className="apex-label-caps" style={{ marginBottom: '0.375rem' }}>{label}</p>
      <p className="apex-mono" style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--apex-text)', lineHeight: 1 }}>{value}</p>
    </div>
  );
}

function Avatar({ name, size = 28, highlight }: { name: string; size?: number; highlight?: boolean }) {
  return (
    <div
      style={{
        width: size, height: size,
        borderRadius: '9999px',
        background: highlight ? 'var(--apex-primary)' : 'var(--apex-primary-soft)',
        border: '1px solid var(--apex-border-bright)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size >= 40 ? '1rem' : '0.6875rem',
        fontWeight: 700,
        color: highlight ? '#fff' : 'var(--apex-primary-bright)',
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

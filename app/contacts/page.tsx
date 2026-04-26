'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ResizableSplit from '@/components/ResizableSplit';
import SortHeader from '@/components/SortHeader';

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

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '·';
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d));
}

function parseParticipants(raw: string[] | string | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, fontSize: 12, color: 'var(--apex-text-faint)' }}>Loading…</div>}>
      <ContactsInner />
    </Suspense>
  );
}

type ContactSortKey = 'name' | 'company' | 'role' | 'mtgs' | 'last' | null;

function ContactsInner() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const search = searchParams?.get('q') ?? '';
  const [selected, setSelected] = useState<Contact | null>(null);
  const [sortKey, setSortKey] = useState<ContactSortKey>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [c, m, a] = await Promise.all([
        fetch('/api/contacts').then((r) => r.ok ? r.json() : []),
        fetch('/api/meetings').then((r) => r.ok ? r.json() : []),
        fetch('/api/action-items').then((r) => r.ok ? r.json() : []),
      ]);
      setContacts(Array.isArray(c) ? c : []);
      setMeetings(Array.isArray(m) ? m : []);
      setActionItems(Array.isArray(a) ? a : []);
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

  const getMeetingsFor = useCallback((c: Contact) => meetingsByParticipant.get(c.fullName.toLowerCase()) ?? [], [meetingsByParticipant]);
  const getActionsFor = useCallback((c: Contact) => {
    const first = c.fullName.split(' ')[0]?.toLowerCase() ?? '';
    return actionItems.filter((a) =>
      a.assignee?.toLowerCase() === c.fullName.toLowerCase() ||
      (first && a.assignee?.toLowerCase().includes(first)),
    );
  }, [actionItems]);

  const getLastSeen = useCallback((c: Contact): string => {
    const ms = getMeetingsFor(c).filter((m) => m.meetingDate).sort((a, b) => new Date(b.meetingDate!).getTime() - new Date(a.meetingDate!).getTime());
    return ms.length > 0 ? formatDate(ms[0].meetingDate) : '—';
  }, [getMeetingsFor]);

  const getLastSeenTime = useCallback((c: Contact): number => {
    const ms = getMeetingsFor(c).filter((m) => m.meetingDate).sort((a, b) => new Date(b.meetingDate!).getTime() - new Date(a.meetingDate!).getTime());
    return ms.length > 0 ? new Date(ms[0].meetingDate!).getTime() : 0;
  }, [getMeetingsFor]);

  const sortedContacts = useMemo(() => {
    if (!sortKey) return filtered;
    const sign = sortDir === 'asc' ? 1 : -1;
    const v = (c: Contact): number | string => {
      switch (sortKey) {
        case 'name':    return c.fullName.toLowerCase();
        case 'company': return (c.companyName ?? '~~~').toLowerCase();
        case 'role':    return (c.role ?? '~~~').toLowerCase();
        case 'mtgs':    return getMeetingsFor(c).length;
        case 'last':    return getLastSeenTime(c);
        default:        return '';
      }
    };
    return [...filtered].sort((a, b) => {
      const av = v(a), bv = v(b);
      if (av < bv) return -1 * sign;
      if (av > bv) return 1 * sign;
      return 0;
    });
  }, [filtered, sortKey, sortDir, getMeetingsFor, getLastSeenTime]);

  const onSort = (key: NonNullable<ContactSortKey>) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortKey(null); setSortDir('asc'); }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const selectedMeetings = selected ? getMeetingsFor(selected).filter((m) => m.meetingDate).sort((a, b) => new Date(b.meetingDate!).getTime() - new Date(a.meetingDate!).getTime()) : [];
  const selectedActions = selected ? getActionsFor(selected) : [];

  // Left — dense table
  const leftPane = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--apex-bg)', minWidth: 0 }}>
      <div className="apex-page-header">
        <span className="apex-page-title">People</span>
      </div>

      <div className="apex-statbar">
        <div className="apex-stat"><span className="apex-stat-value">{contacts.length}</span><span className="apex-stat-label">Total</span></div>
        <div className="apex-stat"><span className="apex-stat-value accent">{filtered.length}</span><span className="apex-stat-label">Showing</span></div>
        <div className="apex-stat"><span className="apex-stat-value">{new Set(contacts.map((c) => c.companyName).filter(Boolean)).size}</span><span className="apex-stat-label">Companies</span></div>
      </div>

      <div className="apex-grid-header" style={{ gridTemplateColumns: '32px 1fr 130px 130px 50px 80px' }}>
        <span></span>
        <SortHeader label="Name"    k="name"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Company" k="company" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Role"    k="role"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Mtgs"    k="mtgs"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
        <SortHeader label="Last"    k="last"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Empty msg="Loading…" />
        ) : sortedContacts.length === 0 ? (
          <Empty msg="No contacts" />
        ) : (
          sortedContacts.map((c) => {
            const isSel = selected?.id === c.id;
            const mc = getMeetingsFor(c).length;
            return (
              <div
                key={c.id}
                className={`apex-grid-row${isSel ? ' selected' : ''}`}
                style={{ gridTemplateColumns: '32px 1fr 130px 130px 50px 80px' }}
                onClick={() => setSelected(isSel ? null : c)}
              >
                <span className="avatar">{initials(c.fullName)}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="cell-primary">{c.fullName}</div>
                  {c.email && <div className="cell-meta" style={{ fontSize: 10 }}>{c.email}</div>}
                </div>
                <span className="cell-secondary">{c.companyName ?? '—'}</span>
                <span className="cell-meta">{c.role ?? '—'}</span>
                <span className="cell-meta" style={{ textAlign: 'right' }}>{mc > 0 ? mc : '—'}</span>
                <span className="cell-meta" style={{ textAlign: 'right' }}>{getLastSeen(c)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // Right — dossier
  const rightPane = selected ? (
    <div className="detail-pane">
      <div className="detail-pane-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span className="avatar lg accent">{initials(selected.fullName)}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--apex-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selected.fullName}
            </div>
            {selected.email && <div className="cell-meta" style={{ fontSize: 10.5 }}>{selected.email}</div>}
          </div>
        </div>
        <button className="btn-icon" onClick={() => setSelected(null)} aria-label="Close">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      </div>

      <div className="detail-pane-body">
        {/* Meta strip */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {selected.companyName && <Meta label="Company" value={selected.companyName} />}
          {selected.role && <Meta label="Role" value={selected.role} />}
          <Meta label="Meetings" value={String(selectedMeetings.length)} />
          <Meta label="Open Actions" value={String(selectedActions.filter((a) => a.status !== 'done').length)} />
        </div>

        {/* Meetings */}
        <div>
          <div className="detail-section-label">Recent Meetings ({selectedMeetings.length})</div>
          {selectedMeetings.length === 0 ? (
            <span style={{ fontSize: 11, color: 'var(--apex-text-faint)' }}>None</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 4 }}>
              {selectedMeetings.slice(0, 12).map((m) => (
                <Link
                  key={m.id}
                  href={`/meetings/${m.id}`}
                  className="apex-grid-row"
                  style={{ gridTemplateColumns: '64px 1fr', minHeight: 28, padding: '4px 0', borderBottom: '1px solid var(--apex-border)' }}
                >
                  <span className="cell-meta">{formatDate(m.meetingDate)}</span>
                  <span className="cell-primary">{m.title}</span>
                </Link>
              ))}
              {selectedMeetings.length > 12 && (
                <span className="cell-meta" style={{ marginTop: 4 }}>+{selectedMeetings.length - 12} more</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div>
          <div className="detail-section-label">Assigned Actions ({selectedActions.length})</div>
          {selectedActions.length === 0 ? (
            <span style={{ fontSize: 11, color: 'var(--apex-text-faint)' }}>None</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 4 }}>
              {selectedActions.map((a) => {
                const status = a.status ?? 'open';
                return (
                  <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 70px', gap: 8, alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--apex-border)' }}>
                    <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>
                    <span className={status === 'done' ? 'cell-done' : 'cell-primary'}>{a.title}</span>
                    <span className="cell-meta" style={{ textAlign: 'right' }}>{a.dueDate ? formatDate(a.dueDate) : '—'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--apex-panel)', borderLeft: '1px solid var(--apex-border)' }}>
      <span style={{ fontSize: 11, color: 'var(--apex-text-faint)' }}>Select a person to preview</span>
    </div>
  );

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <ResizableSplit
        left={leftPane}
        right={rightPane}
        defaultLeftPct={60}
        minLeftPx={520}
        minRightPx={360}
        storageKey="contacts-split"
      />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="detail-section-label">{label}</div>
      <div className="detail-section-value" style={{ fontSize: 12 }}>{value}</div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ padding: 32, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>{msg}</div>;
}

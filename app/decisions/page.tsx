'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SortHeader from '@/components/SortHeader';
import { formatDate } from '@/lib/format-date';

interface Row {
  id: string;
  decision: string;
  owner: string | null;
  implication: string | null;
  meetingId: string | null;
  meetingTitle: string | null;
  meetingDate: string | null;
  companyName: string | null;
}

type SortKey = 'decision' | 'owner' | 'meeting' | 'date' | null;

export default function DecisionsListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetch('/api/decisions')
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const onSort = (k: NonNullable<SortKey>) => {
    if (sortKey !== k) { setSortKey(k); setSortDir('asc'); return; }
    if (sortDir === 'asc') setSortDir('desc');
    else { setSortKey(null); }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const cmp = (a: Row, b: Row) => {
      const av = sortKey === 'decision' ? a.decision
        : sortKey === 'owner' ? (a.owner ?? '')
        : sortKey === 'meeting' ? (a.meetingTitle ?? '')
        : (a.meetingDate ?? '');
      const bv = sortKey === 'decision' ? b.decision
        : sortKey === 'owner' ? (b.owner ?? '')
        : sortKey === 'meeting' ? (b.meetingTitle ?? '')
        : (b.meetingDate ?? '');
      return av < bv ? -1 : av > bv ? 1 : 0;
    };
    const out = [...rows].sort(cmp);
    return sortDir === 'desc' ? out.reverse() : out;
  }, [rows, sortKey, sortDir]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="apex-page-header">
        <span className="apex-page-title">Decisions</span>
        <span className="cell-meta">{rows.length}</span>
      </div>
      <div className="apex-grid-header" style={{ gridTemplateColumns: '2fr 140px 1fr 140px 1.5fr' }}>
        <SortHeader label="Decision" k="decision" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Owner" k="owner" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Meeting" k="meeting" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Date" k="date" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--apex-text-muted)', textTransform: 'uppercase' }}>Implication</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>Loading…</div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>No decisions yet.</div>
        ) : (
          sorted.map((r) => (
            <div key={r.id} className="apex-grid-row" style={{ gridTemplateColumns: '2fr 140px 1fr 140px 1.5fr', minHeight: 32, padding: '6px 14px' }}>
              <span className="cell-primary" style={{ fontSize: 12 }}>{r.decision}</span>
              <span className="cell-meta" style={{ fontSize: 11.5 }}>{r.owner ?? '—'}</span>
              <Link href={r.meetingId ? `/meetings/${r.meetingId}` : '#'} style={{ fontSize: 11.5, color: 'var(--apex-primary-bright)', textDecoration: 'none' }}>
                {r.meetingTitle ?? '—'}
              </Link>
              <span className="cell-meta" style={{ fontSize: 11.5 }}>{formatDate(r.meetingDate)}</span>
              <span className="cell-secondary" style={{ fontSize: 11.5 }}>{r.implication ?? '—'}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

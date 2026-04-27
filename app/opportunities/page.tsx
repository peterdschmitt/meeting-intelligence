'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SortHeader from '@/components/SortHeader';

interface Row {
  id: string;
  opportunity: string;
  nextStep: string | null;
  status: string | null;
  meetingId: string | null;
  meetingTitle: string | null;
  meetingDate: string | null;
  companyName: string | null;
}

type SortKey = 'opportunity' | 'status' | 'meeting' | 'date' | null;

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'pursuing', label: 'Pursuing' },
  { value: 'won', label: 'Won' },
  { value: 'dropped', label: 'Dropped' },
];

function formatDate(d: string | null): string {
  if (!d) return '—';
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, '0')}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getFullYear()).slice(-2)}`;
}

export default function OpportunitiesListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetch('/api/opportunities')
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

  const setStatus = async (id: string, status: string) => {
    const prev = rows;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
    try {
      const res = await fetch(`/api/opportunities/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch { setRows(prev); }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const cmp = (a: Row, b: Row) => {
      const av = sortKey === 'opportunity' ? a.opportunity
        : sortKey === 'status' ? (a.status ?? '')
        : sortKey === 'meeting' ? (a.meetingTitle ?? '')
        : (a.meetingDate ?? '');
      const bv = sortKey === 'opportunity' ? b.opportunity
        : sortKey === 'status' ? (b.status ?? '')
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
        <span className="apex-page-title">Opportunities</span>
        <span className="cell-meta">{rows.length}</span>
      </div>
      <div className="apex-grid-header" style={{ gridTemplateColumns: '2.5fr 110px 1.5fr 1fr 130px' }}>
        <SortHeader label="Opportunity" k="opportunity" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--apex-text-muted)', textTransform: 'uppercase' }}>Next step</span>
        <SortHeader label="Meeting" k="meeting" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Date" k="date" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>Loading…</div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>No opportunities yet.</div>
        ) : (
          sorted.map((r) => (
            <div key={r.id} className="apex-grid-row" style={{ gridTemplateColumns: '2.5fr 110px 1.5fr 1fr 130px', minHeight: 32, padding: '6px 14px', alignItems: 'center' }}>
              <span className="cell-primary" style={{ fontSize: 12 }}>{r.opportunity}</span>
              <select
                value={r.status ?? 'open'}
                onChange={(e) => setStatus(r.id, e.target.value)}
                style={{ height: 24, fontSize: 11, padding: '0 6px', background: 'var(--apex-panel)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)', borderRadius: 4 }}
              >
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <span className="cell-secondary" style={{ fontSize: 11.5 }}>{r.nextStep ?? '—'}</span>
              <Link href={r.meetingId ? `/meetings/${r.meetingId}` : '#'} style={{ fontSize: 11.5, color: 'var(--apex-primary-bright)', textDecoration: 'none' }}>
                {r.meetingTitle ?? '—'}
              </Link>
              <span className="cell-meta" style={{ fontSize: 11.5 }}>{formatDate(r.meetingDate)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

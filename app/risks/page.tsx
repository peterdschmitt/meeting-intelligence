'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SortHeader from '@/components/SortHeader';
import { formatDate } from '@/lib/format-date';

interface Row {
  id: string;
  risk: string;
  severity: string | null;
  status: string | null;
  whyItMatters: string | null;
  mitigation: string | null;
  meetingId: string | null;
  meetingTitle: string | null;
  meetingDate: string | null;
  companyName: string | null;
}

type SortKey = 'risk' | 'severity' | 'status' | 'meeting' | 'date' | null;

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const STATUS_OPTIONS = [
  { value: 'open', label: 'O', full: 'Open' },
  { value: 'mitigated', label: 'M', full: 'Mitigated' },
  { value: 'accepted', label: 'A', full: 'Accepted' },
];

export default function RisksListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('severity');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetch('/api/risks')
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
      const res = await fetch(`/api/risks/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch { setRows(prev); }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const cmp = (a: Row, b: Row) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortKey === 'severity') {
        av = SEVERITY_ORDER[a.severity ?? ''] ?? 99;
        bv = SEVERITY_ORDER[b.severity ?? ''] ?? 99;
      } else if (sortKey === 'risk')    { av = a.risk; bv = b.risk; }
      else if (sortKey === 'status')  { av = a.status ?? ''; bv = b.status ?? ''; }
      else if (sortKey === 'meeting') { av = a.meetingTitle ?? ''; bv = b.meetingTitle ?? ''; }
      else                             { av = a.meetingDate ?? ''; bv = b.meetingDate ?? ''; }
      return av < bv ? -1 : av > bv ? 1 : 0;
    };
    const out = [...rows].sort(cmp);
    return sortDir === 'desc' ? out.reverse() : out;
  }, [rows, sortKey, sortDir]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="apex-page-header">
        <span className="apex-page-title">Risks</span>
        <span className="cell-meta">{rows.length}</span>
      </div>
      <div className="apex-grid-header" style={{ gridTemplateColumns: '2.5fr 90px 50px 1fr 130px' }}>
        <SortHeader label="Risk" k="risk" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Severity" k="severity" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Meeting" k="meeting" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeader label="Date" k="date" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>Loading…</div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>No risks yet.</div>
        ) : (
          sorted.map((r) => (
            <div key={r.id} className="apex-grid-row" style={{ gridTemplateColumns: '2.5fr 90px 50px 1fr 130px', minHeight: 32, padding: '6px 14px', alignItems: 'center' }}>
              <span className="cell-primary" style={{ fontSize: 12 }}>{r.risk}</span>
              <span className={`badge sev-${r.severity ?? 'medium'}`} style={{ fontSize: 10 }}>{(r.severity ?? '—').toUpperCase()}</span>
              <select
                value={r.status ?? 'open'}
                onChange={(e) => setStatus(r.id, e.target.value)}
                title={`Status: ${(STATUS_OPTIONS.find((s) => s.value === r.status)?.full ?? 'Open')}`}
                style={{ height: 24, fontSize: 11, padding: '0 4px', textAlign: 'center', background: 'var(--apex-panel)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)', borderRadius: 4 }}
              >
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
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

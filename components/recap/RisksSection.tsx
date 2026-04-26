'use client';

import { useState } from 'react';
import Section from './Section';
import InlineText from './InlineText';
import type { Risk } from '@/lib/schema';

interface Props {
  meetingId: string;
  initial: Risk[];
}

const SEVERITY = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];
const STATUS = [
  { value: 'open', label: 'Open' },
  { value: 'mitigated', label: 'Mitigated' },
  { value: 'accepted', label: 'Accepted' },
];

export default function RisksSection({ meetingId, initial }: Props) {
  const [rows, setRows] = useState<Risk[]>(initial);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const prev = rows;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...body } as Risk : x)));
    try {
      const res = await fetch(`/api/risks/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch { setRows(prev); }
  };

  const remove = async (id: string) => {
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/risks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch { setRows(prev); }
  };

  const add = async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/risks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ risk: 'New risk', severity: 'medium' }),
      });
      if (!res.ok) return;
      const created = await res.json() as Risk;
      setRows((r) => [...r, created]);
    } catch { /* ignore */ }
  };

  return (
    <Section
      id="risks" title="Risks" count={rows.length}
      actions={<button className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 11 }} onClick={add}>+ Add</button>}
    >
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--apex-text-faint)' }}>No risks recorded.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((x) => (
            <li key={x.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--apex-border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--apex-text)', fontWeight: 600, marginBottom: 4 }}>
                  <InlineText value={x.risk} onSave={(v) => patch(x.id, { risk: v })} fontSize={12.5} color="var(--apex-text)" />
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--apex-text-secondary)', marginBottom: 4 }}>
                  Why it matters: <InlineText value={x.whyItMatters} placeholder="…" onSave={(v) => patch(x.id, { whyItMatters: v })} fontSize={11.5} multiline />
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--apex-text-secondary)', marginBottom: 6 }}>
                  Mitigation: <InlineText value={x.mitigation} placeholder="…" onSave={(v) => patch(x.id, { mitigation: v })} fontSize={11.5} multiline />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={x.severity ?? 'medium'}
                    onChange={(e) => patch(x.id, { severity: e.target.value })}
                    style={{ height: 22, fontSize: 11, padding: '0 6px', background: 'var(--apex-panel)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)', borderRadius: 4 }}
                  >
                    {SEVERITY.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <select
                    value={x.status ?? 'open'}
                    onChange={(e) => patch(x.id, { status: e.target.value })}
                    style={{ height: 22, fontSize: 11, padding: '0 6px', background: 'var(--apex-panel)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)', borderRadius: 4 }}
                  >
                    {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={() => remove(x.id)} title="Delete" style={{ height: 22, width: 22, padding: 0, background: 'transparent', border: 'none', color: 'var(--apex-text-faint)', cursor: 'pointer', fontSize: 14 }}>×</button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

'use client';

import { useState } from 'react';
import Section from './Section';
import InlineText from './InlineText';
import type { Opportunity } from '@/lib/schema';

interface Props {
  meetingId: string;
  initial: Opportunity[];
}

const STATUS = [
  { value: 'open', label: 'Open' },
  { value: 'pursuing', label: 'Pursuing' },
  { value: 'won', label: 'Won' },
  { value: 'dropped', label: 'Dropped' },
];

export default function OpportunitiesSection({ meetingId, initial }: Props) {
  const [rows, setRows] = useState<Opportunity[]>(initial);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const prev = rows;
    setRows((r) => r.map((o) => (o.id === id ? { ...o, ...body } as Opportunity : o)));
    try {
      const res = await fetch(`/api/opportunities/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch { setRows(prev); }
  };

  const remove = async (id: string) => {
    const prev = rows;
    setRows((r) => r.filter((o) => o.id !== id));
    try {
      const res = await fetch(`/api/opportunities/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch { setRows(prev); }
  };

  const add = async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/opportunities`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity: 'New opportunity' }),
      });
      if (!res.ok) return;
      const created = await res.json() as Opportunity;
      setRows((r) => [...r, created]);
    } catch { /* ignore */ }
  };

  return (
    <Section
      id="opportunities" title="Opportunities" count={rows.length}
      actions={<button className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 11 }} onClick={add}>+ Add</button>}
    >
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--apex-text-faint)' }}>No opportunities recorded.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((o) => (
            <li key={o.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--apex-border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--apex-text)', fontWeight: 600, marginBottom: 4 }}>
                  <InlineText value={o.opportunity} onSave={(v) => patch(o.id, { opportunity: v })} fontSize={12.5} color="var(--apex-text)" />
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--apex-text-secondary)', marginBottom: 6 }}>
                  Next step: <InlineText value={o.nextStep} placeholder="…" onSave={(v) => patch(o.id, { nextStep: v })} fontSize={11.5} multiline />
                </div>
                <select
                  value={o.status ?? 'open'}
                  onChange={(e) => patch(o.id, { status: e.target.value })}
                  style={{ height: 22, fontSize: 11, padding: '0 6px', background: 'var(--apex-panel)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)', borderRadius: 4 }}
                >
                  {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <button onClick={() => remove(o.id)} title="Delete" style={{ height: 22, width: 22, padding: 0, background: 'transparent', border: 'none', color: 'var(--apex-text-faint)', cursor: 'pointer', fontSize: 14 }}>×</button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

'use client';

import { useState } from 'react';
import Section from './Section';
import InlineText from './InlineText';
import type { Decision } from '@/lib/schema';

interface Props {
  meetingId: string;
  initial: Decision[];
}

export default function DecisionsSection({ meetingId, initial }: Props) {
  const [rows, setRows] = useState<Decision[]>(initial);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const prev = rows;
    setRows((r) => r.map((d) => (d.id === id ? { ...d, ...body } as Decision : d)));
    try {
      const res = await fetch(`/api/decisions/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch { setRows(prev); }
  };

  const remove = async (id: string) => {
    const prev = rows;
    setRows((r) => r.filter((d) => d.id !== id));
    try {
      const res = await fetch(`/api/decisions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch { setRows(prev); }
  };

  const add = async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/decisions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'New decision' }),
      });
      if (!res.ok) return;
      const created = await res.json() as Decision;
      setRows((r) => [...r, created]);
    } catch { /* ignore */ }
  };

  return (
    <Section
      id="decisions" title="Decisions" count={rows.length}
      actions={<button className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 11 }} onClick={add}>+ Add</button>}
    >
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--apex-text-faint)' }}>No decisions recorded.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((d) => (
            <li key={d.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--apex-border)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--apex-text)', fontWeight: 600, marginBottom: 2 }}>
                    <InlineText value={d.decision} onSave={(v) => patch(d.id, { decision: v })} fontSize={12.5} color="var(--apex-text)" />
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--apex-text-muted)', marginBottom: 2 }}>
                    Owner: <InlineText value={d.owner} placeholder="—" onSave={(v) => patch(d.id, { owner: v })} fontSize={11.5} />
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--apex-text-secondary)' }}>
                    <InlineText value={d.implication} placeholder="Implication…" onSave={(v) => patch(d.id, { implication: v })} fontSize={11.5} />
                  </div>
                </div>
                <button onClick={() => remove(d.id)} title="Delete" style={{ height: 22, width: 22, padding: 0, background: 'transparent', border: 'none', color: 'var(--apex-text-faint)', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

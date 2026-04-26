'use client';

import { useMemo, useState } from 'react';
import Section from './Section';
import InlineText from './InlineText';
import type { MeetingPrepItem } from '@/lib/schema';

interface Props {
  meetingId: string;
  initial: MeetingPrepItem[];
}

type Kind = 'agenda' | 'question' | 'outcome';
const KINDS: { kind: Kind; title: string; placeholder: string }[] = [
  { kind: 'agenda',   title: 'Suggested agenda', placeholder: 'New agenda item' },
  { kind: 'question', title: 'Questions to ask', placeholder: 'New question' },
  { kind: 'outcome',  title: 'Desired outcomes', placeholder: 'New outcome' },
];

export default function PrepSection({ meetingId, initial }: Props) {
  const [rows, setRows] = useState<MeetingPrepItem[]>(initial);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const prev = rows;
    setRows((r) => r.map((p) => (p.id === id ? { ...p, ...body } as MeetingPrepItem : p)));
    try {
      const res = await fetch(`/api/prep-items/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch { setRows(prev); }
  };

  const remove = async (id: string) => {
    const prev = rows;
    setRows((r) => r.filter((p) => p.id !== id));
    try {
      const res = await fetch(`/api/prep-items/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch { setRows(prev); }
  };

  const add = async (kind: Kind, defaultText: string) => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/prep-items`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, text: defaultText }),
      });
      if (!res.ok) return;
      const created = await res.json() as MeetingPrepItem;
      setRows((r) => [...r, created]);
    } catch { /* ignore */ }
  };

  const grouped = useMemo(() => {
    const m: Record<Kind, MeetingPrepItem[]> = { agenda: [], question: [], outcome: [] };
    for (const p of rows) {
      const k = p.kind as Kind;
      if (k in m) m[k].push(p);
    }
    return m;
  }, [rows]);

  const total = rows.length;

  return (
    <Section id="prep" title="Next Meeting Prep" count={total}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {KINDS.map(({ kind, title, placeholder }) => (
          <div key={kind}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--apex-text-muted)', margin: 0 }}>{title}</h3>
              <button className="btn btn-ghost" style={{ height: 22, padding: '0 8px', fontSize: 11 }} onClick={() => add(kind, placeholder)}>+ Add</button>
            </div>
            {grouped[kind].length === 0 ? (
              <p style={{ fontSize: 11.5, color: 'var(--apex-text-faint)', margin: 0 }}>None.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {grouped[kind].map((p) => (
                  <li key={p.id} style={{ display: 'grid', gridTemplateColumns: kind === 'outcome' ? '20px 1fr 24px' : (kind === 'agenda' ? '1fr 1fr 24px' : '1fr 24px'), gap: 10, alignItems: 'center', padding: '4px 0' }}>
                    {kind === 'outcome' && (
                      <input
                        type="checkbox"
                        checked={p.completed ?? false}
                        onChange={(e) => patch(p.id, { completed: e.target.checked })}
                      />
                    )}
                    <InlineText value={p.text} onSave={(v) => patch(p.id, { text: v })} fontSize={12} />
                    {kind === 'agenda' && (
                      <InlineText value={p.rationale} placeholder="Rationale (why)" onSave={(v) => patch(p.id, { rationale: v })} fontSize={11.5} />
                    )}
                    <button onClick={() => remove(p.id)} title="Delete" style={{ height: 22, width: 22, padding: 0, background: 'transparent', border: 'none', color: 'var(--apex-text-faint)', cursor: 'pointer', fontSize: 14 }}>×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

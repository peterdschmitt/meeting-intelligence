'use client';

import { useState } from 'react';
import Section from './Section';
import InlineText from './InlineText';
import BulletProse from './BulletProse';
import type { MeetingTopic } from '@/lib/schema';

interface Props {
  meetingId: string;
  initial: MeetingTopic[];
}

export default function TopicsSection({ meetingId, initial }: Props) {
  const [rows, setRows] = useState<MeetingTopic[]>(initial);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const prev = rows;
    setRows((r) => r.map((t) => (t.id === id ? { ...t, ...body } as MeetingTopic : t)));
    try {
      const res = await fetch(`/api/topics/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch { setRows(prev); }
  };

  const remove = async (id: string) => {
    const prev = rows;
    setRows((r) => r.filter((t) => t.id !== id));
    try {
      const res = await fetch(`/api/topics/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch { setRows(prev); }
  };

  const add = async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/topics`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New topic', content: '' }),
      });
      if (!res.ok) return;
      const created = await res.json() as MeetingTopic;
      setRows((r) => [...r, created]);
    } catch { /* ignore */ }
  };

  return (
    <Section
      id="topics" title="Topics" count={rows.length}
      actions={<button className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 11 }} onClick={add}>+ Add</button>}
    >
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--apex-text-faint)' }}>No topics yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {rows.map((t) => (
            <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--apex-text)', flex: 1 }}>
                  <InlineText value={t.title} onSave={(v) => patch(t.id, { title: v })} fontSize={13} color="var(--apex-text)" />
                </h3>
                <button onClick={() => remove(t.id)} title="Delete" style={{ height: 22, width: 22, padding: 0, background: 'transparent', border: 'none', color: 'var(--apex-text-faint)', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
              <BulletProse value={t.content} onSave={(v) => patch(t.id, { content: v })} placeholder="Click to add bullets…" />
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

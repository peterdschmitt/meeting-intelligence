'use client';

import { useState } from 'react';
import Section from './Section';
import BulletProse from './BulletProse';

interface Props {
  meetingId: string;
  initial: {
    durationMinutes: number | null;
    productiveMinutes: number | null;
    asyncableMinutes: number | null;
    tangentMinutes: number | null;
    improvementNote: string | null;
  };
}

export default function EffectivenessSection({ meetingId, initial }: Props) {
  const [data, setData] = useState(initial);

  const patch = async (body: Partial<typeof initial>) => {
    const prev = data;
    setData((d) => ({ ...d, ...body }));
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch { setData(prev); }
  };

  const numInput = (label: string, key: 'productiveMinutes' | 'asyncableMinutes' | 'tangentMinutes' | 'durationMinutes') => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: 'var(--apex-text-muted)' }}>
      <span>{label}</span>
      <input
        type="number" min={0}
        value={data[key] ?? ''}
        onChange={(e) => {
          const v = e.target.value === '' ? null : Number(e.target.value);
          patch({ [key]: v } as Partial<typeof initial>);
        }}
        style={{ width: 80, height: 26, fontSize: 12, padding: '0 6px', background: 'var(--apex-panel)', color: 'var(--apex-text)', border: '1px solid var(--apex-border)', borderRadius: 4 }}
      />
    </label>
  );

  return (
    <Section id="effectiveness" title="Meeting Effectiveness">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {numInput('Total (min)', 'durationMinutes')}
          {numInput('Productive', 'productiveMinutes')}
          {numInput('Async-able', 'asyncableMinutes')}
          {numInput('Tangent', 'tangentMinutes')}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--apex-text-muted)', marginBottom: 6 }}>What to improve</div>
          <BulletProse
            value={data.improvementNote}
            placeholder="Click to add notes about what to improve next time… (one bullet per line)"
            onSave={(v) => patch({ improvementNote: v })}
          />
        </div>
      </div>
    </Section>
  );
}

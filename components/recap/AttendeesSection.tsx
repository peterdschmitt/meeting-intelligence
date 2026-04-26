'use client';

import { useState } from 'react';
import Section from './Section';
import InlineText from './InlineText';
import type { MeetingAttendee } from '@/lib/schema';

interface Props {
  meetingId: string;
  initial: MeetingAttendee[];
}

const ENGAGEMENT_OPTIONS = [
  { value: '', label: '—' },
  { value: 'dominant', label: 'Dominant' },
  { value: 'active', label: 'Active' },
  { value: 'quiet', label: 'Quiet' },
];

export default function AttendeesSection({ meetingId, initial }: Props) {
  const [rows, setRows] = useState<MeetingAttendee[]>(initial);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const prev = rows;
    setRows((r) => r.map((a) => (a.id === id ? { ...a, ...body } as MeetingAttendee : a)));
    try {
      const res = await fetch(`/api/attendees/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('patch failed');
    } catch { setRows(prev); }
  };

  const remove = async (id: string) => {
    const prev = rows;
    setRows((r) => r.filter((a) => a.id !== id));
    try {
      const res = await fetch(`/api/attendees/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch { setRows(prev); }
  };

  const add = async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/attendees`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New attendee' }),
      });
      if (!res.ok) return;
      const created = await res.json() as MeetingAttendee;
      setRows((r) => [...r, created]);
    } catch { /* ignore */ }
  };

  return (
    <Section
      id="attendees" title="Attendees" count={rows.length}
      actions={<button className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 11 }} onClick={add}>+ Add</button>}
    >
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--apex-text-faint)' }}>No attendees recorded.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((a) => (
            <li key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px 24px', gap: 12, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--apex-border)' }}>
              <InlineText value={a.name} onSave={(v) => patch(a.id, { name: v })} fontSize={12.5} color="var(--apex-text)" />
              <InlineText value={a.roleAtMeeting} placeholder="Role at meeting" onSave={(v) => patch(a.id, { roleAtMeeting: v })} />
              <select
                value={a.engagement ?? ''}
                onChange={(e) => patch(a.id, { engagement: e.target.value || null })}
                style={{ height: 24, fontSize: 11, padding: '0 6px', background: 'var(--apex-panel)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)', borderRadius: 4 }}
              >
                {ENGAGEMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button onClick={() => remove(a.id)} title="Delete" style={{ height: 24, width: 24, padding: 0, background: 'transparent', border: 'none', color: 'var(--apex-text-faint)', cursor: 'pointer', fontSize: 16 }}>×</button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

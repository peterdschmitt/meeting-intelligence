'use client';

import { useMemo, useState } from 'react';
import Section from './Section';
import InlineText from './InlineText';
import type { ActionItem } from '@/lib/schema';

interface Props {
  meetingId: string;
  initial: ActionItem[];
}

type ViewMode = 'urgency' | 'owner';

const URGENCY_LABELS: Record<string, string> = {
  urgent: 'Urgent (24h)',
  this_week: 'This Week',
  waiting_on: 'Waiting On',
  none: 'No urgency',
};
const URGENCY_ORDER = ['urgent', 'this_week', 'waiting_on', 'none'];

const OWNER_LABELS: Record<string, string> = {
  peter: 'By Peter',
  external: 'By others',
  unknown: 'Unassigned side',
};

export default function ActionItemsSection({ meetingId, initial }: Props) {
  const [rows, setRows] = useState<ActionItem[]>(initial);
  const [view, setView] = useState<ViewMode>('urgency');

  const patch = async (id: string, body: Record<string, unknown>) => {
    const prev = rows;
    setRows((r) => r.map((a) => (a.id === id ? { ...a, ...body } as ActionItem : a)));
    try {
      const res = await fetch(`/api/action-items/${id}`, {
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
      const res = await fetch(`/api/action-items/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch { setRows(prev); }
  };

  const add = async () => {
    try {
      const res = await fetch('/api/action-items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New action item', meetingId, status: 'open' }),
      });
      if (!res.ok) return;
      const created = await res.json() as ActionItem;
      setRows((r) => [...r, created]);
    } catch { /* ignore */ }
  };

  const groups = useMemo(() => {
    const map = new Map<string, ActionItem[]>();
    for (const r of rows) {
      const key = view === 'urgency'
        ? (r.urgencyTier ?? 'none')
        : (r.ownerSide ?? 'unknown');
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return map;
  }, [rows, view]);

  const orderedKeys = view === 'urgency'
    ? URGENCY_ORDER.filter((k) => groups.has(k))
    : ['peter', 'external', 'unknown'].filter((k) => groups.has(k));

  return (
    <Section
      id="action-items" title="Action Items" count={rows.length}
      actions={
        <>
          <div style={{ display: 'flex', gap: 4, marginRight: 8 }}>
            <button className={`btn ${view === 'urgency' ? 'btn-primary' : 'btn-ghost'}`} style={{ height: 24, padding: '0 8px', fontSize: 11 }} onClick={() => setView('urgency')}>By urgency</button>
            <button className={`btn ${view === 'owner' ? 'btn-primary' : 'btn-ghost'}`} style={{ height: 24, padding: '0 8px', fontSize: 11 }} onClick={() => setView('owner')}>By owner</button>
          </div>
          <button className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 11 }} onClick={add}>+ Add</button>
        </>
      }
    >
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--apex-text-faint)' }}>No action items.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {orderedKeys.map((key) => {
            const items = groups.get(key) ?? [];
            const label = view === 'urgency' ? (URGENCY_LABELS[key] ?? key) : (OWNER_LABELS[key] ?? key);
            return (
              <div key={key}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--apex-text-muted)', marginBottom: 6 }}>{label}</div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map((a) => (
                    <li key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 90px 24px', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--apex-border)' }}>
                      <InlineText value={a.title} onSave={(v) => patch(a.id, { title: v })} fontSize={12.5} color="var(--apex-text)" />
                      <InlineText value={a.assignee} placeholder="Assignee" onSave={(v) => patch(a.id, { assignee: v })} fontSize={11.5} />
                      <select
                        value={a.urgencyTier ?? 'none'}
                        onChange={(e) => patch(a.id, { urgencyTier: e.target.value })}
                        style={{ height: 24, fontSize: 11, padding: '0 6px', background: 'var(--apex-panel)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)', borderRadius: 4 }}
                      >
                        {URGENCY_ORDER.map((k) => <option key={k} value={k}>{URGENCY_LABELS[k]}</option>)}
                      </select>
                      <select
                        value={a.ownerSide ?? ''}
                        onChange={(e) => patch(a.id, { ownerSide: e.target.value || null })}
                        style={{ height: 24, fontSize: 11, padding: '0 6px', background: 'var(--apex-panel)', color: 'var(--apex-text-secondary)', border: '1px solid var(--apex-border)', borderRadius: 4 }}
                      >
                        <option value="">—</option>
                        <option value="peter">Peter</option>
                        <option value="external">External</option>
                      </select>
                      <button onClick={() => remove(a.id)} title="Delete" style={{ height: 22, width: 22, padding: 0, background: 'transparent', border: 'none', color: 'var(--apex-text-faint)', cursor: 'pointer', fontSize: 14 }}>×</button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

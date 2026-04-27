'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { compareByImportance, importanceScore } from '@/lib/importance';
import { formatDate } from '@/lib/format-date';

interface ActionItem {
  id: string;
  title: string;
  status: string | null;
  assignee: string | null;
  dueDate: string | null;
  priority: string | null;
  urgencyTier: string | null;
  ownerSide: string | null;
  meetingId: string | null;
  meetingTitle?: string | null;
  createdAt?: string | null;
  snoozedUntil?: string | null;
}

const ME_PATTERNS = ['peter schmitt', 'peter', 'pschmitt', 'p. schmitt'];
const isMe = (s: string | null | undefined): boolean => {
  if (!s) return false;
  const a = s.toLowerCase();
  return ME_PATTERNS.some((p) => a.includes(p));
};

function isOpen(item: ActionItem): boolean {
  const s = item.status ?? 'open';
  return s !== 'done' && s !== 'cancelled';
}

function dueLabel(d: string | null | undefined): { label: string; tone: 'overdue' | 'today' | 'soon' | 'normal' | 'none' } {
  if (!d) return { label: '—', tone: 'none' };
  const due = new Date(d); due.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: `${days}d`, tone: 'overdue' };
  if (days === 0) return { label: 'Today', tone: 'today' };
  if (days <= 7) return { label: `+${days}d`, tone: 'soon' };
  return { label: formatDate(d), tone: 'normal' };
}

function dueColor(tone: 'overdue' | 'today' | 'soon' | 'normal' | 'none'): string {
  if (tone === 'overdue') return 'var(--apex-error)';
  if (tone === 'today') return 'var(--apex-amber)';
  if (tone === 'soon') return 'var(--apex-primary-bright)';
  return 'var(--apex-text-muted)';
}

function composeMailto(person: string, items: ActionItem[]): string {
  const subject = `Following up on ${items.length} item${items.length === 1 ? '' : 's'}`;
  const lines = items.map((it) => {
    const due = it.dueDate ? ` (due ${formatDate(it.dueDate)})` : '';
    return `• ${it.title}${due}`;
  });
  const body = `Hi ${person.split(/\s+/)[0]},\n\nQuick follow-up on the items below — let me know where each stands.\n\n${lines.join('\n')}\n\nThanks,\nPeter`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function FollowUpsPage() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/action-items')
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, ActionItem[]>();
    for (const it of items) {
      if (!isOpen(it)) continue;
      const name = (it.assignee ?? '').trim();
      if (!name) continue;
      if (isMe(name)) continue;
      const arr = map.get(name) ?? [];
      arr.push(it);
      map.set(name, arr);
    }
    // Sort each group by importance desc.
    for (const arr of map.values()) arr.sort(compareByImportance);
    // Sort groups by their TOP item's importance.
    return Array.from(map.entries())
      .map(([name, arr]) => ({ name, items: arr, top: importanceScore(arr[0]) }))
      .sort((a, b) => b.top - a.top);
  }, [items]);

  const totalOpen = useMemo(() => items.filter(isOpen).filter((i) => !isMe(i.assignee)).length, [items]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="apex-page-header">
        <span className="apex-page-title">Follow-ups</span>
        <span className="cell-meta">
          {groups.length} {groups.length === 1 ? 'person' : 'people'} · {totalOpen} open
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 24px' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>Loading…</div>
        ) : groups.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>
            No open items assigned to other people.
          </div>
        ) : (
          groups.map(({ name, items: list }) => (
            <section key={name} style={{ borderBottom: '1px solid var(--apex-border)', padding: '14px 16px' }}>
              <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--apex-text)', margin: 0 }}>{name}</h2>
                <span style={{ fontSize: 11, color: 'var(--apex-text-muted)' }}>{list.length} open</span>
                <a
                  href={composeMailto(name, list)}
                  className="btn btn-primary"
                  style={{ marginLeft: 'auto', height: 24, padding: '0 10px', fontSize: 11, textDecoration: 'none' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>mail</span>
                  Compose follow-up
                </a>
              </header>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {list.map((it) => {
                  const due = dueLabel(it.dueDate);
                  return (
                    <li
                      key={it.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 90px 90px 70px',
                        gap: 10,
                        alignItems: 'center',
                        padding: '5px 0',
                        fontSize: 12,
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                      }}
                    >
                      <span style={{ color: 'var(--apex-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {it.title}
                      </span>
                      <span className={`badge sev-${it.priority ?? 'medium'}`} style={{ fontSize: 10 }}>
                        {(it.priority ?? '—').toUpperCase()}
                      </span>
                      <span style={{ fontSize: 10.5, color: 'var(--apex-text-muted)' }}>
                        {it.urgencyTier && it.urgencyTier !== 'none' ? it.urgencyTier.replace('_', ' ') : '—'}
                      </span>
                      <span style={{ fontSize: 10.5, color: dueColor(due.tone), textAlign: 'right' }}>
                        {due.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--apex-text-faint)' }}>
                {list[0]?.meetingTitle && (
                  <Link href={`/meetings/${list[0].meetingId}`} style={{ color: 'var(--apex-text-faint)', textDecoration: 'none' }}>
                    Most recent: {list[0].meetingTitle}
                  </Link>
                )}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

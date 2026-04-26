'use client';

import { useEffect, useState } from 'react';

export interface TocEntry {
  id: string;
  label: string;
  count?: number | null;
}

interface Props {
  entries: TocEntry[];
}

export default function TocSidebar({ entries }: Props) {
  const [activeId, setActiveId] = useState<string>(entries[0]?.id ?? '');

  useEffect(() => {
    if (entries.length === 0) return;
    const observer = new IntersectionObserver(
      (records) => {
        const visible = records.filter((r) => r.isIntersecting);
        if (visible.length > 0) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          const id = visible[0].target.id;
          if (id) setActiveId(id);
        }
      },
      { rootMargin: '-64px 0px -50% 0px', threshold: [0, 1] },
    );
    for (const e of entries) {
      const el = document.getElementById(e.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [entries]);

  return (
    <nav style={{
      position: 'sticky', top: 0, alignSelf: 'flex-start',
      width: 200, padding: '24px 16px',
      background: 'var(--apex-bg)',
      borderRight: '1px solid var(--apex-border)',
      maxHeight: '100vh', overflowY: 'auto',
    }}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.map((e) => {
          const active = e.id === activeId;
          return (
            <li key={e.id}>
              <a
                href={`#${e.id}`}
                onClick={(ev) => {
                  ev.preventDefault();
                  const el = document.getElementById(e.id);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  setActiveId(e.id);
                }}
                style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                  padding: '6px 8px', borderRadius: 4,
                  fontSize: 11.5, color: active ? 'var(--apex-primary-bright)' : 'var(--apex-text-muted)',
                  background: active ? 'rgba(46,98,255,0.08)' : 'transparent',
                  textDecoration: 'none', fontWeight: active ? 600 : 400,
                }}
              >
                <span>{e.label}</span>
                {e.count !== undefined && e.count !== null && e.count > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--apex-text-faint)' }}>{e.count}</span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

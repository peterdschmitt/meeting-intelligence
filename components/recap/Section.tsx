'use client';

import { ReactNode } from 'react';

interface Props {
  id: string;
  title: string;
  count?: number | null;
  actions?: ReactNode;
  children: ReactNode;
}

export default function Section({ id, title, count, actions, children }: Props) {
  return (
    <section id={id} style={{ scrollMarginTop: 64, padding: '24px 28px', borderBottom: '1px solid var(--apex-border)' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--apex-text)', margin: 0, letterSpacing: '0.02em' }}>{title}</h2>
        {count !== undefined && count !== null && (
          <span style={{ fontSize: 11, color: 'var(--apex-text-muted)' }}>({count})</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>{actions}</div>
      </header>
      <div>{children}</div>
    </section>
  );
}

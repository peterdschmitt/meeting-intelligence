'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';

const TITLES: Record<string, string> = {
  '/': 'Inbox',
  '/meetings': 'Meetings',
  '/action-items': 'Action Items',
  '/contacts': 'People',
  '/companies': 'Companies',
  '/import': 'Import',
};

export default function TopBar() {
  const [query, setQuery] = useState('');
  const pathname = usePathname() ?? '/';

  // Find best title match (longest prefix)
  const title =
    Object.entries(TITLES)
      .filter(([k]) => (k === '/' ? pathname === '/' : pathname.startsWith(k)))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? '';

  return (
    <header className="apex-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--apex-text)', whiteSpace: 'nowrap' }}>
          {title}
        </span>
        <span style={{ width: 1, height: 14, background: 'var(--apex-border-bright)' }} />
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <span
            className="material-symbols-outlined"
            style={{
              position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
              fontSize: 14, color: 'var(--apex-text-faint)', pointerEvents: 'none',
            }}
          >
            search
          </span>
          <input
            className="apex-topbar-search"
            placeholder="Search everything..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className="btn-icon" aria-label="Command menu" title="⌘K">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bolt</span>
        </button>
        <button className="btn-icon" aria-label="Notifications">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>notifications</span>
        </button>
      </div>
    </header>
  );
}

'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const TITLES: Record<string, string> = {
  '/': 'Inbox',
  '/meetings': 'Meetings',
  '/action-items': 'Action Items',
  '/contacts': 'People',
  '/companies': 'Companies',
  '/import': 'Import',
};

const PLACEHOLDERS: Record<string, string> = {
  '/': 'Search everything…',
  '/meetings': 'Search meetings…',
  '/action-items': 'Search action items…',
  '/contacts': 'Search people…',
  '/companies': 'Search companies…',
};

function pathTitle(pathname: string): string {
  const matchKey = Object.entries(TITLES)
    .filter(([k]) => (k === '/' ? pathname === '/' : pathname.startsWith(k)))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[0] ?? '/';
  return TITLES[matchKey] ?? '';
}

function pathPlaceholder(pathname: string): string {
  const matchKey = Object.entries(PLACEHOLDERS)
    .filter(([k]) => (k === '/' ? pathname === '/' : pathname.startsWith(k)))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[0] ?? '/';
  return PLACEHOLDERS[matchKey] ?? 'Search…';
}

function TopBarSearch() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQ = searchParams?.get('q') ?? '';
  const [query, setQuery] = useState(urlQ);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state when URL changes externally (e.g. nav)
  useEffect(() => {
    setQuery(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Debounce URL updates
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (query) params.set('q', query); else params.delete('q');
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    }, 200);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--apex-text)', whiteSpace: 'nowrap' }}>
        {pathTitle(pathname)}
      </span>
      <span style={{ width: 1, height: 14, background: 'var(--apex-border-bright)' }} />
      <div style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
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
          placeholder={pathPlaceholder(pathname)}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQuery('');
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          style={{ width: '100%' }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Clear search"
            style={{
              position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
              width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', color: 'var(--apex-text-muted)', cursor: 'pointer', borderRadius: 4,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
          </button>
        )}
      </div>
    </div>
  );
}

function TopBarSearchFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
      <span style={{ width: 1, height: 14, background: 'var(--apex-border-bright)' }} />
      <div style={{ flex: 1, maxWidth: 420, height: 28 }} />
    </div>
  );
}

export default function TopBar() {
  return (
    <header className="apex-topbar">
      <Suspense fallback={<TopBarSearchFallback />}>
        <TopBarSearch />
      </Suspense>

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

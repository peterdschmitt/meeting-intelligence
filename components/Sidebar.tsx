'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const primaryNav = [
  { href: '/',             icon: 'space_dashboard', label: 'Inbox' },
  { href: '/meetings',     icon: 'event_note',      label: 'Meetings' },
  { href: '/action-items', icon: 'checklist',       label: 'Action Items' },
  { href: '/contacts',     icon: 'group',           label: 'People' },
  { href: '/companies',    icon: 'business',        label: 'Companies' },
];

const secondaryNav = [
  { href: '/import', icon: 'cloud_upload', label: 'Import' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <aside className="apex-sidebar">
      {/* Brand */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--apex-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 24, height: 24,
              background: 'var(--apex-primary)',
              borderRadius: 5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 14 }}>
              forest
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--apex-text)', lineHeight: 1.1, letterSpacing: '-0.01em' }}>
              Pine Lake
            </div>
            <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--apex-text-faint)', marginTop: 2 }}>
              Meeting Intelligence
            </div>
          </div>
        </div>
      </div>

      {/* Create CTA */}
      <div style={{ padding: '10px 8px 4px' }}>
        <Link href="/import" className="btn btn-primary" style={{ width: '100%', height: 28, fontSize: 12 }}>
          <span className="material-symbols-outlined">add</span>
          New
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)' }}>⌘N</span>
        </Link>
      </div>

      {/* Primary */}
      <nav style={{ flex: 1, padding: '8px 8px', overflow: 'auto' }}>
        {primaryNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`apex-nav-item${isActive(item.href) ? ' active' : ''}`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}

        <div className="apex-nav-section-label" style={{ marginTop: 14 }}>Workspace</div>
        {secondaryNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`apex-nav-item${isActive(item.href) ? ' active' : ''}`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Footer: user */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--apex-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
          <div className="avatar accent" style={{ width: 24, height: 24, fontSize: 10 }}>P</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--apex-text)', lineHeight: 1.1, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Peter Schmitt
            </p>
            <p style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--apex-text-faint)', marginTop: 1 }}>
              Managing Director
            </p>
          </div>
          <button className="btn-icon" aria-label="Settings">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>settings</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

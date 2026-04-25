'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/',             icon: 'dashboard',       label: 'Dashboard' },
  { href: '/meetings',     icon: 'event_note',      label: 'Meetings' },
  { href: '/action-items', icon: 'checklist',       label: 'Action Items' },
  { href: '/contacts',     icon: 'group',           label: 'People' },
  { href: '/companies',    icon: 'business',        label: 'Companies' },
  { href: '/import',       icon: 'cloud_upload',    label: 'Import' },
];

const footerItems = [
  { href: '/settings', icon: 'settings_suggest', label: 'Settings' },
  { href: '/support',  icon: 'help_outline',     label: 'Support' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <aside className="apex-sidebar">
      {/* Brand */}
      <div style={{ padding: '1.25rem 1.25rem 1rem', borderBottom: '1px solid var(--apex-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: 'var(--apex-primary)',
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 20 }}>
              forest
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '1.0625rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--apex-text)',
                lineHeight: 1.1,
              }}
            >
              Pine Lake
            </div>
            <div
              style={{
                fontSize: '0.625rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                color: 'var(--apex-text-muted)',
                marginTop: 2,
              }}
            >
              Intelligence
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '1rem 0.875rem', overflow: 'auto' }}>
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} className={`apex-nav-item${active ? ' active' : ''}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer: New Action CTA + secondary nav + user */}
      <div style={{ padding: '1rem 0.875rem 1.25rem', borderTop: '1px solid var(--apex-border)' }}>
        <Link
          href="/import"
          className="apex-btn-primary"
          style={{ width: '100%', marginBottom: '1rem' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          New Action
        </Link>

        <div style={{ marginBottom: '1rem' }}>
          {footerItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`apex-nav-item${isActive(item.href) ? ' active' : ''}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.5rem',
            borderRadius: '0.5rem',
            background: 'rgba(255,255,255,0.025)',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: 'var(--apex-primary-soft)',
              border: '1px solid var(--apex-border-bright)',
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--apex-primary-bright)',
              flexShrink: 0,
            }}
          >
            P
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--apex-text)', margin: 0 }}>
              Peter Schmitt
            </p>
            <p
              style={{
                fontSize: '0.625rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: 'var(--apex-text-muted)',
                marginTop: 1,
              }}
            >
              Managing Director
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

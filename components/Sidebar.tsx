'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/',             icon: 'dashboard',  label: 'Dashboard' },
  { href: '/meetings',     icon: 'event_note', label: 'Meetings' },
  { href: '/action-items', icon: 'checklist',  label: 'Action Items' },
  { href: '/contacts',     icon: 'group',      label: 'People' },
  { href: '/companies',    icon: 'business',   label: 'Companies' },
  { href: '/import',       icon: 'upload',     label: 'Import' },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <aside className="sidebar custom-scrollbar" style={{ overflowY: 'auto' }}>
      {/* Brand */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <span
            className="material-symbols-outlined"
            style={{ color: '#000', fontSize: '16px', fontVariationSettings: "'FILL' 1" }}
          >
            forest
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <h2
            style={{
              fontFamily: '"Playfair Display", serif',
              fontStyle: 'italic',
              fontSize: '18px',
              color: '#ffffff',
              lineHeight: '1',
              margin: 0,
            }}
          >
            Pine Lake.
          </h2>
          <span style={{ color: '#d97706', fontSize: '18px', lineHeight: 1 }}>●</span>
        </div>
      </div>

      {/* Micro label */}
      <div style={{ padding: '0 24px 24px' }}>
        <span className="micro-label">Meeting Intelligence</span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div className={`sidebar-nav-item${active ? ' active' : ''}`}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '16px' }}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {/* New Meeting */}
        <Link href="/import" style={{ textDecoration: 'none' }}>
          <div className="sidebar-btn-new">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
            Import Meeting
          </div>
        </Link>

        {/* User */}
        <div className="sidebar-user">
          <div
            style={{
              width: '28px',
              height: '28px',
              background: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 700,
              color: '#000',
              flexShrink: 0,
            }}
          >
            P
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: '#e5e5e7', fontSize: '12px', fontWeight: 500, margin: 0 }}>
              Peter
            </p>
            <p className="micro-label" style={{ marginTop: '2px' }}>
              Managing Director
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

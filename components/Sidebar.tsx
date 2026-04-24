'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/',             icon: 'dashboard',  label: 'Dashboard' },
  { href: '/meetings',     icon: 'event_note', label: 'Meetings' },
  { href: '/action-items', icon: 'checklist',  label: 'Action Items' },
  { href: '/contacts',     icon: 'group',      label: 'Contacts' },
  { href: '/companies',    icon: 'business',   label: 'Companies' },
  { href: '/import',       icon: 'upload',     label: 'Import' },
];

const bottomItems = [
  { href: '/settings', icon: 'settings_suggest', label: 'Settings' },
  { href: '/support',  icon: 'help_outline',     label: 'Support' },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <aside
      className="sidebar custom-scrollbar"
      style={{ overflowY: 'auto' }}
    >
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <span
            className="material-symbols-outlined"
            style={{
              color: '#ffffff',
              fontSize: '18px',
              fontVariationSettings: "'FILL' 1",
            }}
          >
            deployed_code
          </span>
        </div>
        <div>
          <h2
            className="text-lg font-bold tracking-tighter"
            style={{ color: '#f4f4f5', lineHeight: '1.2' }}
          >
            Equinox PE
          </h2>
          <p
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: '#52525b' }}
          >
            Command Center
          </p>
        </div>
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
                  style={{ fontSize: '20px' }}
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
        {/* New Meeting button */}
        <Link href="/meetings" style={{ textDecoration: 'none' }}>
          <div className="sidebar-btn-new">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              add
            </span>
            <span>+ New Meeting</span>
          </div>
        </Link>

        {/* Settings / Support */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {bottomItems.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div className="sidebar-nav-item">
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '20px' }}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* User avatar footer */}
        <div className="sidebar-user">
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#2e62ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 700,
              color: '#ffffff',
              flexShrink: 0,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            P
          </div>
          <div style={{ minWidth: 0 }}>
            <p
              className="text-xs font-semibold truncate"
              style={{ color: '#f4f4f5', marginBottom: '1px' }}
            >
              Peter
            </p>
            <p
              className="truncate"
              style={{ color: '#52525b', fontSize: '10px' }}
            >
              Managing Director
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

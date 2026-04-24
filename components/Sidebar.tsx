'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/',             icon: 'dashboard',  label: 'Dashboard' },
  { href: '/meetings',     icon: 'event_note', label: 'Meetings' },
  { href: '/action-items', icon: 'checklist',  label: 'Actions' },
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
      {/* Brand — compact */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="sidebar-logo-icon" style={{ width: 22, height: 22, flexShrink: 0 }}>
            <span className="material-icons" style={{ color: '#000', fontSize: '12px' }}>forest</span>
          </div>
          <div>
            <div style={{
              fontFamily: '"Playfair Display", serif',
              fontStyle: 'italic',
              fontSize: '13px',
              color: '#ffffff',
              lineHeight: 1,
            }}>
              Pine Lake
            </div>
            <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.25em', color: '#52525b', marginTop: 2 }}>
              Intelligence
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 8 }}>
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div className={`sidebar-nav-item${active ? ' active' : ''}`}>
                <span className="material-icons" style={{ fontSize: '14px', flexShrink: 0 }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 'auto' }}>
        <Link href="/import" style={{ textDecoration: 'none' }}>
          <div style={{
            width: '100%',
            background: '#d97706',
            color: 'black',
            padding: '6px 8px',
            fontSize: '9px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            border: 'none',
            cursor: 'pointer',
            marginBottom: 10,
          }}>
            <span className="material-icons" style={{ fontSize: '12px' }}>add</span>
            Import
          </div>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 22, height: 22,
            background: '#d97706',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: 700, color: '#000', flexShrink: 0,
          }}>P</div>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: '#e5e5e7', fontSize: '11px', fontWeight: 500, margin: 0 }}>Peter</p>
            <p style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#52525b', marginTop: 1 }}>MD</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

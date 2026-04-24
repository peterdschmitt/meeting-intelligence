'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  Users,
  Upload,
  Building2,
  Zap,
  Plus,
  Settings,
  LifeBuoy,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/meetings', icon: CalendarDays, label: 'Meetings' },
  { href: '/action-items', icon: CheckSquare, label: 'Action Items' },
  { href: '/contacts', icon: Users, label: 'Contacts' },
  { href: '/companies', icon: Building2, label: 'Companies' },
  { href: '/import', icon: Upload, label: 'Import' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: '220px',
        minWidth: '220px',
        background: '#0d1117',
        borderRight: '1px solid rgba(255,255,255,0.08)',
      }}
      className="h-screen sticky top-0 flex flex-col z-40 shrink-0"
    >
      {/* Logo + wordmark */}
      <div
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        className="h-14 flex items-center px-4"
      >
        <div className="flex items-center gap-2.5">
          <div
            style={{ background: '#2563eb', borderRadius: '7px' }}
            className="w-7 h-7 flex items-center justify-center shrink-0"
          >
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight" style={{ color: '#e6edf3' }}>
              Meeting Intel
            </p>
            <p
              className="text-[9px] font-semibold uppercase tracking-widest leading-tight mt-0.5"
              style={{ color: '#484f58' }}
            >
              Private Equity Ops
            </p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors duration-100 cursor-pointer',
                  active
                    ? 'rounded-r-md'
                    : 'rounded-md hover:bg-white/[0.04]'
                )}
                style={
                  active
                    ? {
                        background: '#1c2128',
                        color: '#3b82f6',
                        borderLeft: '2px solid #2563eb',
                        paddingLeft: '10px',
                        borderRadius: '0 6px 6px 0',
                        marginLeft: '-8px',
                        paddingRight: '12px',
                      }
                    : { color: '#7d8590' }
                }
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLDivElement).style.color = '#e6edf3';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLDivElement).style.color = '#7d8590';
                  }
                }}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        className="px-3 py-3 space-y-1"
      >
        {/* New Meeting button */}
        <Link href="/meetings">
          <div
            className="flex items-center justify-center gap-2 w-full py-2 rounded-md text-sm font-semibold transition-colors cursor-pointer"
            style={{ background: '#2563eb', color: '#ffffff' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = '#3b82f6';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = '#2563eb';
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            New Meeting
          </div>
        </Link>

        {/* Settings + Support */}
        <Link href="/settings">
          <div
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer"
            style={{ color: '#7d8590' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.color = '#e6edf3';
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.color = '#7d8590';
              (e.currentTarget as HTMLDivElement).style.background = 'transparent';
            }}
          >
            <Settings className="w-4 h-4 shrink-0" />
            Settings
          </div>
        </Link>
        <Link href="/support">
          <div
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer"
            style={{ color: '#7d8590' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.color = '#e6edf3';
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.color = '#7d8590';
              (e.currentTarget as HTMLDivElement).style.background = 'transparent';
            }}
          >
            <LifeBuoy className="w-4 h-4 shrink-0" />
            Support
          </div>
        </Link>

        {/* User avatar */}
        <div
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
          className="flex items-center gap-2.5 pt-3 mt-1 px-1"
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: '#2563eb', color: '#ffffff' }}
          >
            P
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: '#e6edf3' }}>
              Peter
            </p>
            <p className="text-[10px] truncate" style={{ color: '#484f58' }}>
              Managing Director
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

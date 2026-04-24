'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  Users,
  Upload,
  Building2,
  Zap,
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
    <aside className="w-16 md:w-56 h-screen sticky top-0 flex flex-col bg-navy-800/80 border-r border-white/[0.06] backdrop-blur-xl z-40 shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="hidden md:block font-semibold text-sm text-white/90 tracking-wide">
            Meeting Intel
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/[0.05]'
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="hidden md:block">{item.label}</span>
                {active && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="hidden md:block ml-auto w-1.5 h-1.5 rounded-full bg-violet-400"
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/[0.06]">
        <div className="hidden md:flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-xs font-bold">
            P
          </div>
          <div>
            <p className="text-xs font-medium text-white/80">Peter</p>
            <p className="text-xs text-white/30">Pine Lake Capital</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

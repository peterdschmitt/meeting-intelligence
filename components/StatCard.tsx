'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: 'violet' | 'emerald' | 'orange';
  description: string;
}

const colorMap = {
  violet: {
    iconBg: 'bg-violet-500/10',
    iconText: 'text-violet-400',
    ring: 'ring-violet-500/20',
    glow: 'shadow-violet-500/10',
  },
  emerald: {
    iconBg: 'bg-emerald-500/10',
    iconText: 'text-emerald-400',
    ring: 'ring-emerald-500/20',
    glow: 'shadow-emerald-500/10',
  },
  orange: {
    iconBg: 'bg-orange-500/10',
    iconText: 'text-orange-400',
    ring: 'ring-orange-500/20',
    glow: 'shadow-orange-500/10',
  },
} as const;

export default function StatCard({ title, value, icon: Icon, color, description }: StatCardProps) {
  const [count, setCount] = useState(0);
  const colors = colorMap[color];

  useEffect(() => {
    if (value === 0) {
      setCount(0);
      return;
    }
    const duration = 1000; // ms
    const steps = 40;
    const increment = value / steps;
    const intervalMs = duration / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 },
      }}
      whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
      className={cn(
        'bg-white/[0.04] border border-white/[0.07] rounded-xl p-5',
        'shadow-xl ring-1',
        colors.ring,
        colors.glow
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">{title}</p>
          <p className="text-4xl font-bold text-white tabular-nums leading-none mb-2">{count}</p>
          <p className="text-xs text-white/30 truncate">{description}</p>
        </div>
        <div className={cn('p-2.5 rounded-lg shrink-0', colors.iconBg)}>
          <Icon className={cn('w-5 h-5', colors.iconText)} />
        </div>
      </div>
    </motion.div>
  );
}

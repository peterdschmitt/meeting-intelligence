'use client';

import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: 'violet' | 'emerald' | 'orange';
  description: string;
}

const colorMap = {
  violet: '#8b5cf6',
  emerald: '#3fb950',
  orange: '#d29922',
} as const;

export default function StatCard({ title, value, icon: Icon, color, description }: StatCardProps) {
  const numberColor = colorMap[color];

  return (
    <div
      className="card transition-colors duration-150"
      style={{ padding: '20px', cursor: 'default' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.14)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)';
      }}
    >
      {/* Top row: label + icon */}
      <div className="flex items-center justify-between mb-3">
        <span className="section-label">{title}</span>
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <Icon className="w-4 h-4" style={{ color: numberColor }} />
        </div>
      </div>

      {/* Number */}
      <p
        className="text-[2rem] font-bold leading-none tabular-nums mb-2"
        style={{ color: numberColor }}
      >
        {value}
      </p>

      {/* Subtitle */}
      <p className="text-xs" style={{ color: '#7d8590' }}>
        {description}
      </p>
    </div>
  );
}

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Calendar, Users, Building2, FileText, Mic, Cloud } from 'lucide-react';
import { cn, formatRelativeDate } from '@/lib/utils';

export interface MeetingCardData {
  id: string;
  title: string;
  meetingDate: string | null;
  participants: string[] | null;
  aiSummary: string | null;
  source: string | null;
  companyName?: string | null;
}

interface MeetingCardProps {
  meeting: MeetingCardData;
  index?: number;
}

const sourceConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  manual: { label: 'Manual', icon: FileText, color: 'text-slate-400 bg-slate-400/10 border-slate-400/20' },
  gdrive:  { label: 'Google Drive', icon: Cloud, color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  voice:   { label: 'Voice', icon: Mic, color: 'text-violet-400 bg-violet-400/10 border-violet-400/20' },
};

function ParticipantList({ participants }: { participants: string[] | null }) {
  if (!participants || participants.length === 0) return null;
  const visible = participants.slice(0, 3);
  const extra = participants.length - 3;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Users className="w-3.5 h-3.5 text-white/30 shrink-0" />
      {visible.map((name, i) => (
        <span key={i} className="text-xs text-white/50">
          {name}{i < visible.length - 1 || extra > 0 ? ',' : ''}
        </span>
      ))}
      {extra > 0 && (
        <span className="text-xs text-violet-400 font-medium">+{extra} more</span>
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: string | null }) {
  const key = (source ?? 'manual') as keyof typeof sourceConfig;
  const cfg = sourceConfig[key] ?? sourceConfig.manual;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border', cfg.color)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

export const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
};

export default function MeetingCard({ meeting }: MeetingCardProps) {
  const summary = meeting.aiSummary
    ? meeting.aiSummary.length > 120
      ? meeting.aiSummary.slice(0, 120).trimEnd() + '…'
      : meeting.aiSummary
    : null;

  return (
    <Link href={`/meetings/${meeting.id}`} className="block group">
      <motion.div
        variants={cardVariants}
        whileHover={{ y: -2, transition: { duration: 0.15 } }}
        className="glass rounded-xl p-5 cursor-pointer border border-white/[0.07] hover:border-violet-500/30 hover:bg-white/[0.04] transition-colors duration-200"
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-semibold text-white/90 text-sm leading-snug group-hover:text-white transition-colors line-clamp-2">
            {meeting.title}
          </h3>
          <SourceBadge source={meeting.source} />
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 mb-3">
          {meeting.meetingDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-white/30" />
              <span className="text-xs text-white/50">{formatRelativeDate(meeting.meetingDate)}</span>
            </div>
          )}
          {meeting.companyName && (
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-white/30" />
              <span className="text-xs text-white/50">{meeting.companyName}</span>
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="mb-3">
          <ParticipantList participants={meeting.participants} />
        </div>

        {/* AI Summary preview */}
        {summary ? (
          <p className="text-xs text-white/40 leading-relaxed line-clamp-2">{summary}</p>
        ) : (
          <p className="text-xs text-white/20 italic">No AI summary yet</p>
        )}
      </motion.div>
    </Link>
  );
}

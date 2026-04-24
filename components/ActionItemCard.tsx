'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Calendar, ExternalLink } from 'lucide-react';
import { cn, formatDate, isOverdue } from '@/lib/utils';
import PriorityBadge from './PriorityBadge';

export interface ActionItemWithMeeting {
  id: string;
  title: string;
  description?: string | null;
  assignee?: string | null;
  dueDate?: string | null;
  status: string;
  priority: string;
  meetingId?: string | null;
  meetingTitle?: string | null;
}

interface ActionItemCardProps {
  item: ActionItemWithMeeting;
  onToggleDone: (id: string) => void;
  isLoading?: boolean;
}

export default function ActionItemCard({
  item,
  onToggleDone,
  isLoading = false,
}: ActionItemCardProps) {
  const done = item.status === 'done';
  const overdue = !done && isOverdue(item.dueDate);
  const assigneeInitial = item.assignee?.charAt(0).toUpperCase() ?? '?';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: done ? 0.55 : 1, y: 0 }}
      exit={{ opacity: 0, x: -24, transition: { duration: 0.22, ease: 'easeIn' } }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'glass rounded-xl p-4 flex items-start gap-4 w-full transition-opacity',
        `border-priority-${item.priority}`,
      )}
    >
      {/* ── Circular checkbox ── */}
      <button
        type="button"
        onClick={() => !done && !isLoading && onToggleDone(item.id)}
        disabled={done || isLoading}
        aria-label={done ? 'Completed' : 'Mark as done'}
        className={cn(
          'shrink-0 w-11 h-11 rounded-full border-2 flex items-center justify-center',
          'transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
          done
            ? 'border-emerald-500 bg-emerald-500/20 cursor-default'
            : isLoading
              ? 'border-white/20 opacity-50 cursor-wait'
              : 'border-white/20 hover:border-violet-400 hover:bg-violet-500/10 active:scale-95 cursor-pointer',
        )}
      >
        {done && (
          <motion.svg
            key="check"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-5 h-5 text-emerald-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </motion.svg>
        )}
        {!done && isLoading && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
            className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full"
          />
        )}
      </button>

      {/* ── Content ── */}
      <div className="flex-1 min-w-0 py-0.5">
        {/* Title */}
        <p
          className={cn(
            'text-sm font-medium leading-snug',
            done ? 'line-through text-white/35' : 'text-white/90',
          )}
        >
          {item.title}
        </p>

        {/* Meta row */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {/* Assignee */}
          {item.assignee && (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                {assigneeInitial}
              </div>
              <span className="text-xs text-white/50">{item.assignee}</span>
            </div>
          )}

          {/* Due date */}
          {item.dueDate && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs',
                overdue ? 'text-red-400' : 'text-white/40',
              )}
            >
              <Calendar className="w-3 h-3 shrink-0" />
              <span>
                {formatDate(item.dueDate)}
                {overdue && ' · Overdue'}
              </span>
            </div>
          )}

          {/* Priority badge */}
          <PriorityBadge priority={item.priority} />

          {/* Meeting source link */}
          {item.meetingId && (
            <Link
              href={`/meetings/${item.meetingId}`}
              className="flex items-center gap-1 text-xs text-violet-400/70 hover:text-violet-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[140px]">
                {item.meetingTitle ?? 'Meeting'}
              </span>
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

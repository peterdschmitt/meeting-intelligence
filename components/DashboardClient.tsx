'use client';

import { useTransition } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  AlertCircle,
  ListChecks,
  Clock,
  Users,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import StatCard from '@/components/StatCard';
import { cn, priorityColors } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Meeting {
  id: string;
  title: string;
  meetingDate: string | null;
  participants: string[] | null;
  company?: string | null;
}

interface ActionItem {
  id: string;
  title: string;
  priority: string | null;
  dueDate: string | null;
  status: string | null;
  assignee: string | null;
}

interface DashboardClientProps {
  greeting: string;
  todayMeetings: Meeting[];
  overdueItems: ActionItem[];
  todayMeetingsCount: number;
  overdueCount: number;
  thisWeekCount: number;
}

// ─── Animation Variants ────────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const fadeUpVariant = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(dateStr));
}

type Priority = keyof typeof priorityColors;

function getPriorityColor(priority: string | null): string {
  if (!priority) return priorityColors.medium;
  return priorityColors[priority as Priority] ?? priorityColors.medium;
}

// ─── Mark Done Button ─────────────────────────────────────────────────────────

function MarkDoneButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleMarkDone = async () => {
    try {
      const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
      await fetch(`${base}/api/action-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      });
      startTransition(() => {
        router.refresh();
      });
    } catch {
      // silently fail — the UI will refresh on next visit
    }
  };

  return (
    <button
      onClick={handleMarkDone}
      disabled={isPending}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        'hover:bg-emerald-500/20 hover:border-emerald-400/40',
        'disabled:opacity-40 disabled:cursor-not-allowed'
      )}
    >
      <CheckCircle2 className="w-3.5 h-3.5" />
      {isPending ? 'Saving…' : 'Done'}
    </button>
  );
}

// ─── Today's Meeting Card ─────────────────────────────────────────────────────

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const participantStr = meeting.participants?.join(', ') ?? '—';

  return (
    <motion.div
      variants={fadeUpVariant}
      className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4 flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 p-2 rounded-lg bg-violet-500/10 shrink-0">
          <CalendarDays className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white/90 truncate">{meeting.title}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <Clock className="w-3 h-3 text-white/30 shrink-0" />
            <span className="text-xs text-white/40">{formatTime(meeting.meetingDate)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 pl-10">
        {participantStr !== '—' && (
          <div className="flex items-center gap-1.5">
            <Users className="w-3 h-3 text-white/25 shrink-0" />
            <p className="text-xs text-white/40 truncate">{participantStr}</p>
          </div>
        )}
        {meeting.company && (
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3 h-3 text-white/25 shrink-0" />
            <p className="text-xs text-white/40 truncate">{meeting.company}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Overdue Item Row ─────────────────────────────────────────────────────────

function OverdueItemRow({ item }: { item: ActionItem }) {
  const priorityLabel = item.priority ?? 'medium';
  const colorClass = getPriorityColor(item.priority);

  return (
    <motion.div
      variants={fadeUpVariant}
      className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4 flex items-center gap-4"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/85 truncate">{item.title}</p>
        {item.assignee && (
          <p className="text-xs text-white/35 mt-0.5 truncate">Assignee: {item.assignee}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full border capitalize',
            colorClass
          )}
        >
          {priorityLabel}
        </span>
        <MarkDoneButton itemId={item.id} />
      </div>
    </motion.div>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────

export default function DashboardClient({
  greeting,
  todayMeetings,
  overdueItems,
  todayMeetingsCount,
  overdueCount,
  thisWeekCount,
}: DashboardClientProps) {
  return (
    <div className="relative min-h-screen">
      {/* Animated gradient background */}
      <div className="animated-gradient pointer-events-none absolute inset-0 opacity-40" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10"
      >
        {/* ── Greeting ─────────────────────────────────────────────────────── */}
        <motion.div variants={fadeUpVariant}>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
            {greeting}, Peter
          </h1>
          <p className="mt-1 text-sm text-white/35">
            {new Intl.DateTimeFormat('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            }).format(new Date())}
          </p>
        </motion.div>

        {/* ── Stat Cards ───────────────────────────────────────────────────── */}
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <StatCard
            title="Today's Meetings"
            value={todayMeetingsCount}
            icon={CalendarDays}
            color="violet"
            description="Scheduled for today"
          />
          <StatCard
            title="Overdue Items"
            value={overdueCount}
            icon={AlertCircle}
            color="orange"
            description="Past due date"
          />
          <StatCard
            title="This Week's Items"
            value={thisWeekCount}
            icon={ListChecks}
            color="emerald"
            description="Open action items"
          />
        </motion.div>

        {/* ── Bottom Grid ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Today's Meetings list */}
          <motion.section variants={fadeUpVariant}>
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              Today&apos;s Meetings
            </h2>

            {todayMeetings.length === 0 ? (
              <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-8 text-center">
                <CalendarDays className="w-8 h-8 text-white/15 mx-auto mb-2" />
                <p className="text-sm text-white/30">No meetings scheduled for today</p>
              </div>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-3"
              >
                {todayMeetings.map((meeting) => (
                  <MeetingCard key={meeting.id} meeting={meeting} />
                ))}
              </motion.div>
            )}
          </motion.section>

          {/* Overdue Action Items */}
          <motion.section variants={fadeUpVariant}>
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-400" />
              Overdue Action Items
            </h2>

            {overdueItems.length === 0 ? (
              <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400/40 mx-auto mb-2" />
                <p className="text-sm text-white/30">You&apos;re all caught up!</p>
              </div>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-3"
              >
                {overdueItems.map((item) => (
                  <OverdueItemRow key={item.id} item={item} />
                ))}
              </motion.div>
            )}
          </motion.section>
        </div>
      </motion.div>
    </div>
  );
}

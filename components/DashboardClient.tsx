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
  AlertTriangle,
} from 'lucide-react';
import StatCard from '@/components/StatCard';

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

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
};

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
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

function daysOverdue(dueDateStr: string | null): number {
  if (!dueDateStr) return 0;
  const diff = Date.now() - new Date(dueDateStr).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function isActiveMeeting(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  // consider active if within 60 min window
  return diff >= 0 && diff < 60 * 60 * 1000;
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
      startTransition(() => { router.refresh(); });
    } catch {
      // silently fail
    }
  };

  return (
    <button
      onClick={handleMarkDone}
      disabled={isPending}
      title="Mark as done"
      className="transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {isPending ? (
        <span style={{ fontSize: '8px', color: '#7d8590' }}>…</span>
      ) : (
        <span style={{ fontSize: '8px', color: '#3fb950' }}>✓</span>
      )}
    </button>
  );
}

// ─── Today's Meeting Card ─────────────────────────────────────────────────────

function MeetingCard({ meeting, index }: { meeting: Meeting; index: number }) {
  const participantStr = meeting.participants?.slice(0, 3).join(', ') ?? '';
  const time = formatTime(meeting.meetingDate);
  const active = isActiveMeeting(meeting.meetingDate);

  return (
    <motion.div
      variants={fadeIn}
      className="card flex gap-4 items-start"
      style={{
        padding: '14px 16px',
        background: active ? '#1c2128' : '#161b22',
        borderLeft: active ? '3px solid #2563eb' : '3px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Timeline dot */}
      <div className="flex flex-col items-center pt-1" style={{ gap: '4px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: active ? '#3b82f6' : '#484f58',
            flexShrink: 0,
          }}
        />
        {index === 0 && (
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.06)' }} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span style={{ fontSize: '0.75rem', color: '#7d8590' }}>{time}</span>
          {active && (
            <span className="badge badge-green">ACTIVE</span>
          )}
        </div>
        <p className="text-sm font-semibold truncate" style={{ color: '#e6edf3' }}>
          {meeting.title}
        </p>
        {participantStr && (
          <p className="text-xs mt-1 truncate" style={{ color: '#7d8590' }}>
            <Users className="w-3 h-3 inline-block mr-1 opacity-60" />
            {participantStr}
          </p>
        )}
      </div>

      {/* Action button */}
      <div className="shrink-0 pt-0.5">
        {active ? (
          <button
            className="text-xs font-semibold px-3 py-1.5 rounded-md transition-colors"
            style={{ background: '#2563eb', color: '#ffffff' }}
          >
            Join Now
          </button>
        ) : (
          <button
            className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: '#7d8590',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            Review Brief
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Overdue Item Row ─────────────────────────────────────────────────────────

function OverdueItemRow({ item }: { item: ActionItem }) {
  const days = daysOverdue(item.dueDate);
  const overdueColor = days > 7 ? '#f85149' : '#d29922';

  return (
    <motion.div
      variants={fadeIn}
      className="card flex items-center gap-3"
      style={{ padding: '12px 14px' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: '#e6edf3' }}>
          {item.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[0.65rem] font-semibold uppercase tracking-wider" style={{ color: overdueColor }}>
            {days} {days === 1 ? 'day' : 'days'} overdue
          </span>
          {item.assignee && (
            <span className="text-xs" style={{ color: '#484f58' }}>
              · {item.assignee}
            </span>
          )}
        </div>
      </div>
      <MarkDoneButton itemId={item.id} />
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
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="min-h-screen"
      style={{ padding: '32px 36px', maxWidth: '1100px' }}
    >
      {/* ── Greeting ─────────────────────────────────────────────────────────── */}
      <motion.div variants={fadeIn} style={{ marginBottom: '28px' }}>
        <h1
          className="font-bold"
          style={{ fontSize: '2rem', color: '#e6edf3', lineHeight: '1.2' }}
        >
          {greeting}, Peter.
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: '#7d8590' }}>
          {dateLabel} —{' '}
          {todayMeetingsCount > 0
            ? `${todayMeetingsCount} meeting${todayMeetingsCount !== 1 ? 's' : ''} today`
            : 'No meetings today'}
          {overdueCount > 0
            ? ` and ${overdueCount} overdue action${overdueCount !== 1 ? 's' : ''} requiring your attention.`
            : '.'}
        </p>
      </motion.div>

      {/* ── Stat Cards ───────────────────────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-3 gap-4"
        style={{ marginBottom: '28px' }}
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
          title="This Week"
          value={thisWeekCount}
          icon={ListChecks}
          color="emerald"
          description="Open action items"
        />
      </motion.div>

      {/* ── Two-column layout ─────────────────────────────────────────────────── */}
      <div className="grid gap-6" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* LEFT: Today's Meetings */}
        <motion.section variants={fadeIn}>
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-3.5 h-3.5" style={{ color: '#7d8590' }} />
            <span className="section-label">Today&apos;s Meetings</span>
            {todayMeetingsCount > 0 && (
              <span className="badge badge-gray ml-1">{todayMeetingsCount}</span>
            )}
          </div>

          {todayMeetings.length === 0 ? (
            <div
              className="card flex flex-col items-center justify-center text-center"
              style={{ padding: '40px 20px' }}
            >
              <CalendarDays className="w-8 h-8 mb-2" style={{ color: '#484f58' }} />
              <p className="text-sm" style={{ color: '#7d8590' }}>
                No meetings scheduled for today
              </p>
            </div>
          ) : (
            <motion.div variants={containerVariants} className="space-y-2">
              {todayMeetings.map((meeting, i) => (
                <MeetingCard key={meeting.id} meeting={meeting} index={i} />
              ))}
            </motion.div>
          )}
        </motion.section>

        {/* RIGHT: Overdue Action Items */}
        <motion.section variants={fadeIn}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#f85149' }} />
            <span className="section-label">Overdue Actions</span>
            {overdueCount > 0 && (
              <span className="badge badge-red ml-1">{overdueCount} TOTAL</span>
            )}
          </div>

          {overdueItems.length === 0 ? (
            <div
              className="card flex flex-col items-center justify-center text-center"
              style={{ padding: '40px 20px' }}
            >
              <Clock className="w-8 h-8 mb-2" style={{ color: '#484f58' }} />
              <p className="text-sm" style={{ color: '#7d8590' }}>
                You&apos;re all caught up!
              </p>
            </div>
          ) : (
            <motion.div variants={containerVariants} className="space-y-2">
              {overdueItems.slice(0, 7).map((item) => (
                <OverdueItemRow key={item.id} item={item} />
              ))}
              {overdueItems.length > 7 && (
                <p
                  className="text-xs text-center pt-1 cursor-pointer hover:underline"
                  style={{ color: '#3b82f6' }}
                >
                  Show All Actions →
                </p>
              )}
            </motion.div>
          )}
        </motion.section>
      </div>
    </motion.div>
  );
}

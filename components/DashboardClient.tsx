'use client';

import { useTransition } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  show:    { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' as const } },
};

const container = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.06 } },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

function hoursOverdue(dueDateStr: string | null): number {
  if (!dueDateStr) return 0;
  const diff = Date.now() - new Date(dueDateStr).getTime();
  return Math.max(0, Math.floor(diff / 3600000));
}

function isActiveMeeting(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  return diff >= 0 && diff < 90 * 60 * 1000;
}

function overdueLabel(item: ActionItem): string {
  const days = daysOverdue(item.dueDate);
  if (days === 0) {
    const hrs = hoursOverdue(item.dueDate);
    if (hrs === 0) return 'DUE NOW';
    return `${hrs} HOUR${hrs !== 1 ? 'S' : ''} OVERDUE`;
  }
  return `${days} DAY${days !== 1 ? 'S' : ''} OVERDUE`;
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
      className="material-symbols-outlined transition-colors disabled:opacity-40"
      style={{
        fontSize: '20px',
        color: isPending ? '#52525b' : '#3f3f46',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '2px',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#a1a1aa'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = isPending ? '#52525b' : '#3f3f46'; }}
    >
      {isPending ? 'hourglass_empty' : 'check_circle'}
    </button>
  );
}

// ─── Stat Card (Metric) ───────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  valueColor,
  sub,
}: {
  label: string;
  value: string | number;
  valueColor?: string;
  sub?: string;
}) {
  return (
    <div className="metric-card">
      <p className="text-label-caps" style={{ color: '#71717a', marginBottom: '0.5rem' }}>
        {label}
      </p>
      <div className="flex items-end justify-between">
        <span className="text-h2" style={{ color: valueColor ?? '#ffffff' }}>
          {value}
        </span>
        {sub && (
          <span
            className="text-xs font-medium"
            style={{ color: sub.includes('%') ? '#60a5fa' : '#71717a' }}
          >
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Today's Meeting Card ─────────────────────────────────────────────────────

function TodayMeetingRow({ meeting, index }: { meeting: Meeting; index: number }) {
  const time = formatTime(meeting.meetingDate);
  const active = isActiveMeeting(meeting.meetingDate);
  const participants = meeting.participants?.slice(0, 3).join(', ') ?? '';

  return (
    <div
      className="relative"
      style={{ paddingLeft: '3rem', position: 'relative' }}
    >
      {/* Timeline dot */}
      <div
        style={{
          position: 'absolute',
          left: '0.75rem',
          top: '1.5rem',
        }}
      >
        {active ? (
          <div className="dot-active" />
        ) : (
          <div className="dot-inactive" />
        )}
      </div>

      <div
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
        style={{
          padding: '1rem',
          borderRadius: '0.5rem',
          background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
          border: active ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
        }}
        onMouseEnter={(e) => {
          if (!active) {
            (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)';
            (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.05)';
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
            (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent';
          }
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-mono-data"
              style={{
                fontSize: '0.75rem',
                color: active ? '#60a5fa' : '#71717a',
              }}
            >
              {time}
            </span>
            {active && (
              <span className="badge badge-active" style={{ fontSize: '9px' }}>
                Active
              </span>
            )}
          </div>
          <h4
            className="font-semibold"
            style={{ color: '#ffffff', fontSize: '0.9375rem' }}
          >
            {meeting.title}
          </h4>
          {participants && (
            <p
              className="text-sm mt-1"
              style={{ color: active ? '#a1a1aa' : '#52525b' }}
            >
              {participants}
              {(meeting.participants?.length ?? 0) > 3
                ? ` +${(meeting.participants?.length ?? 0) - 3} others`
                : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {active ? (
            <Link href={`/meetings/${meeting.id}`}>
              <button
                className="btn-primary"
                style={{ fontSize: '0.75rem', padding: '0.375rem 1rem' }}
              >
                Join Now
              </button>
            </Link>
          ) : (
            <Link href={`/meetings/${meeting.id}`}>
              <button className="btn-ghost">
                Review Brief
              </button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Overdue Action Row ───────────────────────────────────────────────────────

function OverdueActionCard({ item }: { item: ActionItem }) {
  const label = overdueLabel(item);
  const isUrgent = daysOverdue(item.dueDate) > 0;

  return (
    <div
      className="transition-all cursor-pointer"
      style={{
        padding: '1rem',
        background: 'rgba(9,9,11,0.6)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '0.5rem',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = isUrgent
          ? 'rgba(255,180,171,0.3)'
          : 'rgba(59,130,246,0.3)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.05)';
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p
            className="text-label-caps"
            style={{
              color: isUrgent ? '#ffb4ab' : '#60a5fa',
              marginBottom: '0.25rem',
              fontSize: '0.65rem',
            }}
          >
            {label}
          </p>
          <h4
            className="text-sm font-medium"
            style={{ color: '#e4e4e7' }}
          >
            {item.title}
          </h4>
          {item.assignee && (
            <div className="flex items-center gap-2 mt-2">
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: '#27272a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '7px',
                  fontWeight: 700,
                  color: '#a1a1aa',
                  flexShrink: 0,
                }}
              >
                {item.assignee.slice(0, 2).toUpperCase()}
              </div>
              <span style={{ fontSize: '11px', color: '#71717a' }}>
                {item.assignee}
              </span>
            </div>
          )}
        </div>
        <MarkDoneButton itemId={item.id} />
      </div>
    </div>
  );
}

// ─── Main Dashboard Client ────────────────────────────────────────────────────

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

  const completionRate = overdueCount === 0 ? 100 : Math.max(0, Math.round(100 - (overdueCount / (overdueCount + thisWeekCount + 1)) * 100));

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      style={{ padding: '2rem 2rem 3rem', maxWidth: '1440px' }}
    >
      {/* ── Hero Header ────────────────────────────────────────────────── */}
      <motion.section variants={fadeUp} style={{ marginBottom: '2rem' }}>
        <h1 className="text-h1" style={{ color: '#ffffff', marginBottom: '0.5rem' }}>
          {greeting}, Peter.
        </h1>
        <p style={{ color: '#71717a', fontSize: '0.9375rem' }}>
          {dateLabel} —{' '}
          {todayMeetingsCount > 0
            ? `${todayMeetingsCount} meeting${todayMeetingsCount !== 1 ? 's' : ''} today`
            : 'No meetings today'}
          {overdueCount > 0
            ? ` and ${overdueCount} overdue action${overdueCount !== 1 ? 's' : ''} requiring your attention.`
            : '.'}
        </p>
      </motion.section>

      {/* ── Metric Cards ───────────────────────────────────────────────── */}
      <motion.div
        variants={container}
        className="grid gap-4"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          marginBottom: '2rem',
        }}
      >
        <motion.div variants={fadeUp}>
          <MetricCard
            label="Total Meetings"
            value={todayMeetingsCount}
            sub="Today"
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <MetricCard
            label="Pending Actions"
            value={thisWeekCount}
            sub="This week"
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <MetricCard
            label="Due Today"
            value={overdueCount}
            valueColor={overdueCount > 0 ? '#ffb4ab' : '#34d399'}
            sub={overdueCount > 0 ? `Overdue: ${overdueCount}` : 'All clear'}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <MetricCard
            label="Completion Rate"
            value={`${completionRate}%`}
            valueColor="#b7c4ff"
          />
        </motion.div>
      </motion.div>

      {/* ── Bento Grid ─────────────────────────────────────────────────── */}
      <div className="grid gap-6" style={{ gridTemplateColumns: '2fr 1fr' }}>

        {/* LEFT: Today's Schedule */}
        <motion.div variants={fadeUp} className="bento-card">
          <div className="flex items-center justify-between" style={{ marginBottom: '2rem' }}>
            <div className="flex items-center gap-3">
              <span
                className="material-symbols-outlined"
                style={{ color: '#3b82f6', fontSize: '22px' }}
              >
                event
              </span>
              <h3 className="text-h3" style={{ color: '#ffffff' }}>
                Today&apos;s Schedule
              </h3>
            </div>
            <Link href="/meetings">
              <button
                className="text-label-caps"
                style={{
                  color: '#3b82f6',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                }}
              >
                VIEW ALL
              </button>
            </Link>
          </div>

          {/* Timeline */}
          <div style={{ position: 'relative' }}>
            {/* Vertical line */}
            <div
              style={{
                position: 'absolute',
                left: '1rem',
                top: '1rem',
                bottom: '1rem',
                width: '1px',
                background: 'rgba(255,255,255,0.07)',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {todayMeetings.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '2.5rem 1rem',
                    color: '#52525b',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: '36px', marginBottom: '0.75rem', display: 'block' }}
                  >
                    event_available
                  </span>
                  <p style={{ fontSize: '0.875rem' }}>No meetings scheduled for today</p>
                </div>
              ) : (
                todayMeetings.map((meeting, i) => (
                  <TodayMeetingRow key={meeting.id} meeting={meeting} index={i} />
                ))
              )}
            </div>
          </div>
        </motion.div>

        {/* RIGHT: Overdue Actions */}
        <motion.div variants={fadeUp} className="bento-card flex flex-col">
          <div className="flex items-center justify-between" style={{ marginBottom: '2rem' }}>
            <div className="flex items-center gap-3">
              <span
                className="material-symbols-outlined"
                style={{ color: '#ffb4ab', fontSize: '22px' }}
              >
                assignment_late
              </span>
              <h3 className="text-h3" style={{ color: '#ffffff' }}>
                Overdue Actions
              </h3>
            </div>
            {overdueCount > 0 && (
              <span className="badge badge-error-container" style={{ fontSize: '9px' }}>
                {overdueCount} TOTAL
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
            {overdueItems.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2.5rem 1rem',
                  color: '#52525b',
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '36px', marginBottom: '0.75rem', display: 'block' }}
                >
                  task_alt
                </span>
                <p style={{ fontSize: '0.875rem' }}>You&apos;re all caught up!</p>
              </div>
            ) : (
              overdueItems.slice(0, 5).map((item) => (
                <OverdueActionCard key={item.id} item={item} />
              ))
            )}
          </div>

          <Link href="/action-items" style={{ marginTop: '1.5rem' }}>
            <button
              className="w-full"
              style={{
                padding: '0.5rem',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '0.5rem',
                color: '#a1a1aa',
                fontSize: '0.75rem',
                fontWeight: 500,
                background: 'transparent',
                cursor: 'pointer',
                transition: 'background 200ms',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              Show All Actions
            </button>
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}

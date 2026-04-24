import { CalendarDays, AlertCircle, ListChecks, Clock, Users, Building2, CheckCircle2 } from 'lucide-react';
import { cn, priorityColors } from '@/lib/utils';
import StatCard from '@/components/StatCard';
import DashboardClient from '@/components/DashboardClient';

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface MeetingsApiResponse {
  meetings: Meeting[];
}

interface ActionItemsApiResponse {
  actionItems: ActionItem[];
}

// ─── Data Fetching ─────────────────────────────────────────────────────────────

async function fetchMeetings(): Promise<Meeting[]> {
  try {
    const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    const res = await fetch(`${base}/api/meetings`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as MeetingsApiResponse;
    return data.meetings ?? [];
  } catch {
    return [];
  }
}

async function fetchActionItems(): Promise<ActionItem[]> {
  try {
    const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    const res = await fetch(`${base}/api/action-items`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as ActionItemsApiResponse;
    return data.actionItems ?? [];
  } catch {
    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isThisWeek(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return d >= startOfWeek && d < endOfWeek;
}

function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(dateStr));
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Page (Server Component) ───────────────────────────────────────────────────

export default async function DashboardPage() {
  const [allMeetings, allActionItems] = await Promise.all([
    fetchMeetings(),
    fetchActionItems(),
  ]);

  const todayMeetings = allMeetings.filter((m) => isToday(m.meetingDate));
  const overdueItems = allActionItems.filter(
    (a) => a.status !== 'done' && isOverdue(a.dueDate)
  );
  const thisWeekItems = allActionItems.filter(
    (a) => a.status !== 'done' && isThisWeek(a.dueDate)
  );

  const greeting = getGreeting();

  return (
    <DashboardClient
      greeting={greeting}
      todayMeetings={todayMeetings}
      overdueItems={overdueItems}
      todayMeetingsCount={todayMeetings.length}
      overdueCount={overdueItems.length}
      thisWeekCount={thisWeekItems.length}
    />
  );
}

// ─── Re-export helpers for DashboardClient ────────────────────────────────────
export { formatTime, priorityColors, cn };
export type { Meeting, ActionItem };

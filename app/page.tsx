import DashboardClient from '@/components/DashboardClient';

interface Meeting {
  id: string;
  title: string;
  meetingDate: string | null;
  participants: string[] | string | null;
  aiSummary: string | null;
  companyName?: string | null;
  source?: string | null;
}

interface ActionItem {
  id: string;
  title: string;
  status: string | null;
  assignee: string | null;
  dueDate: string | null;
  meetingId: string | null;
  meetingTitle?: string | null;
}

interface Contact {
  id: string;
  fullName: string;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    const res = await fetch(`${base}${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

function isThisWeek(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}

function isThisMonth(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

export default async function DashboardPage() {
  const [meetings, actionItems, contacts] = await Promise.all([
    fetchJson<Meeting[]>('/api/meetings'),
    fetchJson<ActionItem[]>('/api/action-items'),
    fetchJson<Contact[]>('/api/contacts'),
  ]);

  const allMeetings = meetings ?? [];
  const allActions = actionItems ?? [];

  const weekMeetings = allMeetings.filter((m) => isThisWeek(m.meetingDate)).length;
  const monthMeetings = allMeetings.filter((m) => isThisMonth(m.meetingDate)).length;
  const openActions = allActions.filter((a) => a.status !== 'done').length;
  const overdueActions = allActions.filter((a) => a.status !== 'done' && isOverdue(a.dueDate)).length;

  const today = new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date());

  return (
    <DashboardClient
      meetings={allMeetings as Meeting[]}
      actionItems={allActions as ActionItem[]}
      contacts={contacts ?? []}
      stats={{ weekMeetings, monthMeetings, openActions, overdueActions }}
      today={today}
    />
  );
}

import Link from 'next/link';

interface Meeting {
  id: string;
  title: string;
  meetingDate: string | null;
  participants: string[] | string | null;
  aiSummary: string | null;
  companyName?: string | null;
}

interface ActionItem {
  id: string;
  title: string;
  status: string | null;
  assignee: string | null;
  dueDate: string | null;
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

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(dateStr));
}

function parseParticipants(raw: string | string[] | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

export default async function DashboardPage() {
  const [meetings, actionItems, contacts] = await Promise.all([
    fetchJson<Meeting[]>('/api/meetings'),
    fetchJson<ActionItem[]>('/api/action-items'),
    fetchJson<Contact[]>('/api/contacts'),
  ]);

  const allMeetings = meetings ?? [];
  const allActions = actionItems ?? [];
  const allContacts = contacts ?? [];

  const weekMeetings = allMeetings.filter((m) => isThisWeek(m.meetingDate));
  const openActions = allActions.filter((a) => a.status !== 'done');
  const overdueActions = allActions.filter((a) => a.status !== 'done' && isOverdue(a.dueDate));
  const recentMeetings = allMeetings.slice(0, 6);
  const recentActions = allActions.filter((a) => a.status !== 'done').slice(0, 8);

  return (
    <div style={{ minHeight: '100vh', background: '#050505' }}>
      {/* Top nav */}
      <div className="top-nav">
        <div className="amber-line">
          <span className="amber-tag">Meeting Intelligence</span>
        </div>
        <div className="micro-label">
          {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())}
        </div>
      </div>

      {/* Main content */}
      <div className="main-content">
        {/* Heading */}
        <div style={{ marginBottom: '48px' }}>
          <h1 className="page-heading">Intelligence.</h1>
          <p className="micro-label" style={{ marginTop: '12px' }}>
            Overview of your meeting activity
          </p>
        </div>

        {/* Stat cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1px',
            background: 'rgba(255,255,255,0.05)',
            marginBottom: '48px',
          }}
        >
          <div className="stat-card">
            <div className="stat-value">{weekMeetings.length}</div>
            <div className="stat-label">Meetings This Week</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: openActions.length > 0 ? '#d97706' : 'white' }}>
              {openActions.length}
            </div>
            <div className="stat-label">Open Actions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{allContacts.length}</div>
            <div className="stat-label">Contacts</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: overdueActions.length > 0 ? '#d97706' : 'white' }}>
              {overdueActions.length}
            </div>
            <div className="stat-label">Overdue</div>
          </div>
        </div>

        {/* Two column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px' }}>
          {/* Recent Meetings */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <span className="micro-label amber-accent">Recent Meetings</span>
              <Link href="/meetings" style={{ textDecoration: 'none' }}>
                <span className="micro-label" style={{ color: '#52525b', cursor: 'pointer' }}>View all →</span>
              </Link>
            </div>
            <div className="glass-panel">
              {recentMeetings.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center' }}>
                  <p className="micro-label">No meetings yet</p>
                </div>
              ) : (
                recentMeetings.map((m) => {
                  const parts = parseParticipants(m.participants);
                  return (
                    <Link key={m.id} href={`/meetings/${m.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                      <div
                        className="data-row"
                        style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p
                            style={{
                              color: '#e5e5e7',
                              fontSize: '13px',
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginBottom: '4px',
                            }}
                          >
                            {m.title}
                          </p>
                          <span className="micro-label">
                            {parts.length > 0 ? `${parts.length} participants` : 'No participants'}
                          </span>
                        </div>
                        <span className="micro-label" style={{ marginLeft: '16px', flexShrink: 0 }}>
                          {formatDate(m.meetingDate)}
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Action Items */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <span className="micro-label amber-accent">Open Action Items</span>
              <Link href="/action-items" style={{ textDecoration: 'none' }}>
                <span className="micro-label" style={{ color: '#52525b', cursor: 'pointer' }}>View all →</span>
              </Link>
            </div>
            <div className="glass-panel">
              {recentActions.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center' }}>
                  <p className="micro-label">No open action items</p>
                </div>
              ) : (
                recentActions.map((a) => (
                  <div
                    key={a.id}
                    className="data-row"
                    style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p
                        style={{
                          color: '#e5e5e7',
                          fontSize: '13px',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginBottom: '4px',
                        }}
                      >
                        {a.title}
                      </p>
                      {a.assignee && (
                        <span className="micro-label">{a.assignee}</span>
                      )}
                    </div>
                    <div style={{ marginLeft: '16px', flexShrink: 0 }}>
                      <span className="status-open">{a.status ?? 'open'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

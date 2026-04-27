import TodayMeetingsPanel from '@/components/TodayMeetingsPanel';

export const metadata = { title: 'Today — Meeting Intelligence' };

export default function TodayPage() {
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  }).format(new Date());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--apex-bg)' }}>
      <div className="apex-page-header" style={{ borderBottom: '1px solid var(--apex-border)' }}>
        <span className="apex-page-title">Today</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--apex-text-muted)', fontFamily: 'var(--font-mono)' }}>
          {dateLabel}
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <TodayMeetingsPanel />
      </div>
    </div>
  );
}

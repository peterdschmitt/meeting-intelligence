'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatLongDate } from '@/lib/format-date';
import TocSidebar, { type TocEntry } from '@/components/recap/TocSidebar';
import Section from '@/components/recap/Section';
import BulletProse from '@/components/recap/BulletProse';
import AttendeesSection from '@/components/recap/AttendeesSection';
import TopicsSection from '@/components/recap/TopicsSection';
import DecisionsSection from '@/components/recap/DecisionsSection';
import ActionItemsSection from '@/components/recap/ActionItemsSection';
import RisksSection from '@/components/recap/RisksSection';
import OpportunitiesSection from '@/components/recap/OpportunitiesSection';
import PrepSection from '@/components/recap/PrepSection';
import EffectivenessSection from '@/components/recap/EffectivenessSection';
import ReExtractDialog from '@/components/recap/ReExtractDialog';
import type {
  ActionItem,
  Decision,
  MeetingAttendee,
  MeetingPrepItem,
  MeetingTopic,
  Opportunity,
  Risk,
} from '@/lib/schema';

interface MeetingDetail {
  id: string;
  title: string;
  meetingDate: string | null;
  meetingTime: string | null;
  platform: string | null;
  companyId: string | null;
  companyName: string | null;
  rawNotes: string | null;
  executiveSummary: string | null;
  transcript: string | null;
  chapters: string | null;
  keyQuestions: string[] | null;
  durationMinutes: number | null;
  productiveMinutes: number | null;
  asyncableMinutes: number | null;
  tangentMinutes: number | null;
  improvementNote: string | null;
  attendees: MeetingAttendee[];
  topics: MeetingTopic[];
  decisions: Decision[];
  actionItems: ActionItem[];
  risks: Risk[];
  opportunities: Opportunity[];
  prepItems: MeetingPrepItem[];
}

interface Chapter { title: string; timestamp: string; bullets: string[] }

function parseChapters(raw: string | null): Chapter[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as Chapter[] : [];
  } catch { return []; }
}

export default function MeetingDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reExtractOpen, setReExtractOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${id}`);
      if (!res.ok) { setMeeting(null); return; }
      const data = await res.json() as MeetingDetail;
      setMeeting(data);
    } catch { setMeeting(null); }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading meeting detail is an external data sync.
    void load().finally(() => setLoading(false));
  }, [load]);

  const reExtract = async () => {
    try {
      const res = await fetch(`/api/meetings/${id}/extract`, { method: 'POST' });
      if (res.ok) { setReExtractOpen(false); await load(); }
    } catch { /* keep dialog open */ }
  };

  const updateExecSummary = async (next: string) => {
    if (!meeting) return;
    setMeeting({ ...meeting, executiveSummary: next });
    try {
      await fetch(`/api/meetings/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executiveSummary: next }),
      });
    } catch { /* ignore */ }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--apex-text-faint)' }}>Loading…</div>;
  }
  if (!meeting) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--apex-text-muted)', marginBottom: 12 }}>Meeting not found.</p>
        <Link href="/meetings" className="btn btn-ghost">← Meetings</Link>
      </div>
    );
  }

  const chapters = parseChapters(meeting.chapters);
  const keyQuestions = meeting.keyQuestions ?? [];
  const transcriptText = meeting.transcript || meeting.rawNotes;
  const hasTranscriptOrChapters = !!transcriptText || chapters.length > 0 || keyQuestions.length > 0;

  const tocEntries: TocEntry[] = [
    { id: 'executive-summary', label: 'Executive Summary' },
    { id: 'attendees',         label: 'Attendees', count: meeting.attendees.length },
    { id: 'topics',            label: 'Topics', count: meeting.topics.length },
    { id: 'decisions',         label: 'Decisions', count: meeting.decisions.length },
    { id: 'action-items',      label: 'Action Items', count: meeting.actionItems.length },
    { id: 'risks',             label: 'Risks', count: meeting.risks.length },
    { id: 'opportunities',     label: 'Opportunities', count: meeting.opportunities.length },
    { id: 'prep',              label: 'Next Meeting Prep', count: meeting.prepItems.length },
    { id: 'effectiveness',     label: 'Effectiveness' },
  ];
  if (hasTranscriptOrChapters) tocEntries.splice(1, 0, { id: 'transcript', label: transcriptText === meeting.rawNotes && !meeting.transcript ? 'Raw Notes' : 'Transcript' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--apex-bg)' }}>
      <div className="apex-page-header" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          <Link href="/meetings" className="btn-icon" aria-label="Back" style={{ flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
          </Link>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--apex-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
            {meeting.title}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button className="btn btn-ghost"><span className="material-symbols-outlined">share</span>Share</button>
          <button className="btn btn-primary" onClick={() => setReExtractOpen(true)}>
            <span className="material-symbols-outlined">auto_awesome</span>Re-extract
          </button>
        </div>
      </div>

      <div className="apex-statbar" style={{ flexShrink: 0 }}>
        <div className="apex-stat"><span className="apex-stat-value mono" style={{ fontSize: 12 }}>{formatLongDate(meeting.meetingDate)}</span></div>
        {meeting.meetingTime && <div className="apex-stat"><span className="cell-meta">{meeting.meetingTime}</span></div>}
        {meeting.durationMinutes !== null && <div className="apex-stat"><span className="cell-meta">{meeting.durationMinutes} min</span></div>}
        {meeting.platform && <div className="apex-stat"><span className="cell-meta">{meeting.platform}</span></div>}
        {meeting.companyName && <div className="apex-stat"><span className="cell-secondary" style={{ fontSize: 11.5 }}>{meeting.companyName}</span></div>}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <TocSidebar entries={tocEntries} />
        <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
          <Section id="executive-summary" title="Executive Summary">
            <BulletProse value={meeting.executiveSummary} onSave={updateExecSummary} placeholder="Click to add an executive summary…" />
          </Section>

          {hasTranscriptOrChapters && (
            <Section
              id="transcript" title={transcriptText === meeting.rawNotes && !meeting.transcript ? 'Raw Notes' : 'Transcript & Chapters'}
              actions={
                <button className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 11 }} onClick={() => setTranscriptOpen((o) => !o)}>
                  {transcriptOpen ? 'Hide' : 'Show'}
                </button>
              }
            >
              {(transcriptOpen || !!transcriptText) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {chapters.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--apex-text-muted)', margin: '0 0 6px 0' }}>Chapters</h4>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {chapters.map((ch, i) => (
                          <li key={i} style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 8, fontSize: 12 }}>
                            <span className="cell-meta">{ch.timestamp}</span>
                            <span style={{ color: 'var(--apex-text-secondary)' }}>{ch.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {keyQuestions.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--apex-text-muted)', margin: '0 0 6px 0' }}>Key Questions</h4>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--apex-text-secondary)' }}>
                        {keyQuestions.map((q, i) => <li key={i}>{q}</li>)}
                      </ul>
                    </div>
                  )}
                  {transcriptText && (
                    <div>
                      <h4 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--apex-text-muted)', margin: '0 0 6px 0' }}>{meeting.transcript ? 'Transcript' : 'Raw Notes'}</h4>
                      <pre style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--apex-text-secondary)', whiteSpace: 'pre-wrap', margin: 0, maxHeight: transcriptOpen ? 'none' : 420, overflow: 'hidden' }}>
                        {transcriptText}
                      </pre>
                      {!transcriptOpen && transcriptText.length > 3000 && (
                        <button className="btn btn-ghost" style={{ marginTop: 10, height: 28, padding: '0 10px', fontSize: 11 }} onClick={() => setTranscriptOpen(true)}>
                          Show full transcript
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--apex-text-muted)', margin: 0 }}>Click &quot;Show&quot; to expand the raw transcript and chapters.</p>
              )}
            </Section>
          )}

          <AttendeesSection meetingId={meeting.id} initial={meeting.attendees} />
          <TopicsSection meetingId={meeting.id} initial={meeting.topics} />
          <DecisionsSection meetingId={meeting.id} initial={meeting.decisions} />
          <ActionItemsSection meetingId={meeting.id} initial={meeting.actionItems} />
          <RisksSection meetingId={meeting.id} initial={meeting.risks} />
          <OpportunitiesSection meetingId={meeting.id} initial={meeting.opportunities} />
          <PrepSection meetingId={meeting.id} initial={meeting.prepItems} />
          <EffectivenessSection
            meetingId={meeting.id}
            initial={{
              durationMinutes: meeting.durationMinutes,
              productiveMinutes: meeting.productiveMinutes,
              asyncableMinutes: meeting.asyncableMinutes,
              tangentMinutes: meeting.tangentMinutes,
              improvementNote: meeting.improvementNote,
            }}
          />
        </main>
      </div>

      <ReExtractDialog
        open={reExtractOpen}
        onCancel={() => setReExtractOpen(false)}
        onConfirm={reExtract}
      />
    </div>
  );
}

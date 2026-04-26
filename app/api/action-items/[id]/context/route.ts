import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { actionItems, meetings } from '@/lib/schema';
import { eq } from 'drizzle-orm';

interface TranscriptLine {
  timestamp: string;
  speaker: string;
  text: string;
  isMatch?: boolean;
}

function parseTranscript(raw: string): TranscriptLine[] {
  return raw
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const m = line.match(/^\((\d{2}:\d{2})\)\s+([^:]+?):\s+(.+)$/);
      if (m) return { timestamp: m[1], speaker: m[2].trim(), text: m[3].trim() };
      const m2 = line.match(/^\((\d{2}:\d{2})\)\s+(.+)$/);
      if (m2) return { timestamp: m2[1], speaker: '', text: m2[2].trim() };
      return { timestamp: '', speaker: '', text: line.trim() };
    });
}

const BEFORE = 3;
const AFTER = 4;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const [item] = await db
      .select()
      .from(actionItems)
      .where(eq(actionItems.id, id))
      .limit(1);

    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let meeting:
      | {
          id: string;
          title: string;
          meetingDate: Date | null;
          aiSummary: string | null;
          platform: string | null;
        }
      | null = null;
    let transcriptSnippet: TranscriptLine[] = [];

    if (item.meetingId) {
      const [m] = await db
        .select({
          id: meetings.id,
          title: meetings.title,
          meetingDate: meetings.meetingDate,
          aiSummary: meetings.aiSummary,
          transcript: meetings.transcript,
          platform: meetings.platform,
        })
        .from(meetings)
        .where(eq(meetings.id, item.meetingId))
        .limit(1);

      if (m) {
        meeting = {
          id: m.id,
          title: m.title,
          meetingDate: m.meetingDate,
          aiSummary: m.aiSummary,
          platform: m.platform,
        };

        if (item.meetingTimestamp && m.transcript) {
          const lines = parseTranscript(m.transcript);
          const targetIdx = lines.findIndex((l) => l.timestamp === item.meetingTimestamp);
          if (targetIdx !== -1) {
            const start = Math.max(0, targetIdx - BEFORE);
            const end = Math.min(lines.length, targetIdx + AFTER);
            transcriptSnippet = lines.slice(start, end).map((l, i) => ({
              ...l,
              isMatch: i + start === targetIdx,
            }));
          } else {
            // Fallback: best-effort fuzzy match by minute when exact timestamp not found
            const minute = item.meetingTimestamp.split(':')[0];
            const fuzzyIdx = lines.findIndex((l) => l.timestamp.startsWith(`${minute}:`));
            if (fuzzyIdx !== -1) {
              const start = Math.max(0, fuzzyIdx - BEFORE);
              const end = Math.min(lines.length, fuzzyIdx + AFTER);
              transcriptSnippet = lines.slice(start, end).map((l, i) => ({
                ...l,
                isMatch: i + start === fuzzyIdx,
              }));
            }
          }
        }
      }
    }

    return NextResponse.json({ item, meeting, transcriptSnippet });
  } catch (error) {
    console.error('[GET /api/action-items/[id]/context]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

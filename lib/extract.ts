import { db } from '@/lib/db';
import { meetings, actionItems, type NewActionItem } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getOpenAI } from '@/lib/openai';

interface ExtractedActionItem {
  title: string;
  assignee: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ExtractionResult {
  actionItems: typeof actionItems.$inferSelect[];
  summary: string;
}

export async function extractAndSave(meetingId: string, rawNotes: string): Promise<ExtractionResult> {
  const systemPrompt = `You are an expert meeting analyst. Extract structured data from meeting notes.
Respond ONLY with valid JSON — no markdown, no code fences, no explanation.

Return an object with two keys:
1. "actionItems": array of objects with: title (string), assignee (string or null), due_date (YYYY-MM-DD string or null), priority ("low"|"medium"|"high"|"critical")
2. "summary": a 2-3 sentence summary of the meeting

Example response:
{"actionItems":[{"title":"Send proposal","assignee":"Alice","due_date":"2024-02-01","priority":"high"}],"summary":"The team discussed Q1 roadmap. Three action items were identified around product launch."}`;

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Extract action items and write a summary from these meeting notes:\n\n${rawNotes}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw) as {
    actionItems: ExtractedActionItem[];
    summary: string;
  };

  const extractedItems: ExtractedActionItem[] = Array.isArray(parsed.actionItems)
    ? parsed.actionItems
    : [];
  const summary = typeof parsed.summary === 'string' ? parsed.summary : '';

  let insertedItems: typeof actionItems.$inferSelect[] = [];
  if (extractedItems.length > 0) {
    const rows: NewActionItem[] = extractedItems.map((item) => ({
      title: item.title,
      assignee: item.assignee ?? null,
      dueDate: item.due_date ?? null,
      priority: item.priority ?? 'medium',
      status: 'open',
      meetingId,
    }));
    insertedItems = await db.insert(actionItems).values(rows).returning();
  }

  await db
    .update(meetings)
    .set({ aiSummary: summary, updatedAt: new Date() })
    .where(eq(meetings.id, meetingId));

  return { actionItems: insertedItems, summary };
}

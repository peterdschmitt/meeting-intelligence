import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { outreachLog, actionItems, meetings, contacts } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { getOpenAI } from '@/lib/openai';
import { sendMail, buildReplyTo, isMailConfigured } from '@/lib/mail';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const entries = await db
      .select()
      .from(outreachLog)
      .where(eq(outreachLog.actionItemId, id))
      .orderBy(desc(outreachLog.sentAt));
    return NextResponse.json(entries);
  } catch (error: unknown) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const sendEmail = body.send === true; // only attempt SMTP send when explicitly requested

    // Fetch action item with meeting + contact info
    const rows = await db
      .select({
        id: actionItems.id,
        title: actionItems.title,
        assignee: actionItems.assignee,
        status: actionItems.status,
        notes: actionItems.notes,
        description: actionItems.description,
        meetingTitle: meetings.title,
        meetingDate: meetings.meetingDate,
        contactEmail: contacts.email,
        contactName: contacts.fullName,
      })
      .from(actionItems)
      .leftJoin(meetings, eq(actionItems.meetingId, meetings.id))
      .leftJoin(contacts, eq(actionItems.contactId, contacts.id))
      .where(eq(actionItems.id, id))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Action item not found' }, { status: 404 });
    }

    const item = rows[0];
    const recipientName = item.contactName ?? item.assignee ?? 'the assignee';
    const recipientFirst = recipientName.split(/\s+/)[0];
    const status = item.status ?? 'open';
    const meetingTitle = item.meetingTitle ?? 'a recent meeting';
    const meetingDate = item.meetingDate
      ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(item.meetingDate))
      : 'recently';
    const notes = item.notes ?? item.description ?? '';

    // Generate message via GPT-4o
    const systemPrompt = `You are Sophia, a virtual chief of staff assistant to Peter Schmitt, Managing Director at Pine Lake Capital. You are following up on action items from meetings on his behalf.

Begin every message with exactly this one line on its own:
"I'm Sophia, Peter's virtual assistant — I'm following up on his behalf."

Then write a brief, professional follow-up addressed to ${recipientFirst}. Tone: warm but direct, like a trusted colleague checking in.
Keep it under 120 words total. No bullet points. Ask:
1. What is the current status?
2. Is there anything blocking progress?
3. Is there anything Peter can do to help move this forward?

Sign off: "Best, Sophia — on behalf of Peter Schmitt, Pine Lake Capital"`;

    const userPrompt = `Action item: "${item.title}" — owned by ${recipientName} in the "${meetingTitle}" meeting on ${meetingDate}. Current status: ${status}.${notes ? ' Context: ' + notes : ''}`;

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 250,
    });

    const message = completion.choices[0]?.message?.content ?? '';

    const replyTag = `ai-${id.slice(0, 8)}`;
    const subject = `Follow-up: ${item.title.slice(0, 60)}`;
    const recipientEmail = item.contactEmail;

    let emailSent = false;
    let sendError: string | null = null;
    let note = '';

    if (sendEmail) {
      if (!recipientEmail) {
        note = 'No email on file for the linked contact. Add one in the People page to enable sending.';
      } else if (!isMailConfigured()) {
        note = 'Outbound mail is not configured on the server. Set GMAIL_USER and GMAIL_APP_PASSWORD env vars.';
        sendError = note;
      } else {
        const emailBody = `${message}\n\n---\nRef: ${replyTag} · please reply to this email — Sophia monitors responses on Peter's behalf.`;
        const result = await sendMail({
          to: `${recipientName} <${recipientEmail}>`,
          subject,
          text: emailBody,
          replyTo: buildReplyTo(replyTag),
        });
        if (result.ok) {
          emailSent = true;
          note = `Email sent to ${recipientEmail}`;
        } else {
          sendError = result.error ?? 'Unknown send error';
          note = `Send failed: ${sendError}`;
        }
      }
    } else if (!recipientEmail) {
      note = 'No email on file for the linked contact. Add one in the People page to enable sending.';
    } else {
      note = 'Message generated. Click Send to deliver it.';
    }

    const [logEntry] = await db.insert(outreachLog).values({
      actionItemId: id,
      assignee: recipientName,
      messageSent: message,
      emailTo: recipientEmail ?? null,
      emailSubject: subject,
      emailSent,
    }).returning();

    return NextResponse.json({
      message,
      logId: logEntry.id,
      emailSent,
      recipientEmail: recipientEmail ?? null,
      recipientName,
      replyTag,
      sendError,
      note,
    });
  } catch (error: unknown) {
    console.error('[POST /api/action-items/[id]/outreach]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

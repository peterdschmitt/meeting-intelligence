import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  meetings, meetingAttendees, actionItems, companies, meetingPrepGuides, contacts,
} from '@/lib/schema';
import { eq, and, ne, sql, desc } from 'drizzle-orm';
import { loadExcludedAssignees, isExcludedAssignee } from '@/lib/exclusions';

export async function GET(): Promise<NextResponse> {
  const todayEst = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  // Today's meetings: any row whose start_at falls today in ET.
  const rows = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      startAt: meetings.startAt,
      endAt: meetings.endAt,
      calendarSource: meetings.calendarSource,
      joinUrl: meetings.joinUrl,
      platform: meetings.platform,
      executiveSummary: meetings.executiveSummary,
      companyId: meetings.companyId,
      companyName: companies.name,
    })
    .from(meetings)
    .leftJoin(companies, eq(meetings.companyId, companies.id))
    .where(sql`(${meetings.startAt} AT TIME ZONE 'America/New_York')::date = ${todayEst}::date`)
    .orderBy(meetings.startAt);

  const excluded = await loadExcludedAssignees();

  const enriched = await Promise.all(
    rows.map(async (m) => {
      const [attendees, actions, latestGuide] = await Promise.all([
        db
          .select({
            name: meetingAttendees.name,
            email: meetingAttendees.email,
            roleAtMeeting: meetingAttendees.roleAtMeeting,
            contactId: meetingAttendees.contactId,
            contactKind: contacts.kind,
          })
          .from(meetingAttendees)
          .leftJoin(contacts, eq(meetingAttendees.contactId, contacts.id))
          .where(eq(meetingAttendees.meetingId, m.id)),
        db
          .select({
            id: actionItems.id,
            title: actionItems.title,
            assignee: actionItems.assignee,
            ownerSide: actionItems.ownerSide,
            dueDate: actionItems.dueDate,
            status: actionItems.status,
            urgencyTier: actionItems.urgencyTier,
          })
          .from(actionItems)
          .where(and(
            eq(actionItems.meetingId, m.id),
            ne(actionItems.status, 'done'),
            ne(actionItems.status, 'cancelled'),
          )),
        db
          .select({
            guide: meetingPrepGuides.guide,
            generatedAt: meetingPrepGuides.generatedAt,
            model: meetingPrepGuides.model,
          })
          .from(meetingPrepGuides)
          .where(eq(meetingPrepGuides.meetingId, m.id))
          .orderBy(desc(meetingPrepGuides.generatedAt))
          .limit(1),
      ]);

      const filteredActions = actions.filter((a) => !isExcludedAssignee(a.assignee, excluded));
      const externalActions = filteredActions.filter((a) => a.ownerSide === 'external');
      const peterActions = filteredActions.filter((a) => a.ownerSide === 'peter');

      let prepGuide: unknown = null;
      let prepGuideGeneratedAt: string | null = null;
      let prepGuideModel: string | null = null;
      if (latestGuide.length > 0) {
        try {
          prepGuide = JSON.parse(latestGuide[0].guide as unknown as string);
        } catch {
          prepGuide = null;
        }
        prepGuideGeneratedAt = latestGuide[0].generatedAt
          ? new Date(latestGuide[0].generatedAt).toISOString()
          : null;
        prepGuideModel = latestGuide[0].model;
      }

      return {
        id: m.id,
        title: m.title,
        startAt: m.startAt ? new Date(m.startAt).toISOString() : null,
        endAt: m.endAt ? new Date(m.endAt).toISOString() : null,
        calendarSource: m.calendarSource,
        joinUrl: m.joinUrl,
        platform: m.platform,
        companyName: m.companyName,
        attendees,
        openActions: filteredActions,
        externalActions,
        peterActions,
        prepGuide,
        prepGuideGeneratedAt,
        prepGuideModel,
      };
    })
  );

  return NextResponse.json(enriched);
}

import { pgTable, uuid, text, timestamp, date, boolean, integer } from 'drizzle-orm/pg-core';

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  fullName: text('full_name').notNull(),
  email: text('email'),
  role: text('role'),
  companyId: uuid('company_id').references(() => companies.id),
  notes: text('notes'),
  // 'team' | 'partner' | 'external' | null — drives default assumptions and grouping.
  kind: text('kind'),
  // When true, this person's action items are hidden from task lists (Follow-ups,
  // Inbox Open Actions, Action Items) — for people who don't track in our system.
  excludeFromTasks: boolean('exclude_from_tasks').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  meetingDate: timestamp('meeting_date'),
  meetingTime: text('meeting_time'),
  platform: text('platform'),
  // participants column is deprecated; kept for the migration window. New code reads meeting_attendees.
  participants: text('participants').array(),
  rawNotes: text('raw_notes'),
  executiveSummary: text('executive_summary'),
  transcript: text('transcript'),
  chapters: text('chapters'),
  keyQuestions: text('key_questions').array(),
  source: text('source').default('manual'),
  gdriveFileId: text('gdrive_file_id'),
  companyId: uuid('company_id').references(() => companies.id),
  durationMinutes: integer('duration_minutes'),
  productiveMinutes: integer('productive_minutes'),
  asyncableMinutes: integer('asyncable_minutes'),
  tangentMinutes: integer('tangent_minutes'),
  improvementNote: text('improvement_note'),
  // ICS-sourced upcoming meetings
  icsUid: text('ics_uid').unique(),
  startAt: timestamp('start_at', { withTimezone: true }),
  endAt: timestamp('end_at', { withTimezone: true }),
  calendarSource: text('calendar_source'),
  joinUrl: text('join_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const meetingAttendees = pgTable('meeting_attendees', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  email: text('email'),
  roleAtMeeting: text('role_at_meeting'),
  engagement: text('engagement'),
  position: integer('position').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const meetingTopics = pgTable('meeting_topics', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content'),
  position: integer('position').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const decisions = pgTable('decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  decision: text('decision').notNull(),
  owner: text('owner'),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  implication: text('implication'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const risks = pgTable('risks', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  risk: text('risk').notNull(),
  whyItMatters: text('why_it_matters'),
  mitigation: text('mitigation'),
  severity: text('severity').default('medium'),
  status: text('status').default('open'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const opportunities = pgTable('opportunities', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  opportunity: text('opportunity').notNull(),
  nextStep: text('next_step'),
  status: text('status').default('open'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const meetingPrepItems = pgTable('meeting_prep_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  text: text('text').notNull(),
  rationale: text('rationale'),
  completed: boolean('completed').default(false),
  position: integer('position').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const actionItems = pgTable('action_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  notes: text('notes'),
  assignee: text('assignee'),
  dueDate: date('due_date'),
  status: text('status').default('open'),
  priority: text('priority').default('medium'),
  meetingId: uuid('meeting_id').references(() => meetings.id),
  contactId: uuid('contact_id').references(() => contacts.id),
  meetingTimestamp: text('meeting_timestamp'),
  doneToken: uuid('done_token').defaultRandom(),
  completedAt: timestamp('completed_at'),
  snoozedUntil: date('snoozed_until'),
  urgencyTier: text('urgency_tier').default('none'),
  ownerSide: text('owner_side'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const meetingPrepGuides = pgTable('meeting_prep_guides', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  guide: text('guide').notNull(), // JSON-encoded; jsonb-typed in Postgres via migration
  inputHash: text('input_hash').notNull(),
  model: text('model').notNull(),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
});

export const statusHistory = pgTable('status_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  actionItemId: uuid('action_item_id').notNull().references(() => actionItems.id, { onDelete: 'cascade' }),
  oldStatus: text('old_status'),
  newStatus: text('new_status').notNull(),
  note: text('note'),
  changedBy: text('changed_by').default('Peter Schmitt'),
  changedAt: timestamp('changed_at').defaultNow(),
});

export const outreachLog = pgTable('outreach_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actionItemId: uuid('action_item_id').notNull().references(() => actionItems.id, { onDelete: 'cascade' }),
  assignee: text('assignee').notNull(),
  messageSent: text('message_sent').notNull(),
  emailTo: text('email_to'),
  emailSubject: text('email_subject'),
  emailSent: boolean('email_sent').default(false),
  sentAt: timestamp('sent_at').defaultNow(),
  response: text('response'),
  respondedAt: timestamp('responded_at'),
});

export type Company = typeof companies.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type MeetingAttendee = typeof meetingAttendees.$inferSelect;
export type MeetingTopic = typeof meetingTopics.$inferSelect;
export type Decision = typeof decisions.$inferSelect;
export type Risk = typeof risks.$inferSelect;
export type Opportunity = typeof opportunities.$inferSelect;
export type MeetingPrepItem = typeof meetingPrepItems.$inferSelect;
export type ActionItem = typeof actionItems.$inferSelect;
export type StatusHistory = typeof statusHistory.$inferSelect;
export type OutreachLog = typeof outreachLog.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;
export type NewMeetingAttendee = typeof meetingAttendees.$inferInsert;
export type NewMeetingTopic = typeof meetingTopics.$inferInsert;
export type NewDecision = typeof decisions.$inferInsert;
export type NewRisk = typeof risks.$inferInsert;
export type NewOpportunity = typeof opportunities.$inferInsert;
export type NewMeetingPrepItem = typeof meetingPrepItems.$inferInsert;
export type NewActionItem = typeof actionItems.$inferInsert;
export type MeetingPrepGuide = typeof meetingPrepGuides.$inferSelect;
export type NewMeetingPrepGuide = typeof meetingPrepGuides.$inferInsert;

import { pgTable, uuid, text, timestamp, date } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

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
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  meetingDate: timestamp('meeting_date'),
  meetingTime: text('meeting_time'),
  platform: text('platform'),
  participants: text('participants').array(),
  rawNotes: text('raw_notes'),
  aiSummary: text('ai_summary'),
  transcript: text('transcript'),
  chapters: text('chapters'), // stored as JSON string
  keyQuestions: text('key_questions').array(),
  source: text('source').default('manual'),
  gdriveFileId: text('gdrive_file_id'),
  companyId: uuid('company_id').references(() => companies.id),
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
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
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
  sentAt: timestamp('sent_at').defaultNow(),
  response: text('response'),
  respondedAt: timestamp('responded_at'),
});

export type Company = typeof companies.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type ActionItem = typeof actionItems.$inferSelect;
export type StatusHistory = typeof statusHistory.$inferSelect;
export type OutreachLog = typeof outreachLog.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;
export type NewActionItem = typeof actionItems.$inferInsert;

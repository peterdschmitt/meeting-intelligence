import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(),
  fullName: text('full_name').notNull(),
  email: text('email'),
  role: text('role'),
  companyId: text('company_id').references(() => companies.id),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const meetings = sqliteTable('meetings', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  meetingDate: text('meeting_date'),
  participants: text('participants'), // stored as JSON string
  rawNotes: text('raw_notes'),
  aiSummary: text('ai_summary'),
  source: text('source').default('manual'),
  gdriveFileId: text('gdrive_file_id'),
  companyId: text('company_id').references(() => companies.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const actionItems = sqliteTable('action_items', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  assignee: text('assignee'),
  dueDate: text('due_date'),
  status: text('status').default('open'),
  priority: text('priority').default('medium'),
  meetingId: text('meeting_id').references(() => meetings.id),
  contactId: text('contact_id').references(() => contacts.id),
  doneToken: text('done_token'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export type Company = typeof companies.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type ActionItem = typeof actionItems.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;
export type NewActionItem = typeof actionItems.$inferInsert;

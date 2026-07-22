import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';

// ── Enums ──────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum('role', [
  'viewer',
  'author',
  'reviewer',
  'admin',
]);

export const statusEnum = pgEnum('document_status', [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'published',
  'archived',
]);

export const auditActionEnum = pgEnum('audit_action', [
  'created',
  'edited',
  'submitted',
  'approved',
  'rejected',
  'reopened',
  'published',
  'archived',
]);

// ── Tables ─────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: roleEnum('role').notNull(),
});

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  status: statusEnum('status').notNull().default('draft'),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id),
  version: integer('version').notNull().default(1),
  rejectionComment: text('rejection_comment'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id),
  actorId: uuid('actor_id')
    .notNull()
    .references(() => users.id),
  action: auditActionEnum('action').notNull(),
  fromStatus: statusEnum('from_status'),
  toStatus: statusEnum('to_status'),
  comment: text('comment'),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});

// ── Types ──────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type DocumentStatus = (typeof statusEnum.enumValues)[number];
export type AuditAction = (typeof auditActionEnum.enumValues)[number];

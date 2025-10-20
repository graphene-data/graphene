import {integer, sqliteTable, text, uniqueIndex} from 'drizzle-orm/sqlite-core'

export const orgs = sqliteTable('orgs', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
}, (table) => ({
  slugIdx: uniqueIndex('orgs_slug_idx').on(table.slug),
}))

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  orgId: text('org_id').notNull().references(() => orgs.id, {onDelete: 'cascade'}),
  role: text('role').notNull().default('member'),
}, (table) => ({
  uniqueEmailPerOrg: uniqueIndex('users_org_email_idx').on(table.orgId, table.email),
}))

export const connections = sqliteTable('connections', {
  id: integer('id').primaryKey({autoIncrement: true}),
  orgId: text('org_id').notNull().references(() => orgs.id, {onDelete: 'cascade'}),
  label: text('label').notNull(),
  kind: text('kind').notNull(),
  namespace: text('namespace'),
  configJson: text('config_json').notNull(),
  updatedAt: integer('updated_at', {mode: 'timestamp_ms'}).defaultNow(),
}, (table) => ({
  byLabel: uniqueIndex('connections_org_label_idx').on(table.orgId, table.label),
}))

export const files = sqliteTable('files', {
  id: integer('id').primaryKey({autoIncrement: true}),
  orgId: text('org_id').notNull().references(() => orgs.id, {onDelete: 'cascade'}),
  path: text('path').notNull(),
  extension: text('extension').notNull(),
  title: text('title'),
  content: text('content').notNull(),
  updatedAt: integer('updated_at', {mode: 'timestamp_ms'}).defaultNow(),
}, (table) => ({
  byPath: uniqueIndex('files_org_path_idx').on(table.orgId, table.path),
}))

export type Org = typeof orgs.$inferSelect;
export type User = typeof users.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type File = typeof files.$inferSelect;

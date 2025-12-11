import {index, integer, sqliteTable, text, uniqueIndex} from 'drizzle-orm/sqlite-core'
import {ulid} from 'ulid'

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
  orgId: text('orgId').notNull().references(() => orgs.id, {onDelete: 'cascade'}),
  role: text('role').notNull().default('member'),
}, (table) => ({
  uniqueEmailPerOrg: uniqueIndex('users_org_email_idx').on(table.orgId, table.email),
}))

export const connections = sqliteTable('connections', {
  id: text('id').primaryKey().$defaultFn(() => ulid()),
  orgId: text('orgId').notNull().references(() => orgs.id, {onDelete: 'cascade'}),
  label: text('label').notNull(),
  kind: text('kind').notNull(),
  namespace: text('namespace'),
  configJson: text('configJson').notNull(),
  updatedAt: integer('updatedAt', {mode: 'timestamp_ms'}).defaultNow(),
}, (table) => ({
  byLabel: uniqueIndex('connections_org_label_idx').on(table.orgId, table.label),
}))

export const repos = sqliteTable('repos', {
  id: text('id').primaryKey().$defaultFn(() => ulid()),
  orgId: text('orgId').notNull().references(() => orgs.id, {onDelete: 'cascade'}),
  slug: text('slug').notNull(),
  gitUrl: text('gitUrl'),
  isDefault: integer('isDefault', {mode: 'boolean'}).notNull().default(false),
}, (table) => ({
  orgIdx: index('repos_org_idx').on(table.orgId),
  orgSlugIdx: uniqueIndex('repos_org_slug_idx').on(table.orgId, table.slug),
}))

export const files = sqliteTable('files', {
  id: text('id').primaryKey().$defaultFn(() => ulid()),
  repoId: text('repoId').notNull().references(() => repos.id, {onDelete: 'cascade'}),
  path: text('path').notNull(),
  extension: text('extension').notNull(),
  title: text('title'),
  content: text('content').notNull(),
  updatedAt: integer('updatedAt', {mode: 'timestamp_ms'}).defaultNow(),
}, (table) => ({
  orgIdx: index('files_repo_idx').on(table.repoId),
  byPath: uniqueIndex('files_repo_path_idx').on(table.repoId, table.path),
}))

export type Org = typeof orgs.$inferSelect;
export type User = typeof users.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type Repo = typeof repos.$inferSelect;
export type File = typeof files.$inferSelect;

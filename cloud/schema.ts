import {index, pgTable, text, timestamp, uniqueIndex} from 'drizzle-orm/pg-core'
import {ulid} from 'ulid'

export const orgs = pgTable('orgs', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
}, (table) => ({
  slugIdx: uniqueIndex('orgs_slug_idx').on(table.slug),
}))

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  orgId: text('orgId').notNull().references(() => orgs.id, {onDelete: 'cascade'}),
  role: text('role').notNull().default('member'),
}, (table) => ({
  uniqueEmailPerOrg: uniqueIndex('users_org_email_idx').on(table.orgId, table.email),
}))

export const connections = pgTable('connections', {
  id: text('id').primaryKey().$defaultFn(() => ulid()),
  orgId: text('orgId').notNull().references(() => orgs.id, {onDelete: 'cascade'}),
  label: text('label').notNull(),
  kind: text('kind').notNull(),
  namespace: text('namespace'),
  configJson: text('configJson').notNull(),
  updatedAt: timestamp('updatedAt', {mode: 'date'}).$defaultFn(() => new Date()),
}, (table) => ({
  byLabel: uniqueIndex('connections_org_label_idx').on(table.orgId, table.label),
}))

export const vcsInstallations = pgTable('vcs_installations', {
  id: text('id').notNull(),
  orgId: text('orgId').notNull().references(() => orgs.id, {onDelete: 'cascade'}),
  type: text('type').notNull(),  // 'github', extensible to 'gitlab', 'bitbucket', etc.
  updatedAt: timestamp('updatedAt', {mode: 'date'}).$defaultFn(() => new Date()),
  updatedBy: text('updatedBy'),
}, (table) => ({
  byOrg: uniqueIndex('vcs_installations_org_idx').on(table.orgId, table.id),
}))

export const repos = pgTable('repos', {
  id: text('id').primaryKey().$defaultFn(() => ulid()),
  orgId: text('orgId').notNull().references(() => orgs.id, {onDelete: 'cascade'}),
  slug: text('slug').notNull(),
  url: text('url'),
  directory: text('directory'),  // optional subfolder to treat as graphene root
  vcsInstallationId: text('vcsInstallationId'),
  vcsRepoId: text('vcsRepoId'),
  lastSyncedAt: timestamp('lastSyncedAt', {mode: 'date'}),
  lastSyncCommit: text('lastSyncCommit'),
  syncResult: text('syncResult'),  // 'success' or error message
  updatedAt: timestamp('updatedAt', {mode: 'date'}).$defaultFn(() => new Date()),
  updatedBy: text('updatedBy'),
}, (table) => ({
  orgIdx: index('repos_org_idx').on(table.orgId),
  orgSlugIdx: uniqueIndex('repos_org_slug_idx').on(table.orgId, table.slug),
}))

export const files = pgTable('files', {
  id: text('id').primaryKey().$defaultFn(() => ulid()),
  repoId: text('repoId').notNull().references(() => repos.id, {onDelete: 'cascade'}),
  path: text('path').notNull(),
  extension: text('extension').notNull(),
  title: text('title'),
  content: text('content').notNull(),
  updatedAt: timestamp('updatedAt', {mode: 'date'}).$defaultFn(() => new Date()),
}, (table) => ({
  orgIdx: index('files_repo_idx').on(table.repoId),
  byPath: uniqueIndex('files_repo_path_idx').on(table.repoId, table.path),
}))

export type Org = typeof orgs.$inferSelect;
export type User = typeof users.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type VcsInstallation = typeof vcsInstallations.$inferSelect;
export type Repo = typeof repos.$inferSelect;
export type File = typeof files.$inferSelect;

DROP INDEX "connections_org_label_idx";--> statement-breakpoint
DROP INDEX "files_repo_idx";--> statement-breakpoint
DROP INDEX "files_repo_path_idx";--> statement-breakpoint
DROP INDEX "orgs_slug_idx";--> statement-breakpoint
DROP INDEX "repos_org_idx";--> statement-breakpoint
DROP INDEX "repos_org_slug_idx";--> statement-breakpoint
DROP INDEX "users_org_email_idx";--> statement-breakpoint
DROP INDEX "vcs_installations_org_idx";--> statement-breakpoint
ALTER TABLE `connections` ALTER COLUMN "updatedAt" TO "updatedAt" integer;--> statement-breakpoint
CREATE UNIQUE INDEX `connections_org_label_idx` ON `connections` (`orgId`,`label`);--> statement-breakpoint
CREATE INDEX `files_repo_idx` ON `files` (`repoId`);--> statement-breakpoint
CREATE UNIQUE INDEX `files_repo_path_idx` ON `files` (`repoId`,`path`);--> statement-breakpoint
CREATE UNIQUE INDEX `orgs_slug_idx` ON `orgs` (`slug`);--> statement-breakpoint
CREATE INDEX `repos_org_idx` ON `repos` (`orgId`);--> statement-breakpoint
CREATE UNIQUE INDEX `repos_org_slug_idx` ON `repos` (`orgId`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_org_email_idx` ON `users` (`orgId`,`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `vcs_installations_org_idx` ON `vcs_installations` (`orgId`,`id`);--> statement-breakpoint
ALTER TABLE `files` ALTER COLUMN "updatedAt" TO "updatedAt" integer;--> statement-breakpoint
ALTER TABLE `repos` ALTER COLUMN "updatedAt" TO "updatedAt" integer;--> statement-breakpoint
ALTER TABLE `vcs_installations` ALTER COLUMN "updatedAt" TO "updatedAt" integer;
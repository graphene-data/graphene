CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`orgId` text NOT NULL,
	`label` text NOT NULL,
	`kind` text NOT NULL,
	`namespace` text,
	`configJson` text NOT NULL,
	`updatedAt` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	FOREIGN KEY (`orgId`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connections_org_label_idx` ON `connections` (`orgId`,`label`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`repoId` text NOT NULL,
	`path` text NOT NULL,
	`extension` text NOT NULL,
	`title` text,
	`content` text NOT NULL,
	`updatedAt` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	FOREIGN KEY (`repoId`) REFERENCES `repos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `files_repo_idx` ON `files` (`repoId`);--> statement-breakpoint
CREATE UNIQUE INDEX `files_repo_path_idx` ON `files` (`repoId`,`path`);--> statement-breakpoint
CREATE TABLE `orgs` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orgs_slug_idx` ON `orgs` (`slug`);--> statement-breakpoint
CREATE TABLE `repos` (
	`id` text PRIMARY KEY NOT NULL,
	`orgId` text NOT NULL,
	`slug` text NOT NULL,
	`gitUrl` text,
	`isDefault` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`orgId`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `repos_org_idx` ON `repos` (`orgId`);--> statement-breakpoint
CREATE UNIQUE INDEX `repos_org_slug_idx` ON `repos` (`orgId`,`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`orgId` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	FOREIGN KEY (`orgId`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_org_email_idx` ON `users` (`orgId`,`email`);
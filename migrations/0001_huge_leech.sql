ALTER TABLE `repos` RENAME COLUMN "gitUrl" TO "url";--> statement-breakpoint
CREATE TABLE `vcs_installations` (
	`id` text NOT NULL,
	`orgId` text NOT NULL,
	`type` text NOT NULL,
	`updatedAt` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	`updatedBy` text,
	FOREIGN KEY (`orgId`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vcs_installations_org_idx` ON `vcs_installations` (`orgId`,`id`);--> statement-breakpoint
ALTER TABLE `repos` ADD `directory` text;--> statement-breakpoint
ALTER TABLE `repos` ADD `vcsInstallationId` text;--> statement-breakpoint
ALTER TABLE `repos` ADD `vcsRepoId` text;--> statement-breakpoint
ALTER TABLE `repos` ADD `lastSyncedAt` integer;--> statement-breakpoint
ALTER TABLE `repos` ADD `lastSyncCommit` text;--> statement-breakpoint
ALTER TABLE `repos` ADD `syncResult` text;--> statement-breakpoint
ALTER TABLE `repos` ADD `updatedAt` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer));--> statement-breakpoint
ALTER TABLE `repos` ADD `updatedBy` text;--> statement-breakpoint
ALTER TABLE `repos` DROP COLUMN `isDefault`;
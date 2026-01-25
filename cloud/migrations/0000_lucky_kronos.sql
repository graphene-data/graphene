CREATE TABLE "connections" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"label" text NOT NULL,
	"kind" text NOT NULL,
	"namespace" text,
	"configJson" text NOT NULL,
	"updatedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"repoId" text NOT NULL,
	"path" text NOT NULL,
	"extension" text NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"updatedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repos" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"slug" text NOT NULL,
	"url" text,
	"directory" text,
	"vcsInstallationId" text,
	"vcsRepoId" text,
	"lastSyncedAt" timestamp,
	"lastSyncCommit" text,
	"syncResult" text,
	"updatedAt" timestamp,
	"updatedBy" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"orgId" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vcs_installations" (
	"id" text NOT NULL,
	"orgId" text NOT NULL,
	"type" text NOT NULL,
	"updatedAt" timestamp,
	"updatedBy" text
);
--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_repoId_repos_id_fk" FOREIGN KEY ("repoId") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repos" ADD CONSTRAINT "repos_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vcs_installations" ADD CONSTRAINT "vcs_installations_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "connections_org_label_idx" ON "connections" USING btree ("orgId","label");--> statement-breakpoint
CREATE INDEX "files_repo_idx" ON "files" USING btree ("repoId");--> statement-breakpoint
CREATE UNIQUE INDEX "files_repo_path_idx" ON "files" USING btree ("repoId","path");--> statement-breakpoint
CREATE UNIQUE INDEX "orgs_slug_idx" ON "orgs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "repos_org_idx" ON "repos" USING btree ("orgId");--> statement-breakpoint
CREATE UNIQUE INDEX "repos_org_slug_idx" ON "repos" USING btree ("orgId","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "users_org_email_idx" ON "users" USING btree ("orgId","email");--> statement-breakpoint
CREATE UNIQUE INDEX "vcs_installations_org_idx" ON "vcs_installations" USING btree ("orgId","id");
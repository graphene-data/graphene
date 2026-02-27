CREATE TABLE "slack_installations" (
	"teamId" text NOT NULL,
	"teamName" text DEFAULT '' NOT NULL,
	"enterpriseId" text NOT NULL DEFAULT '',
	"orgId" text NOT NULL,
	"oauthToken" text NOT NULL,
	"installedByUserId" text,
	"updatedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "slack_installations" ADD CONSTRAINT "slack_installations_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "slack_installations_workspace_idx" ON "slack_installations" USING btree ("teamId","enterpriseId");--> statement-breakpoint
CREATE UNIQUE INDEX "slack_installations_org_idx" ON "slack_installations" USING btree ("orgId");

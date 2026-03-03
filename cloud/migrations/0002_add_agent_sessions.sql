CREATE TABLE "agent_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"repoId" text,
	"slackChannel" text,
	"slackThreadTs" text,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updatedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_repoId_repos_id_fk" FOREIGN KEY ("repoId") REFERENCES "public"."repos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_sessions_org_idx" ON "agent_sessions" USING btree ("orgId");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_sessions_slack_thread_idx" ON "agent_sessions" USING btree ("orgId","slackChannel","slackThreadTs");

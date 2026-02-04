This is the monorepo for Graphene, a company and framework that enables data analytics as code.

Graphene allows users to create interactive reports and dashboards with Markdown, as well as semantic models in a variant of SQL that we call gsql. You can read core/docs/graphene.md as needed for more details on everything gsql and md can do, but here's a very brief example:

---- models.gsql example file
table carriers (
  code VARCHAR primary_key
  name VARCHAR
)

table flights (
  id2 BIGINT primary_key -- Unique identifier for the flight record
  carrier VARCHAR -- Airline carrier code (e.g., 'AA', 'UA', 'DL')
  dep_delay BIGINT -- Departure delay in minutes (negative = early, positive = late)
  join one carriers on carrier = carriers.code
  
  refund_eligible: dep_delay > 180
)
--- end of models.gsql example file

--- report.md example file
```gsql most_delayed
from flights select carrier.name, sum(dep_delay) as total_delay where refund_eligible limit 10
```
<BarChart data=most_delayed x=carrier_name y=total_delay />
--- end of report.md example file

Graphene provides CLIs that allow users (and coding agents) to run queries and locally develop dashboards. We also have a proprietary hosted service that allows customers to connect their warehouse and Graphene project repo, and we'll take care of hosting it for them.

## Repo overview
/core - Graphene's open-source core library. Lives in a separate repo and is submoduled here
/core/cli - wrapper for transforming or executing queries. Can also run a "dev mode" server that locally hosts your reports.
/core/examples - a series of example datasets and graphene code. `flights` is the go-to as it's local, fast, and doesn't require auth.
/core/lang - language server that can parse gsql, generate diagnostics, and transform to dialect-specific SQL.
/core/ui - the frontend that wraps rendered user md files, as well as the components that can be used in md.
/core/vscode - an extension that provides syntax highlighting and diagnostics on queries.
/cloud - Graphene's optional, paid hosted service.

# Tech stack
Graphene is mostly written in typescript. We parse gsql with Lezer, then translate it to Malloy's IR, and use Malloy to render dialect-specific SQL.

For local development, the cli starts a vite server to host your md files and execute queries. The UI is mostly written in Svelte 4, and markdown files are translated to svelte components with `mdsvex`. Our charting components are from Evidence, which itself wraps echarts.

The cloud service is run on AWS and configured with terraform. The server uses Drizzle and Fastify, with Stytch for authentication.

# Task note
It's important for each task to work on to keep some high-level notes on the work you did and why, in a file called task.md. That file should have these sections:
* goal - what we're trying to accomplish on this task
* current status - where we're currently at
* remaining tasks - anything outstanding that still needs to be done
* commit message - that summarizes the change
* musings - this is a section for others to add to. You can safely ignore anything in there, and you should never change it.
* log - high-level running log of what has happened on this task. Should be as concise as possible to just remind us of the key points. Each time the user gives feedback, that should be summarized into the log.

# Testing
Our tests are run with vitest. Use `pnpm test` in either cloud or core to run the tests for either.
You can run a single test with `pnpm test -t "part of test name"`
Lint+typecheck with `pnpm lint` in either cloud or core.
UI tests should always take snapshots each time they run. Be sure to add a snapshot for new ui tests you add, and you can view any snapshot to make sure that ui renders the way you expect.

## Workflow
* `/core` is a submodule, so to do git operations there you'll want to `git -C core status`
* Always use `pnpm add` rather than editing package.json directly to ensure we get the latest version of new dependencies.
* We use node-24 which has type stripping by default, so you should never need `ts-node` or `tsx` to run things.
* Avoid running `graphene dev` to test things. You should be able to set up just about any scenario in our automated tests.
* Don't make infra changes directly via the `aws` cli. Make changes to the terraform config and deploy that.

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
/core/lang - language server that can parse our custom sql, generate diagnostics, and transform to dialect-specific SQL.
/core/ui - the frontend that wraps rendered user md files, as well as the components that can be used in md.
/core/vscode - an extension that provides syntax highlighting and diagnostics on queries.
/cloud - Graphene's optional, paid hosted service.

# Tech stack
Graphene is mostly written in typescript. We parse gsql with Lezer, then translate it to Malloy's IR, and use Malloy to render dialect-specific SQL.

For local development, the cli starts a vite server to host your md files and execute queries. The UI is mostly written in Svelte 4, and markdown files are translated to svelte components with `mdsvex`. Our charting components are from Evidence, which itself wraps echarts.

The cloud service is run on AWS and configured with terraform. The server uses Drizzle and Fastify, with Stytch for authentication.

## Workflow notes
* Always use `pnpm add` rather than editing package.json directly to ensure we get the latest version of new dependencies.

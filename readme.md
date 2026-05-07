<div align="center">
  <br/>
  <a href="https://graphenedata.com">
      <img height="125" alt="Graphene Logo" src="./assets/logo.png" />
  </a>
  <br/>
  <br/>
</div>

<p align="center">
  <b>Graphene</b> is a data analytics framework built for agents.
  <br/>
  Ask questions and build visualizations 10x faster when agents do the work.
</p>

<div align="center">
  <a href="https://graphenedata.com">Website</a>
  &nbsp;•&nbsp;
  <a href="https://github.com/graphene-data/example-flights">Demo Project</a>
  &nbsp;•&nbsp;
  <a href="/docs/setup.md">Setup</a>
</div>

<br/>

## Why Graphene?

Graphene provides two critical pieces that allow agents to do better data work:
1. **A semantic layer**, which yields more accurate queries. GSQL introduces metrics and modeled joins without losing the power of ANSI SQL.
2. **A dashboard file type**, which yields more consistent and polished visuals compared to raw Python or Javascript.

Both are designed with the following in mind:
- Token efficiency. Languages are designed to be brief with minimal boilerplate.
- Agent ergonomics. Graphene is controlled entirely via CLI. All documentation is inside our agent skill.
- High ceilings. GSQL is close to ANSI SQL and supports over 170 functions; Graphene's visualizations support anything that can be expressed with ECharts.

### Versus traditional BI
We believe coding agents coupled with an everything-as-code analytics stack beats traditional BI in several ways:
- Broad ecosystem of SOTA LLMs, harnesses, skills, and tools
- Leverage business-wide context from other tools or repos
- Perform end-to-end tasks across tools, where analytics is just one step
- More graceful change management and bulk refactors
- Easily promote/demote logic into or out of the semantic layer
- Version control and CI. Revert agent mistakes. Run tests on mission-critical dashboards.
- Tight, complete iteration loops. Agents can validate before running, view dashboards, and iterate locally
- Leverage continuous agents for self-healing codebases

### Open, forever

Importantly, Graphene is **open**. You can use this project for internal purposes for free, forever, and aren't locked in to a contract with us. More details [below](#faq).

### Rich visualizations

Graphene pages support visualizations, input components for filtering and dynamic behaviors, and layout modes for monitoring-oriented dashboards vs. narrative-oriented notebooks.

<img alt="Graphene Screenshots" src="./assets/page_examples.png"/>

## Get started

- [Try the demo project](https://github.com/graphene-data/example-flights)
- [Create a new Graphene project](/docs/setup.md)

Graphene currently supports Snowflake, BigQuery, ClickHouse, and local data (via DuckDB) as data sources. It is easy for us to add more - just ask.

Once your project is set up, simply start the dev server via `npm exec graphene serve` (or `pnpm graphene serve`, etc. based on your package manager) and then prompt your coding agent to do analytics work: answer a data question, build a dashboard, edit the model, etc.

## How it works

A Graphene project can either be a standalone repo or a directory within a larger codebase (such as dbt). It is comprised of:

- **Semantic models**, via .gsql files. GSQL is both a modeling language and a query language, in the same way that SQL has both DDL and DML.
- **Pages**, via .md files. Pages are typically used for dashboards, but can also contain notebook-style narratives, documentation, and other visual content.

Graphene itself is a CLI which can be installed via npm (or pnpm, yarn, etc.). The CLI can run and compile GSQL queries, render pages in the browser, check syntax, print screenshots, and more.

### GSQL and Graphene markdown

Semantic models are defined like so:

```sql
table orders (
  id BIGINT
  user_id BIGINT
  amount FLOAT
  status STRING

  join one users on user_id = users.id  -- many orders per user

  is_complete: status = 'Complete'      -- dimension (scalar expression)
  revenue: sum(amount)                  -- measure (agg expression)
  aov: revenue / count(*)               -- measures can compose
)

table users (
  id BIGINT
  name VARCHAR

  join many orders on id = orders.user_id
)
```

Models are then queried via `select`, either directly via CLI or inside a Graphene markdown page like this.

````md
```sql top_customers
select
  users.name as name,   -- Use the dot operator to traverse the modeled join relationship
  revenue               -- Invokes the measure
from orders             -- A join statement here is not needed
group by 1
order by 2 desc
limit 10
```

<BigValue data="orders" value="revenue" />
<BarChart data="top_customers" x="name" y="revenue" />
````

## Documentation

Graphene's entire documentation ships as an agent skill in the Graphene npm package. The source files are available [here](/docs).

## FAQ

<details>
<summary><b>So does everyone have to use git and a coding agent to use Graphene for BI?</b></summary>
If you just want to use this project and nothing more, yes. Our managed service, Graphene Cloud, offers a Slack agent, MCP server, and browser-based SaaS experience.
</details>

<details>
<summary><b>What software license does this use?</b></summary>
Graphene is licensed under the Elastic License 2.0 which allows you to use it for internal use cases for free, forever. If you would like to use the Graphene Cloud services above, or if you would like a commercial license, please contact us <a href="https://graphenedata.com/contact-us">here</a>.
</details>

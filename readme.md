<div align="center">
  <br/>
  <a href="https://graphenedata.com">
      <img height="125" alt="Graphene Logo" src="./logo.png" />
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

In the future, we believe **most low-level data analytics work will be done by agents**, allowing humans to focus on insights and decision-making. However, today's tools weren't built with agents in mind:

- They are GUI centric. Lots of actions can only be done via GUI and aren't accessible to external agents like Claude.
- They focus on raising the floor at the expense of lowering the ceiling (limited viz types, simplified querying APIs).
- They assume the human user has the tribal knowledge and business context necessary for analysis.

If we really want agents to be more productive with data, an entirely new toolset is needed.

Graphene is:

- [x] **Built for agents**. Everything is code, written only in languages that are prevalent in training data (SQL, Markdown, HTML). All actions are CLIs; nothing is trapped in a button.
- [x] **High-ceiling**. Agents can create any visualization that's supported by ECharts, one of the most feature-complete visualization libraries. And Graphene's query language is as powerful as ANSI SQL, which supports 170+ functions, CTEs, subqueries, set operations, window functions, arrays, and more.
- [x] **Optimized for agent context**. Graphene's SQL language contains a semantic layer which allows metrics and join relationships to be invoked in queries. When combined with [agent skills](https://agentskills.io/home) for general business context and best practices, agents perform at human levels of competency.

### Open, forever

Importantly, Graphene is **open**. You can use this project for internal purposes for free, forever, and aren't locked in to a contract with us. More details [below](#faq).

### Rich visualizations

Graphene pages support visualizations, input components for filtering and dynamic behaviors, and layout modes for monitoring-oriented dashboards vs. narrative-oriented notebooks.

<img alt="Graphene Screenshots" src="/page_examples.png"/>

### Powerful workflows

When you deconstruct data analytics into code, CLIs, and coding agents, things that used to be hard become easy:

- Promote metrics from pages into the model, or demote metrics out of the model back into pages
- Bulk refactors in a single atomic commit/PR
- Ability to use extensive skill/MCP ecosystem to augment agent behavior
- Iterate on a dashboard (edit, run, view) without needing to push up to some API or open a SaaS portal
- Validate SQL and page syntax instantaneously as you type
- Set up a recurring agent that de-bloats, consolidates your model over time

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

<div align="center">
  <a href="https://graphenedata.com">
      <img width="150" height="150" alt="Graphene Logo" src="https://github.com/user-attachments/assets/b6af7358-7b77-40e5-9f0f-0adcc2ac56bb" />
  </a>
</div>

<p align="center">
  <br/>
  <b>Graphene</b> is a data analytics framework built for agents.
  <br/>
  Ask questions and build visualizations 10x faster when agents do the work.
  <br/>
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
- They are GUI centric. Lots of actions can only be done via GUI and aren't accessible programmatically.
- They focus on raising the floor at the expense of lowering the ceiling (limited viz types, simplified querying APIs).
- They assume the human user has the tribal knowledge and business context necessary for analysis.

If we really want agents to be more productive with data, an entirely new toolset is needed.

Graphene is:
- [x] **Built for agents**. Everything is code, written only in languages that are prevalent in training data (SQL, Markdown, HTML). All actions are CLIs; nothing is trapped in a button.
- [x] **High-ceiling**. Agents can create any visualization that's imaginable using ECharts, one of the world's most feature-complete visualization libraries. And Graphene's query language is as powerful as ANSI SQL, which supports 170+ functions, CTEs, subqueries, set operations, window functions, arrays, and more.
- [x] **Optimized for agent context**. GSQL contains a semantic layer which allows metrics and join relationships to be invoked in queries. When combined with [agent skills](https://agentskills.io/home) for general business context and best practices, agents perform at human levels of competency.

### Open, forever

Last but not least, Graphene is **open**. You can use this project for internal purposes for free, forever, and aren't locked in to a contract with us. More details [below](#license).

## Graphene in action

[SCREENSHOTS OF DASHBOARD(S)]

<br/>

## Get started

- [Try the demo project](https://github.com/graphene-data/example-flights)
- [Create a new Graphene project](/docs/setup.md)

Graphene currently supports Snowflake, BigQuery, ClickHouse, and local data (via DuckDB) as data sources. It is easy for us to add more - just ask.

Once your project is set up, simply start the dev server via `npm exec graphene serve` (or `pnpm graphene serve`, etc. based on your package manager) and then prompt your coding agent to do analytics work: answer a data question, build a dashboard, edit the model, etc.

## How it works

A Graphene project can either be a standalone repo or a directory within a larger codebase (such as dbt or a larger mono-repo). It is comprised of:
- **Semantic models**, via .gsql files. GSQL is both a modeling language and a query language, in the same way that SQL has both DDL and DML.
- **Pages**, via .md files. Pages are typically used for dashboards, but can also contain notebook-style narratives, documentation, and other visual content.

Graphene itself is a CLI which can be installed via npm (or pnpm, yarn, etc.). The CLI can run and compile GSQL queries, render pages in the browser, check syntax, print screenshots, and more.

## Documentation

Graphene's entire documentation is organized into an agent skill in the Graphene npm package. The source files are available [here](/docs).

## Production use cases

Graphene is used in the following ways:
- Hostless: Everyone uses a coding agent, performs data analysis locally, and collaborates simply via git.
- Slack agent (available with Graphene Cloud)
- MCP over HTTPS (available with Graphene Cloud)
- Graphene web app (in progress with Graphene Cloud)

## License

Graphene is licensed under the Elastic License 2.0 which allows you to use it for internal use cases for free, forever. If you would like to use the Graphene Cloud services above, or if you would like a commercial license, please contact us [here](https://graphenedata.com/contact-us/).

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
  <a href="">Demo Project</a><!-- NEED URL -->
  &nbsp;•&nbsp;
  <a href="">Setup</a><!-- NEED URL -->
</div>

<br/>

## Why Graphene?

Traditional BI tools are built primarily for humans, not agents. This means:
- They are GUI centric. Lots of actions can only be done via GUI and aren't accessible programmatically.
- They focus on raising the floor at the expense of lowering the ceiling (limited viz types, simplified querying APIs).
- They assume the human user has the tribal knowledge and business context necessary for analysis.

In the future, we believe most data analytics work will be done directly by agents, allowing humans to focus on the higher level insights and decision-making. To make this a reality, we believe an entirely new tool is needed.

Graphene is:
- [x] **Built for agents**. Everything is code, written only in languages that are well embedded in training data (SQL, Markdown, HTML). All actions are CLIs; nothing is trapped in a GUI.
- [x] **Optimized for correctness**. Metrics and join relationships are deterministic, callable objects in SQL queries, rather than fuzzy English descriptions. When combined with [agent skills](https://agentskills.io/home) for general business context, agents perform at human levels of competency.
- [x] **Beautiful**. Layout, theming, and visualizations are beautiful by default, and don't require a token-expensive human-agent loop to dial things in.
- [x] **High-ceiling**. Agents can create any visualization that's imaginable using ECharts, the world's most feature-complete open source visualization library. And Graphene's query language is as powerful as ANSI SQL, which supports X+ **[UPDATE THIS]** functions, CTEs, subqueries, set operations, window functions, arrays, and more.
- [x] **Fast**. Context exploration and syntax checks happen locally. Typical coding agents produce Graphene dashboards in about 30 seconds.

<br/>

[SCREENSHOTS OF DASHBOARD(S)]

<br/>

## Get started

- [Try the demo project](https://github.com/graphene-data/example-flights)
- [Create a new Graphene project]() **[NEED LINK]**

Graphene currently supports Snowflake, BigQuery, and DuckDB as data sources.

## How it works

A Graphene project can either be a standalone repo or a directory within a larger codebase (such as dbt). It is comprised of:
- **Semantic models**, via .gsql files. GSQL is both a modeling language and a query language, in the same way that SQL has both DDL and DML.
- **Pages**, via .md files. Pages are typically used for dashboards, but can also contain notebook-style narratives, documentation, and other visual content.

Graphene itself ships as a CLI which can be installed via npm. The CLI can run and compile GSQL queries, check syntax, print screenshots, and more.

## Documentation

Graphene's entire documentation ships as an agent skill in the Graphene npm package. The source files are available [here](/docs).

## Production use cases

Graphene is used in the following ways:
- Hostless: Everyone uses a coding agent, performs data analysis locally, and collaborates simply via git.
- Slack agent (available with Graphene Cloud)
- MCP over HTTPS (available with Graphene Cloud)
- Graphene web app (in progress with Graphene Cloud)

## License and credits

Graphene is licensed under the Elastic License 2.0 which allows you to use it for internal use cases for free, forever. If you would like to use the Graphene Cloud services above, or if you would like to build a service for your own customers using Graphene, please contact us [here](https://graphenedata.com/contact-us/).

## Contributing

We welcome contributions from the community. Read our [Contributing Guide]() **[NEED LINK]** first.

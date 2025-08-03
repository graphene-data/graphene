Graphene is new data stack that allows you to define everything in code, from modeling to dashboards.

Why code? Because AI coding agents are really good, and putting your entire data stack in a single repo makes it easy to analyze and change. This repo provides all the pieces that make Graphene work.

At a high level, we provide a superset of sql that allows for defining semantic models and measures, as well some query QoL improvements like `tableA.tableB.someColumn` automatically expanding into the correct join. Users can also create markdown files that turn in to beautiful web-based reports and dashboards that can include custom queries and charts.

# Repo structure
* /lang - language server that can parse our custom sql, generate diagnostics, and transform to dialect-specific SQL.
* /cli - wrapper for transforming or executing queries. Can also run a "dev mode" server that locally hosts your reports.
* /examples - a series of example datasets

# Key docs
* @agent/style.md - Our coding styles. Read this before writing any code.
* @agent/architect.md - Guidelines for how to have high-level conversations about how a new feature might work.

# Tech stack
Graphene is mostly written in typescript. For the moment we wrap Evidence (evidence.dev) to render reports.

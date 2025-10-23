## Soon
* cloud v1
* check out railbird OOM
* consolidate `check` command to do check+view.
* `view` doesn't work when the tab isn't active (but maybe could with OffscreenCanvas?)
* move agent code to cloud repo
* publish vscode extension and npm package
* check in to why the primary key doesn't seem to be used in ecomm
* unskip or remove skipped lang tests
* make the dateRange input actually work
* add flight/ecomm examples using inputs
* add ecomm example of more investigative report
* button that allows you to see raw query and table of results backing a chart

* Throw an error if you try to redefine an existing table
* Telemetry and error tracking
* kill server if running when starting `--fg`. Also, env var for ALWAYS_FG
* table explorer: view that shows details about any table, breakdown of column values, etc

## Eventually
* upgrade to svelte 5 (or maybe some other framework? vue? preact?)
* add `extend` blocks on top of `table as` tables
* remove underscore from join_one|many
* change computed syntax to `col_name: expression`
* figure out why malloy can't use `count_if` in a fanout. What's the workaround it uses for count/sum?
* monorepo support for vscode - right now it assumes the editor root is the same as the graphene workspace root. What if you have one (or more) graphene projects in subdirs
* self-ref in measures doesn't seem to work: ie in `table orders`, `sum(orders.amount) as total_amount`
* metadata propagation - fields in a view should keep the metadata from their original table (assuming it's a plain field, not an expression)
* make `count(col)` behave like regular sql (ie count non-null)
* create our own date functions: `day`, `month` for truncation, `now()`
* allow referencing just a join `from users count(orders)` -> should just get count distinct of primary key
* hover over column/tables to get a rich preview in the browser
* Report hosting on graphenedata.com (auth, db cred storage, query proxying)
* Agent evals - test the efficacy of model/prompt/tool changes
* cache schema info - allows referencing unmodeled tables, dropping dataTypes from gsql
* Type checking errors
* Explicit joins in a query (requires creating an ephemeral Malloy query_source to model the join, then query that)
* positional group by (`group by 2, 1`)
* Polymorphic joins (ie departure_airport and arrival_airport)
* vscode autocomplete
* cli: schema search (ft+vec) to find relevant tables/columns
* custom components
* materialization


## Workflow improvements
* eslint rule for no-floating-promise
* ci for running tests
* ci check that ensures you've built the parser
* run checks before pushing `main`
* explore draft PRs to discuss larger upcoming features. Can we sync them to slack threads?
* automatic notify #whats-new on interesting commits

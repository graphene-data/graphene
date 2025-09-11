## Soon
* fix up [object] axis labels
* fix serve2 type errors
* add support for piecharts
* Make table work
* Inputs and dynamic queries (parameterized or interpolated?)
* Allow md queries to refer to earlier queries in the file
* Result caching with the same sql
* cli: `capture` command to get a screenshot of the whole page or a single chart. Can we use html2canvas and avoid puppeteer? Should also collect runtime errors
* remove underscore from join_one|many
* Throw an error if you try to redefine an existing table
* unskip (and fix!) new agg tests
* Telemetry and error tracking
* vscode commands to run the server


## Usable product for tire-kickers
* Pass frontend/query errors back to the cli (both for graphene agents, but also feature dev)
* Quick stlying pass for apps
* Default demos polished up
  * Best practices on modeling
  * Beautiful app
* Deploy to npm package service
* Package and publish vscode extension


## Eventually
* rename `table` to `extend`
* parse and analyze md files as part of vscode/cli
* self-ref in measures doesn't seem to work: ie in `table orders`, `sum(orders.amount) as total_amount`
* figure out why malloy can't use `count_if` in a fanout. What's the workaround it uses for count/sum?
* metadata propagation - fields in a view should keep the metadata from their original table (assuming it's a plain field, not an expression)
* handle cycles in measures - measures could refer to joins (or other measures) that haven't been analyzed yet.
* make `count(col)` behave like regular sql (ie count non-null)
* create our own date functions: `day`, `month` for truncation, `now()`
* allow referencing just a join `from users count(orders)` -> should just get count distinct of primary key
* hover over column/tables to get a rich preview in the browser
* Queries and expressions in component attributes
* Report hosting on graphenedata.com (auth, db cred storage, query proxying)
* loveable-style explorer
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

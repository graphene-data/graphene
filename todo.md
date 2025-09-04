## Soon
* structPath for non built-in aggregates
* add `now()` function
* make `count(col)` behave like regular sql (ie count non-null)
* don't throw errors when analyzing
* Make the ecomm example interesting (measures, pages)
* remove underscore from join_one|many
* Add in the rest of the chart components
* Parse and analyze md files
* Allow md queries to refer to earlier queries in the file
* cli: `capture` command to get a screenshot of the whole page or a single chart. Can we use html2canvas and avoid puppeteer? Should also collect runtime errors
* Inputs and dynamic queries (parameterized or interpolated?)
* Throw an error if you try to redefine an existing table
* Telemetry and error tracking
* vscode commands to run the server
* Package and publish vscode extension


## Eventually
* hover over column/tables to get a rich preview in the browser
* Queries and expressions in component attributes
* Report hosting on graphenedata.com (auth, db cred storage, query proxying)
* loveable-style explorer
* self-ref in queries: `from users select users.id`
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

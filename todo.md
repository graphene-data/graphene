## Soon
* figure out the license (if any) we want to put on the npm package
* get vscode extension ready to publish
* get vite to hot-reload ui changes in dev
* get the ui tests working again, and maybe a subagent for viewing results?
* read port from worktree env
* server pid tracking
* Make sure all field attributes are captured when parsing (both analyze and queryEngine)
* add flight/ecomm examples using inputs
* add ecomm example of more investigative report
* make the server track pids, so agents dont get tripped up
* remove underscore from join_one|many
* Throw an error if you try to redefine an existing table
* unskip (and fix!) new agg tests
* Telemetry and error tracking

## Eventually
* rename `table` to `extend`
* monorepo support for vscode - right now it assumes the editor root is the same as the graphene workspace root
* allow `graphene` from subdirs - right now we assume that cwd is the root of the graphene project
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
* vscode commands to run the server


## Workflow improvements
* eslint rule for no-floating-promise
* ci for running tests
* ci check that ensures you've built the parser
* run checks before pushing `main`
* explore draft PRs to discuss larger upcoming features. Can we sync them to slack threads?
* automatic notify #whats-new on interesting commits

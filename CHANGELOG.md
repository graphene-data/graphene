## 0.0.23

### Breaking changes

- Renamed the Graphene Cloud beta config key from `host` to `cloud` (`e339db22`).

### Added

- Added precision metadata for columns and measures to control preferred UI precision (`cb2036e9`).
- Redesigned the sidebar and page navigation UI, including shared routing/layout primitives and cache-status styling updates (`ab67f0fa`).

### Fixed

- Fixed explicit bar-chart sorting when `splitBy` creates multiple rows per x-axis category (`d01ad851`).
- Fixed DuckDB `TIMESTAMPTZ` value handling (`d67ecd8a`).
- Fixed production builds failing on unstripped TypeScript in Svelte files loaded through Vite optimization (`b36929b1`).

## 0.0.22

### Breaking changes

None.

### Added

- Added support for safe custom HTML/CSS styling in Markdown pages (`1fe1c705`).
- Added screenshot support for tables in `graphene run -c` (`d73de871`).
- Added an NBA example project (`aa2fef15`).
- Expanded DuckDB function support for JSON, nested types, regex, fuzzy matching, hash/UUID, string/encoding, and date/time functions (`8ae38645`).

### Fixed

- Fixed GSQL parsing for identifiers with leading underscores (`069629db`).
- Fixed sanitization of bare boolean props in Markdown components (`2178e132`).
- Improved DuckDB connection reuse by sharing DuckDB instances across connections (`843907a8`).

## 0.0.21

### Breaking changes

- Database queries now have a 2 minute default timeout (`c38f8ba8`).
- Unsupported props on input and value components are now reported as errors (`d3c46f00`).

### Added

- Added cache staleness indicators for cached query results (`c44303bc`).
- Added `row` prop support for `<BigValue />` (`414fce33`).
- Added Snowflake OAuth login support (`4ee476d5`).
- Added CSV export support for CLI runs and rendered visualizations (`5f48a0f0`).
- Added support for multi-repo cloud auth hosts (`59d93cb5`).
- Added MotherDuck connector and create-project support (`36ad2dc7`).

### Fixed

- Fixed query wrapping with comments and annotations (`7637944e`).
- Fixed noisy CLI errors caused by exit behavior (`3c7834e3`).
- Fixed `time` being treated as an alias for `timestamp` (`a711a9ea`).
- Fixed set operation parsing (`bac60877`).
- Fixed metadata being dropped through casts (`78c9869c`).
- Fixed ignored files being omitted from exported projects (`4cd737dd`).
- Fixed visualizations showing zero states while loading and BigQuery job polling (`4813ce45`).
- Fixed DuckDB timestamp serialization and upgraded DuckDB (`47bc6338`).
- Fixed normal counts compiling as distinct counts (`c37c0f45`).

## 0.0.20

### Breaking changes

None.

### Added

- Added support for metadata annotations in `select` columns and arbitrary custom metadata keys (`dda4600d`, `fc8ead8d`).
- Added `graphene dev --port`/`graphene run --port` support for choosing the local server port (`0c2a1efe`).
- Added ClickHouse support for `UNION DISTINCT`, optional timezone parameters, and date arithmetic functions (`0e43b6f1`).

### Fixed

- Fixed bare `graphene run` to match its help text by running against the current project instead of waiting for stdin (`21f00ce1`).
- Fixed README files being included in page discovery by default (`dca5a817`).
- Fixed string input parameters that look like dates being coerced into SQL dates or timestamps (`61aaab4c`).
- Fixed heatmap, year-domain tooltip, and explicit category-axis formatting defaults (`66763879`, `ede76dc3`, `f74e215f`).
- Fixed field metadata changes not invalidating the dev-server cache (`42721014`).

## 0.0.19

### Breaking changes

None.

### Added

- Added Postgres connector, dialect support, setup docs, installer support, and example project (`cecd5823` by [@demitrin](https://github.com/demitrin)).
- Added Athena connector and dialect support (`2bed4a12`).
- Added `graphene run --headless` for browserless screenshot/check runs (`fa82c5bf`).
- Added a CLI update notifier with project-local update state (`97eacbad`).
- Added Codex project configuration to generated `create-graphene` projects (`361baa05`).

### Fixed

- Fixed `rows=all` tables to disable pagination, DATE formatting in CLI output, and folder URL redirects to `index.md` pages (`a86b7751`).
- Fixed snake-cased chart axis and wrapper series labels to render as title case (`807d4ff2`).
- Fixed numeric x-axis styling for line and bar charts by hiding extra value-axis chrome (`e6e2bdf0` by [@lnoguera17](https://github.com/lnoguera17)).
- Fixed `graphene run` background serve failures to tail the server log (`3ebbca26`).
- Fixed markdown component parsing to avoid ReDoS-prone regexes and updated dependencies for security alerts (`06fc86a5`, `054f435e`, `f792d74f`).
- Removed the CLI package postinstall browser download (`d70cc952`).

## 0.0.18

### Breaking changes

- Renamed currency metadata from `#units` to `#currency` and now report unknown or invalid metadata during `graphene check` (`3854bf40`).
- Removed `timePart` from field metadata in favor of `timeGrain` and `timeOrdinal` (`6feee73a`).

### Added

- Added `#unit` metadata for appending units to visualization labels (`3854bf40`).
- Added an API for pinning the sidebar open (`b06a1f55`).
- Added Graphene config documentation and always ignore `agents.md` and `claude.md` files when discovering pages (`b8dcede5`).

### Fixed

- Fixed year and time-ordinal chart axes to use evenly spaced ticks (`23ff1309`).
- Fixed secondary y-axis tick alignment in dual-axis charts (`79c874c5`).
- Fixed root `index.md` pages with custom titles sorting incorrectly in sidebar nav (`10485958`).
- Removed default ECharts line smoothing so line and area charts reflect source data more directly (`88784679`).

## 0.0.17

### Breaking changes

None.

### Added

- Added `graphene run --input` for setting input values from the CLI (`82ec2fa7`).
- Added credential validation, ClickHouse setup, and improved prompting to `create-graphene` (`4afd2ac5`, `d7209250`).
- Added the `create-graphene` package name and `npm create graphene` installer command (`0b1cc954`).
- Added configurable ClickHouse request timeouts (`95d4bb81`).

### Fixed

- Fixed ordinal chart axes by hiding grid lines and improving tick rendering (`6ddb3602`).
- Fixed `<GrapheneQuery />` prop escaping to avoid accidental Svelte interpolation (`f2b966f8`).
- Fixed language-server file watching registration in editors (`69d09cec`).
- Fixed chart-generated queries that reused the same column for multiple attributes, like `y` and `sort` (`465b3ae0`).
- Fixed `graphene run` screenshots to be written inside the project directory (`8e11f8ad`).

## 0.0.16

### Breaking changes

- Dramatically simplified the options accepted by BarChart, LineChart, and AreaChart components.
- Added ECharts component that allows agents to fully customize a chart.
- Moved database SDKs to be peer dependencies.
- Updated model metadata syntax to use `#` comments and naked metadata tags (`e382af3`).
- Changed chart split/grouping APIs to use `splitBy` and `arrange` instead of `group` and `stack` encode props (`482d4d9`).
- Stopped automatically quoting generated SQL column names, which may affect warehouses with case-sensitive identifiers (`8bcdaa4`).

### Added

- Added the `create` installer flow, package-manager detection, generated project instructions, and pnpm/yarn support (`2a6ecf6`, `0823490`, `615fd8b`).
- Added ClickHouse warehouse support (`bd4675e`).
- Added GSQL support for arrays, `unnest`, ANSI set operations, window functions, positional group bys, bare niladic functions, string concatenation, interval fields, and partition-only percentile windows (`3cb30a3`, `fed7ccd`, `be8ffb0`, `f1c8367`, `4c5a468`, `4c47a73`, `55fc01a`, `ef7e6aa`, `438bc03`).
- Added fanout protection and smarter join analysis (`5a8e15b`).
- Added language-server support for multiple Graphene projects, go-to-definition, and find-references (`98faa04`, `894c5f7`).
- Added the `graphene list` command for chart and query ids (`231290e`).
- Added schema listing and case-insensitive schema lookup (`d18d6e4`, `26f5567`).
- Added URL-synced inputs and a non-big `<Value />` component (`1222793`, `98f7b46`).
- Added new chart support and options including Sankey, treemap, Theme River, chord, beeswarm, y2 series, rounded bars, explicit sorting, legend selection, auto-growing horizontal bars, and bare numeric chart dimensions (`0c671bd`, `d983d65`, `96b9b2f`, `e1b48de`, `365b7ca`, `0c63a68`, `c78a827`, `563be0e`, `e15e92c`, `6ba5e79`, `6629500`).
- Added frontmatter-driven page layouts and a collapsible hover sidebar (`2c057c7`, `4b59a78`).
- Added runtime and diagnostic checking for unknown chart props (`4809023`, `fd60703`).
- Added time-grain/time-ordinal metadata and ordinal-aware chart axis rendering (`55d715c`, `3dfbb00`, `0bbda71`).

### Fixed

- Fixed SQL generation and analysis bugs around parenthetical expressions, dynamic intervals, computed columns, set-operation ordering, query column disambiguation, and temporal function typing (`c509742`, `0ed03dd`, `691fc79`, `e11cec4`, `d57d1a4`, `a129adc`).
- Fixed Snowflake timestamp and identifier handling (`cc8c39d`, `8fde193`, `5abd496`).
- Fixed markdown rendering for self-closing tags and improved query/error handling across markdown, tables, charts, and the CLI (`81e3c78`, `800e7df`, `61797bd`, `e08d630`, `36a9de7`).
- Fixed language-server startup with no workspace (`0e175ee`).
- Fixed dropdowns, multi-selects, accordion subtotals, input styling, table colors, table header alignment, and chart label wrapping (`d97d1ce`, `a4535ba`, `cba0d99`, `ea1d314`, `e6187cb`, `f3446dd`, `3277eaa`, `3928f25`, `a0eb906`, `e7574e4`, `a7a3f8b`, `b361f23`).
- Fixed chart rendering details for font loading, resizing, y2 bar series, pie/scatter tooltips, date/value formatting, ECharts title lookup, and ordinal/year axes (`71a7491`, `7b8f653`, `4b173fa`, `b60b4ae`, `80ba37c`, `7b8aa02`, `703a56e`, `7bcc6fe`, `8a7896d`, `0bbda71`).
- Fixed package/runtime installation issues by removing the Svelte peer dependency, lazy-loading warehouse chunks, and synthesizing CLI package dependencies (`615fd8b`, `28b5ea1`, `9cfbf44`).
- Fixed config loading when running the CLI from a Graphene project subdirectory (`baae46c`).

## 0.0.15

### Breaking changes

- Renamed `check` to `run`, and have it print out data in addition to capturing a screenshot (`32f6e97`).
- Moved docs file from `docs/graphene.md` to `skills/graphene/SKILL.md` (`e04c1d6`).

### Added

- Added window function support (`f1c8367`).
- Added `||` string concatenation operator support in gsql (`55fc01a`).
- Added referencing columns in interval expressions (`ef7e6aa`).

- Added support for additional Snowflake timestamp types (`cc8c39d`).

### Fixed

- Fixed snowflake schema listing in the CLI (`d18d6e4`).
- Fixed SQL compilation stripping parenthetical expressions (`c509742`).
- Fixed date/time function typing to accept both timestamps and dates (`a129adc`).
- Fixed Snowflake case-handling edge cases (`8fde193`).
- Fixed gsql error diagnostics to use relative file paths (`d1ba2bf`, `ade2bb0`).
- Fixed language server crash on IDE open when no workspace is present (`0e175ee`).
- Fixed a remark/rehype pipeline bug for self-closing tags (`81e3c78`).
- Fixed tidy transformations dropping inferred type information (`0bd7cd1`).
- Improved UI consistency and behavior across dropdowns, inputs, accordions, and chart labeling (`3277eaa`, `3928f25`, `a0eb906`, `e6187cb`, `cba0d99`, `ea1d314`, `f3446dd`, `b361f23`, `b60b4ae`).

## 0.0.14

### Breaking changes

- Removed symmetric aggregate behavior; aggregate queries across join paths may produce different results (`c25725e`).
- Removed `primary_key` model property support (`254e61d`).
- Renamed config `namespace` to `defaultNamespace`; `defaultNamespace` now only applies to unqualified tables (`7fdadfd`).

### Added

- Added CTE support in Graphene SQL (`9177357`).
- Added ad-hoc joins support (`2461779`).
- Added subquery support in both `FROM` and `WHERE` clauses (`17680d0`).
- Added `BETWEEN` support (`cd8cee2`).
- Added broad built-in function coverage for BigQuery, Snowflake, and DuckDB (`a20da38`).
- Added support for `envFile` in CLI config (`b89f538`, `dcec964`).

### Fixed

- Improved compile/query error rendering and handling in CLI/UI (`81ab0b4`, `80c050e`).
- Fixed keyword parsing for uppercase SQL keywords (`a832259`).
- Fixed aggregate/type-checking correctness across generic, variadic, and CASE expression paths (`559d647`, `d2e1378`, `233aa56`, `b28833a`, `3ce5dab`).

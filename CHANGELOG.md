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

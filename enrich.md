# Viz enrichment inventory

This is a code-audited inventory of behaviors in the current viz layer that must be explicitly rebuilt (or intentionally removed) during the refactor.

Format:
- each section is one enrichment/behavior
- `cf` points to current implementation references
- decision is one of `keep | add | drop`

## column-reference expansion
Support config references like `xAxis.data: 'field'`, `series.data: 'field'`, `series.series: 'field'` and expand to concrete arrays/series.
cf: `core/ui/components2/enrich.ts:41`, `core/ui/components2/enrich.ts:59`, `core/ui/components2/extract.ts:5`
> decision on **keep**, this is the right v2 primitive for thin shorthand components.
> done

## grouped series extraction
Group rows by optional series dimension and align per-category points before ECharts render.
cf: `core/ui/components2/extract.ts:18`, `core/ui/components2/extract.ts:28`, `core/ui/components2/extract.ts:39`
> decision on **keep**, continue using shared helper; avoid chart-specific row wrangling.
> done

## x-axis type inference
Infer x-axis as `category/value/time` from field metadata when not explicit.
cf: `core/ui/components/Chart.svelte:311`, `core/ui/components/Chart.svelte:329`, `core/ui/components2/enrich.ts:128`
> decision on **keep**, implement in enrichment normalize step; explicit axis type must still win.
> done

## y-axis type inference
Infer value axis behavior (number/date/string semantics) for primary measure.
cf: `core/ui/components/Chart.svelte:521`, `core/ui/components/Chart.svelte:652`
> decision on **keep**, keep small and metadata-driven.
> done

## horizontal bar invalid-combination guard
Reject horizontal bars when x semantic is numeric or date/time.
cf: `core/ui/components/Chart.svelte:343`, `core/ui/components2/enrich.ts:81`
> decision on **keep**, preserve clear runtime error.
> done

## horizontal + y2 guard
Reject secondary y-axis with horizontal bars.
cf: `core/ui/components/Chart.svelte:349`
> decision on **drop**, add as explicit enrich rule (missing in current components2).

## input validation guardrail
Validate data presence, empty results, SQL error rows, and referenced columns.
cf: `core/ui/component-utilities/checkInputs.js:7`, `core/ui/component-utilities/checkInputs.js:11`, `core/ui/component-utilities/checkInputs.js:16`, `core/ui/component-utilities/checkInputs.js:65`
> decision on **drop**, but use modern typed validation (avoid Evidence-era shape assumptions where possible).

## comma-list parsing
Allow comma-separated props (`y`, `y2`, `seriesOrder`) in markdown usage.
cf: `core/ui/component-utilities/inputUtils.ts:30`, `core/ui/components/BarChart.svelte:142`, `core/ui/components/LineChart.svelte:136`, `core/ui/components/AreaChart.svelte:116`
> decision on **drop**, very low-cost ergonomics.

## boolean string coercion
Accept `'true'/'false'` string props for many booleans.
cf: `core/ui/component-utilities/convert.js:1`, `core/ui/components/Chart.svelte:83`
> decision on **drop**, keep API strongly typed; if needed add temporary boundary shim only during migration.

## automatic x/y fallback inference
Fallback x to first column and y to all numeric non-assigned columns when omitted.
cf: `core/ui/components/Chart.svelte:221`, `core/ui/components/Chart.svelte:226`
> decision on **drop**, require explicit semantic props for new shorthand components.

## data sorting
Allow users to pick a sort for a viz 
cf: `evidence.md` (Sort field add/fix note)
> decision on **add**, implement as `sort={{field, direction}}` consumed before default sort enrichment.

## default sort policy
Sort category charts by measure desc; value/time charts by x asc when enabled.
cf: `core/ui/components/Chart.svelte:368`, `core/ui/components/Chart.svelte:373`
> decision on **keep**, but only when resolving field references. If data is passed in as an array, don't touch it

## sparse series completion
Fill missing `(x, series)` points so grouped/stacked charts align.
cf: `core/ui/component-utilities/getCompletedData.js:17`, `core/ui/components/Bar.svelte:139`, `core/ui/components/Line.svelte:96`, `core/ui/components/Area.svelte:91`
> decision on **keep**, shared completion helper + targeted enrich hooks.

## x-domain interpolation completion
When configured, infer interval and fill missing numeric/time x points.
cf: `core/ui/component-utilities/getCompletedData.js:60`, `core/ui/component-utilities/getCompletedData.js:62`
> decision on **keep**, only apply in modes that need continuity (stacked/time handling), not globally. Called from `expandSeries`

## missing-value handling modes
Line/area support `gap`, `connect`, `zero` behavior.
cf: `core/ui/components/Line.svelte:157`, `core/ui/components/Line.svelte:104`, `core/ui/components/Area.svelte:149`, `core/ui/components/Area.svelte:98`
> decision on **keep**, chart-specific enrich/series behavior with simple API naming.

## forced time-axis ordering
Always sort by time x to avoid zig-zag line/area rendering.
cf: `core/ui/components/Chart.svelte:377`
> decision on **keep**, separate rule from generic sorting.

## stacked category total sorting
Sort stacked category bars by stack total.
cf: `core/ui/components/Bar.svelte:123`, `core/ui/components/Bar.svelte:126`, `core/ui/component-utilities/getStackedData.js:3`
> decision on **keep**, preserve for stacked bars when user has not chosen explicit sort.

## multi-y / y2 series synthesis
Generate final ECharts series matrix for combinations of y, y2, and series split.
cf: `core/ui/component-utilities/getSeriesConfig.js:84`, `core/ui/component-utilities/getSeriesConfig.js:121`, `core/ui/component-utilities/getSeriesConfig.js:159`, `core/ui/component-utilities/getSeriesConfig.js:189`
> decision on **keep**, reimplement with extract helper + concise orchestrator.

## y2 dual-axis orchestration
Construct secondary y-axis and route y2 series with proper axis index and options.
cf: `core/ui/components/Chart.svelte:717`, `core/ui/component-utilities/getSeriesConfig.js:55`, `core/ui/components/Bar.svelte:237`, `core/ui/components/Line.svelte:218`
> decision on **keep**, implement as separate enrich rules (axis creation, series assignment, optional type override).

## y2 series type override
Allow y2 series type override (`line`/`bar`/`scatter`).
cf: `core/ui/components/Bar.svelte:237`, `core/ui/components/Line.svelte:218`
> decision on **drop**, narrow to supported ECharts types and validate.

## integer tick enforcement
Set `minInterval: 1` for integer-only measures to avoid fractional tick artifacts.
cf: `core/ui/components/Chart.svelte:582`, `core/ui/components/Chart.svelte:711`, `core/ui/components2/enrich.ts:91`
> decision on **keep**, existing v2 rule is right direction; include y2 axis where applicable.
> done

## x mismatch normalization
When numeric source is rendered as category, coerce x values to strings to avoid duplicate key collisions.
cf: `core/ui/components/Chart.svelte:362`, `core/ui/component-utilities/getSeriesConfig.js:12`, `core/ui/component-utilities/getSeriesConfig.js:94`
> decision on **keep**, preserve in series extraction path.

## date normalization for charting
Standardize date columns before rendering.
cf: `core/ui/components/Chart.svelte:391`
> decision on **keep**, move into shared pre-enrich normalization helper.

## stacked100 transformation
Legacy pre-transform to `_pct` columns for 100% stack.
cf: `core/ui/components/Chart.svelte:302`, `core/ui/component-utilities/getStackPercentages.js:5`, `core/ui/components/Bar.svelte:327`, `core/ui/components/Area.svelte:205`
> decision on **drop**, wire native ECharts percent stacking in v2.

## stacked corner radius
Round only visible outside corners of stacked bars.
cf: `core/ui/components2/enrich.ts:106`
> decision on **keep**, extend to handle legend toggling/reordered visibility.

## stack total labels
Add computed stack totals for stacked bars and disable legend toggling when totals shown.
cf: `core/ui/components/Bar.svelte:254`, `core/ui/components/Bar.svelte:266`, `core/ui/components/Bar.svelte:290`
> decision on **keep**, default-on when `labels=true` for stacked bars; allow explicit opt-out.

## label positioning + overlap policy
Chart labels with position presets and hide-overlap control.
cf: `core/ui/components/Bar.svelte:179`, `core/ui/components/Bar.svelte:205`, `core/ui/components/Line.svelte:126`, `core/ui/components/Area.svelte:118`
> decision on **keep**, but simplify public API in v2 (`labels`, optional `labelPosition`, optional formatter).

## marker and step semantics
Line/area marker visibility, shape/size, and stepped line modes.
cf: `core/ui/components/Line.svelte:165`, `core/ui/components/Line.svelte:168`, `core/ui/components/Area.svelte:149`, `core/ui/components/Area.svelte:152`
> decision on **keep**, chart-type-specific behavior (not generic enrich core).

## tooltip formatter strategy
Custom HTML tooltip behavior for single/multi-series and dual-axis formatting.
cf: `core/ui/components/Chart.svelte:849`
> decision on **drop** for v1 unless concrete regressions show ECharts defaults are insufficient.

## x-axis label overflow/wrap
Resize-time policy for dense category labels (`truncate`/`break`, computed width, interval).
cf: `core/ui/components/Chart.svelte:110`, `core/ui/component-utilities/echarts.js:154`, `core/ui/component-utilities/echarts.js:176`
> decision on **keep**, split between enrich defaults + runtime resize recalculation.

## axis visibility controls
Per-axis toggles for gridlines, tick marks, baselines, and labels.
cf: `core/ui/components/Chart.svelte:84`, `core/ui/components/Chart.svelte:717`
> decision on **keep**, map to explicit v2 props with cleaner names.

## axis/title default conventions
Support `true/false/custom` axis-title behaviors derived from field names.
cf: `core/ui/components/Chart.svelte:430`, `core/ui/components/Chart.svelte:437`, `core/ui/components/Chart.svelte:448`
> decision on **drop**, keep explicit titles only (metadata can provide display names elsewhere).

## dynamic chart area sizing
Compute container height based on title/subtitle/legend/axis-title and horizontal bar count.
cf: `core/ui/components/Chart.svelte:766`, `core/ui/components/Chart.svelte:805`
> decision on **keep**, implement simplified readable sizing rule set first.

## high-cardinality adaptive sizing
Improve readability for many categories (height/spacing/aspect behavior).
cf: `core/ui/components/Chart.svelte:797`, `evidence.md` (high cardinality note)
> decision on **add**, implement bounded growth + sensible maxes.

## color palette parsing flexibility
Accept palette key, CSV string, JSON string array, or array.
cf: `core/ui/component-utilities/themeStores.ts:95`, `core/ui/component-utilities/themeStores.ts:101`, `core/ui/component-utilities/themeStores.ts:113`
> decision on **keep**, preserve markdown ergonomics.

## series color override parsing
Accept per-series color map as object or JSON string.
cf: `core/ui/component-utilities/themeStores.ts:75`, `core/ui/component-utilities/echarts.js:61`
> decision on **keep**, apply after base config so explicit override always wins.

## theme token color resolution
Resolve semantic color tokens (`base-content`, etc.) into concrete chart colors.
cf: `core/ui/component-utilities/themeStores.ts:55`, `core/ui/component-utilities/themeStores.ts:63`
> decision on **keep**, keep centralized in theme store layer.

## page-stable palette rotation
Rotate default palette ordering per page/report to avoid always-start-blue charts while staying deterministic.
cf: `evidence.md` (palette ordering add note)
> decision on **add**, deterministic seed from report path/id + chart index.

## built-in echarts theme registration
Register themed ECharts defaults before chart init.
cf: `core/ui/component-utilities/echarts.js:33`
> decision on **keep**, but light-mode-first in v1.

## dark mode chart theme switching
Theme change causes chart re-init and separate dark theme registration.
cf: `core/ui/component-utilities/echarts.js:34`, `core/ui/component-utilities/echarts.js:189`, `core/ui/component-utilities/themeStores.ts:4`
> decision on **drop** for v1 (current theme store is already light-only).

## svg-first renderer default
Prefer SVG renderer for stability and screenshot reliability.
cf: `core/ui/components2/ECharts2.svelte:28`, `core/ui/component-utilities/echarts.js:41`
> decision on **keep**, continue default SVG in v2.

## iOS large-canvas svg fallback
Legacy auto-switch to SVG for oversized iOS canvas.
cf: `core/ui/component-utilities/echarts.js:28`
> decision on **drop**, redundant if SVG is default.

## option merge precedence
Deterministic merge order: base config, seriesColors, echartsOptions, seriesOptions.
cf: `core/ui/component-utilities/echarts.js:117`, `core/ui/component-utilities/echarts.js:126`, `core/ui/component-utilities/echarts.js:127`, `core/ui/component-utilities/echarts.js:128`
> decision on **keep**, codify this precedence explicitly in ECharts2 runtime.

## resize observer runtime glue
Observe parent size changes and trigger chart resize with debounce.
cf: `core/ui/component-utilities/echarts.js:144`, `core/ui/component-utilities/echarts.js:148`
> decision on **keep**, simplified observer logic is enough for v1.

## cross-chart tooltip linking
Connect charts by group for synchronized interactions.
cf: `core/ui/component-utilities/echarts.js:48`
> decision on **drop** for v1.

## chart debug registry
Expose chart instances in global symbol map for debugging/testing.
cf: `core/ui/component-utilities/chartWindowDebug.js:1`, `core/ui/component-utilities/echarts.js:45`, `core/ui/components2/ECharts2.svelte:52`
> decision on **drop** unless tests prove dependency.

## faceting support
First-class small multiples/faceting at viz layer.
cf: `evidence.md` (faceting add note)
> decision on **add**, but out of v1; implement as composition layer above per-chart enrichment.

## rename swapXY to horizontal
Replace confusing axis-swap term with semantic orientation prop.
cf: `core/ui/components/BarChart.svelte:16`, `core/ui/components/Chart.svelte:24`, `core/ui/components2/enrich.ts:85`
> decision on **add**, use `horizontal` in v2 APIs, with temporary alias during migration if needed.

## legacy evidence type compatibility shim (`_evidenceColumnTypes`)
Carry Evidence-specific type metadata through transforms and infer formats/titles from it.
cf: `core/ui/internal/queryEngine.ts:154`, `core/ui/component-utilities/getColumnSummary.js:32`, `core/ui/component-utilities/getCompletedData.js:111`, `core/ui/component-utilities/getSortedData.js:5`
> decision on **drop**, rely on native `fields` metadata in v2; no Evidence compatibility layer.

## pie default config conveniences
Pie shorthand includes default donut radius + tooltip template + QueryLoad shell.
cf: `core/ui/components/PieChart.svelte:29`, `core/ui/components/PieChart.svelte:33`, `core/ui/components/PieChart.svelte:47`
> decision on **keep**, as thin shorthand behavior (not central enrichment core).

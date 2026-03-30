
# What we'd lose by replacing current viz components with thin ECharts wrappers

This document inventories behavior currently implemented in Graphene's Evidence-derived chart layer.

If we remove that layer and rebuild `BarChart`, `LineChart`, `AreaChart`, and `PieChart` as thin wrappers around `echarts.setOption(...)`, **everything below is lost unless we explicitly rebuild it**.

## 1) Query/data integration behavior


### 1.3 Built-in loading and empty states
Current behavior:
- Skeleton loading block while query runs.
- Empty dataset message if query returns zero rows.
- Error display component for query errors.

Loss:
- You need to implement your own loading/empty/error chart shell.

> Rebuild, look jank

---

## Shorten Y axis labels consistently


## 2) Type metadata compatibility (`_evidenceColumnTypes`)

### 2.1 Query-engine type mapping for charts
Current behavior:
- Query engine maps Graphene types to Evidence-style types and stores on rows:
  - `_evidenceColumnTypes = [{name, evidenceType}]`
- Also sets `rows.dataLoaded = true` for component compatibility.

Loss:
- Existing type-driven chart logic (formatting, axis inference, integer tick behavior, etc.) no longer works unless replaced.

> Drop this

---

## 3) Input normalization/coercion layer

### 3.1 Comma-list parsing (clarification)
Current behavior:
- Props like `y`, `y2`, `seriesOrder` can be passed as comma-separated strings and are parsed to arrays.
- Example: `y="sales, profit"` becomes `['sales', 'profit']`.

Loss:
- In thin wrappers, these become literal strings unless you rebuild parsing.

> Keep

### 3.2 Boolean string coercion
Current behavior:
- Many props accept both booleans and strings:
  - `true`, `false`, `'true'`, `'false'`
- Used across axes, labels, sorting, log scale, marker flags, etc.

Loss:
- Prop ergonomics regress; string values from MDX-like markup stop working unless normalized.

> Drop

### 3.3 Flexible color/palette input parsing
Current behavior:
- `colorPalette` supports:
  - palette key (`default`),
  - comma list (`"red, steelblue, #00ff00"`),
  - JSON array string (`"['#123456', 'pink']"`),
  - array value.
- `seriesColors` supports object or JSON object string.

Loss:
- Need strict raw ECharts color arrays/objects unless you rebuild these adapters.

> keep

---

## Pick a different default color palette ordering per page

Want to avoid every chart on every page being blue.
Still needs to be keep it stable on reloads (maybe key off filename?)

> Add

## 4) Automatic column inference and validation

### 4.2 Automatic x/y fallback behavior
Current behavior:
- If `x` not provided: first dataset column is used.
- If `y` not provided: all numeric non-assigned columns are used.

Loss:
- You must always provide explicit x/y or recreate fallback logic.

> Drop

### 4.3 Chart-specific config guards
- `checkInputs(...)` verifies:
  - data exists,
  - dataset non-empty,
  - referenced columns exist,
  - SQL error rows surface as chart errors.

Current behavior includes explicit runtime errors for invalid combinations:
- Horizontal charts (`swapXY=true`) reject value/time x-axis.
- Horizontal charts reject `y2`.
- Log scale rejects stacked / stacked100.
- Log scale rejects data with values <= 0.
- `chartAreaHeight` must be positive numeric.

Loss:
- These protections disappear unless reimplemented.

> Keep

---

## Support faceting as a first-class thing

> Add

## 5) Data shaping and series construction

### 5.1 Sparse-series completion (`getCompletedData`)
Current behavior:
- For multi-series and stacked charts, missing `(x, series)` combinations are filled so stacks/legends align.
- Can fill with `null` or `0` depending on mode.
- Can interpolate/fill x values for numeric/time-ish intervals in specific modes.

Loss:
- Missing categories/timestamps produce uneven series and visual artifacts unless you rebuild this.

> Keep

### 5.2 Sorting policy defaults
Current behavior:
- Default sort behavior depends on axis type:
  - category x: sort by y desc (or stack total in some cases)
  - value/time x: sort by x asc
- Time axes are always re-sorted ascending to prevent line zig-zag.

Loss:
- Raw input order is used unless caller sorts manually.

> Keep

### Sort field
separate attribute that tells echarts how to sort a particular axis

> Add/Fix

### 5.3 100% stacking transformation
Current behavior:
- `stacked100` computes per-group percentages and rewrites y fields (`*_pct`) via `getStackPercentages`.

Loss:
- No built-in percent normalization.

> drop - echarts supports this natively now, just need to wire it in

### 5.4 Series synthesis matrix (`getSeriesConfig`)
Current behavior supports all combinations:
- single y / multiple y
- with or without `series` split column
- optional `y2`
- optional `size`/`tooltipTitle` payloads
- series reordering via `seriesOrder`
- series label formatting via `seriesLabelFmt`

Loss:
- You have to manually produce ECharts `series[]` for each case.

> Keep

---

## 6) Axis behavior and layout policy

### 6.1 Axis type inference
Current behavior:
- Infers x axis from metadata:
  - number -> `value`
  - string -> `category`
  - date/timestamp -> `time`
- Allows `xType` override with guardrails.
- `xMismatch` behavior

Loss:
- Caller must configure axis type manually.

> Keep, but improve: extract(month) is categorical, for example, and should be sorted properly (and also filled in?)

### 6.2 Dual-axis orchestration (`y2`)
Current behavior:
- Builds secondary y-axis, tick/label/grid controls, min/max/scale, formatters, axis titles.
- Supports `y2SeriesType` override (`line`/`bar`/`scatter`) for y2 series.

Loss:
- No plug-and-play `y2` support.

> Keep

### 6.3 Integer tick handling
Current behavior:
- If numeric column has maxDecimals=0, sets `minInterval: 1` to avoid fractional tick steps.

Loss:
- Integer metrics may get fractional tick labels.

> Keepish, mostly just make sure that charts with only values [0,1] don't have more than just "0" and "1" as axis ticks

### 6.4 Axis/title defaults
Current behavior:
- `xAxisTitle`, `yAxisTitle`, `y2AxisTitle` accept:
  - `true` = auto title from formatted column name
  - `false` = hidden
  - custom string

Loss:
- Need explicit title text and logic.

> Drop

### 6.5 Gridline/tick/baseline switches
Current behavior:
- Rich per-axis toggles:
  - `xGridlines`, `yGridlines`, `y2Gridlines`
  - `xTickMarks`, `yTickMarks`, `y2TickMarks`
  - `xBaseline`, `yBaseline`, `y2Baseline`
  - `xAxisLabels`, `yAxisLabels`, `y2AxisLabels`

Loss:
- Must manually map these to ECharts options.

> Keep

### 6.6 Dynamic chart area sizing
Current behavior:
- Computes container height using:
  - title/subtitle presence,
  - legend presence,
  - axis title placement,
  - horizontal bar count scaling.

Loss:
- Need your own layout spacing policy; charts may clip or waste space.

> Keep

---

## 7) Tooltip and label behavior

### 7.1 Custom tooltip formatter strategy
Current behavior:
- Different tooltip rendering for:
  - multi-series,
  - single-series with numeric x,
  - single-series with category/time x,
  - dual-axis formatting.
- Uses column formats for values and titles.

Loss:
- Default ECharts tooltip behavior only, unless rebuilt.

> Drop? Dig in and figure out where Echarts defaults suck

### 7.2 Value labels with advanced controls
Current behavior:
- Supports:
  - `labels`, `labelSize`, `labelPosition`, `labelColor`
  - `labelFmt`, `yLabelFmt`, `y2LabelFmt`
  - `showAllLabels` overlap behavior

Loss:
- Need custom label formatters and overlap policy.

> Keep, but maybe simplify to just labels: true/false?

### 7.3 Stacked total labels
Current behavior:
- For stacked bars with labels, can add computed total labels (`stackTotalLabel`) and disable legend toggling accordingly.

Loss:
- No built-in stack totals.

> Keep, but this should just be the default if `label='true'`

### 7.4 X-label truncation/wrap policy
Current behavior:
- `showAllXAxisLabels` and `xLabelWrap` drive resize-time label width/overflow policy.
- Calculates width from chart width and distinct x count.

Loss:
- Long category labels become unreadable unless custom logic is added.

> Keep? Does echarts not do this?

---

## 8) Formatting system (numbers/dates/auto formats)

### 8.1 Column-format inference by name/type
Current behavior:
- Implicit auto formats based on type/name patterns (`year`, `id`, dates, numeric unit scaling).
- Supports built-in + custom formats.

Loss:
- All implicit formatting disappears.

> Drop, we want to use metadata for this

### 8.2 Value vs axis format separation
Current behavior:
- Distinct axis format code support (`axisFormatCode`) and value format code behavior.

Loss:
- Less control/fidelity unless you carry format objects through.

> Drop

### 8.3 Title/tag formatting integration
Current behavior:
- Column names are title-cased / tag-replaced for labels and legends.

Loss:
- Raw field names likely shown unless normalized elsewhere.

> Drop, also use metadata for this

---

## 9) Theme/color integration

### 9.1 Theme token resolution
Current behavior:
- Color names can map through theme tokens (`base-content`, etc.).
- Active appearance is passed to chart action and can trigger re-init.

Loss:
- Theming contract breaks unless replaced.

> Keep

### 9.2 Axis color auto-behavior with y2
Current behavior:
- `yAxisColor='true'` and `y2AxisColor='true'` can auto-select palette colors matching series groups.

Loss:
- Manual color assignment required.

> Keep. Why do we need attributes to control this?

### 9.3 Built-in ECharts themes
Current behavior:
- Registers light/dark themes from `echartsThemes.js`.

Loss:
- Style defaults change unless you keep this layer.

> Keep, but we're going to want to make this customizable via a theme.ts file
> Drop dark mode support

---

## Corner rounding
Want these to be the default, need to customize them when dealing with stacked charts when series are toggled on or off, or vertical vs horizontal

## Rename `swapXY` to `horizontal=true`
This is confusing, but maybe is good to keep x and y always the same?

## 10) ECharts action runtime glue (`component-utilities/echarts.js`)

### 10.1 Override merge pipeline
Current behavior:
- Applies base config, then `seriesColors`, then `echartsOptions`, then `seriesOptions` (with exclusions for reference series types).

Loss:
- You must define a deterministic merge order yourself.

> Keep? What actual evidence code is here?

### 10.2 Cross-chart tooltip linking
Current behavior:
- `connectGroup` sets ECharts group and calls `connect(...)`.

Loss:
- Synchronized cross-chart interactions are gone.

> Drop

## Switch to SVG by default

Better resizing, high-res rendering?
Low effort, if it causes issues switch back to canvas

### 10.3 Resize/watch behavior
Current behavior:
- Uses `ResizeObserver` on parent container with debounced resize.
- Falls back to `window.resize` listener.

Loss:
- More layout bugs in responsive/fullscreen contexts unless rebuilt.

> Keep, seems janky sometimes though, maybe when in a Row?

## Make charts look good when cardinality is high
- maybe get wider/taller
- try and preserve aspect ratios so they aren't super skinny
- Think through



### 10.4 iOS large-canvas fallback
Current behavior:
- Switches to SVG renderer automatically on iOS when canvas area exceeds threshold.

Loss:
- iOS rendering failures can reappear.

> Drop, assuming we make svg the default

### 10.5 Render lifecycle integration
Current behavior:
- Emits `window.$GRAPHENE.renderStart/renderComplete` for page-level `waitForLoad()` stability.

Loss:
- Screenshot/test and UX "done rendering" semantics degrade unless replaced.

> Keep

### 10.6 Chart window debug registry
Current behavior:
- Charts are registered for test/debug access via `__evidence-chart-window-debug__` symbol map.

Loss:
- Existing chart debug/test hooks break.

> Drop? Possible claude added this for testing

---

## 11) Component-specific behavior

### 11.1 `BarChart` / `Bar`
Current extras beyond basic ECharts bar:
- `type`: `stacked` / `grouped` / `stacked100`
- horizontal mode (`swapXY`) with constraints
- `stackTotalLabel`, `seriesLabels`, `y2SeriesType`
- fill/outline styling, label defaults by mode
- sorted stacked category behavior by stack total

> Keep

### 11.2 `LineChart` / `Line`
Current extras:
- `markers`, `markerShape`, `markerSize`
- missing value handling modes (`gap`, `connect`, `zero`)
- `step` + `stepPosition`
- y2 mixed series typing

> Keep, but try to use default echart names

### 11.3 `AreaChart` / `Area`
Current extras:
- stacked area behavior via line-series + `areaStyle`
- `line` toggle (show/hide stroke)
- missing handling and completion rules tuned for area stacking

> Keep

### 11.4 `PieChart`
Closest to thin wrapper already, but still provides:
- query loading shell (`QueryLoad`)
- title/subtitle and default tooltip template
- `seriesOptions`/`echartsOptions` convenience merge

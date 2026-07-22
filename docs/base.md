Graphene is a framework for doing data analysis and BI as code. Schema definitions and semantic models are in `.gsql` files, dashboards/notebooks (called pages) in `.md`.

# GSQL
GSQL extends ANSI SQL with dimensions, measures, and join relationships. Declare them in `table` statements:

```sql
table orders (
  id bigint
  created_at datetime
  user_id bigint
  amount float                          #currency=USD
  status string
  join one users on user_id = users.id  -- many orders per user
  is_complete: status = 'Complete'      -- dimension (scalar expression)
  revenue: sum(amount)                  -- measure (agg expression) #currency=USD
  avg_order: revenue / count(*)         -- measures can compose #currency=USD
)
table users (
  id bigint
  name varchar
  join many orders on id = orders.user_id
)
```

Other statements:
- `table X as (select ...)` defines a table as the result of a query
- `extend` adds dimensions, measures, and joins to an existing table, usually used with `table X as (select ...)`

## Using semantics in queries
### Implicit joins
- `from orders select status, user.name` will automatically join users on to orders per the model-defined join
- Use multiple dot operators to traverse multi-hop joins e.g. `from orders select status, order_items.inventory_items.avg_days_in_inventory -- orders -> order_items -> inventory_items
- Normal ANSI joins (`inner join`, `left join`, etc.) supported in `select` as well, if the join you need is not already modeled

### Dimension and measure expansion
Dimensions and measures are like macros that expand inline when GSQL compiles to database SQL. For example, `from users select id, orders.revenue` automatically expands to `select users.id, sum(orders.amount) ...`
- NEVER(!): `sum(revenue)` or `group by revenue` because `revenue` is already an agg expression
- OK: `floor(revenue)`, `revenue / cost` 
- OK: `sum(case when is_complete then 1 else 0 end)` or `group by is_complete` (because `is_complete` is a dimension, not a measure)

### Arrays
- Array columns and casts use `array<T>` syntax in GSQL, for example `tags array<string>` or `cast(tags as array<string>)`
- Arrays can be expanded in queries with `cross join unnest(tags) as tag`

### Special features
- `group by all` is implied when aggregates exist, and does not need to be put in GSQL
- Agg function `pXX(column)` computes the XXth percentile (e.g., p50, p975, p9999)
- `select`, `from`, `order by`, etc. in any order

### Supported
- All scalar, agg, and window functions of the connected database
- ANSI joins, CTEs, subqueries, set operations

### Not supported
- Table functions
- UDFs
- `pivot`, `lateral`
- `variant`, `object`, `record` types

# Pages
Graphene pages extend Markdown with the following:
- GSQL queries in code fences
- Visualization and input components
- Safe layout HTML such as `<div>`, `<span>`, semantic sections, lists, and tables
- `<style>` blocks for page-level visual customization

````md
---
title: My First Dashboard
layout: dashboard
---

```sql sales_by_status
select extract(year from created_at) AS year, status, revenue
from orders
where status <> 'cancelled'
```

<BigValue data="orders" value="revenue" />
<BarChart data="sales_by_status" x="year" y="revenue" splitBy="status"/>
````

Queries can be referenced by other queries in the `from` or `join` to form DAGs of data logic within the page.

## HTML and CSS
Pages can use safe HTML markup for custom layout and styling. Common layout and text tags are supported, along with `class`, `id`, `role`, `aria-*`, and `data-*` attributes. Use `<style>` blocks to customize page visuals or target Graphene components.

Graphene treats page CSS as visual customization, not executable code. CSS can use external visual resources, including `@import`, font files, and image URLs. Inline `style=""` attributes are not supported; use classes and `<style>` blocks instead.

Unsupported:
- Javascript of any kind, including `<script>`, event handlers, framework directives, dynamic markup expressions, and raw HTML injection
- Automatic embedded/resource tags such as `<iframe>`, `<object>`, `<embed>`, `<link>`, `<meta>`, `<img>`, `<video>`, `<audio>`, `<svg>`, and `<math>`
- Form controls such as `<form>`, `<input>`, `<button>`, `<textarea>`, and `<select>`

## Page frontmatter
You can add YAML frontmatter at the top of a page. The following attributes are supported:
- `title`: title displayed at the top of the page
  - DO NOT(!) put an h1 at the top of the page if you already set a title via frontmatter.
- `layout`: `notebook` is the default, good for prose interspersed with charts. `dashboard` has a wider max-width, for chart-heavy pages with lots of `<Row>`s.

## Viz and display components
- LineChart: title, data, x, y, y2, splitBy, sort, height, width
- AreaChart: title, data, x, y, y2, splitBy, arrange (`stack` (default) or `stack100`), sort, height, width
- BarChart: title, data, x, y, y2, splitBy, arrange (`stack` (default), `group`, or `stack100`), label (true or false (default); shows labels above bars), sort, height, width
- ScatterPlot: title, data, x, y, splitBy, height, width
- PieChart: title, data, category, value, height, width
- ECharts: data, height, width, renderer
- BigValue: title, data, value, row
- Table: title, data, rows, sortable, sort, groupBy, groupType, subtotals, totalRow, link, showLinkCol, rowShading, rowLines, rowNumbers, compact, headerColor, headerFontColor, totalRowColor, totalFontColor, backgroundColor, emptyMessage
  - Column (sub-component of Table): id (column name), title, description, align, wrap, wrapTitle, colGroup, contentType, totalAgg, redNegatives
- Value: data, column, row
- Row (layout container, distributes children horizontally): No attributes

Notes on common attributes:
- `data` can also point at a modeled GSQL table.
- Any attribute that accepts a column can also accept an arbitrary GSQL expression. These attributes are x, y, y2, splitBy, category, value, link, groupBy, scaleColumn
- `splitBy` creates a series for each distinct value in the column (long format data).
- `y` can take a comma-separated list of columns/expressions, to map multiple fields to the same y-axis as separate series (wide format data).
- `sort` takes a column name followed by `asc` or `desc`, eg. `my_col desc`. Useful when you want something sorted differently than its inherent alphanumeric ordering.
- `height` and `width` accept any CSS size units eg. `240px` or `50%`.
- There is no `swapXY`. To create horizontal bars, simply switch what is assigned to `x` and `y`.

### `<BigValue>`
Displays one prominent value from a query or modeled table. `data` and `value` are required; `title` is optional and `row` selects a result row (default `0`).

```md
<BigValue data=orders value=num_orders title="Total Orders" />
```

### `<ECharts>`
To create visualizations or customizations beyond Graphene's out-of-the-box components, specify an ECharts config via `<ECharts>`.

This example creates a stacked bar chart with a purple x-axis.

```md
<ECharts data="sales_by_status">
  title: {text: "Annual Revenue by Status"},
  xAxis: {axisLine: {lineStyle: {color: 'purple'}}},
  series: [{type: "bar", stack: "bar-stack", encode: {x: "year", y: "revenue", splitBy: "status"}],
</ECharts>
```

Use `encode` to map objects to the columns of the data source. In Graphene, `encode` also accepts `splitBy` which automatically expands one template into multiple series. For bar charts, `splitBy` can be a two-item list (`[groupBy, stackBy]`) for grouped+stacked bars.

Graphene will handle axes, layout, and styles for you, so you can omit those configurations unless you explicitly want to override them.

Unsupported:
- `{@colName}` formatter templates (but `{a}`, `{b}`, `{c}` work)
- Javascript of any kind

### `<Value>`
`<Value>` is used for inlining SQL-derived values within markdown text. You can place them anywhere in markdown, including headers, and they can be styled with `**` or `_`.

```md
### Top 3 Most Active Airplane Models
1. **<Value data=top_airplane_models column=manufacturer_model row=0 />** ...
```

## Input components
Input values are referenced by their `name` as `$name` in GSQL and sync into the page URL query string, preserving state across reloads and shared links.

### `<Dropdown>`
Build options from a query using `data` and `value`; optionally use `label` as the displayed column. Other attributes are `title`, `description`, `defaultValue`, `multiple`, `selectAllByDefault`, `noDefault`, and `disableSelectAll`. `name` is required.

````md
```sql statuses
select distinct status from orders
```
<Dropdown name=status data=statuses value=status defaultValue="Complete" />

```sql filtered_orders
select * from orders where status = $status
```
````

For `multiple=true`, the input produces a list; filter with `where status in ($status)`. Static options can be nested inside the dropdown as `<DropdownOption value="complete" valueLabel="Complete" />`; `value` is required and `valueLabel` defaults to it.

### `<TextInput>`
Collects freeform text. `name` is required; optional attributes are `title`, `placeholder` (default `"Type to search"`), and `description`.

```md
<TextInput name=search title="Search" />
```

For example, filter with `where email ilike concat('%', $search, '%')`.

### `<DateRange>`
Collects start and end dates. `name` is required; optional attributes are `title`, `description`, `data` and `dates` (to infer the available date domain), `start`, `end`, `defaultValue`, and `presetRanges`.

```md
<DateRange name=date_filter data=sales dates=date defaultValue="Last 30 Days" />
```

Use the selected bounds as `$date_filter_start` and `$date_filter_end`, for example `where date >= $date_filter_start and date < $date_filter_end`. Built-in presets include the last 7/30/90/365 days, last month/year, month/year to date or today, and all time. Custom `Last N Days` and `Last N Months` presets are supported; override the menu with a comma-separated `presetRanges` value.

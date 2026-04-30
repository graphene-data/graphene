Graphene is a framework for doing data analysis and BI as code. Schema definitions and semantic models are in `.gsql` files, dashboards/notebooks (called pages) in `.md`.

# GSQL
GSQL extends ANSI SQL with dimensions, measures, and join relationships. Declare them in `table` statements:

```sql
table orders (
  id bigint
  user_id bigint
  amount float
  status string
  join one users on user_id = users.id  -- many orders per user
  is_complete: status = 'Complete'      -- dimension (scalar expression)
  revenue: sum(amount)                  -- measure (agg expression)
  avg_order: revenue / count(*)         -- measures can compose
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

````md
---
title: My First Dashboard
layout: dashboard
---

```sql sales_by_status
select status, revenue
from orders
where status <> 'cancelled'
```

<BigValue data="sales_by_status" value="revenue" />
<BarChart data="sales_by_status" x="status" y="revenue" />
````

Queries can be referenced by other queries in the `from` or `join` to form DAGs of data logic within the page.

## Page frontmatter
You can add YAML frontmatter at the top of a page. The following attributes are supported:
- `title`: title displayed at the top of the page
- `layout`: `notebook` is the default, good for prose interspersed with charts. `dashboard` has a wider max-width, for chart-heavy pages with lots of `<Row>`s.

## Viz and display components
- LineChart: title, data, x, y, y2, splitBy, height, width
- AreaChart: title, data, x, y, y2, splitBy, arrange (`stack` (default), `group`, or `stack100`), height, width
- BarChart: title, data, x, y, y2, splitBy, arrange, label (true or false (default); shows labels above bars), height, width
- PieChart: title, data, category, value, height, width
- ECharts: data, height, width, renderer
- BigValue: title, data, value, comparison, comparisonTitle, downIsGood, sparkline, sparklineType, sparklineColor
- Table: title, data, rows, subtitle, groupBy, groupType, subtotals, totalRow, search, sort, link, rowShading, rowNumbers, compact, headerColor
  - Column (sub-component of Table): id (column name), title, fmt, align, wrap, contentType, totalAgg, redNegatives
- Value (for inlining dynamic numbers within markdown text): data, column, row.
- Row (layout container, distributes children horizontally): No attributes

Notes on common attributes:
- `data` can also point at a modeled GSQL table.
- Any attribute that accepts a column can also accept an arbitrary GSQL expression. These attributes are x, y, y2, splitBy, category, value, comparison, sparkline, link, groupBy, weightCol, scaleColumn
- `splitBy` creates a series for each distinct value in the column (long format data).
- `y` can take a comma-separated list of columns/expressions, to map multiple fields to the same y-axis as separate series (wide format data).
- `height` and `width` accept any CSS size units eg. `240px` or `50%`.

### ECharts
To create visualizations or customizations beyond Graphene's out-of-the-box components, specify an ECharts config via `<ECharts>`.

```md
<ECharts data="sales_by_status">
  xAxis: {axisLine: {lineStyle: {color: 'purple'}}},
  series: [{type: "bar", stack: "bar-stack", encode: {x: "month", y: "revenue", splitBy: "status"}],
</ECharts>
```

Graphene introduces an `encode` property within `series` configs to map to columns in the data source.
In addition to the regular fields `encode` takes, it also accepts `splitBy`, which automatically expands one template into multiple series. For bar charts, `splitBy` can be a two-item list (`[groupBy, stackBy]`) for grouped+stacked bars.

## Input components
- Dropdown: title, name, data, value (column to populate list with), label, defaultValue, multiple
- TextInput: title, name, placeholder
- DateRange: title, name, data, dates, start, end, defaultValue, presetRanges, description

Inject input values into queries by referring to their `name` attribute as `$name` in GSQL. 

````md
<Dropdown name=status .../>

```sql my_query
select ...
where status = $status
```
````

DateRange components emit two referenceable values via `${name}_start` and `${name}_end`.

Input values also sync into the page URL query string (eg. `localhost:4000/my_dashboard?status=cancelled`), so reloads and shared links preserve the same dashboard state.

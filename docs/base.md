Graphene is a framework for doing data analysis and BI as code. Schema definitions and semantic models are in `.gsql` files, dashboards in `.md`.

# GSQL
GSQL extends ANSI SQL with dimensions, measures, and join relationships. Declare them in `table` statements:

```sql
table orders (
  id BIGINT
  user_id BIGINT
  amount FLOAT
  status STRING
  join one users on user_id = users.id  -- many orders per user
  is_complete: status = 'Complete'      -- dimension (scalar expression)
  revenue: sum(amount)                  -- measure (agg expression)
  avg_order: revenue / count(*)         -- measures can compose
)
table users (
  id BIGINT
  name VARCHAR
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

### Special features
- `group by all` is implied when aggregates exist, and does not need to be put in GSQL
- Agg function `pXX(column)` computes the XXth percentile (e.g., p50, p975, p9999)
- ANSI set operations `union`, `union all`, `intersect`, and `except` are supported

### Types
- Array columns and casts use `array<T>` syntax in GSQL, for example `tags array<string>` or `cast(tags as array<string>)`
- Arrays can be expanded in queries with `cross join unnest(tags) as tag`
- Other semi-structured data types (`VARIANT`, `OBJECT`, `RECORD`) are unsupported

# Dashboards
Graphene dashboards extend Markdown with the following:
- GSQL queries in code fences
- Visualization components reference query names

````md
```sql sales_by_category
select category, revenue from orders
```
<BarChart data="sales_by_category" x="category" y="revenue" />
<BigValue data="sales_by_category" value="revenue" />
````

Queries can be referenced by other queries in the `from` or `join` to form DAGs of data transformations within the dashboard.
`data` can be a query name or a table name. Attributes that accept columns also accept GSQL expressions.

## Components
All viz components take `data`, which is the name of a gsql table or code-fenced query in the markdown.
Component "field" attributes (like x and y) map to a column within data.
Attributes like `x`, `y`, `y2`, and `splitBy` are the names of columns within the `data` table.
`title` - shown above the viz
- BarChart: Fields [x,y,y2,splitBy,arrange]. `arrange` can be `stack`, `group`, or `stack100` (default `stack`). `label` shows labels above bars.
- LineChart: Fields [x,y,y2,splitBy]
- AreaChart: Fields [x,y,splitBy,arrange]. `arrange` can be `stack` or `stack100` (default `stack`).
- PieChart: Fields: [category,value]

- BigValue: data, value, title, fmt, comparison, comparisonFmt, comparisonTitle, downIsGood, sparkline, sparklineType, sparklineColor
- Table: data, rows, title, subtitle, groupBy, groupType, subtotals, totalRow, search, sort, link, rowShading, rowNumbers, compact, headerColor
  - Column (sub-component of Table): id, title, fmt, align, wrap, contentType, totalAgg, redNegatives

## ECharts
To further customize the look and feel of a chart, use the ECharts component to provide an echarts config.
Be sure to set `data`, and use `encode` on series to map columns in the `data`.
In addition to the regular fields `encode` takes, it also accepts `splitBy`, which automatically expands one template into multiple series. For bar charts, `splitBy` can be a two-item list (`[groupBy, stackBy]`) for grouped+stacked bars.

```md
<ECharts data="sales_by_category">
  xAxis: {axisLine: {lineStyle: {color: 'purple'}}},
  series: [{type: "bar", stack: "bar-stack", encode: {x: "month", y: "revenue", splitBy: "category"}],
</ECharts>
```

### Inputs
- Dropdown: name, data, value, label, defaultValue, multiple, title
- TextInput: name, title, placeholder

### Other components
- Row: no attributes (layout container, distributes children horizontally)

## Tying input components to SQL
Inject input values into queries by referring to their `name` attribute as $name. 

Input values also sync into the page URL query string, so reloads and shared links preserve the same dashboard state.

````md
<Dropdown name=status .../>
```sql my_query
select ...
where status = $status
```
````

## Formatting
`fmt` attributes accept Excel custom format codes or built-in Graphene formats:
- Numbers: num, num0-num4, num0k, num0m, num0b (etc.), id, fract, mult, mult0-mult2, sci
- Currency: usd, usd0-usd2, usd0k, usd0m, usd0b (etc.), (also eur, gbp, etc.)
- Percent: pct, pct0, pct1, pct2, pct3
- Dates: shortdate, longdate, fulldate, mdy, dmy, hms, ddd, dddd, mmm, mmmm, yyyy
- Excel: "$#,##0.00", "0.0%", "m/d/yy" (etc.)

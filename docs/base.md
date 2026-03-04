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
`from orders select status, user.name` will automatically join users on to orders per the model-defined join

### Dimension and measure expansion
Dimensions and measures are like macros that expand inline when GSQL compiles to database SQL. For example, `from users select id, orders.revenue` automatically expands to `select users.id, sum(orders.amount) ...`
- NEVER(!): `sum(revenue)` or `group by revenue` because `revenue` is already an agg expression
- OK: `floor(revenue)`, `revenue / cost` 
- OK: `sum(case when is_complete then 1 else 0 end)` or `group by is_complete` (because `is_complete` is a dimension, not a measure)

### Special features
- `group by all` is implied when aggregates exist, and does not need to be put in GSQL
- Agg function `pXX(column)` computes the XXth percentile (e.g., p50, p975, p9999)

### Unsupported
- Window functions
- Set operations (`union`, etc.)

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
### Visualizations
- BarChart: data, x, y, y2, series, title, subtitle, xFmt, yFmt, y2Fmt, colorPalette, type, swapXY, labels, labelFmt, sort, legend, yMin, yMax
- LineChart: data, x, y, y2, series, title, subtitle, xFmt, yFmt, colorPalette, labels, sort, legend, handleMissing, markers, markerShape, lineType, lineWidth
- AreaChart: data, x, y, series, title, subtitle, xFmt, yFmt, colorPalette, type, labels, sort, legend, handleMissing, fillOpacity, line
- PieChart: data, category, value, title, subtitle
- BigValue: data, value, title, fmt, comparison, comparisonFmt, comparisonTitle, downIsGood, sparkline, sparklineType, sparklineColor
- Table: data, rows, title, subtitle, groupBy, groupType, subtotals, totalRow, search, sort, link, rowShading, rowNumbers, compact, headerColor
  - Column (sub-component of Table): id, title, fmt, align, wrap, contentType, totalAgg, redNegatives

### Inputs
- Dropdown: name, data, value, label, defaultValue, multiple, title
- TextInput: name, title, placeholder

### Other components
- Row: no attributes (layout container, distributes children horizontally)

## Component attributes
- series: column whose values become separate lines/bars (series=country plots one line per country)
- type: stacked (default), grouped (BarChart only), stacked100
- y2: secondary y-axis, y2SeriesType sets its chart type (line/bar/scatter)
- swapXY: horizontal bars
- handleMissing: gap (default), connect, zero
- colorPalette: comma-separated "#hex1, #hex2", applied to series in order
- seriesOrder: control series order "Val1, Val2", pairs with colorPalette
- labels: show value labels on chart
- markers: show dots on line points; markerShape: circle, emptyCircle, rect, triangle, diamond
- lineType: solid, dashed, dotted
- downIsGood: green for negative (for comparison/delta)
- sparkline: date column for mini trend; sparklineType: line, area, bar
- groupBy: group table rows; groupType: accordion (collapsible) or section (merged)
- totalRow: sum row at bottom; subtotals: sum row per group
- link: make table rows clickable, value is URL column
- contentType:
  - delta: arrows+colors. deltaSymbol, downIsGood, chip, neutralMin/Max
  - colorscale: background gradient. colorScale, colorMin/Mid/Max
  - bar: in-cell bar. barColor, negativeBarColor
  - link: clickable. linkLabel, openInNewTab
  - image: show image. height, width
  - sparkline/sparkarea/sparkbar: mini chart from array. sparkX, sparkY, sparkColor
- totalAgg: sum (default), mean, weightedMean, median, min, max, count, countDistinct

## Tying input components to SQL
Inject input values into queries by referring to their `name` attribute as $name. 

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

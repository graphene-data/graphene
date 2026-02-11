Graphene is a framework for doing data analysis as code.

Schema definitions and semantic models are done in `.gsql`, dashboards in `.md`.

## GSQL
GSQL extends ansi sql with a few key features:
`table` statements define existing tables, adding joins and dimensions/measures
`table X as (select ...)` define a table as the result of a query
`extend` add measures and joins to an existing table, usually used with `table X as (select ...)`
Implicit joins: `from orders select status, user.name` will automatically join users on to orders
Measure expansion: `from users select id, orders.revenue` automatically expands to `select users.id, sum(orders.amount) ...`
- NEVER `sum(revenue)` or `group by revenue`
- OK: `floor(revenue)`, `revenue / cost`
`group by all` is implied, and does not need to be put in gsql

A few common features are not supported in gsql, and must be avoided: window functions, subqueries, CTEs.

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

## Dashboards

`.md` files with GSQL in code fences, viz components reference query names.

````md
```gsql monthly_sales
select date_trunc(created_at, month) as month, revenue from orders
```
<LineChart data="monthly_sales" x="month" y="revenue" />
<BigValue data="monthly_sales" value="revenue" />
````

`data` can be query name or table name. Attributes accept columns, expressions, or GSQL.

## Components

BarChart: data, x, y, y2, series, title, subtitle, xFmt, yFmt, y2Fmt, colorPalette, type, swapXY, labels, labelFmt, sort, legend, yMin, yMax
LineChart: data, x, y, y2, series, title, subtitle, xFmt, yFmt, colorPalette, labels, sort, legend, handleMissing, markers, markerShape, lineType, lineWidth
AreaChart: data, x, y, series, title, subtitle, xFmt, yFmt, colorPalette, type, labels, sort, legend, handleMissing, fillOpacity, line
PieChart: data, category, value, title, subtitle
BigValue: data, value, title, fmt, comparison, comparisonFmt, comparisonTitle, downIsGood, sparkline, sparklineType, sparklineColor
Table: data, rows, title, subtitle, groupBy, groupType, subtotals, totalRow, search, sort, link, rowShading, rowNumbers, compact, headerColor
Column: id, title, fmt, align, wrap, contentType, totalAgg, redNegatives
Dropdown: name, data, value, label, defaultValue, multiple, title
TextInput: name, title, placeholder
Row: layout container, distributes children horizontally

series: column whose values become separate lines/bars (series=country plots one line per country)
type: stacked (default), grouped, stacked100
y2: secondary y-axis, y2SeriesType sets its chart type (line/bar/scatter)
swapXY: horizontal bars
handleMissing: gap (default), connect, zero
colorPalette: comma-separated "#hex1, #hex2", applied to series in order
seriesOrder: control series order "Val1, Val2", pairs with colorPalette
labels: show value labels on chart
markers: show dots on line points; markerShape: circle, emptyCircle, rect, triangle, diamond
lineType: solid, dashed, dotted
downIsGood: green for negative (for comparison/delta)
sparkline: date column for mini trend; sparklineType: line, area, bar
groupBy: group table rows; groupType: accordion (collapsible) or section (merged)
totalRow: sum row at bottom; subtotals: sum row per group
link: make table rows clickable, value is URL column

Column contentType:
- delta: arrows+colors. deltaSymbol, downIsGood, chip, neutralMin/Max
- colorscale: background gradient. colorScale, colorMin/Mid/Max
- bar: in-cell bar. barColor, negativeBarColor
- link: clickable. linkLabel, openInNewTab
- image: show image. height, width
- sparkline/sparkarea/sparkbar: mini chart from array. sparkX, sparkY, sparkColor

Column totalAgg: sum (default), mean, weightedMean, median, min, max, count, countDistinct

Inputs: reference as $name in queries. `<Dropdown name=status .../>` -> `where status = $status`

## Formatting

`fmt` attr accepts Excel codes or built-ins:
Numbers: num0-num4, num0k, num0m, num0b
Currency: usd, usd0, usd1k, usd2m (also eur, gbp, etc)
Percent: pct, pct0, pct1, pct2
Dates: shortdate, longdate, mdy, dmy, mmm, yyyy
Excel: "$#,##0.00", "0.0%", "m/d/yy"

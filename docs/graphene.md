# Graphene documentation

Graphene is a framework for data analysis, semantic modeling, and data visualization in code. Graphene projects are comprised of:
- .gsql files that define semantics-enriched tables (aka semantic models)
- .md files that define data apps (aka dashboards)

Graphene also has a CLI that lets you check syntax, run queries, serve data apps, and more.

**Table of Contents**

- [Graphene SQL (GSQL)](#graphene-sql-gsql)
  - [`table` statements](#table-statements)
    - [Base columns (required)](#base-columns-required)
    - [Join relationships](#join-relationships)
      - [Multiple join relationships between the same two tables](#multiple-join-relationships-between-the-same-two-tables)
      - [Best practices for modeling join relationships](#best-practices-for-modeling-join-relationships)
    - [Stored expressions](#stored-expressions)
  - [`select` statements](#select-statements)
    - [Using join relationships in queries](#using-join-relationships-in-queries)
      - [Multi-hop joins](#multi-hop-joins)
    - [Using stored expressions in queries](#using-stored-expressions-in-queries)
    - [Safe aggregation in fan-outs](#safe-aggregation-in-fan-outs)
  - [`table as` statements](#table-as-statements)
  - [Other miscellaneous details about GSQL](#other-miscellaneous-details-about-gsql)
- [Graphene data apps (dashboards)](#graphene-data-apps-dashboards)
  - [Visualization components](#visualization-components)
    - [Bar chart](#bar-chart)
      - [All bar chart attributes](#all-bar-chart-attributes)
        - [General](#general)
        - [Data](#data)
        - [Formatting & Styling](#formatting--styling)
        - [Value Labels](#value-labels)
        - [Axes](#axes)
        - [Interactivity](#interactivity)
    - [Pie chart](#pie-chart)
      - [All pie chart attributes](#all-pie-chart-attributes)
        - [General](#general-1)
        - [Data](#data-1)
    - [Line chart](#line-chart)
      - [All line chart attributes](#all-line-chart-attributes)
        - [General](#general-2)
        - [Data](#data-2)
        - [Formatting & Styling](#formatting--styling-1)
        - [Axes](#axes-1)
        - [Interactivity](#interactivity-1)
    - [Area chart](#area-chart)
      - [All area chart attributes](#all-area-chart-attributes)
        - [General](#general-3)
        - [Data](#data-3)
        - [Formatting & Styling](#formatting--styling-2)
        - [Value Labels](#value-labels-1)
        - [Axes](#axes-2)
        - [Interactivity](#interactivity-2)
    - [Big value](#big-value)
      - [All big value attributes](#all-big-value-attributes)
        - [Data](#data-4)
        - [Comparison](#comparison)
        - [Sparkline](#sparkline)
    - [Table](#table)
      - [All table attributes](#all-table-attributes)
        - [Table](#table-1)
        - [Groups](#groups)
        - [Column](#column)
  - [Input components](#input-components)
    - [Text input](#text-input)
      - [All text input attributes](#all-text-input-attributes)
    - [Date range](#date-range)
      - [All date range attributes](#all-date-range-attributes)
    - [Dropdown](#dropdown)
      - [All dropdown attributes](#all-dropdown-attributes)
        - [DropdownOption](#dropdownoption)
  - [Other components](#other-components)
  - [Value formatting](#value-formatting)
    - [Built-in Formats](#built-in-formats)
      - [Auto-Formatting](#auto-formatting)
      - [Dates](#dates)
      - [Currencies](#currencies)
      - [Numbers](#numbers)
      - [Percentages](#percentages)
- [Graphene CLI](#graphene-cli)
- [AGENT INSTRUCTIONS](#agent-instructions)

## Graphene SQL (GSQL)

GSQL is comprised of `table` statements that declare tables and `select` statements that query them.

### `table` statements

`table` statements manifest tables that already exist in your database. Here's an example of two tables, `orders` and `users`, in GSQL.

```sql
table orders (

  /* Base columns */

  id BIGINT primary_key,
  user_id BIGINT,
  created_at DATETIME,
  status STRING, -- One of 'Processing', 'Shipped', 'Complete', 'Cancelled', 'Returned'
  amount FLOAT, -- Amount paid by customer
  cost FLOAT, -- Cost of materials

  /* Join relationships */

  join_one users on user_id = users.id,

  /* Scalar expressions */

  status in ('Processing', 'Shipped', 'Complete') as revenue_recognized,

  /* Agg expressions */

  sum(case when revenue_recognized then amount else 0 end) as revenue,
  sum(case when revenue_recognized then cost else 0 end) as cogs,
  revenue - cogs as profit,
  profit / revenue as profit_margin
)

table users (
  id BIGINT primary_key,
  name VARCHAR,
  email VARCHAR,
  age INTEGER,
  country_code VARCHAR,

  join_many orders on id = orders.user_id
)
```

We can break down a table statement into three parts: [base columns](#base-columns-required), [join relationships](#join-relationships), and [stored expressions](#stored-expressions) (aka dimensions and measures).

#### Base columns (required)

The base column set is simply a reflection of the underlying database table's schema. Similar to `create table` statements in regular SQL DDL, you list each column's name and data type. One column must be designated as the primary key.

#### Join relationships

Join relationships in a `table` statement declare joins that can be used when querying them. This makes query writing easier and more foolproof. See [Using join relationships in queries](#using-join-relationships-in-queries) below for how to use modeled joins in queries.

The other main difference about joins in GSQL vs. regular SQL is that you have to explain if there are many rows in the left table for each row in the right table, or vice versa. This additional bit of information allows Graphene to prevent incorrect aggregation as a result of row duplication (aka fan-out) through joins. See [Safe aggregation in fan-outs](#safe-aggregation-in-fan-outs) for more details.

This information is provided with the two supported join types, `join_one` and `join_many`:
- `join_one` is used if there are many rows in the **left** table for each row in the **right** table.
- `join_many` is used if there are many rows in the **right** table for each row in the **left** table.

In the example above with `orders` and `users`, the joins confirm that there are many orders per user, and only one user per order.

Note that all joins in GSQL are left outer joins. There is no inner, right, or cross join.

##### Multiple join relationships between the same two tables

Sometimes there are multiple valid ways to join two tables together. You can model this in Graphene by aliasing the various joins with `as`, just as you would in normal SQL. For example:

```sql
table projects (
  ...
  owner_id BIGINT,
  viewer_id BIGINT,

  join_one users as project_owner on owner_id = project_owner.id,
  join_one users as project_viewer on viewer_id = project_viewer.id
)

table users (
  ...
  id BIGINT,

  join_many projects as projects_as_owner on id = projects_as_owner.owner_id,
  join_many projects as projects_as_viewer on id = projects_as_viewer.viewer_id
)
```

##### Best practices for modeling join relationships

- For a given `table` statement, only model joins that are directly on that table. Multi-hop join paths do not need to be written explicitly in order for queries to traverse them.
- A join between two tables should be modeled in both the respective `table` statements. This may seem redundant but it offers more flexibility for queries to choose which table to set in the `from` (remember that direction matters in queries since all joins are left joins).

#### Stored expressions

**Stored expressions** are GSQL expressions (ie. any arbitrary combination of functions, operators, and column references) that you want to make reusable to queries. Stored expressions are great for canonizing metrics, segments, and other important business definitions.

A stored expression must be given a name via `as`. It can then be referenced by name in queries that use the parent table. See [Using stored expressions in queries](#using-stored-expressions-in-queries) below for how to use stored expressions in queries.

Like expressions in regular SQL, expressions in GSQL are either scalar or aggregative. In BI parlance, these would be called dimensions and measures, respectively.

Expressions can refer to other expressions, as from the example before:

```sql
table orders (
  ...

  /* Scalar expressions */

  status in ('Processing', 'Shipped', 'Complete') as revenue_recognized,

  /* Agg expressions */

  sum(case when revenue_recognized then amount else 0 end) as revenue,
  sum(case when revenue_recognized then cost else 0 end) as cogs,
  revenue - cogs as profit, -- even though there are no agg functions here, this is still aggregative as it references other aggregative expressions
  profit / revenue as profit_margin
)
```


### `select` statements

`select` is how you write queries in Graphene SQL. It behaves similarly to regular SQL except in the following ways:
- It can invoke join relationships and stored expressions from `table` statements.
- It prevents users from accidentally aggregating incorrectly through joins.

These differences are described in the sections below.

#### Using join relationships in queries

If a `table` has join relationships declared in it, a `select` query on that table can leverage that join without needing to write its own join statement. This is helpful for query writers who have not memorized all the correct join keys.

If you recall the model from before:

```sql
table orders (
  ...
  user_id BIGINT,
  join_one users on user_id = users.id
)

table users (
  id BIGINT primary_key,
  name VARCHAR,
  ...
)
```

We can write a query that leverages the modeled join relationship between `orders` and `users`:


```sql
-- Top 10 customers by order count
select
  users.name, -- Use the dot operator to traverse the modeled join relationship
  count(*)
from orders -- A join statement here is not needed
group by 1
order by 2 desc
limit 10
```

##### Multi-hop joins

Sometimes you need to access columns or stored expressions in a table that is two or more joins away from the `from` table. To do this, simply use more dot operators to trace the desired join path. For example, say there is another table added to our project, `countries`:

```sql
table orders (
  ...

  join_one users on user_id = users.id
)

table users (
  ...

  join_many orders on id = orders.user_id,
  join_one country on country_code = countries.code
)

table countries (
  code VARCHAR primary_key,
  name VARCHAR,
  currency VARCHAR,
  free_shipping BOOLEAN,

  join_many users on code = users.country_code
)
```

We can write the following query to show the top ten countries by order count:

```sql
-- Top 10 countries by order count
select
  users.countries.name, -- Orders -> Users -> Countries
  count(*)
from orders
group by 1
order by 2 desc
limit 10
```

#### Using stored expressions in queries

A stored expression can be invoked in a query by simply referencing it by name.

Again, using the orders table from before:

```sql
table orders (
  id BIGINT primary_key,
  user_id BIGINT,
  created_at DATETIME,
  status STRING, -- One of 'Processing', 'Shipped', 'Complete', 'Cancelled', 'Returned'
  amount FLOAT, -- Amount paid by customer
  cost FLOAT, -- Cost of materials

  join_one users on user_id = users.id,

  status in ('Processing', 'Shipped', 'Complete') as revenue_recognized,

  sum(case when revenue_recognized then amount else 0 end) as revenue,
  sum(case when revenue_recognized then cost else 0 end) as cogs,
  revenue - cogs as profit,
  profit / revenue as profit_margin
)
```

We can count the number of orders that were revenue-recognized vs. not:

```sql
-- Number of revenue-recognized orders vs. not
select
  revenue_recognized, -- Stored expression in orders
  count(*)
from orders
group by 1
```

This would be equivalent to:

```sql
select
  status in ('Processing', 'Shipped', 'Complete') as revenue_recognized,
  count(*)
from orders
group by 1 
```

You can see that invoking a stored expression is like using a macro: the definition for the stored expression is effectively expanded in-line by Graphene when it runs the query.

This is an important concept to understand when invoking stored expressions that are **aggregative** (ie. contain agg functions). Here's an example.

```sql
-- Profit by month
select
  date_trunc(created_at, month) as month,
  profit
from orders
group by 1
order by 1 asc
```

Note that, while `profit` looks like a column here, it is _not_ a column. That's because this query is equivalent to:

```sql
select
  date_trunc(created_at, month) as month,
  sum(case when revenue_recognized then amount else 0 end) - sum(case when revenue_recognized then cost else 0 end) as profit -- Profit is defined as revenue - cogs, which respectively expands out to these two filtered sums
from orders
group by 1
order by 1 asc
```

For this reason, in a query you would never wrap an aggregative stored expression in a `sum()` or `avg()` or any other agg function for the same reason you would never write `sum(sum(foo))` in SQL. That would throw an error!

#### Safe aggregation in fan-outs

A common and dangerous user error in regular SQL is aggregating data incorrectly after joining tables. This can happen when rows of one table match multiple rows of another, and effectively get duplicated for each match.

For example, after joining `users` to `orders`, your joined result will have some users repeated multiple times if they've made multiple purchases. If you wanted to find the average age of customers over this joined result, simply using an `avg(users.age)` would be _incorrect_, because you would be weighting the average towards users with multiple purchases, rather than taking the true average.

GSQL aims to solve this problem. With the additional information provided via `join_one` and `join_many`, Graphene knows under which scenarios when row dupliation occurs, and will rewrite aggregative expressions in a way that ignores the duplicate rows.

The query `select avg(users.age) from orders` will be rewritten to the following SQL when Graphene queries the underlying database (this is for BigQuery, specifically):

```sql
SELECT 
   (CAST((
    (
      SUM(DISTINCT
        (CAST(ROUND(COALESCE(users_0.`age`,0)*(1*1.0), 9) AS NUMERIC) +
        (cast(cast(concat('0x', substr(to_hex(md5(CAST(users_0.`id` AS STRING))), 1, 15)) as int64) as numeric) * 4294967296 + cast(cast(concat('0x', substr(to_hex(md5(CAST(users_0.`id` AS STRING))), 16, 8)) as int64) as numeric)) * 0.000000001
      ))
      -
       SUM(DISTINCT (cast(cast(concat('0x', substr(to_hex(md5(CAST(users_0.`id` AS STRING))), 1, 15)) as int64) as numeric) * 4294967296 + cast(cast(concat('0x', substr(to_hex(md5(CAST(users_0.`id` AS STRING))), 16, 8)) as int64) as numeric)) * 0.000000001)
    )/(1*1.0)) AS FLOAT64))/NULLIF(COUNT(DISTINCT CASE WHEN users_0.`age` IS NOT NULL THEN users_0.`id` END),0) as `col_0`
FROM `bigquery-public-data.thelook_ecommerce.orders` as base
 LEFT JOIN `bigquery-public-data.thelook_ecommerce.users` AS users_0
  ON users_0.`id`=base.`user_id`
```

You don't have to understand this; the point is that GSQL is minimizing the chances that naive users aggregate data incorrectly.

### `table as` statements

You can turn the output of any `select` statement into a table with `table foo as (select ...)`. Here's an example of an additional table `user_facts` added to the two tables from earlier:

```sql
table orders (
  id BIGINT primary_key,
  user_id BIGINT,
  created_at DATETIME,
  status STRING, -- One of 'Processing', 'Shipped', 'Complete', 'Cancelled', 'Returned'
  amount FLOAT, -- Amount paid by customer
  cost FLOAT, -- Cost of materials

  join_one users on user_id = users.id,

  status in ('Processing', 'Shipped', 'Complete') as revenue_recognized,

  sum(case when revenue_recognized then amount else 0 end) as revenue,
  sum(case when revenue_recognized then cost else 0 end) as cogs,
  revenue - cogs as profit,
  profit / revenue as profit_margin
)

table users (
  id BIGINT primary_key,
  name VARCHAR,
  email VARCHAR,
  age INTEGER,

  join_many orders on id = orders.user_id,
  join_one user_facts on id = user_facts.id,

  /* Scalar expressions */

  user_facts.ltv as ltv,
  user_facts.lifetime_orders as lifetime_orders
)

table user_facts as (
  select
    id,
    orders.revenue as ltv,
    count(orders.id) as lifetime_orders,
  from users
  group by id
)
```

`table as` statements are conceptually the same as view tables in regular SQL. A few things to note:
- You cannot yet declare join relationships or stored expressions directly in a `table as` statement. Other tables can declare join relationships to it, though, as shown above.
- In the example above, the `ltv` and `lifetime_orders` columns from `user_facts` are "hoisted" back into `users` so that they appear as if they are columns from `users`. This is simply a design choice which allows query writers to never need to know about `user_facts`.

### Other miscellaneous details about GSQL

- Trailing commas in `table` statements are optional.
- Trailing semicolons after `table` and `table as` statements are optional.
- The clauses in a `select` statement (`select`, `from`, `join`, `group by`, etc.) can be written in any order. They cannot be repeated, however.
- `group by all` is implied if aggregative and scalar expressions are both present in the `select` clause. This means that `group by` can be omitted and the query will still effectively execute the `group by all`.
- Expressions in `group by` are implicitly selected, so `from orders select avg(amount) group by user_id` will return two columns.
- `count` is a reserved word. Do not alias your columns as `count`.
- Window functions and set operations are not supported.

## Graphene data apps (dashboards)

Graphene data apps are written in Markdown with the addition of special Graphene HTML components. Markdown files can contain named GSQL queries in code fences that components can then refer to. Those queries can use any tables defined in .gsql files.

_my_first_dashboard.md_
````md
# Order analysis

Looking at our order breakdowns.

```sql orders_by_month
select
  date_trunc(created_at, month) as month,
  count(*) as num_orders,
  profit
from orders
group by month
```

<Row>
  <LineChart title="Orders by Month" data=orders_by_month x=month y=num_orders />
  <LineChart title="Profit by Month, USD" data=orders x="date_trunc(created_at, month)" y=profit />
</Row>
````

Syntax notes
- The `data` attribute can also refer directly to modeled GSQL tables instead of code-fenced queries.
- Attributes that take column references can also take whole GSQL expressions, as shown in the second line chart from the example above.
- Like in HTML, the string value assigned to an attribute does not need to be wrapped in double quotes if it only contains alphanumeric characters, `-`, `_`, `:`, or `.`.

Best practices
- If you have multiple time series charts, align their x-axes to have the same range and granularity.
- Use the same color for a given metric if it is used in multiple charts.

### Visualization components

#### Bar chart

Use bar or column charts to compare a metric across categories. Bar charts are best with a small number of categories and series, and should generally start at 0.

Here's an example:

```markdown
<BarChart 
  title="Sales by Category"
  data=orders_by_category_2021
  x=month
  y=sales
  series=category
/>
```

##### All bar chart attributes

###### General

| Attribute | Description | Options | Default |
|----------|-------------|---------|---------|
| title | Chart title. Appears at top left of chart. | string | - |
| subtitle | Chart subtitle. Appears just under title. | string | - |
| legend | Turns legend on or off. Legend appears at top center of chart. | `true`, `false` | `true` for multiple series |
| chartAreaHeight | Minimum height of the chart area (excl. header and footer) in pixels. Adjusting the height affects all viewport sizes and may impact the mobile UX. | number | `180` |
| renderer | Which chart renderer type (canvas or SVG) to use. See ECharts' documentation on renderers. | `canvas`, `svg` | `canvas` |
| downloadableData | Whether to show the download button to allow users to download the data | `true`, `false` | `true` |
| downloadableImage | Whether to show the button to allow users to save the chart as an image | `true`, `false` | `true` |

###### Data

| Attribute | Description | Required | Options | Default |
|----------|-------------|----------|---------|---------|
| data | Query name, wrapped in curly braces | true | query name | - |
| x | Column or expression to use for the x-axis of the chart | false | column name, stored expression name, GSQL expression | First column |
| y | Column(s) or expression(s) to use for the y-axis of the chart | false | column name, stored expression name, GSQL expression, list of any combination of these | Any non-assigned numeric columns |
| y2 | Column(s) or expression(s) to include on a secondary y-axis | false | column name, stored expression name, GSQL expression, list of any combination of these | - |
| y2SeriesType | Chart type to apply to the series on the y2 axis | false | `bar`, `line`, `scatter` | `bar` |
| series | Column or expression to use as the series (groups) in a multi-series chart | false | column name, stored expression name, GSQL expression | - |
| sort | Whether to apply default sort to your data. Default sort is x ascending for number and date x-axes, and y descending for category x-axes | false | `true`, `false` | `true` |
| type | Grouping method to use for multi-series charts | false | `stacked`, `grouped`, `stacked100` | `stacked` |
| stackName | Name for an individual stack. If separate Bar components are used with different stackNames, the chart will show multiple stacks | false | string | - |
| emptySet | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. | false | `error`, `warn`, `pass` | `error` |
| emptyMessage | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). | false | string | No records |

###### Formatting & Styling

| Attribute | Description | Options | Default |
|----------|-------------|---------|---------|
| xFmt | Format to use for x column ([see available formats](#value-formatting)) | Excel-style format, built-in format name | - |
| yFmt | Format to use for y column ([see available formats](#value-formatting)) | Excel-style format, built-in format name | - |
| y2Fmt | Format to use for y2 column(s) ([see available formats](#value-formatting)) | Excel-style format, built-in format name | - |
| seriesLabelFmt | Format to use for series label ([see available formats](#value-formatting)) | Excel-style format, built-in format name | - |
| fillColor | Color to override default series color. Only accepts a single color. | CSS name, hexademical, RGB, HSL | - |
| fillOpacity | % of the full color that should be rendered, with remainder being transparent | number (0 to 1) | `1` |
| outlineWidth | Width of line surrounding each bar | number | `0` |
| outlineColor | Color to use for outline if outlineWidth > 0 | CSS name, hexademical, RGB, HSL | - |
| colorPalette | List of custom colors to use for the chart | list of color strings (CSS name, hexademical, RGB, HSL) e.g. `"#cf0d06, #eb5752, #e88a87"` | built-in color palette |
| seriesOrder | Apply a specific order to the series in a multi-series chart. | list of series names in the order they should be used in the chart `"Canada, US"` | default order implied by the data |
| leftPadding | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off | number | - |
| rightPadding | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off | number | - |
| xLabelWrap | Whether to wrap x-axis labels when there is not enough space. Default behaviour is to truncate the labels. | `true`, `false` | `false` |

###### Value Labels

| Attribute | Description | Options | Default |
|----------|-------------|---------|---------|
| labels | Show value labels | `true`, `false` | `false` |
| stackTotalLabel | If using labels, whether to show a total at the top of stacked bar chart | `true`, `false` | `true` |
| seriesLabels | If using labels, whether to show series labels | `true`, `false` | `true` |
| labelSize | Font size of value labels | number | `11` |
| labelPosition | Where label will appear on your series | `outside`, `inside` | Single Series: `outside`, Stacked: `inside`, Grouped: `outside` |
| labelColor | Font color of value labels | CSS name, hexademical, RGB, HSL | Automatic based on color contrast of background |
| labelFmt | Format to use for value labels ([see available formats](#value-formatting)) | Excel-style format, built-in format name | same as y column |
| yLabelFmt | Format to use for value labels for series on the y axis. Overrides any other formats ([see available formats](#value-formatting)) | Excel-style format, built-in format name | - |
| y2LabelFmt | Format to use for value labels for series on the y2 axis. Overrides any other formats ([see available formats](#value-formatting)) | Excel-style format, built-in format name | - |
| showAllLabels | Allow all labels to appear on chart, including overlapping labels | `true`, `false` | `false` |

###### Axes

| Attribute | Description | Options | Default |
|----------|-------------|---------|---------|
| swapXY | Swap the x and y axes to create a horizontal chart | `true`, `false` | `false` |
| yLog | Whether to use a log scale for the y-axis | `true`, `false` | `false` |
| yLogBase | Base to use when log scale is enabled | number | `10` |
| xAxisTitle | Name to show under x-axis. If 'true', formatted column name is used. Only works with swapXY=false | string, `true`, `false` | `false` |
| yAxisTitle | Name to show beside y-axis. If 'true', formatted column name is used. | string, `true`, `false` | `false` |
| y2AxisTitle | Name to show beside y2 axis. If 'true', formatted column name is used. | string, `true`, `false` | `false` |
| xGridlines | Turns on/off gridlines extending from x-axis tick marks (vertical lines when swapXY=false) | `true`, `false` | `false` |
| yGridlines | Turns on/off gridlines extending from y-axis tick marks (horizontal lines when swapXY=false) | `true`, `false` | `true` |
| y2Gridlines | Turns on/off gridlines extending from y2-axis tick marks (horizontal lines when swapXY=false) | `true`, `false` | `true` |
| xAxisLabels | Turns on/off value labels on the x-axis | `true`, `false` | `true` |
| yAxisLabels | Turns on/off value labels on the y-axis | `true`, `false` | `true` |
| y2AxisLabels | Turns on/off value labels on the y2-axis | `true`, `false` | `true` |
| xBaseline | Turns on/off thick axis line (line appears at y=0) | `true`, `false` | `true` |
| yBaseline | Turns on/off thick axis line (line appears directly alongside the y-axis labels) | `true`, `false` | `false` |
| y2Baseline | Turns on/off thick axis line (line appears directly alongside the y2-axis labels) | `true`, `false` | `false` |
| xTickMarks | Turns on/off tick marks for each of the x-axis labels | `true`, `false` | `false` |
| yTickMarks | Turns on/off tick marks for each of the y-axis labels | `true`, `false` | `false` |
| y2TickMarks | Turns on/off tick marks for each of the y2-axis labels | `true`, `false` | `false` |
| yMin | Starting value for the y-axis | number | - |
| yMax | Maximum value for the y-axis | number | - |
| yScale | Whether to scale the y-axis to fit your data. `yMin` and `yMax` take precedence over `yScale` | `true`, `false` | `false` |
| y2Min | Starting value for the y2-axis | number | - |
| y2Max | Maximum value for the y2-axis | number | - |
| y2Scale | Whether to scale the y-axis to fit your data. `y2Min` and `y2Max` take precedence over `y2Scale` | `true`, `false` | `false` |
| yAxisColor | Turns on/off color on the y-axis (turned on by default when secondary y-axis is used). Can also be used to set a specific color | `true`, `false`, color string (CSS name, hexademical, RGB, HSL) | `true` when y2 used; `false` otherwise |

###### Interactivity

| Attribute | Description | Options |
|----------|-------------|---------|
| connectGroup | Group name to connect this chart to other charts for synchronized tooltip hovering. Charts with the same `connectGroup` name will become connected | string |

#### Pie chart

Use a pie chart to show part-to-whole relationships across categories. Best for a small number of categories where proportions are easy to compare.

Here's an example:

```markdown
<PieChart 
  title="Sales share by category"
  data=orders_by_category_2021
  category=category
  value=sales
/>
```

##### All pie chart attributes

###### General

| Attribute | Description | Options | Default |
|----------|-------------|---------|---------|
| title | Chart title. Appears at top left of chart. | string | - |
| subtitle | Chart subtitle. Appears just under title. | string | - |

###### Data

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | Query name, wrapped in curly braces | true | query name | - |
| category | Column or expression to use for slice names | true | column name, stored expression name, GSQL expression | - |
| value | Column or expression to use for slice values | true | column name, stored expression name, GSQL expression | - |

#### Line chart

Use line charts to display how one or more metrics vary over time. Line charts are suitable for plotting a large number of data points on the same chart.

Here's an example:

```markdown
<LineChart 
  title="Monthly Sales"
  subtitle="Includes all categories"
  data=orders_by_month
  x=month
  y=sales_usd0k 
  yAxisTitle="Sales per Month"
/>
```

##### All line chart attributes

###### General

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| title | Chart title. Appears at top left of chart. | false | string | - |
| subtitle | Chart subtitle. Appears just under title. | false | string | - |
| legend | Turn legend on or off. Legend appears at top center of chart. | false | `true`, `false` | `true` for multiple series |
| chartAreaHeight | Minimum height of the chart area (excl. header and footer) in pixels. Adjusting the height affects all viewport sizes and may impact the mobile UX. | false | number | `180` |
| renderer | Which chart renderer type (canvas or SVG) to use. See ECharts' [documentation on renderers](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/). | false | `canvas`, `svg` | `canvas` |
| downloadableData | Whether to show the download button to allow users to download the data | false | `true`, `false` | `true` |
| downloadableImage | Whether to show the button to allow users to save the chart as an image | false | `true`, `false` | `true` |

###### Data

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | Query name, wrapped in curly braces | true | query name | - |
| x | Column or expression to use for the x-axis of the chart | true | column name, stored expression name, GSQL expression | - |
| y | Column(s) or expression(s) to use for the y-axis of the chart | true | column name, stored expression name, GSQL expression, list of any combination of these | - |
| y2 | Column(s) or expression(s) to include on a secondary y-axis | false | column name, stored expression name, GSQL expression, list of any combination of these | - |
| y2SeriesType | Chart type to apply to the series on the y2 axis | false | `line`, `bar`, `scatter` | `line` |
| series | Column or expression to use as the series (groups) in a multi-series chart | false | column name, stored expression name, GSQL expression | - |
| sort | Whether to apply default sort to your data. Default is x ascending for number and date x-axes, and y descending for category x-axes | false | `true`, `false` | `true` |
| handleMissing | Treatment of missing values in the dataset | false | `gap`, `connect`, `zero` | `gap` |
| emptySet | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. | false | `error`, `warn`, `pass` | `error` |
| emptyMessage | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). | false | string | - |

###### Formatting & Styling

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| xFmt | Format to use for x column ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| yFmt | Format to use for y column(s) ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| y2Fmt | Format to use for y2 column(s) ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| seriesLabelFmt | Format to use for series label ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| step | Specifies whether the chart is displayed as a step line | false | `true`, `false` | `false` |
| stepPosition | Configures the position of turn points for a step line chart | false | `start`, `middle`, `end` | `end` |
| lineColor | Color to override default series color. Only accepts a single color | false | CSS name, hexademical, RGB, HSL | - |
| lineOpacity | % of the full color that should be rendered, with remainder being transparent | false | number (0 to 1) | `1` |
| lineType | Options to show breaks in a line (dashed or dotted) | false | `solid`, `dashed`, `dotted` | `solid` |
| lineWidth | Thickness of line (in pixels) | false | number | `2` |
| markers | Turn on/off markers (shapes rendered onto the points of a line) | false | `true`, `false` | `false` |
| markerShape | Shape to use if markers=true | false | `circle`, `emptyCircle`, `rect`, `triangle`, `diamond` | `circle` |
| markerSize | Size of each shape (in pixels) | false | number | `8` |
| colorPalette | List of custom colors to use for the chart | false | list of color strings (CSS name, hexademical, RGB, HSL) e.g. `"#cf0d06, #eb5752, #e88a87"` | - |
| seriesOrder | Apply a specific order to the series in a multi-series chart. | false | list of series names in the order they should be used in the chart `"Canada, US"` | default order implied by the data |
| labels | Show value labels | false | `true`, `false` | `false` |
| labelSize | Font size of value labels | false | number | `11` |
| labelPosition | Where label will appear on your series | false | `above`, `middle`, `below` | `above` |
| labelColor | Font color of value labels | false | CSS name, hexademical, RGB, HSL | - |
| labelFmt | Format to use for value labels ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| yLabelFmt | Format to use for value labels for series on the y axis. Overrides any other formats ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| y2LabelFmt | Format to use for value labels for series on the y2 axis. Overrides any other formats ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| showAllLabels | Allow all labels to appear on chart, including overlapping labels | false | `true`, `false` | `false` |
| leftPadding | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off | false | number | - |
| rightPadding | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off | false | number | - |
| xLabelWrap | Whether to wrap x-axis labels when there is not enough space. Default behaviour is to truncate the labels. | false | `true`, `false` | `false` |

###### Axes

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| yLog | Whether to use a log scale for the y-axis | false | `true`, `false` | `false` |
| yLogBase | Base to use when log scale is enabled | false | number | `10` |
| xAxisTitle | Name to show under x-axis. If 'true', formatted column name is used. Only works with swapXY=false | false | `true`, `string`, `false` | `false` |
| yAxisTitle | Name to show beside y-axis. If 'true', formatted column name is used. | false | `true`, `string`, `false` | `false` |
| y2AxisTitle | Name to show beside y2 axis. If 'true', formatted column name is used. | false | `true`, `string`, `false` | `false` |
| xGridlines | Turns on/off gridlines extending from x-axis tick marks (vertical lines when swapXY=false) | false | `true`, `false` | `false` |
| yGridlines | Turns on/off gridlines extending from y-axis tick marks (horizontal lines when swapXY=false) | false | `true`, `false` | `true` |
| y2Gridlines | Turns on/off gridlines extending from y2-axis tick marks (horizontal lines when swapXY=false) | false | `true`, `false` | `true` |
| xAxisLabels | Turns on/off value labels on the x-axis | false | `true`, `false` | `true` |
| yAxisLabels | Turns on/off value labels on the y-axis | false | `true`, `false` | `true` |
| y2AxisLabels | Turns on/off value labels on the y2-axis | false | `true`, `false` | `true` |
| xBaseline | Turns on/off thick axis line (line appears at y=0) | false | `true`, `false` | `true` |
| yBaseline | Turns on/off thick axis line (line appears directly alongside the y-axis labels) | false | `true`, `false` | `false` |
| y2Baseline | Turns on/off thick axis line (line appears directly alongside the y2-axis labels) | false | `true`, `false` | `false` |
| xTickMarks | Turns on/off tick marks for each of the x-axis labels | false | `true`, `false` | `false` |
| yTickMarks | Turns on/off tick marks for each of the y-axis labels | false | `true`, `false` | `false` |
| y2TickMarks | Turns on/off tick marks for each of the y2-axis labels | false | `true`, `false` | `false` |
| yMin | Starting value for the y-axis | false | number | - |
| yMax | Maximum value for the y-axis | false | number | - |
| yScale | Whether to scale the y-axis to fit your data. `yMin` and `yMax` take precedence over `yScale` | false | `true`, `false` | `false` |
| y2Min | Starting value for the y2-axis | false | number | - |
| y2Max | Maximum value for the y2-axis | false | number | - |
| y2Scale | Whether to scale the y-axis to fit your data. `y2Min` and `y2Max` take precedence over `y2Scale` | false | `true`, `false` | `false` |

###### Interactivity

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| connectGroup | Group name to connect this chart to other charts for synchronized tooltip hovering. Charts with the same `connectGroup` name will become connected | false | - | - |


#### Area chart

Use area charts to track how a metric with multiple series changes over time, or a continuous range. Area charts emphasize changes in the sum of series over the individual series.

Here's an example:

```markdown
<AreaChart 
  data=orders_by_month
  x=month
  y=sales
/>
```

##### All area chart attributes

###### General

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| title | Chart title. Appears at top left of chart. | false | string | - |
| subtitle | Chart subtitle. Appears just under title. | false | string | - |
| legend | Turn legend on or off. Legend appears at top center of chart. | false | `true`, `false` | `true` for multiple series |
| chartAreaHeight | Minimum height of the chart area (excl. header and footer) in pixels. Adjusting the height affects all viewport sizes and may impact the mobile UX. | false | number | `180` |
| renderer | Which chart renderer type (canvas or SVG) to use. See ECharts' [documentation on renderers](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/). | false | `canvas`, `svg` | `canvas` |
| downloadableData | Whether to show the download button to allow users to download the data | false | `true`, `false` | `true` |
| downloadableImage | Whether to show the button to allow users to save the chart as an image | false | `true`, `false` | `true` |

###### Data

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | Query name, wrapped in curly braces | true | query name | - |
| x | Column or expression to use for the x-axis of the chart | true | column name, stored expression name, GSQL expression | First column |
| y | Column(s) or expression(s) to use for the y-axis of the chart | true | column name, stored expression name, GSQL expression, list of any combination of these | Any non-assigned numeric columns |
| series | Column or expression to use as the series (groups) in a multi-series chart | false | column name, stored expression name, GSQL expression | - |
| sort | Whether to apply default sort to your data. Default sort is x ascending for number and date x-axes, and y descending for category x-axes | false | `true`, `false` | `true` |
| type | Grouping method to use for multi-series charts | false | `stacked`, `stacked100` | `stacked` |
| handleMissing | Treatment of missing values in the dataset | false | `gap`, `connect`, `zero` | `gap` for single series, `zero` for multi-series |
| emptySet | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. | false | `error`, `warn`, `pass` | `error` |
| emptyMessage | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). | false | string | "No records" |

###### Formatting & Styling

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| xFmt | Format to use for x column ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| yFmt | Format to use for y column ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| seriesLabelFmt | Format to use for series label ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| step | Specifies whether the chart is displayed as a step line | false | `true`, `false` | `false` |
| stepPosition | Configures the position of turn points for a step line chart | false | `start`, `middle`, `end` | `end` |
| fillColor | Color to override default series color. Only accepts a single color. | false | CSS name, hexademical, RGB, HSL | - |
| lineColor | Color to override default line color. Only accepts a single color. | false | CSS name, hexademical, RGB, HSL | - |
| fillOpacity | % of the full color that should be rendered, with remainder being transparent | false | number (0 to 1) | `0.7` |
| line | Show line on top of the area | false | `true`, `false` | `true` |
| colorPalette | List of custom colors to use for the chart | false | list of color strings (CSS name, hexademical, RGB, HSL) e.g. `"#cf0d06, #eb5752, #e88a87"` | built-in color palette |
| seriesOrder | Apply a specific order to the series in a multi-series chart. | false | list of series names in the order they should be used in the chart `"Canada, US"` | default order implied by the data |
| leftPadding | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off | false | number | - |
| rightPadding | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off | false | number | - |
| xLabelWrap | Whether to wrap x-axis labels when there is not enough space. Default behaviour is to truncate the labels. | false | `true`, `false` | `false` |

###### Value Labels

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| labels | Show value labels | false | `true`, `false` | `false` |
| labelSize | Font size of value labels | false | number | `11` |
| labelPosition | Where label will appear on your series | false | `above`, `middle`, `below` | `above` |
| labelColor | Font color of value labels | false | CSS name, hexademical, RGB, HSL | Automatic based on color contrast of background |
| labelFmt | Format to use for value labels ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | same as y column |
| showAllLabels | Allow all labels to appear on chart, including overlapping labels | false | `true`, `false` | `false` |

###### Axes

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| yLog | Whether to use a log scale for the y-axis | false | `true`, `false` | `false` |
| yLogBase | Base to use when log scale is enabled | false | number | `10` |
| xAxisTitle | Name to show under x-axis. If 'true', formatted column name is used. Only works with swapXY=false | false | `true`, `string`, `false` | `false` |
| yAxisTitle | Name to show beside y-axis. If 'true', formatted column name is used. | false | `true`, `string`, `false` | `false` |
| xGridlines | Turns on/off gridlines extending from x-axis tick marks (vertical lines when swapXY=false) | false | `true`, `false` | `false` |
| yGridlines | Turns on/off gridlines extending from y-axis tick marks (horizontal lines when swapXY=false) | false | `true`, `false` | `true` |
| xAxisLabels | Turns on/off value labels on the x-axis | false | `true`, `false` | `true` |
| yAxisLabels | Turns on/off value labels on the y-axis | false | `true`, `false` | `true` |
| xBaseline | Turns on/off thick axis line (line appears at y=0) | false | `true`, `false` | `true` |
| yBaseline | Turns on/off thick axis line (line appears directly alongside the y-axis labels) | false | `true`, `false` | `false` |
| xTickMarks | Turns on/off tick marks for each of the x-axis labels | false | `true`, `false` | `false` |
| yTickMarks | Turns on/off tick marks for each of the y-axis labels | false | `true`, `false` | `false` |
| yMin | Starting value for the y-axis | false | number | - |
| yMax | Maximum value for the y-axis | false | number | - |
| yScale | Whether to scale the y-axis to fit your data. `yMin` and `yMax` take precedence over `yScale` | false | `true`, `false` | `false` |

###### Interactivity

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| connectGroup | Group name to connect this chart to other charts for synchronized tooltip hovering. Charts with the same `connectGroup` name will become connected | false | - | - |


#### Big value

Use big values to display a large value standalone, and optionally include a comparison and a sparkline.

Here's an example:

```markdown
<BigValue 
  data=orders_with_comparisons 
  value=num_orders
  sparkline=month
  comparison=order_growth
  comparisonFmt=pct1
  comparisonTitle="vs. Last Month"
/>
```

##### All big value attributes

###### Data

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | Query name, wrapped in curly braces | true | query name | - |
| value | Column or expression to pull the main value from. | true | column name, stored expression name, GSQL expression | - |
| title | Title of the card. | false | string | Title of the value column. |
| minWidth | Overrides min-width of component | false | % or px value | `"18%"` |
| maxWidth | Adds a max-width to the component | false | % or px value | - |
| fmt | Sets format for the value ([see available formats](#value-formatting)) | false | Excel-style format, built-in format | - |
| emptySet | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. | false | `error`, `warn`, `pass` | `error` |
| emptyMessage | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). | false | string | `"No records"` |
| link | Used to navigate to other pages. Can be a full external link like `"https://google.com"` or an internal link like `"/sales/performance"` | false | - | - |

###### Comparison

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| comparison | Column or expression to pull the comparison value from. | false | column name, stored expression name, GSQL expression | - |
| comparisonTitle | Text to the right of the comparison. | false | string | Title of the comparison column. |
| comparisonDelta | Whether to display delta symbol and color | false | `true`, `false` | `true` |
| downIsGood | If present, negative comparison values appear in green, and positive values appear in red. | false | `true`, `false` | `false` |
| neutralMin | Sets the bottom of the range for 'neutral' values - neutral values appear in grey rather than red or green | false | number | `0` |
| neutralMax | Sets the top of the range for 'neutral' values - neutral values appear in grey rather than red or green | false | number | `0` |
| comparisonFmt | Sets format for the comparison ([see available formats](#value-formatting)) | false | Excel-style format, built-in format | - |

###### Sparkline

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| sparkline | Column or expression to pull the date from to create the sparkline. | false | column name, stored expression name, GSQL expression | - |
| sparklineType | Chart type for sparkline | false | `line`, `area`, `bar` | `line` |
| sparklineValueFmt | Formatting for tooltip values | false | format code | same as fmt if supplied |
| sparklineDateFmt | Formatting for tooltip dates | false | format code | `YYYY-MM-DD` |
| sparklineColor | Color of visualization | false | CSS name, hexademical, RGB, HSL | - |
| sparklineYScale | Whether to truncate the y-axis of the chart to enhance visibility | false | `true`, `false` | `false` |
| connectGroup | Group name to connect this sparkline to other charts for synchronized tooltip hovering. Charts with the same `connectGroup` name will become connected | false | string | - |
| description | Adds an info icon with description tooltip on hover | false | string | - |

#### Table

Use a Table component to display a richly formatted table of data from a query. Tables are powerful default choice for data display that allow high information density, and are easy to read.

Here's an example:

```markdown
<Table data=orders_summary />
```

##### All table attributes

###### Table

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | Query name, wrapped in curly braces | true | query name | - |
| rows | Number of rows to show in the table before paginating results. Use `"rows=all"` to show all rows in the table. | false | number, `all` | `10` |
| title | Title for the table | false | string | - |
| subtitle | Subtitle - appears under the title | false | string | - |
| headerColor | Background color of the header row | false | Hex color code, css color name | - |
| headerFontColor | Font color of the header row | false | Hex color code, css color name | - |
| totalRow | Show a total row at the bottom of the table, defaults to sum of all numeric columns | false | `true`, `false` | `false` |
| totalRowColor | Background color of the total row | false | Hex color code, css color name | - |
| totalFontColor | Font color of the total row | false | Hex color code, css color name | - |
| rowNumbers | Turns on or off row index numbers | false | `true`, `false` | `false` |
| rowLines | Turns on or off borders at the bottom of each row | false | `true`, `false` | `true` |
| rowShading | Shades every second row in light grey | false | `true`, `false` | `false` |
| backgroundColor | Background color of the table | false | Hex color code, css color name | - |
| sortable | Enable sort for each column - click the column title to sort | false | `true`, `false` | `true` |
| sort | Column to sort by on initial page load. Sort direction is asc if unspecified. Can only sort by one column using this prop. If you need multi-column sort, use the order by clause in your sql in combination with this prop. | false | 'column name + asc/desc' | - |
| search | Add a search bar to the top of your table | false | `true`, `false` | `false` |
| downloadable | Enable download data button below the table on hover | false | `true`, `false` | `true` |
| formatColumnTitles | Enable auto-formatting of column titles. Turn off to show raw SQL column names | false | `true`, `false` | `true` |
| wrapTitles | Wrap column titles | false | `true`, `false` | `false` |
| compact | Enable a more compact table view that allows more content vertically and horizontally | false | `true`, `false` | `false` |
| link | Makes each row of your table a clickable link. Accepts a column or expression containing the link to use for each row in your table | false | column name, stored expression name, GSQL expression | - |
| showLinkCol | Whether to show the column supplied to the `link` attribute | false | `true`, `false` | `false` |
| generateMarkdown | Helper for writing Table syntax with many columns. When set to true, markdown for the Table including each `Column` contained within the query will be generated and displayed below the table. | false | `true`, `false` | `false` |
| emptySet | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. | false | `error`, `warn`, `pass` | `error` |
| emptyMessage | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). | false | string | "No records" |

###### Groups

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| groupBy | Column or expression to use to create groups. Note that groups are currently limited to a single group column. | false | column name, stored expression name, GSQL expression | - |
| groupType | How the groups are shown in the table. Can be accordion (expand/collapse) or section (group column values are merged across rows) | false | `accordion`, `section` | `accordion` |
| subtotals | Whether to show aggregated totals for the groups | false | `true`, `false` | `false` |
| subtotalFmt | Specify an override format to use in the subtotal row ([see available formats](#value-formatting)). Custom strings or values are unformatted by default. | false | Excel-style format, built-in format | - |
| groupsOpen | [groupType=accordion] Whether to show the accordions as open on page load | false | `true`, `false` | `true` |
| accordionRowColor | [groupType=accordion] Background color for the accordion row | false | Hex color code, css color name | - |
| subtotalRowColor | [groupType=section] Background color for the subtotal row | false | Hex color code, css color name | - |
| subtotalFontColor | [groupType=section] Font color for the subtotal row | false | Hex color code, css color name | - |
| groupNamePosition | [groupType=section] Where the group label will appear in its cell | false | `top`, `middle`, `bottom` | `middle` |

###### Column

Use the Column sub-component to choose specific columns to display in your table, and to apply options to specific columns. If you don't supply any columns to the table, it will display all columns from your query result.

Here's an example:

```markdown
<Table data=country_summary>
  <Column id=country />
  <Column id=category />
  <Column id=value_usd fmt=eur />
  <Column id=yoy title="Y/Y Growth" fmt=pct3 />
</Table>
```

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| id | Column id (from SQL query) | true | column name | - |
| title | Override title of column | false | string | column name (formatted) |
| description | Adds an info icon with description tooltip on hover | false | string | - |
| align | Align column text | false | `left`, `center`, `right` | `left` |
| fmt | Format the values in the column ([see available formats](#value-formatting)) | false | Excel-style format, built-in format | - |
| fmtColumn | Column to use to format values in this column. This is used to achieve different value formats by row. The fmtColumn should contain strings of format codes - either Graphene built-in formats or Excel codes. | false | column name | - |
| totalAgg | Specify an aggregation function to use for the total row. Accepts predefined functions, custom strings or values | false | `sum`, `mean`, `weightedMean`, `median`, `min`, `max`, `count`, `countDistinct`, custom string or value | `sum` |
| totalFmt | Specify an override format to use in the total row ([see available formats](#value-formatting)). Custom strings or values are unformatted by default. | false | Excel-style format, built-in format | - |
| weightCol | Column or expression to use as the weight values for weighted mean aggregation. If not specified, a weight of 1 for each value will be used and the result will be the same as the `mean` aggregation. | false | column name, stored expression name, GSQL expression | - |
| wrap | Wrap column text | false | `true`, `false` | `false` |
| wrapTitle | Wrap column title | false | `true`, `false` | `false` |
| contentType | Lets you specify how to treat the content within a column. See below for contentType-specific options. | false | `link`, `image`, `delta`, `colorscale`, `html` | - |
| colGroup | Group name to display above a group of columns. Columns with the same group name will get a shared header above them | false | string | - |
| redNegatives | Conditionally sets the font color to red based on whether the selected value is less than 0 | false | `true`, `false` | `false` |

Column attributes for specific contentTypes:

Images (`contentType=image`)

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| height | Height of image in pixels | false | number | original height of image |
| width | Width of image in pixels | false | number | original width of image |
| alt | Alt text for image | false | column name | Name of the image file (excluding the file extension) |

Links (`contentType=link`)

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| linkLabel | Text to display for link | false | column name, string | raw url |
| openInNewTab | Whether to open link in new tab | false | `true`, `false` | `false` |

Deltas (`contentType=delta`)

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| deltaSymbol | Whether to show the up/down delta arrow symbol | false | `true`, `false` | `true` |
| downIsGood | If present, negative comparison values appear in green, and positive values appear in red. | false | `true`, `false` | `false` |
| showValue | Whether to show the delta value. Set this to false to show only the delta arrow indicator. | false | `true`, `false` | `true` |
| neutralMin | Start of the range for 'neutral' values, which appear in grey font with a dash instead of an up/down arrow. By default, neutral is not applied to any values. | false | number | `0` |
| neutralMax | End of the range for 'neutral' values, which appear in grey font with a dash instead of an up/down arrow. By default, neutral is not applied to any values. | false | number | `0` |
| chip | Whether to display the delta as a 'chip', with a background color and border. | false | `true`, `false` | `false` |

Sparklines (`contentType=sparkline` | `contentType=sparkarea` | `contentType=sparkbar`)

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| sparkX | Column within an array cell to use as the x-axis for the spark viz. Arrays can be created inside a query using the `"array_agg()"` function from DuckDB | false | column from array cell | - |
| sparkY | Column within an array cell to use as the y-axis for the spark viz. Arrays can be created inside a query using the `"array_agg()"` function from DuckDB | false | column from array cell | - |
| sparkYScale | Whether to truncate the y-axis | false | `true`, `false` | `false` |
| sparkHeight | Height of the spark viz. Making the viz taller will increase the height of the full table row | false | number | `18` |
| sparkWidth | Width of the spark viz | false | number | `90` |
| sparkColor | Color of the spark viz | false | Hex color code, css color name | - |

Bar chart column (`contentType=bar`)

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| barColor | Color of the bars. Affects positive bars only. See `negativeBarColor` to change color of negative bars | false | Hex color code, css color name | - |
| negativeBarColor | Color of negative bars | false | Hex color code, css color name | - |
| hideLabels | Whether to hide the data labels on the bars | false | `true`, `false` | `false` |
| backgroundColor | Background color for bar chart | false | Hex color code, css color name | `transparent` |

Conditional formatting (`contentType=colorscale`)

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| colorScale | Color to use for the scale | false | - | `green` |
| colorMin | Set a minimum for the scale. Any values below that minimum will appear in the lowest color on the scale | false | number | min of column |
| colorMid | Set a midpoint for the scale | false | number | mid of column |
| colorMax | Set a maximum for the scale. Any values above that maximum will appear in the highest color on the scale | false | number | max of column |
| colorBreakpoints | List of numbers to use as breakpoints for each color in your color scale. Should line up with the colors you provide in `colorScale` | false | list of numbers | - |
| scaleColumn | Column or expression to use to define the color scale range. Values in this column will have their cell color determined by the value in the scaleColumn | false | column name, stored expression name, GSQL expression | - |

### Input components

#### Text input

Creates a text input that can be used to filter or search. To see how to filter a query using a text input, see Filters.

Here's an example:

```markdown
<TextInput
  name=name_of_input
  title=Search
/>
```

The user-inputted text would then be referenced in GSQL via `$name_of_input`. For example:

```sql
select *
from users
where email ilike concat('%', $name_of_input, '%') 
```

##### All text input attributes

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| name | Name of the text input, used to reference the selected value elsewhere as `"$name"` | true | string | - |
| title | Title displayed above the text input | false | string | - |
| placeholder | Alternative placeholder text displayed in the text input | false | string | `"Type to search"` |
| hideDuringPrint | Hide the component when the report is printed | false | `true`, `false` | `true` |
| description | Adds an info icon with description tooltip on hover | false | string | - |


#### Date range

Creates a date picker that can be used to filter a query. Includes a set of preset ranges for quick selection of common date ranges (relative to the supplied end date). To see how to filter a query using an input component, see Filters.

Here's an example:

```markdown
<DateRange
  name=date_range_name
  data=orders_by_day
  dates=day
/>
```

The start and end dates for the user-selected range would then be referenced in GSQL as `$date_range_name_start` and `$date_range_name_end` at the end. For example:

```sql
select *
from orders
where created_at > $date_range_name_start and < $date_range_name_end
```

##### All date range attributes

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| name | Name of the DateRange, used to reference the selected values elsewhere as `"$name_start"` or `"$name_end"` | true | string | - |
| data | Query name, wrapped in curly braces | false | query name | - |
| dates | Column or expression from the query containing date range to span | false | column name, stored expression name, GSQL expression | - |
| start | A manually specified start date to use for the range | false | string formatted YYYY-MM-DD | - |
| end | A manually specified end date to use for the range | false | string formatted YYYY-MM-DD | - |
| title | Title to display in the Date Range component | false | string | - |
| presetRanges | Customize "Select a Range" drop down, by including preset range options | false | list of values e.g. `"Last 7 Days, Last 30 Days"`. Allowed values: `Last 7 Days`, `Last 30 Days`, `Last 90 Days`, `Last 365 Days`, `Last 3 Months`, `Last 6 Months`, `Last 12 Months`, `Last Month`, `Last Year`, `Month to Date`, `Month to Today`, `Year to Date`, `Year to Today`, `All Time` | - |
| defaultValue | Accepts preset in string format to apply default value in Date Range picker | false | `"Last 7 Days"`, `"Last 30 Days"`, `"Last 90 Days"`, `"Last 365 Days"`, `"Last 3 Months"`, `"Last 6 Months"`, `"Last 12 Months"`, `"Last Month"`, `"Last Year"`, `"Month to Date"`, `"Month to Today"`, `"Year to Date"`, `"Year to Today"`, `"All Time"` | - |
| hideDuringPrint | Hide the component when the report is printed | false | `true`, `false` | `true` |
| description | Adds an info icon with description tooltip on hover | false | string | - |


#### Dropdown

Creates a dropdown menu with a list of options that can be selected. The selected option can be used to filter queries or in markdown. To see how to filter a query using a dropdown, see Filters.

Here's an example:

````markdown
```sql statuses
select distinct status from orders
```

<Dropdown 
  title="Select Order Status" 
  name="status_dropdown"
  data="statuses" 
  value="status"
  defaultValue="Complete"
/>
````

The user-selected value would then be referenced in GSQL as `$status_dropdown`. For example:

```sql
select *
from orders
where status = $status_dropdown
```

##### All dropdown attributes

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| name | Name of the dropdown, used to reference the selected value elsewhere as `"$name"` | true | - | - |
| data | Query name, wrapped in curly braces | false | query name | - |
| value | Column name from the query containing values to pick from | false | column name | - |
| multiple | Enables multi-select which returns a list | false | `true`, `false` | `false` |
| defaultValue | Value to use when the dropdown is first loaded. Must be one of the options in the dropdown. Lists supported for multi-select. | false | value from dropdown, list of values e.g. `"Value 1, Value 2"` | - |
| selectAllByDefault | Selects and returns all values, multiple attribute required | false | `true`, `false` | `false` |
| noDefault | Stops any default from being selected. Overrides any set `defaultValue`. | false | boolean | `false` |
| disableSelectAll | Removes the `"Select all"` button. Recommended for large datasets. | false | boolean | `false` |
| label | Column name from the query containing labels to display instead of the values (e.g., you may want to have the drop-down use `customer_id` as the value, but show `customer_name` to your users) | false | column name | Uses the column in value |
| title | Title to display above the dropdown | false | string | - |
| order | Column to sort options by, with optional ordering keyword | false | column name [ `asc`, `desc` ] | Ascending based on dropdown value (or label, if specified) |
| where | SQL where fragment to filter options by (e.g., where sales > 40000) | false | SQL where clause | - |
| hideDuringPrint | Hide the component when the report is printed | false | `true`, `false` | `true` |
| description | Adds an info icon with description tooltip on hover | false | string | - |

###### DropdownOption

The `DropdownOption` sub-component can be used to manually add options to a dropdown. This is useful to add a default option, or to add options that are not in a query.

Here's an example:

```markdown
<Dropdown name=hardcoded>
  <DropdownOption valueLabel="Option One" value=1 />
  <DropdownOption valueLabel="Option Two" value=2 />
  <DropdownOption valueLabel="Option Three" value=3 />
</Dropdown>
```

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| value | Value to use when the option is selected | true | - | - |
| valueLabel | Label to display for the option in the dropdown | false | - | Uses the value |

### Other components

`<Row></Row>` - Evenly distributes components inside along the same row.

### Value formatting

The easiest way to format numbers and dates in Graphene is through component attributes. You can pass in either of the following:

* [Excel-style format codes](https://support.microsoft.com/en-us/office/number-format-codes-in-excel-for-mac-5026bbd6-04bc-48cd-bf33-80f18b4eae68) (e.g., `fmt="$#,##0.0"`)
* [Graphene's built-in formats](#built-in-formats) (e.g., `fmt=usd2k`)

For example, you can use the `fmt` attribute to format values inside a BigValue component:

```markdown
<BigValue 
  data=sales_data 
  value=sales 
  fmt="$#,##0" 
/>
```

Within charts, you can format individual columns using `xFmt` and `yFmt`:

```markdown
<LineChart 
  data=sales_data 
  x=date 
  y=sales 
  xFmt="m/d"
  yFmt=eur
/>
```

In the example above, `xFmt` is passing in an Excel-style code to format the dates and `yFmt` is referencing a built-in format (see the full list of supported formats below).

**Date formatting**

Formatting does not apply to the date axis of a chart. For example, if you set `xFmt` to `"m/d/yy"`, you will only see that formatting reflected in your chart tooltips and annotations. This is to ensure that the chart axis labels have the correct spacing.

#### Built-in Formats

Graphene supports a variety of date/time, number, percentage, and currency formats.

##### Auto-Formatting

Wherever you see `auto` listed beside a format, that means Graphene will automatically format your value based on the context it is in.

For example, Graphene automatically formats large numbers into shortened versions based on the size of the median number in a column (e.g., 4,000,000 → 4M).

You can choose to handle these numbers differently by choosing a specific format code. For example, if Graphene is formatting a column as millions, but you want to see all numbers in thousands, you could use the `num0k` format, which will show all numbers in the column in thousands with 0 decimal places.

##### Dates

Graphene supports the following date formats:

* `ddd` - Short day name (e.g., Mon, Tue)
* `dddd` - Full day name (e.g., Monday, Tuesday)
* `mmm` - Short month name (e.g., Jan, Feb)
* `mmmm` - Full month name (e.g., January, February)
* `yyyy` - Four-digit year
* `shortdate` - Short date format (e.g., Jan 9/22)
* `longdate` - Long date format (e.g., January 9, 2022)
* `fulldate` - Full date format (e.g., Monday January 9, 2022)
* `mdy` - Month/day/year (e.g., 1/9/22)
* `dmy` - Day/month/year (e.g., 9/1/22)
* `hms` - Time format (e.g., 11:45:03 AM)

##### Currencies

Supported currencies include USD, AUD, BRL, CAD, CNY, EUR, GBP, JPY, INR, KRW, NGN, RUB, and SEK.

In order to use currency tags, use the currency code, optionally appended with:

* a number indicating the number of decimal places to show (0-2)
* a letter indicating the order of magnitude to show ("","k", "m", "b")

For example, the available tags for USD are:

* `usd` (auto) - Automatically formats based on value size
* `usd0`, `usd1`, `usd2` - USD with 0, 1, or 2 decimal places
* `usd0k`, `usd1k`, `usd2k` - USD in thousands (e.g., $64k)
* `usd0m`, `usd1m`, `usd2m` - USD in millions (e.g., $42M)
* `usd0b`, `usd1b`, `usd2b` - USD in billions (e.g., $1B)

Similar patterns apply to other supported currencies.

##### Numbers

The default number format (when no `fmt` is specified) automatically handles decimal places and summary units (in the same way that `usd` does for currency).

Available number formats:

* `num0`, `num1`, `num2`, `num3`, `num4` - Numbers with 0-4 decimal places
* `num0k`, `num1k`, `num2k` - Numbers in thousands (e.g., 64k)
* `num0m`, `num1m`, `num2m` - Numbers in millions (e.g., 42M)
* `num0b`, `num1b`, `num2b` - Numbers in billions (e.g., 1B)
* `id` - Integer format for IDs
* `fract` - Fraction format
* `mult`, `mult0`, `mult1`, `mult2` - Multiplier format (e.g., 5.32x)
* `sci` - Scientific notation

##### Percentages

Available percentage formats:

* `pct` (auto) - Automatically formats percentages based on value
* `pct0` - Percentage with 0 decimal places (e.g., 73%)
* `pct1` - Percentage with 1 decimal place (e.g., 73.1%)
* `pct2` - Percentage with 2 decimal places (e.g., 73.10%)
* `pct3` - Percentage with 3 decimal places (e.g., 73.100%)

## Graphene CLI

These are the available commands:
- `npm run graphene check` - Checks the syntax (GSQL and Markdown) for the entire Graphene project.
- `npm run graphene check <mdPath>` - Checks the syntax for a specified Graphene markdown file. Will also do a runtime check if the dev server is running, and if successful, take a full page screenshot to a temp directory for the agent to view.
- `npm run graphene check <mdPath> --chart "<chartTitle>"` - Same as above, except if the runtime check is successful, only takes a screenshot of the specified chart. `<chartTitle>` must match (case sensitive) the `title` attribute on the chart component. `-c` can be used as shorthand for `--chart`.
- `npm run graphene compile "<GSQL>"` - Shows how GSQL is translated into the underlying database SQL.
- `npm run graphene run "<GSQL>"` - Runs a GSQL query. The tables and semantics defined in all .gsql files in the project are available for the query to use.
- `npm run graphene serve` - Starts (or restarts) the dev server, which allows the user to view their Graphene app on localhost.
- `npm run graphene stop` - Stops the dev server.

# AGENT INSTRUCTIONS

Follow these guidelines when working in a Graphene project.
- When formulating GSQL queries:
   - First check all available stored expressions to see if there are any you can use. DO NOT redefine important business definitions like `profit` if they've already been modeled!
   - Run your GSQL queries in the CLI first, _before_ you write them to a file. This way you can reason about the results to make sure they make sense.
- Do not try to search the web for Graphene-specific info; you will not find anything. All the documentation is here in graphene.md.
- When writing to a .gsql file, check your code with `npm run graphene check`.
- When writing to a Graphene .md file:
   - Always check your code with `npm run graphene check <mdPath>`. 
   - Then do a visual check by either a) looking at the screenshot that `npm run graphene check <mdPath>` creates, or b) using your browser tool to open the .md file at `localhost:<port>/mdPath` (without the .md extension; default port 4000).
      - Critique what you see: Are all the data values formatted in a way that is easy to read? Does the shape of the visualized data require an adjustment to scale, axis min/max, etc.? Are any visualizations missing data altogether? Is that visualization type really the best way to paint the picture? Etc.
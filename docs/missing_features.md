# Missing Features in Graphene

This document tracks SQL functions and language features that we (or the agents) have attempted to use and are not currently supported in Graphene. If you run into a missing feature that's already listed here, increment the counter.

## SQL Language

### Date/Time Functions
- `hour(timestamp)` - Encountered **1** time - Extract hour from timestamp
- `month(timestamp)` - Encountered **1** time - Extract month from timestamp

### Mathematical Functions  
- `abs(number)` - Encountered **1** time - Absolute value
- `round(number)` - Encountered **1** time - Round to nearest integer

### NULL Handling
- `IS NULL` / `IS NOT NULL` - Encountered **1** time - TRUE if a value is null

### ORDER BY Clause
- `ORDER BY` - Encountered **1** time - Sorting query results by specified columns
- `ORDER BY column DESC` - Encountered **1** time - Descending sort order
- `ORDER BY column ASC` - Encountered **1** time - Ascending sort order

### Column Aliases in GROUP BY
- `GROUP BY column_alias` - Encountered **1** time - Using column aliases in GROUP BY clause
- `GROUP BY 1, 2` with aliases - Encountered **1** time - Positional GROUP BY with column aliases

### JOIN Syntax
- `JOIN ... ON` in SELECT queries - Encountered **1** time - Explicit JOIN syntax in SELECT statements (though joins are defined in models)

### Grouping Without Aggregates
- `SELECT DISTINCT <columns>` - Encountered **2** times - Ability to group over a column without there being an aggration. Synonymous to `SELECT <columns> FROM ... GROUP BY <columns>`. This helps you see distinct values in a column or set of columns.

## Markdown Language

### Can't reference foreign fields from chart component

Given the following inline SQL:

```delay_per_origin
select origin, origin_airport.full_name, avg(dep_delay) as avg_delay from flights group by 1, 2 limit 20
```

There is no way to access origin_airport.full_name from the chart below.

```
<BarChart 
  data={delay_per_origin}
  x=origin
  labels=true
  labelPosition=inside
  y=avg_delay
  swapXY=true
  tooltip={origin_airport.full_name}
  title="Most Delayed Airports"
  subtitle="Top 20 airports by average delay (minutes)"
/>
```

Even if you alias the column via `origin_airport.full_name as origin_full_name`, Evidence returns "origin_full_name is not defined."
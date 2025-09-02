# Missing Features in GSQL

This document tracks SQL functions and language features that we (or the agents) have attempted to use and are not currently supported in GSQL. If you run into a missing feature that's already listed here, increment the counter.

## Missing SQL Functions

### Date/Time Functions
- `hour(timestamp)` - Encountered **1** time - Extract hour from timestamp
- `month(timestamp)` - Encountered **1** time - Extract month from timestamp

### Mathematical Functions  
- `abs(number)` - Encountered **1** time - Absolute value
- `round(number)` - Encountered **1** time - Round to nearest integer

### NULL Handling
- `IS NULL` / `IS NOT NULL` - Encountered **1** time - TRUE if a value is null

## Language Features

### ORDER BY Clause
- `ORDER BY` - Encountered **1** time - Sorting query results by specified columns
- `ORDER BY column DESC` - Encountered **1** time - Descending sort order
- `ORDER BY column ASC` - Encountered **1** time - Ascending sort order

### Column Aliases in GROUP BY
- `GROUP BY column_alias` - Encountered **1** time - Using column aliases in GROUP BY clause
- `GROUP BY 1, 2` with aliases - Encountered **1** time - Positional GROUP BY with column aliases

### JOIN Syntax
- `JOIN ... ON` in SELECT queries - Encountered **1** time - Explicit JOIN syntax in SELECT statements (though joins are defined in models)


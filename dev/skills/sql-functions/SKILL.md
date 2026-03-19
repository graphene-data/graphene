---
name: sql-functions
description: Use when updating SQL function references for database dialects like BigQuery, DuckDB, or Snowflake.
---

# SQL Function Reference Updater

This skill helps you update Graphene's SQL function definitions to match the functions supported by each database dialect.

## Documentation Sources

### BigQuery

Base URL: https://cloud.google.com/bigquery/docs/reference/standard-sql/

| Category         | Doc Path                        | Description                       |
| ---------------- | ------------------------------- | --------------------------------- |
| Aggregate        | aggregate_functions             | SUM, COUNT, AVG, etc.             |
| Approx Aggregate | approximate_aggregate_functions | APPROX_COUNT_DISTINCT, etc.       |
| Mathematical     | mathematical_functions          | ABS, ROUND, SQRT, etc.            |
| String           | string_functions                | CONCAT, SUBSTR, LOWER, etc.       |
| Date             | date_functions                  | DATE_ADD, DATE_DIFF, etc.         |
| Datetime         | datetime_functions              | DATETIME_ADD, etc.                |
| Timestamp        | timestamp_functions             | TIMESTAMP_DIFF, etc.              |
| Time             | time_functions                  | TIME_ADD, etc.                    |
| Interval         | interval_functions              | MAKE_INTERVAL, JUSTIFY_DAYS, etc. |
| JSON             | json_functions                  | JSON_EXTRACT, JSON_VALUE, etc.    |
| Array            | array_functions                 | ARRAY_LENGTH, ARRAY_CONCAT, etc.  |
| Geography        | geography_functions             | ST_DISTANCE, etc.                 |
| Hash             | hash_functions                  | MD5, SHA256, etc.                 |
| Conditional      | conditional_expressions         | IF, COALESCE, NULLIF              |
| Statistical      | statistical_aggregate_functions | STDDEV, CORR, etc.                |
| Bit              | bit_functions                   | BIT_COUNT                         |
| Conversion       | conversion_functions            | PARSE_NUMERIC, etc.               |
| Utility          | utility-functions               | GENERATE_UUID, TYPEOF             |
| Debugging        | debugging_functions             | ERROR                             |

### DuckDB

Base URL: https://duckdb.org/docs/stable/sql/functions/

| Category            | Doc Path                 | Description                             |
| ------------------- | ------------------------ | --------------------------------------- |
| Aggregate           | aggregates.html          | SUM, COUNT, AVG, list, string_agg, etc. |
| Numeric             | numeric.html             | ABS, ROUND, SQRT, SIN, etc.             |
| Text                | text.html                | CONCAT, SUBSTR, LOWER, etc.             |
| Date                | date.html                | DATE_ADD, DATE_DIFF, etc.               |
| Timestamp           | timestamp.html           | AGE, EPOCH, MAKE_TIMESTAMP, etc.        |
| Time                | time.html                | TIME functions                          |
| Interval            | interval.html            | INTERVAL functions                      |
| List                | list.html                | Array/List functions                    |
| Pattern Matching    | pattern_matching.html    | LIKE, GLOB, etc.                        |
| Regular Expressions | regular_expressions.html | REGEXP\_\*, etc.                        |

### Snowflake

Base URL: https://docs.snowflake.com/en/sql-reference/functions/

Functions are organized alphabetically. Key categories:

- Aggregate Functions
- String & Binary Functions
- Numeric Functions
- Date & Time Functions
- Conditional Expression Functions

## File Locations

| File                             | Purpose                                        |
| -------------------------------- | ---------------------------------------------- |
| `core/lang/functionTypes.ts`     | Type definitions for FunctionDef               |
| `core/lang/bigQueryFunctions.ts` | BigQuery function definitions (~200 functions) |
| `core/lang/duckDbFunctions.ts`   | DuckDB function definitions (~130 functions)   |
| `core/lang/functionDefs.ts`      | Converts FunctionDef to Malloy blueprints      |

## Function Definition Format

Functions use the `trim()` helper (alias for `trimIndentation`) for clean multiline descriptions:

```typescript
import {trimIndentation} from './util.ts'
const trim = trimIndentation

{
  name: 'function_name',
  description: trim(`
    FUNCTION_NAME(arg1, arg2[, optional_arg])

    Description of what the function does. Copy this from the docs.

    Definitions:
    - arg1: Description of arg1.
    - arg2: Description of arg2.

    Details:
    Additional behavior notes from the docs.

    Supported Argument Types: STRING, BYTES
    Returned Data Types: INT64
  `),
  url: `${bq}/category#function_name`,
  args: [
    ['arg1', 'string'],                                    // Simple tuple
    {name: 'arg2', type: 'number?', description: '...'},   // With description
  ],
  returns: 'number',
  aggregate: true,  // Only for aggregate functions
}
```

### The `description` Field

**IMPORTANT**: The `description` field contains ALL documentation text from the BigQuery docs page:

- Function signature/syntax
- Description text
- Definitions of arguments
- Details section
- Supported argument types
- Return data types

Do NOT summarize or truncate. Copy the full text from each section.

### Argument Format

Arguments can be either:

1. **Simple tuple** for basic args: `['x', 'number']`
2. **Object with description** when docs provide argument-specific details:
   ```typescript
   {name: 'expression', type: 'T', description: 'Any orderable data type except for ARRAY.'}
   ```

Use object format when the BigQuery docs provide a specific description for that argument.

### Type Conventions

| Pattern       | Meaning          | Notes                          |
| ------------- | ---------------- | ------------------------------ |
| `'number'`    | Required number  | INT64, FLOAT64, NUMERIC        |
| `'number?'`   | Optional number  |                                |
| `'string...'` | Variadic strings |                                |
| `'T'`         | Generic type     | Inferred from usage            |
| `'T?'`        | Optional generic |                                |
| `'T...'`      | Variadic generic |                                |
| `'any'`       | Any input type   | **Cannot be used for returns** |
| `'array'`     | Array type       |                                |
| `'boolean'`   | Boolean          |                                |
| `'date'`      | Date             |                                |
| `'datetime'`  | Datetime         |                                |
| `'time'`      | Time             |                                |
| `'timestamp'` | Timestamp        |                                |
| `'interval'`  | Interval         |                                |
| `'json'`      | JSON             |                                |
| `'bytes'`     | Bytes/binary     |                                |
| `'never'`     | Never returns    | For ERROR function             |

**Note**: `'any'` cannot be used as a return type - Malloy doesn't support it. Use a specific type or generic `'T'`.

## Special Cases

### SQL Keywords (not functions)

Some SQL constructs are keywords, not functions, and should NOT be added:

- `CAST(x AS type)` - SQL keyword
- `SAFE_CAST(x AS type)` - SQL keyword
- `EXTRACT(part FROM date)` - Uses special syntax with FROM keyword

### Manual Overrides

Some functions need manual overrides in `functionDefs.ts` because they use:

- **sql_native keywords**: Like `DATE_TRUNC(date, WEEK)` where WEEK is a keyword
- **Multiple overloads**: With significantly different signatures
- **Custom SQL templates**: Where the generated SQL differs from `FUNC(args)`

These are defined in `BIGQUERY_MANUAL_OVERRIDES` in functionDefs.ts.

## Workflow for Adding Functions

### 1. Fetch the docs

```
WebFetch: https://cloud.google.com/bigquery/docs/reference/standard-sql/{category}_functions
```

### 2. For each function, extract:

- Function signature (the syntax line)
- Description paragraph
- Definitions section (if present)
- Details section (if present)
- Supported Argument Types
- Returned Data Types

### 3. Add to bigQueryFunctions.ts

```typescript
{
  name: 'contains_substr',
  description: trim(`
    CONTAINS_SUBSTR(expression, search_value_literal[, json_scope=>json_scope_value])

    Performs a normalized, case-insensitive search to see if a value exists as a substring in an expression. Returns TRUE if the value exists, otherwise returns FALSE.

    Before values are compared, they are normalized and case folded with NFKC normalization. Wildcard searches are not supported.

    Definitions:
    - search_value_literal: The value to search for. It must be a STRING literal or a STRING constant expression.
    - expression: The data to search over. The expression can be a column or table reference.
    - json_scope: A named argument with a STRING value. Takes 'JSON_VALUES' (default), 'JSON_KEYS', or 'JSON_KEYS_AND_VALUES'.

    Returned Data Types: BOOL
  `),
  url: `${bq}/string_functions#contains_substr`,
  args: [
    {name: 'expression', type: 'any', description: 'The data to search over. The expression can be a column or table reference.'},
    {name: 'search_value_literal', type: 'string', description: 'The value to search for. It must be a STRING literal or a STRING constant expression.'},
    {name: 'json_scope', type: 'string?', description: "A named argument with a STRING value. Takes 'JSON_VALUES' (default), 'JSON_KEYS', or 'JSON_KEYS_AND_VALUES'."},
  ],
  returns: 'boolean',
},
```

### 4. Run tests

```bash
cd core
pnpm lint       # Check for type errors
pnpm test --project lang  # Run lang tests
```

### 5. If tests fail with "Cannot return any type"

Change the return type from `'any'` to a specific type:

- For JSON functions: use `'json'`
- For generic functions: use `'T'`
- For functions returning the input type: use `'T'` with generic args

## Example: Complete Function Entry

```typescript
{
  name: 'array_slice',
  description: trim(`
    ARRAY_SLICE(array_to_slice, start_offset, end_offset)

    Returns an array containing zero or more consecutive elements from the input array.

    Definitions:
    - array_to_slice: The array that contains the elements to return.
    - start_offset: The 0-based inclusive starting offset for elements to return.
    - end_offset: The 0-based exclusive ending offset for elements to return.

    Returned Data Types: ARRAY
  `),
  url: `${bq}/array_functions#array_slice`,
  args: [
    {name: 'array_to_slice', type: 'array', description: 'The array to slice.'},
    {name: 'start_offset', type: 'number', description: 'The 0-based inclusive starting offset.'},
    {name: 'end_offset', type: 'number', description: 'The 0-based exclusive ending offset.'},
  ],
  returns: 'array',
},
```

## Testing Commands

```bash
cd core
pnpm test --project lang --run     # Run all lang tests
pnpm test -t "BigQuery"            # Run BigQuery-specific tests
pnpm lint                          # Check for type errors
```

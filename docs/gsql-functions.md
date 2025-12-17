## GSQL Functions Reference

### Aggregate Functions

| Function | Description | Parameters | Return Type | DuckDB | BigQuery | Snowflake |
| - | - | - | - | - | - | - |
| count(), count(*) | Counts the number of rows. | - | Number | x | x | x |
| count(column) | Counts the number of non-null values in a column. | `column` - Any column/expression | Number | x | x | x |
| count(distinct column) | Counts the number of distinct non-null values in a column. | `column` - Any column/expression | Number | x | x | x |
| sum(column) | Calculates the sum of numeric values. | `column` - Numeric column/expression | Number | x | x | x |
| avg(column) | Calculates the average (mean) of numeric values. | `column` - Numeric column/expression | Number | x | x | x |
| min(column) | Returns the minimum value. | `column` - Any comparable column/expression | Same as input | x | x | x |
| max(column) | Returns the maximum value. | `column` - Any comparable column/expression | Same as input | x | x | x |
| count_if(condition) | Counts rows where the condition is true. | `condition` - Boolean expression | Number | x | x | |
| string_agg(column) | Concatenates string values. | `column` - String column/expression | String | x | x | x |
| stddev(column) | Calculates the standard deviation. | `column` - Numeric column/expression | Number | x | x | x |
| pXX(column) | Returns the XXth percentile (e.g., p50, p975, p9999). | `column` - Numeric column/expression | Number | x | x (≤p99) | x |

### Date and Time Functions

| Function | Description | Parameters | Return Type | DuckDB | BigQuery | Snowflake |
| - | - | - | - | - | - | - |
| current_date() | Returns the current date. | - | Date | x | x | x |
| current_time() | Returns the current time. | - | Timestamp | x | x | x |
| current_timestamp() | Returns the current timestamp. | - | Timestamp | x | x | x |
| local_timestamp() | Returns the local timestamp. | - | Timestamp | x | x | x |
| current_datetime() | Returns the current datetime (BigQuery only). | - | Timestamp | | x | |
| date_trunc(unit, date) | Truncates date/timestamp to unit (DuckDB). | `unit` - String ('year', 'month', 'day', etc.)<br>`date` - Timestamp | Timestamp | x | | |
| date_trunc(date, unit) | Truncates date/timestamp to unit (BigQuery). | `date` - Date or timestamp<br>`unit` - Keyword (year, month, day, week, etc.) | Same as input | | x | |
| extract(unit from timestamp) | Extracts a date part from timestamp. | `unit` - Date part (year, month, day, hour, etc.)<br>`timestamp` - Timestamp/date | Number | x | x | x |
| timestamp_diff(start, end, unit) | Calculates difference between timestamps (BigQuery). | `start` - Timestamp<br>`end` - Timestamp<br>`unit` - Keyword (day, week, month, etc.) | Number | | x | |

### Conditional Functions

| Function | Description | Parameters | Return Type | DuckDB | BigQuery | Snowflake |
| - | - | - | - | - | - | - |
| if(condition, trueValue, falseValue) | Returns one of two values based on condition. | `condition` - Boolean<br>`trueValue` - Any type<br>`falseValue` - Same type as trueValue | Same as value args | x | x | |
| case when ... then ... else ... end | Evaluates conditions and returns values. | Multiple when/then clauses | Varies | x | x | x |
| coalesce(value1, value2, ...) | Returns first non-null value. | `value1, value2, ...` - Same type | Same as input | x | x | x |

### Math Functions

| Function | Description | Parameters | Return Type | DuckDB | BigQuery | Snowflake |
| - | - | - | - | - | - | - |
| floor(number) | Rounds down to nearest integer. | `number` - Numeric value | Number | x | x | x |
| ceil(number) | Rounds up to nearest integer. | `number` - Numeric value | Number | x | x | x |
| greatest(value1, value2, ...) | Returns the greatest value. | `value1, value2, ...` - Same type | Same as input | x | x | x |
| least(value1, value2, ...) | Returns the smallest value. | `value1, value2, ...` - Same type | Same as input | x | x | x |
| safe_divide(numerator, denominator) | Divides, returning null on division by zero (BigQuery). | `numerator` - Number<br>`denominator` - Number | Number | | x | |

### Type Conversion

| Function | Description | Parameters | Return Type | DuckDB | BigQuery | Snowflake |
| - | - | - | - | - | - | - |
| cast(value as type) | Converts value to specified type. | `value` - Any value<br>`type` - Target type (varchar, int, float64, etc.) | Specified type | x | x | x |
| value::type | Alternative cast syntax. | `value` - Any value<br>`type` - Target type | Specified type | x | x | x |

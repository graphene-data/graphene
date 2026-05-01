Creates a date range picker with start/end date inputs and optional preset ranges. The selected range can be used to filter queries or in markdown.

Here's an example:

````markdown
```sql sales
select date, revenue from orders
```

<DateRange
  title="Date Range"
  name=date_filter
  data=sales
  dates=date
/>
````

The selected start and end dates are then referenced in GSQL as `$date_filter_start` and `$date_filter_end`. For example:

```sql
select date, revenue
from orders
where date >= $date_filter_start and date < $date_filter_end
```

Date range selections sync into the page URL query string as `{name}_start` and `{name}_end`, eg. `localhost:4000/my_dashboard?date_filter_start=2024-01-01&date_filter_end=2024-02-01`.

# Attributes

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| name | Name of the date range, used to reference the selected value elsewhere as `"$name.start"` and `"$name.end"` | true | - | - |
| data | GSQL query or table name to infer the date domain from | false | query name | - |
| dates | Column name from the query containing date values, used to determine the min/max of the domain | false | column name | - |
| start | Initial start date | false | date string or Date | - |
| end | Initial end date | false | date string or Date | - |
| defaultValue | Preset label to apply on first load (e.g., `"Last 30 Days"`) | false | preset label | - |
| presetRanges | List of preset range labels to show in the dropdown. Accepts a comma-separated string or an array. | false | preset labels | See defaults below |
| title | Title to display above the input | false | string | - |
| description | Subtitle text displayed below the title | false | string | - |

# Preset ranges

By default, the following presets are available in the dropdown:

- Last 7 Days
- Last 30 Days
- Last 90 Days
- Last 365 Days
- Last Month
- Last Year
- Month to Date
- Month to Today
- Year to Date
- Year to Today
- All Time

The `Last N Days` and `Last N Months` patterns are also supported for any number N (e.g., `"Last 14 Days"`, `"Last 6 Months"`).

You can override the list with the `presetRanges` prop:

```markdown
<DateRange name="date_filter" presetRanges="Last 7 Days, Last 30 Days, Last Year" />
```

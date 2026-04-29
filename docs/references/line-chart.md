Use line charts to show trends over an ordered axis (usually time).

`LineChart` is a convenience wrapper around `ECharts`: it supports common line-chart mappings with a minimal API.

Here's an example:

```markdown
<LineChart
  title="Monthly Revenue"
  data=revenue_by_month
  x=month
  y=revenue
  y2=conversion_rate
/>
```

# Attributes

## General

| Attribute | Description | Required | Options | Default |
|----------|-------------|----------|---------|---------|
| data | GSQL query or table name | true | query name | - |
| title | Chart title | false | string | - |
| height | Chart height in px or CSS size string | false | number, string | `240px` |
| width | Chart width in px or CSS size string | false | number, string | `100%` |

## Series mapping

| Attribute | Description | Required | Options | Default |
|----------|-------------|----------|---------|---------|
| x | Field for x-axis | true | column/expression name | - |
| y | One or more value fields (comma-separated) | true | column(s), e.g. `revenue` or `revenue, cost` | - |
| y2 | Optional single field rendered on secondary axis | false | column/expression name | - |
| splitBy | Split one `y` field into one line per distinct value | false | column/expression name | - |

`splitBy` is incompatible with multiple y fields. If `y` includes multiple fields, each field becomes its own line.
Use `y2` when one additional line should use a separate value axis, such as a rate alongside a total.

For advanced behavior (custom line styles, annotations, axis config, dataset transforms), use [`ECharts`](./echarts.md) directly.

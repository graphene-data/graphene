Use area charts when you want line-chart trends with filled areas.

`AreaChart` is a convenience wrapper around `ECharts` that focuses on common grouped/stacked area patterns.

Here's an example:

```markdown
<AreaChart
  title="Revenue by Month"
  data=revenue_by_month
  x=month
  y=revenue
  splitBy=channel
  arrange=stack
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
| y2 | Optional single field rendered as a line on secondary axis | false | column/expression name | - |
| splitBy | Split one value field into multiple area series by distinct values of this field | false | column/expression name | - |
| arrange | Arrangement for `splitBy` series | false | `stack`, `stack100` | `stack` |

`splitBy` is incompatible with multiple y fields.
Use `y2` when one additional line should use a separate value axis, such as a rate alongside a total area.

For more control, use [`ECharts`](./echarts.md) directly.

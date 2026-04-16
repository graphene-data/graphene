Use area charts when you want line-chart trends with filled areas.

`AreaChart` is a convenience wrapper around `ECharts` that focuses on common grouped/stacked area patterns.

Here's an example:

```markdown
<AreaChart
  title="Revenue by Month"
  data=revenue_by_month
  x=month
  y=revenue
  stack=channel
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
| group | Split one `y` field into multiple overlapping area series | false | column/expression name | - |
| stack | Split one `y` field into stacked areas | false | column/expression name | - |
| stack100 | Same as `stack`, but normalized to 100% | false | column/expression name | - |

`group`, `stack`, and `stack100` are mutually exclusive.
When `y` has multiple fields, `group`/`stack`/`stack100` are not supported.

For more control, use [`ECharts`](./echarts.md) directly.

Use bar or column charts to compare a metric across categories.

`BarChart` is a convenience wrapper around `ECharts`: it handles common cases with a small API and relies on chart enrichments for good defaults.

Here's an example:

```markdown
<BarChart
  title="Revenue by Category"
  data=orders_by_category
  x=category
  y=revenue
  splitBy=region
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
| x | Field for category axis | true | column/expression name | - |
| x | Field for category axis. For horizontal bars you can provide multiple comma-separated x fields. | true | column/expression name(s) | - |
| y | One or more value fields (comma-separated). For horizontal bars this should be the category field. | true | column(s), e.g. `revenue` or `revenue, cost` | - |
| y2 | Optional field rendered as a line on secondary axis | false | column/expression name | - |
| splitBy | Split one value field into multiple series by distinct values of this field | false | column/expression name | - |
| arrange | Arrangement for `splitBy` series | false | `stack`, `group`, `stack100` | `stack` |
| label | Show value labels on bars | false | `true`, `false` | `false` |

`splitBy` is incompatible with multiple value fields.

For advanced behavior (custom tooltips, axes, transforms, chart types), use [`ECharts`](./echarts.md) directly.

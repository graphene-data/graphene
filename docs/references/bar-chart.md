Use bar or column charts to compare a metric across categories.

`BarChart` is a convenience wrapper around `ECharts`: it handles common cases with a small API and relies on chart enrichments for good defaults.

Here's an example:

```markdown
<BarChart
  title="Revenue by Category"
  data=orders_by_category
  x=category
  y=revenue
  stack=region
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
| y | One or more value fields (comma-separated). Multiple values create one series per field. | true | column(s), e.g. `revenue` or `revenue, cost` | - |
| y2 | Optional field rendered as a line on secondary axis | false | column/expression name | - |
| group | Split one `y` field into grouped bars by distinct values of this field | false | column/expression name | - |
| stack | Split one `y` field into stacked bars by distinct values of this field | false | column/expression name | - |
| stack100 | Same as `stack`, but normalized to 100% | false | column/expression name | - |
| label | Show value labels on bars | false | `true`, `false` | `false` |

`group`, `stack`, and `stack100` are mutually exclusive.

For advanced behavior (custom tooltips, axes, transforms, chart types), use [`ECharts`](./echarts.md) directly.

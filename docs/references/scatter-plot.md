Use scatter plots to show the relationship between two values.

`ScatterPlot` is a convenience wrapper around `ECharts`: it supports common scatter-plot mappings with a minimal API.

Here's an example:

```markdown
<ScatterPlot
  title="Revenue vs Margin"
  data=product_metrics
  x=revenue
  y=gross_margin
  splitBy=category
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
| y | One or more value fields (comma-separated) | true | column(s), e.g. `gross_margin` or `gross_margin, growth_rate` | - |
| splitBy | Split one `y` field into one point series per distinct value | false | column/expression name | - |

`splitBy` is incompatible with multiple y fields. If `y` includes multiple fields, each field becomes its own scatter series.

For advanced behavior (custom point sizing, symbol styles, annotations, axis config, dataset transforms), use [`ECharts`](./echarts.md) directly.

Use pie charts to show part-to-whole splits across a small number of categories.

`PieChart` is a convenience wrapper around `ECharts` for donut-style pies.

Here's an example:

```markdown
<PieChart
  title="Orders by Segment"
  data=orders_by_segment
  category=segment
  value=orders
/>
```

# Attributes

| Attribute | Description | Required | Options | Default |
|----------|-------------|----------|---------|---------|
| data | GSQL query or table name | true | query name | - |
| category | Category field shown in legend/labels | true | column/expression name | - |
| value | Numeric field used for slice size | true | column/expression name | - |
| title | Chart title | false | string | - |
| height | Chart height in px or CSS size string | false | number, string | `240px` |
| width | Chart width in px or CSS size string | false | number, string | `100%` |

For advanced pie configurations (rose charts, custom label layout, etc.), use [`ECharts`](./echarts.md).

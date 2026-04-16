Use `ECharts` when you need chart behavior that goes beyond the built-in chart components.

Graphene charts are powered by Apache ECharts. In markdown, you define the ECharts option object **inside the `<ECharts>` tag body**.

Example:

```markdown
<ECharts data="sales_by_month">
  title: {text: "Revenue"},
  tooltip: {trigger: "axis"},
  xAxis: {},
  yAxis: {},
  series: [{type: "line", encode: {x: "month", y: "revenue"}}],
</ECharts>
```

# Attributes

| Attribute | Description | Required | Options | Default |
|----------|-------------|----------|---------|---------|
| data | GSQL query or table name | true | query/table name | - |
| height | Chart height in px or CSS size string | false | number, string | `240px` |
| width | Chart width in px or CSS size string | false | number, string | `100%` |
| renderer | ECharts renderer | false | `svg`, `canvas` | `svg` |

## Config body syntax

Inside `<ECharts>...</ECharts>`, Graphene parses the config as JSON5:
- unquoted keys are allowed (`xAxis: {}`)
- trailing commas are allowed
- you can wrap the whole thing in `{ ... }` or omit the outer braces

## Grouping and stacking hints

Graphene supports a few `encode` extensions to reduce boilerplate:
- `encode.group`: expands one series template into one series per distinct value
- `encode.stack`: same expansion, but stacked
- `stackPercentage: true`: converts stacked values to 100% stacking

Example:

```markdown
<ECharts data="sales_by_month_and_region">
  xAxis: {},
  yAxis: {},
  series: [{
    type: "bar",
    encode: {x: "month", y: "revenue", stack: "region"},
    stack: "revenue-stack",
    stackPercentage: true,
  }],
</ECharts>
```

For common chart types, prefer `BarChart`, `LineChart`, `AreaChart`, and `PieChart`. Use `ECharts` when you need deeper customization.
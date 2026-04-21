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

## Encode fields by series type

Each series type maps columns via `encode`. Graphene accepts:

| Series type | Encode fields |
|-------------|---------------|
| `bar`, `line`, `scatter`, `candlestick`, `heatmap`, `effectScatter` | `x`, `y`, `splitBy` |
| `pie`, `funnel` | `itemName`, `value` |
| `treemap` | `itemName`, `value` |
| `sankey` | `source`, `target`, `value` |

## Customizing with split hints

To keep configs concise, Graphene supports a split hint:

- `encode.splitBy: "field"`: split one series template into one series per distinct field value
- `encode.splitBy: ["groupField", "stackField"]` (bar only): expands to grouped+stacked bars, where the first field groups and the second stacks
- with a single split field, `series.stack` decides stacked vs grouped behavior
- `stackPercentage: true`: convert stacked values to percentages (100% stacked)

Examples:

```markdown
<ECharts data="sales_by_month_and_region">
  xAxis: {},
  yAxis: {},
  series: [{
    type: 'bar',
    encode: {x: 'month', y: 'revenue', splitBy: 'region'},
    stack: 'revenue-stack',
    stackPercentage: true
  }]
</ECharts>

<!-- Char that is both grouped by region and stacked by channel -->
<ECharts data="sales_by_month_region_channel">
  xAxis: {},
  yAxis: {},
  series: [{
    type: 'bar',
    encode: {x: 'month', y: 'revenue', splitBy: ['region', 'channel']},
    stack: 'revenue-stack',
    stackPercentage: true
  }]
/>
```

For common chart types, prefer `BarChart`, `LineChart`, `AreaChart`, and `PieChart`. Use `ECharts` when you need deeper customization.

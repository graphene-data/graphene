Use `ECharts` when you need chart behavior that goes beyond the built-in chart components.

Graphene charts are powered by Apache ECharts (v6). In markdown, you define the ECharts option object **inside the `<ECharts>` tag body**.

Example:

```markdown
<ECharts data="sales_by_month">
  title: {text: "Revenue"},
  tooltip: {trigger: "axis"},
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
- Unquoted keys are allowed (`xAxis: {}`)
- Trailing commas are allowed
- You can wrap the whole thing in `{ ... }` or omit the outer braces
- Inline Javascript is not allowed

## What Graphene handles automatically

You don't need to configure these — Graphene applies them by default:

- Axes: created if missing, types inferred from field metadata (time, category, value), tick formatting applied
- Layout: grid padding computed to prevent title/legend overlap
- Style: color palette, fonts, axis borders, split lines, and series marker defaults (via the Graphene theme)

Your config typically only needs to specify the series `type`, `encode` mappings, and any explicit overrides to the above.

## Encode fields by series type

Each series type maps columns via `encode`. Graphene accepts:

| Series type | Encode fields |
|-------------|---------------|
| `bar`, `line`, `scatter`, `candlestick`, `heatmap`, `effectScatter` | `x`, `y`, `splitBy` |
| `pie`, `funnel` | `itemName`, `value` |
| `treemap` | `itemName`, `value` |
| `sankey`, `chord` | `source`, `target`, `value` |
| `themeRiver` | `single`, `value`, `seriesName` |

For a beeswarm, use a `scatter` series and set `jitter` (plus optional `jitterOverlap`/`jitterMargin`) on the categorical axis.

## Customizing with split hints

To keep configs concise, Graphene supports a split hint:

- `encode.splitBy: "field"`: split one series template into one series per distinct field value
- `encode.splitBy: ["groupField", "stackField"]` (bar only): expands to grouped+stacked bars, where the first field groups and the second stacks
- with a single split field, `series.stack` decides stacked vs grouped behavior
- `stackPercentage: true`: convert stacked values to percentages (100% stacked)

Examples:

```markdown
<ECharts data="sales_by_month_and_region">
  title: {text: "Revenue by Region"},
  series: [{
    type: 'bar',
    encode: {x: 'month', y: 'revenue', splitBy: 'region'},
    stack: 'revenue-stack',
    stackPercentage: true
  }]
</ECharts>

<!-- Char that is both grouped by region and stacked by channel -->
<ECharts data="sales_by_month_region_channel">
  title: {text: "Revenue by Region and Channel"},
  series: [{
    type: 'bar',
    encode: {x: 'month', y: 'revenue', splitBy: ['region', 'channel']},
    stack: 'revenue-stack',
    stackPercentage: true
  }]
/>
```

## More examples

### Heatmap

```markdown
<ECharts data="delay_by_hour_and_day" height=520px>
  title: {text: "Avg Delay by Hour & Day of Week (min)"},
  tooltip: {trigger: 'item'},
  visualMap: {
    min: -5, max: 30,
    calculable: true,
    orient: 'horizontal',
    left: 'center',
    bottom: 4,
    inRange: {color: ['#5B8F9E', '#e4eff3', '#D4A94C']},
  },
  xAxis: {type: 'category', position: 'top', data: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']},
  yAxis: {type: 'category', inverse: true, data: ['6am','7am','8am','9am','10am','11am','12pm']},
  series: [{type: 'heatmap', encode: {x: 'day_label', y: 'hour_label', value: 'avg_delay'}}],
</ECharts>
```

### Scatter/bubble

```markdown
<ECharts data="airport_stats" height=480px>
  title: {text: "Departure vs Arrival Delay by Airport"},
  tooltip: {trigger: 'item'},
  visualMap: {
    dimension: 'flight_count',
    type: 'continuous',
    min: 0, max: 3000,
    inRange: {symbolSize: [4, 32]},
    show: false,
  },
  xAxis: {type: 'value', name: 'Avg Departure Delay (min)', nameLocation: 'middle', nameGap: 22},
  yAxis: {type: 'value', name: 'Avg Arrival Delay (min)', nameLocation: 'middle', nameGap: 20},
  series: [{
    type: 'scatter',
    encode: {x: 'avg_dep_delay', y: 'avg_arr_delay', itemName: 'code'},
    tooltip: {formatter: '{b}'},
  }],
</ECharts>
```

### Lollipop

Combine a `pictorialBar` series (the stem) with a `scatter` series (the dot) on a category y-axis.

```markdown
<ECharts data="avg_delay_by_carrier">
  title: {text: "Avg Delay by Carrier (min)"},
  xAxis: {type: 'value'},
  yAxis: {type: 'category', inverse: true, encode: {y: 'carrier'}},
  series: [
    {
      type: 'pictorialBar',
      symbol: 'rect',
      symbolSize: ['100%', 2],
      symbolPosition: 'end',
      encode: {x: 'avg_delay', y: 'carrier'},
    },
    {
      type: 'scatter',
      symbolSize: 12,
      encode: {x: 'avg_delay', y: 'carrier', itemName: 'carrier'},
      label: {show: true, position: 'right', formatter: '{b}', fontSize: 11},
    },
  ],
</ECharts>
```

For common chart types, prefer `BarChart`, `LineChart`, `AreaChart`, `ScatterPlot`, and `PieChart`. Use `ECharts` when you need deeper customization.

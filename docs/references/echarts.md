Use `ECharts` when you want full control over chart behavior and styling.

Graphene uses Apache ECharts under the hood. The `ECharts` component lets you pass an ECharts config directly, while Graphene enrichments still fill in sensible defaults (dataset wiring, axis inference, formatting, and common layout fixes).

Here's a simple example:

```markdown
<ECharts
  data=sales_by_month
  config={{
    title: {text: 'Revenue'},
    tooltip: {trigger: 'axis'},
    xAxis: {},
    yAxis: {},
    series: [{type: 'line', encode: {x: 'month', y: 'revenue'}}]
  }}
/>
```

# Attributes

| Attribute | Description | Required | Options | Default |
|----------|-------------|----------|---------|---------|
| data | GSQL query/table name, or inline query result object | true | query name or `{rows, fields}` | - |
| config | ECharts option object | true | valid ECharts config | - |
| height | Chart height in px or CSS size string | false | number, string | `240px` |
| width | Chart width in px or CSS size string | false | number, string | `100%` |
| renderer | ECharts renderer | false | `svg`, `canvas` | `svg` |

## Data shape

When using inline data, pass both `rows` and `fields`:

```markdown
<ECharts
  data={{
    rows: [{month: '2026-01', revenue: 120}],
    fields: [
      {name: 'month', type: {kind: 'scalar', scalar: 'date'}},
      {name: 'revenue', type: {kind: 'scalar', scalar: 'number', metadata: {units: 'usd'}}}
    ]
  }}
  config={{...}}
/>
```

`fields` replaces the old `_evidenceColumnTypes` approach.

## Customizing with grouping hints

To keep configs concise, Graphene supports series grouping hints:

- `encode.group`: split one series template into one series per distinct field value
- `encode.stack`: same split behavior, but with stacked series semantics
- `stackPercentage: true`: convert stacked values to percentages (100% stacked)

Example:

```markdown
<ECharts
  data=sales_by_month_and_region
  config={{
    xAxis: {},
    yAxis: {},
    series: [{
      type: 'bar',
      encode: {x: 'month', y: 'revenue', stack: 'region'},
      stack: 'revenue-stack',
      stackPercentage: true
    }]
  }}
/>
```

This is the recommended path for custom charts: start from an ECharts config, then rely on Graphene enrichments for defaults instead of re-implementing shared behavior.

---
title: Funnel Chart
description: Display how a single metric changes across a series of stages. Funnel charts are widely used for visualizing conversion.
---

Use funnel charts to display a single metric across a series of stages. Funnel charts are widely used for visualizing conversion.


**Example:**

```markdown
<FunnelChart 
    data={funnel_data} 
    nameCol=stage
    valueCol=customers
/>
```

## Examples

### Ascending

**Example:**

```markdown
<FunnelChart 
    data={funnel_data} 
    nameCol=stage
    valueCol=customers
    funnelSort=ascending
/>
```

### Alignment

**Example:**

```markdown
<FunnelChart 
    data={funnel_data} 
    nameCol=stage
    valueCol=customers
    funnelAlign=left
/>
```

### Show Percent Label

**Example:**

```markdown
<FunnelChart 
    data={funnel_data} 
    nameCol=stage
    valueCol=customers
    showPercent=true
/>
```

## Options

### Data

| Property | Required | Type | Default | Description |
|----------|----------|------|---------|-------------|
| data | ✓ | query name | | Query name, wrapped in curly braces |
| nameCol | ✓ | column name | | Column to use for the name of the chart |
| valueCol | ✓ | column name | | Column to use for the value of the chart |
| emptySet | | error/warn/pass | error | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. |
| emptyMessage | | string | "No records" | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). |

### Formatting & Styling

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| valueFmt | Excel-style format \| built-in format \| custom format | | Format to use for `valueCol` ([see available formats](/core-concepts/formatting)) |
| outlineColor | CSS name \| hexademical \| RGB \| HSL | transparent | Border color. Only accepts a single color. |
| outlineWidth | number | 1 | Border Width. It should be a natural number. |
| labelPosition | left/right/inside | inside | Position of funnel item's label. |
| showPercent | true/false | false | Show percentage in data labels |
| funnelSort | none/ascending/descending | none | Data sorting of the chart. |
| funnelAlign | left/right/center | center | Alignment of funnel. |
| colorPalette | array of color strings (CSS name \| hexademical \| RGB \| HSL) | built-in color palette | Array of custom colours to use for the chart. E.g., `{['#cf0d06','#eb5752','#e88a87']}` |

### Chart

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| title | string | | Chart title. Appears at top left of chart. |
| subtitle | string | | Chart subtitle. Appears just under title. |
| legend | true/false | true | Turns legend on or off. Legend appears at top center of chart. |
| renderer | canvas/svg | canvas | Which chart renderer type (canvas or SVG) to use. See ECharts' [documentation on renderers](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/). |

### Custom Echarts Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| echartsOptions | `{{exampleOption:'exampleValue'}}` | | Custom Echarts options to override the default options. See [reference page](/components/charts/echarts-options) for available options. |
| seriesOptions | `{{exampleSeriesOption:'exampleValue'}}` | | Custom Echarts options to override the default options for all series in the chart. This loops through the series to apply the settings rather than having to specify every series manually using `echartsOptions` See [reference page](/components/charts/echarts-options) for available options. |
| printEchartsConfig | true/false | false | Helper prop for custom chart development - inserts a code block with the current echarts config onto the page so you can see the options used and debug your custom options |

### Interactivity

| Property | Type | Description |
|----------|------|-------------|
| connectGroup | | Group name to connect this chart to other charts for synchronized tooltip hovering. Charts with the same `connectGroup` name will become connected |

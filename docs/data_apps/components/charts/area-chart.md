---
title: 'Area Chart'
description: Track how a metric with multiple series changes over time, or a continuous range. 
---

Use area charts to track how a metric with multiple series changes over time, or a continuous range. Area charts emphasize changes in the sum of series over the individual series.

**Example:**

```markdown
<AreaChart 
    data={orders_by_month}
    x=month
    y=sales
/>
```

## Examples

### Area

**Example:**

```markdown
<AreaChart 
    data={orders_by_month}
    x=month
    y=sales
/>
```

### Stacked

**Example:**

```markdown
<AreaChart 
    data={orders_by_category_2021}
    x=month
    y=sales
    series=category
/>
```

### 100% Stacked

**Example:**

```markdown
<AreaChart 
    data={orders_by_category_2021}
    x=month
    y=sales
    series=category
    type=stacked100
/>
```

### Stepped Line

**Example:**

```markdown
<AreaChart 
    data={orders_by_category_2021}
    x=month
    y=sales
    series=category
    step=true
/>
```

### Y-Axis Formatting

**Example:**

```markdown
<AreaChart 
    data={orders_by_month}
    x=month
    y=sales
    yFmt=usd0
/>
```

### Labels

**Example:**

```markdown
<AreaChart 
    data={orders_by_month}
    x=month
    y=sales
    labels=true
    labelFmt=usd0k
/>
```

## Options

### Data

| Property | Required | Type | Default | Description |
|----------|----------|------|---------|-------------|
| data | ✓ | query name | | Query name, wrapped in curly braces |
| x | ✓ | column name | First column | Column to use for the x-axis of the chart |
| y | ✓ | column name \| array of column names | Any non-assigned numeric columns | Column(s) to use for the y-axis of the chart |
| series | | column name | - | Column to use as the series (groups) in a multi-series chart |
| sort | | true/false | true | Whether to apply default sort to your data. Default sort is x ascending for number and date x-axes, and y descending for category x-axes |
| type | | stacked/stacked100 | stacked | Grouping method to use for multi-series charts |
| handleMissing | | gap/connect/zero | gap (single series) \| zero (multi-series) | Treatment of missing values in the dataset |
| emptySet | | error/warn/pass | error | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. |
| emptyMessage | | string | "No records" | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). |

### Formatting & Styling

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| xFmt | Excel-style format \| built-in format name \| custom format name | - | Format to use for x column ([see available formats](/core-concepts/formatting)) |
| yFmt | Excel-style format \| built-in format name \| custom format name | - | Format to use for y column ([see available formats](/core-concepts/formatting)) |
| seriesLabelFmt | Excel-style format \| built-in format name \| custom format name | - | Format to use for series label ([see available formats](/core-concepts/formatting)) |
| step | true/false | false | Specifies whether the chart is displayed as a step line. |
| stepPosition | start/middle/end | end | Configures the position of turn points for a step line chart. |
| fillColor | CSS name \| hexademical \| RGB \| HSL | - | Color to override default series color. Only accepts a single color. |
| lineColor | CSS name \| hexademical \| RGB \| HSL | - | Color to override default line color. Only accepts a single color. |
| fillOpacity | number (0 to 1) | 0.7 | % of the full color that should be rendered, with remainder being transparent |
| line | true/false | true | Show line on top of the area |
| colorPalette | array of color strings (CSS name \| hexademical \| RGB \| HSL) | built-in color palette | Array of custom colours to use for the chart E.g., ['#cf0d06','#eb5752','#e88a87'] Note that the array must be surrounded by curly braces. |
| seriesColors | object with series names and assigned colors | colors applied by order of series in data | Apply a specific color to each series in your chart. Unspecified series will receive colors from the built-in palette as normal. Note the double curly braces required in the syntax |
| seriesOrder | Array of series names in the order they should be used in the chart | default order implied by the data | Apply a specific order to the series in a multi-series chart. |
| leftPadding | number | | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off |
| rightPadding | number | | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off |
| xLabelWrap | true/false | false | Whether to wrap x-axis labels when there is not enough space. Default behaviour is to truncate the labels. |

### Value Labels

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| labels | true/false | false | Show value labels |
| labelSize | number | 11 | Font size of value labels |
| labelPosition | above/middle/below | above | Where label will appear on your series |
| labelColor | CSS name \| hexademical \| RGB \| HSL | Automatic based on color contrast of background | Font color of value labels |
| labelFmt | Excel-style format \| built-in format name \| custom format name | same as y column | Format to use for value labels ([see available formats](/core-concepts/formatting)) |
| showAllLabels | true/false | false | Allow all labels to appear on chart, including overlapping labels |

### Axes

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| yLog | true/false | false | Whether to use a log scale for the y-axis |
| yLogBase | number | 10 | Base to use when log scale is enabled |
| xAxisTitle | true/string/false | false | Name to show under x-axis. If 'true', formatted column name is used. Only works with swapXY=false |
| yAxisTitle | true/string/false | false | Name to show beside y-axis. If 'true', formatted column name is used. |
| xGridlines | true/false | false | Turns on/off gridlines extending from x-axis tick marks (vertical lines when swapXY=false) |
| yGridlines | true/false | true | Turns on/off gridlines extending from y-axis tick marks (horizontal lines when swapXY=false) |
| xAxisLabels | true/false | true | Turns on/off value labels on the x-axis |
| yAxisLabels | true/false | true | Turns on/off value labels on the y-axis |
| xBaseline | true/false | true | Turns on/off thick axis line (line appears at y=0) |
| yBaseline | true/false | false | Turns on/off thick axis line (line appears directly alongside the y-axis labels) |
| xTickMarks | true/false | false | Turns on/off tick marks for each of the x-axis labels |
| yTickMarks | true/false | false | Turns on/off tick marks for each of the y-axis labels |
| yMin | number | - | Starting value for the y-axis |
| yMax | number | - | Maximum value for the y-axis |
| yScale | true/false | false | Whether to scale the y-axis to fit your data. `yMin` and `yMax` take precedence over `yScale` |

### Chart

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| title | string | - | Chart title. Appears at top left of chart. |
| subtitle | string | - | Chart subtitle. Appears just under title. |
| legend | true/false | true for multiple series | Turns legend on or off. Legend appears at top center of chart. |
| chartAreaHeight | number | 180 | Minimum height of the chart area (excl. header and footer) in pixels. Adjusting the height affects all viewport sizes and may impact the mobile UX. |
| renderer | canvas/svg | canvas | Which chart renderer type (canvas or SVG) to use. See ECharts' [documentation on renderers](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/). |
| downloadableData | true/false | true | Whether to show the download button to allow users to download the data |
| downloadableImage | true/false | true | Whether to show the button to allow users to save the chart as an image |

### Custom Echarts Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| echartsOptions | `{{exampleOption:'exampleValue'}}` | - | Custom Echarts options to override the default options. See [reference page](/components/charts/echarts-options) for available options. |
| seriesOptions | `{{exampleSeriesOption:'exampleValue'}}` | - | Custom Echarts options to override the default options for all series in the chart. This loops through the series to apply the settings rather than having to specify every series manually using `echartsOptions` See [reference page](/components/charts/echarts-options) for available options. |
| printEchartsConfig | true/false | false | Helper prop for custom chart development - inserts a code block with the current echarts config onto the page so you can see the options used and debug your custom options |

### Interactivity

| Property | Type | Description |
|----------|------|-------------|
| connectGroup | | Group name to connect this chart to other charts for synchronized tooltip hovering. Charts with the same `connectGroup` name will become connected |

## Annotations

Area charts can include [annotations](/components/charts/annotations) using the `ReferenceLine` and `ReferenceArea` components. These components are used within a chart component like so:

```html
<AreaChart data={sales_data} x=date y=sales>
	<ReferenceLine data={target_data} y=target label=name />
	<ReferenceArea xMin='2020-03-14' xMax='2020-05-01' />
</AreaChart>
```

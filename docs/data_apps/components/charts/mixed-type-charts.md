---
title: Mixed-Type Charts
description: Display multiple series types on the same chart, for example a bar for an amount, and a line for a related percentage.
---

Use mixed-type charts to display multiple series types on the same chart, for example a bar for an amount, and a line for a related percentage. 

Mixed-type charts can be confusing, so use them sparingly. To add reference lines, areas or points to a chart instead, see [Annotations](/components/charts/annotations).

> **Info**
> 
> The easiest way to create mixed-type charts is setting up [a secondary y-axis in `LineChart`](/components/charts/line-chart#secondary-axis-with-bar) or a [secondary axis in `BarChart`](/components/charts/bar-chart#secondary-axis-with-line)

You can combine multiple chart types inside a single `<Chart>` tag to create mixed-type charts.

## Examples

### Mixed-Type Chart

This example uses multiple y columns and multiple series types (bar and line)

```markdown
<Chart data="fda_recalls">
    <Bar y=voluntary_recalls/>
    <Line y=fda_recalls/>
</Chart>
```

Because x is the first column in the dataset, an explicit `x` prop is not required.

This structure also gives you control over the individual series on your chart. For example, if you have a single series running through a component, you can override props specifically for that series. Since the FDA acronym was not fully capitalized above, you can rename that specific series inside the `<Line>` primitive:

```markdown
<Chart data="fda_recalls">
    <Bar y=voluntary_recalls/>
    <Line y=fda_recalls name="FDA Recalls"/>
</Chart>
```

# Chart `<Chart>`

```markdown
<Chart data="query_name">
    Insert primitives here
</Chart>
```

## Data

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | Query name, wrapped in curly braces | true | query name | - |
| x | Column to use for the x-axis of the chart | false | column name | - |
| y | Column(s) to use for the y-axis of the chart | false | column name \| array of column names | - |
| sort | Whether to apply default sort to your data. Default is x ascending for number and date x-axes, and y descending for category x-axes | false | ['true', 'false'] | "true" |
| series | Column to use as the series (groups) in a multi-series chart | false | column name | - |
| xFmt | Format to use for x column ([see available formats](/core-concepts/formatting)) | false | Excel-style format \| built-in format name \| custom format name | - |
| yFmt | Format to use for y column ([see available formats](/core-concepts/formatting)) | false | Excel-style format \| built-in format name \| custom format name | - |
| yLog | Whether to use a log scale for the y-axis | false | ['true', 'false'] | "false" |
| yLogBase | Base to use when log scale is enabled | false | number | 10 |
| emptySet | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in build:strict. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. | false | ['error', 'warn', 'pass'] | "error" |
| emptyMessage | Text to display when an empty dataset is received - only applies when emptySet is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). | false | string | "No records" |

## Chart

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| swapXY | Swap the x and y axes to create a horizontal chart | false | ['true', 'false'] | "false" |
| title | Chart title. Appears at top left of chart. | false | string | - |
| subtitle | Chart subtitle. Appears just under title. | false | string | - |
| legend | Turns legend on or off. Legend appears at top center of chart. | false | ['true', 'false'] | true for multiple series |
| chartAreaHeight | Minimum height of the chart area (excl. header and footer) in pixels. Adjusting the height affects all viewport sizes and may impact the mobile UX. | false | number | 180 |
| xAxisTitle | Name to show under x-axis. If 'true', formatted column name is used. Only works with swapXY=false | false | ['true', 'string', 'false'] | "false" |
| yAxisTitle | Name to show beside y-axis. If 'true', formatted column name is used. | false | ['true', 'string', 'false'] | "false" |
| xGridlines | Turns on/off gridlines extending from x-axis tick marks (vertical lines when swapXY=false) | false | ['true', 'false'] | "false" |
| yGridlines | Turns on/off gridlines extending from y-axis tick marks (horizontal lines when swapXY=false) | false | ['true', 'false'] | "true" |
| xAxisLabels | Turns on/off value labels on the x-axis | false | ['true', 'false'] | "true" |
| yAxisLabels | Turns on/off value labels on the y-axis | false | ['true', 'false'] | "true" |
| xBaseline | Turns on/off thick axis line (line appears at y=0) | false | ['true', 'false'] | "true" |
| yBaseline | Turns on/off thick axis line (line appears directly alongside the y-axis labels) | false | ['true', 'false'] | "false" |
| xTickMarks | Turns on/off tick marks for each of the x-axis labels | false | ['true', 'false'] | "false" |
| yTickMarks | Turns on/off tick marks for each of the y-axis labels | false | ['true', 'false'] | "false" |
| yMin | Starting value for the y-axis | false | number | - |
| yMax | Maximum value for the y-axis | false | number | - |
| yScale | Whether to scale the y-axis to fit your data. yMin and yMax take precedence over yScale | false | ['true', 'false'] | "false" |
| options | JavaScript object to add or override chart configuration settings (see Custom Charts page) | false | object | - |
| colorPalette | Array of custom colours to use for the chart. E.g., `{['#cf0d06','#eb5752','#e88a87']}` | false | array of color strings (CSS name \| hexademical \| RGB \| HSL) | built-in color palette |
| seriesColors | Apply a specific color to each series in your chart. Unspecified series will receive colors from the built-in palette as normal. Note the double curly braces required in the syntax `seriesColors={{"Canada": "red", "US": "blue"}}` | false | object with series names and assigned colors | colors applied by order of series in data |
| renderer | Which chart renderer type (canvas or SVG) to use. See ECharts' [documentation on renderers](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg). | false | ['canvas', 'svg'] | "canvas" |
| downloadableData | Whether to show the download button to allow users to download the data | false | ["true", "false"] | "true" |
| downloadableImage | Whether to show the button to allow users to save the chart as an image | false | ["true", "false"] | "true" |

# Line `<Line/>`

```markdown
<Chart data="query_name">
    <Line/>
</Chart>
```

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| y | Column(s) to use for the y-axis of the chart. Can be different than the y supplied to Chart | false | column name \| array of column names | y supplied to Chart |
| series | Column to use as the series (groups) in a multi-series chart. Can be different than the series supplied to Chart | false | column name | series supplied to Chart |
| name | Name to show in legend for a single series (to override column name) | false | string | - |
| lineColor | Color to override default series color. Only accepts a single color. | false | CSS name \| hexademical \| RGB \| HSL | - |
| lineOpacity | % of the full color that should be rendered, with remainder being transparent | false | number (0 to 1) | 1 |
| lineType | Options to show breaks in a line (dashed or dotted) | false | ['solid', 'dashed', 'dotted'] | "solid" |
| lineWidth | Thickness of line (in pixels) | false | number | 2 |
| markers | Turn on/off markers (shapes rendered onto the points of a line) | false | ['true', 'false'] | "false" |
| markerShape | Shape to use if markers=true | false | ['circle', 'emptyCircle', 'rect', 'triangle', 'diamond'] | "circle" |
| markerSize | Size of each shape (in pixels) | false | number | 8 |
| handleMissing | Treatment of missing values in the dataset | false | ['gap', 'connect', 'zero'] | "gap" |
| options | JavaScript object to add or override chart configuration settings (see Custom Charts page) | false | object | - |

# Area `<Area/>`

```markdown
<Chart data="query_name">
    <Area/>
</Chart>
```

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| y | Column(s) to use for the y-axis of the chart. Can be different than the y supplied to Chart | false | column name \| array of column names | y supplied to Chart |
| series | Column to use as the series (groups) in a multi-series chart. Can be different than the series supplied to Chart | false | column name | series supplied to Chart |
| name | Name to show in legend for a single series (to override column name) | false | string | - |
| fillColor | Color to override default series color. Only accepts a single color. | false | CSS name \| hexademical \| RGB \| HSL | - |
| fillOpacity | % of the full color that should be rendered, with remainder being transparent | false | number (0 to 1) | 0.7 |
| line | Show line on top of the area | false | ['true', 'false'] | "true" |
| handleMissing | Treatment of missing values in the dataset | false | ['gap', 'connect', 'zero'] | gap (single series) \| zero (multi-series) |
| options | JavaScript object to add or override chart configuration settings (see Custom Charts page) | false | object | - |

# Bar `<Bar/>`

```markdown
<Chart data="query_name">
    <Bar/>
</Chart>
```

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| y | Column to use for the y-axis of the chart | false | column name | - |
| name | Name to show in legend for a single series (to override column name) | false | string | - |
| type | Grouping method to use for multi-series charts | false | ['stacked', 'grouped'] | "stacked" |
| stackName | Name for an individual stack. If separate Bar components are used with different stackNames, the chart will show multiple stacks | false | string | - |
| fillColor | Color to override default series color. Only accepts a single color. | false | CSS name \| hexademical \| RGB \| HSL | - |
| fillOpacity | % of the full color that should be rendered, with remainder being transparent | false | number (0 to 1) | 1 |
| outlineWidth | Width of line surrounding each bar | false | number | 0 |
| outlineColor | Color to use for outline if outlineWidth > 0 | false | CSS name \| hexademical \| RGB \| HSL | - |
| options | JavaScript object to add or override chart configuration settings (see Custom Charts page) | false | object | - |

# Scatter `<Scatter/>`

```markdown
<Chart data="query_name">
    <Scatter/>
</Chart>
```

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| y | Column to use for the y-axis of the chart | false | column name | - |
| name | Name to show in legend for a single series (to override column name) | false | string | - |
| shape | Options for which shape to use for scatter points | false | ['circle', 'emptyCircle', 'rect', 'triangle', 'diamond'] | "circle" |
| pointSize | Change size of all points on the chart | false | number | 10 |
| opacity | % of the full color that should be rendered, with remainder being transparent | false | number (0 to 1) | 0.7 |
| fillColor | Color to override default series color. Only accepts a single color. | false | CSS name \| hexademical \| RGB \| HSL | - |
| outlineWidth | Width of line surrounding each shape | false | number | 0 |
| outlineColor | Color to use for outline if outlineWidth > 0 | false | CSS name \| hexademical \| RGB \| HSL | - |
| options | JavaScript object to add or override chart configuration settings (see Custom Charts page) | false | object | - |

# Bubble `<Bubble/>`

```markdown
<Chart data="query_name">
    <Bubble/>
</Chart>
```

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| y | Column to use for the y-axis of the chart | false | column name | - |
| size | Column to use to scale the size of the bubbles | false | column name | - |
| name | Name to show in legend for a single series (to override column name) | false | string | - |
| shape | Options for which shape to use for bubble points | false | ['circle', 'emptyCircle', 'rect', 'triangle', 'diamond'] | "circle" |
| minSize | Minimum bubble size | false | number | 200 |
| maxSize | Maximum bubble size | false | number | 400 |
| opacity | % of the full color that should be rendered, with remainder being transparent | false | number (0 to 1) | 0.7 |
| fillColor | Color to override default series color. Only accepts a single color. | false | CSS name \| hexademical \| RGB \| HSL | - |
| outlineWidth | Width of line surrounding each shape | false | number | 0 |
| outlineColor | Color to use for outline if outlineWidth > 0 | false | CSS name \| hexademical \| RGB \| HSL | - |
| options | JavaScript object to add or override chart configuration settings (see Custom Charts page) | false | object | - |

# Hist `<Hist/>`

```markdown
<Chart data="query_name">
    <Hist/>
</Chart>
```

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| x | Column which contains the data you want to summarize | false | column name | - |
| fillColor | Color to override default series color | false | CSS name \| hexademical \| RGB \| HSL | - |
| fillOpacity | % of the full color that should be rendered, with remainder being transparent | false | number (0 to 1) | 1 |
| options | JavaScript object to add or override chart configuration settings (see Custom Charts page) | false | object | - |

### Interactivity

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| connectGroup | Group name to connect this chart to other charts for synchronized tooltip hovering. Charts with the same `connectGroup` name will become connected | false | - | - |

## Annotations

Mixed type charts can include [annotations](/components/charts/annotations) using the `ReferenceLine` and `ReferenceArea` components. These components are used within a chart component like so:

```html
<Chart data="sales_data" x=date y=sales>
  <Line y=sales/>
  <ReferenceLine data="target_data" y=target label=name/>
  <ReferenceArea xMin='2020-03-14' xMax='2020-05-01'/>
</Chart>
```

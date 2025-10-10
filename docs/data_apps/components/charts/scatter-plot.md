---
title: Scatter Plot
description: Show the correlation between two metrics for categorical values, or a set of samples.
---

Use scatter plots to show the correlation between two metrics for categorical values, or a set of samples.

## Example

```markdown
<ScatterPlot 
    data="price_vs_volume"
    x=price
    y=number_of_units
    xFmt=usd0
    series=category
/>
```

## Examples

### Default

```markdown
<ScatterPlot 
    data="price_vs_volume"
    x=price
    y=number_of_units
/>
```

### Multi-Series

```markdown
<ScatterPlot 
    data="price_vs_volume"
    x=price
    y=number_of_units
    series=category
/>
```

## Options

### Data

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | Query name, wrapped in curly braces | true | query name | - |
| x | Column to use for the x-axis of the chart | true | column name | First column |
| y | Column(s) to use for the y-axis of the chart | true | column name \| array of column names | Any non-assigned numeric columns |
| series | Column to use as the series (groups) in a multi-series chart | false | column name | - |
| sort | Whether to apply default sort to your data. Default is x ascending for number and date x-axes, and y descending for category x-axes | false | ['true', 'false'] | "true" |
| tooltipTitle | Column to use as the title for each tooltip. Typically, this is a name to identify each point. | false | column name | - |
| emptySet | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. | false | ['error', 'warn', 'pass'] | "error" |
| emptyMessage | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). | false | string | "No records" |

### Formatting & Styling

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| xFmt | Format to use for x column ([see available formats](/core-concepts/formatting)) | false | Excel-style format \| built-in format name \| custom format name | - |
| yFmt | Format to use for y column ([see available formats](/core-concepts/formatting)) | false | Excel-style format \| built-in format name \| custom format name | - |
| seriesLabelFmt | Format to use for series label ([see available formats](/core-concepts/formatting)) | false | Excel-style format \| built-in format name \| custom format name | "-" |
| shape | Options for which shape to use for scatter points | false | circle \| emptyCircle \| rect \| triangle \| diamond | "circle" |
| pointSize | Change size of all points on the chart | false | number | 10 |
| opacity | % of the full color that should be rendered, with remainder being transparent | false | number (0 to 1) | 0.7 |
| fillColor | Color to override default series color. Only accepts a single color. | false | CSS name \| hexademical \| RGB \| HSL | - |
| outlineWidth | Width of line surrounding each shape | false | number | 0 |
| outlineColor | Color to use for outline if outlineWidth > 0 | false | CSS name \| hexademical \| RGB \| HSL | - |
| colorPalette | Array of custom colours to use for the chart. E.g., `{['#cf0d06','#eb5752','#e88a87']}` | false | array of color strings (CSS name \| hexademical \| RGB \| HSL) | built-in color palette |
| seriesColors | Apply a specific color to each series in your chart. Unspecified series will receive colors from the built-in palette as normal. Note the double curly braces required in the syntax `seriesColors={{"Canada": "red", "US": "blue"}}` | false | object with series names and assigned colors | colors applied by order of series in data |
| seriesOrder | Apply a specific order to the series in a multi-series chart. | false | Array of series names in the order they should be used in the chart seriesOrder="`{['series one', 'series two']"`} | default order implied by the data |
| leftPadding | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off | false | number | - |
| rightPadding | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off | false | number | - |
| xLabelWrap | Whether to wrap x-axis labels when there is not enough space. Default behaviour is to truncate the labels. | false | ["true", "false"] | "false" |

### Axes

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| yLog | Whether to use a log scale for the y-axis | false | ['true', 'false'] | 'false' |
| yLogBase | Base to use when log scale is enabled | false | 'number' | '10' |
| xAxisTitle | Name to show under x-axis. If 'true', formatted column name is used. Only works with swapXY=false | false | 'true \| string \| false' | 'true' |
| yAxisTitle | Name to show beside y-axis. If 'true', formatted column name is used. | false | 'true \| string \| false' | 'true' |
| xGridlines | Turns on/off gridlines extending from x-axis tick marks (vertical lines when swapXY=false) | false | ['true', 'false'] | 'false' |
| yGridlines | Turns on/off gridlines extending from y-axis tick marks (horizontal lines when swapXY=false) | false | ['true', 'false'] | 'true' |
| xAxisLabels | Turns on/off value labels on the x-axis | false | ['true', 'false'] | 'true' |
| yAxisLabels | Turns on/off value labels on the y-axis | false | ['true', 'false'] | 'true' |
| xBaseline | Turns on/off thick axis line (line appears at y=0) | false | ['true', 'false'] | 'true' |
| yBaseline | Turns on/off thick axis line (line appears directly alongside the y-axis labels) | false | ['true', 'false'] | 'false' |
| xTickMarks | Turns on/off tick marks for each of the x-axis labels | false | ['true', 'false'] | 'false' |
| yTickMarks | Turns on/off tick marks for each of the y-axis labels | false | ['true', 'false'] | 'false' |
| xMin | Starting value for the x-axis | false | 'number' | - |
| xMax | Maximum value for the x-axis | false | 'number' | - |
| yMin | Starting value for the y-axis | false | 'number' | - |
| yMax | Maximum value for the y-axis | false | 'number' | - |

### Chart

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| title | Chart title. Appears at top left of chart. | false | 'string' | - |
| subtitle | Chart subtitle. Appears just under title. | false | 'string' | - |
| legend | Turns legend on or off. Legend appears at top center of chart. | false | ['true', 'false'] | 'true for multiple series' |
| chartAreaHeight | Minimum height of the chart area (excl. header and footer) in pixels. Adjusting the height affects all viewport sizes and may impact the mobile UX. | false | 'number' | '180' |
| renderer | Which chart renderer type (canvas or SVG) to use. See ECharts' [documentation on renderers](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg). | false | 'canvas \| svg' | 'canvas' |
| downloadableData | Whether to show the download button to allow users to download the data | false | ["true", "false"] | "true" |
| downloadableImage | Whether to show the button to allow users to save the chart as an image | false | ["true", "false"] | "true" |

### Custom Echarts Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| echartsOptions | Custom Echarts options to override the default options. See [reference page](/components/charts/echarts-options) for available options. | false | `{{exampleOption:'exampleValue'}}` | - |
| seriesOptions | Custom Echarts options to override the default options for all series in the chart. This loops through the series to apply the settings rather than having to specify every series manually using `echartsOptions` See [reference page](/components/charts/echarts-options) for available options. | false | `{{exampleSeriesOption:'exampleValue'}}` | - |
| printEchartsConfig | Helper prop for custom chart development - inserts a code block with the current echarts config onto the page so you can see the options used and debug your custom options | false | ['true', 'false'] | "false" |

### Interactivity

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| connectGroup | Group name to connect this chart to other charts for synchronized tooltip hovering. Charts with the same `connectGroup` name will become connected | false | - | - |

## Annotations

Scatter plots can include [annotations](/components/charts/annotations) using the `ReferenceLine` and `ReferenceArea` components. These components are used within a chart component like so:

```html
<ScatterPlot data="sales_data" x=date y=sales>
  <ReferenceLine data="target_data" y=target label=name/>
  <ReferenceArea xMin='2020-03-14' xMax='2020-05-01'/>
</ScatterPlot>
```

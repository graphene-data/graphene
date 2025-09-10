---
title: Bubble Chart
description: Display categorical data across three metrics. The X and Y position, and the size of the bubble each represent a different metric for the category.
---

Use bubble charts to display categorical data across three metrics. The X and Y position, and the size of the bubble each represent a different metric for the category.

**Example:**

```markdown
<BubbleChart 
    data={price_vs_volume}
    x=price
    y=number_of_units
    xFmt=usd0
    series=category
    size=total_sales
/>
```

## Examples

### Default

**Example:**

```markdown
<BubbleChart 
    data={price_vs_volume}
    x=price
    y=number_of_units
    size=total_sales
/>
```

### Multi-Series

**Example:**

```markdown
<BubbleChart 
    data={price_vs_volume}
    x=price
    y=number_of_units
    series=category
    size=total_sales
/>
```

## Options

### Data

| Property | Required | Type | Default | Description |
|----------|----------|------|---------|-------------|
| data | ✓ | query name | | Query name, wrapped in curly braces |
| x | ✓ | column name | First column | Column to use for the x-axis of the chart |
| y | ✓ | column name \| array of column names | Any non-assigned numeric columns | Column(s) to use for the y-axis of the chart |
| series | | column name | | Column to use as the series (groups) in a multi-series chart |
| size | ✓ | column name | | Column to use to scale the size of the bubbles |
| sort | | true/false | true | Whether to apply default sort to your data. Default is x ascending for number and date x-axes, and y descending for category x-axes |
| tooltipTitle | | column name | | Column to use as the title for each tooltip. Typically, this is a name to identify each point. |
| emptySet | | error/warn/pass | error | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. |
| emptyMessage | | string | "No records" | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). |

### Formatting & Styling

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| xFmt | Excel-style format \| built-in format name \| custom format name | | Format to use for x column ([see available formats](/core-concepts/formatting)) |
| yFmt | Excel-style format \| built-in format name \| custom format name | | Format to use for y column ([see available formats](/core-concepts/formatting)) |
| sizeFmt | Excel-style format \| built-in format name \| custom format name | | Format to use for size column ([see available formats](/core-concepts/formatting)) |
| seriesLabelFmt | Excel-style format \| built-in format name \| custom format name | - | Format to use for series label ([see available formats](/core-concepts/formatting)) |
| shape | circle \| emptyCircle \| rect \| triangle \| diamond | circle | Options for which shape to use for bubble points |
| scaleTo | number | 1 | Scale the size of the bubbles by this factor (e.g., 2 will double the size) |
| opacity | number (0 to 1) | 0.7 | % of the full color that should be rendered, with remainder being transparent |
| fillColor | CSS name \| hexademical \| RGB \| HSL | | Color to override default series color. Only accepts a single color. |
| outlineWidth | number | 0 | Width of line surrounding each shape |
| outlineColor | CSS name \| hexademical \| RGB \| HSL | | Color to use for outline if outlineWidth > 0 |
| colorPalette | array of color strings (CSS name \| hexademical \| RGB \| HSL) | built-in color palette | Array of custom colours to use for the chart. E.g., ['#cf0d06','#eb5752','#e88a87'] Note that the array must be surrounded by curly braces. |
| seriesColors | object with series names and assigned colors | colors applied by order of series in data | Apply a specific color to each series in your chart. Unspecified series will receive colors from the built-in palette as normal. Note the double curly braces required in the syntax |
| seriesOrder | Array of series names in the order they should be used in the chart | default order implied by the data | Apply a specific order to the series in a multi-series chart. |
| leftPadding | number | | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off |
| rightPadding | number | | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off |
| xLabelWrap | true/false | false | Whether to wrap x-axis labels when there is not enough space. Default behaviour is to truncate the labels. |

### Axes

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| yLog | true/false | false | Whether to use a log scale for the y-axis |
| yLogBase | number | 10 | Base to use when log scale is enabled |
| xAxisTitle | true/string/false | true | Name to show under x-axis. If 'true', formatted column name is used. Only works with swapXY=false |
| yAxisTitle | true/string/false | true | Name to show beside y-axis. If 'true', formatted column name is used. |
| xGridlines | true/false | false | Turns on/off gridlines extending from x-axis tick marks (vertical lines when swapXY=false) |
| yGridlines | true/false | true | Turns on/off gridlines extending from y-axis tick marks (horizontal lines when swapXY=false) |
| xAxisLabels | true/false | true | Turns on/off value labels on the x-axis |
| yAxisLabels | true/false | true | Turns on/off value labels on the y-axis |
| xBaseline | true/false | true | Turns on/off thick axis line (line appears at y=0) |
| yBaseline | true/false | false | Turns on/off thick axis line (line appears directly alongside the y-axis labels) |
| xTickMarks | true/false | false | Turns on/off tick marks for each of the x-axis labels |
| yTickMarks | true/false | false | Turns on/off tick marks for each of the y-axis labels |
| yMin | number | | Starting value for the y-axis |
| yMax | number | | Maximum value for the y-axis |

### Chart

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| title | string | | Chart title. Appears at top left of chart. |
| subtitle | string | | Chart subtitle. Appears just under title. |
| legend | true/false | true for multiple series | Turns legend on or off. Legend appears at top center of chart. |
| chartAreaHeight | number | 180 | Minimum height of the chart area (excl. header and footer) in pixels. Adjusting the height affects all viewport sizes and may impact the mobile UX. |
| renderer | canvas/svg | canvas | Which chart renderer type (canvas or SVG) to use. See ECharts' [documentation on renderers](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/). |
| downloadableData | true/false | true | Whether to show the download button to allow users to download the data |
| downloadableImage | true/false | true | Whether to show the button to allow users to save the chart as an image |

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

## Annotations

Bubble charts can include [annotations](/components/charts/annotations) using the `ReferenceLine` and `ReferenceArea` components. These components are used within a chart component like so:

**Example:**

```markdown
<BubbleChart 
    data={price_vs_volume}
    x=price
    xFmt=usd0
    y=number_of_units
    size=total_sales
>
    <ReferenceLine
        x=75
        label="Consumer Limit"
    />
</BubbleChart>
```

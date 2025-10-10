---
title: Line Chart
description: Display how one or more metrics vary over time. Line charts are suitable for plotting a large number of data points on the same chart.
---

Use line charts to display how one or more metrics vary over time. Line charts are suitable for plotting a large number of data points on the same chart.


## Example

```svelte
<LineChart 
    data="orders_by_month"
    x=month
    y=sales_usd0k 
    yAxisTitle="Sales per Month"
/>
```

## Examples

### Line

```svelte
<LineChart 
    data="orders_by_month"
    x=month
    y=sales_usd0k 
    yAxisTitle="Sales per Month"
    title="Monthly Sales"
    subtitle="Includes all categories"
/>
```

### Multi-Series Line

```markdown
<LineChart 
    data="orders_by_category"
    x=month
    y=sales_usd0k 
    yAxisTitle="Sales per Month"
    series=category
/>
```

### Multi-Series Line with Steps

```svelte
<LineChart 
    data="orders_by_category"
    x=month
    y=sales_usd0k 
    yAxisTitle="Sales per Month"
    series=category
    step=true
/>
```

### Multiple y Columns

```svelte
<LineChart 
    data="orders_by_month"
    x=month
    y={['sales_usd0k','orders']} 
    yAxisTitle="Sales per Month"
/>
```

### Secondary y Axis

```markdown
<LineChart 
    data="orders_by_month"
    x=month
    y=sales_usd0k
    y2=orders
    yAxisTitle="Sales per Month"
/>
```

### Secondary Axis with Bar

```markdown
<LineChart 
    data="orders_by_month"
    x=month
    y=sales_usd0k
    y2=orders
    y2SeriesType=bar
    yAxisTitle="Sales per Month"
/>
```

### Value Labels

```markdown
<LineChart 
    data="orders_by_month"
    x=month
    y=sales_usd0k 
    yAxisTitle="Sales per Month"
    labels=true
/>
```

### Custom Color Palette

```markdown
<LineChart 
    data="orders_by_category"
    x=month
    y=sales_usd0k 
    yAxisTitle="Sales per Month"
    series=category
    colorPalette="
        [
        '#cf0d06',
        '#eb5752',
        '#e88a87',
        '#fcdad9',
        ]
    "
/>
```

### Markers

#### Default

```svelte
<LineChart 
    data="orders_by_month"
    x=month
    y=sales_usd0k
    markers=true 
/>
```

#### `markerShape=emptyCircle`

```svelte
<LineChart 
    data="orders_by_month"
    x=month
    y=sales_usd0k 
    markers=true
    markerShape=emptyCircle
/>
```

## Options

### Data

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | Query name, wrapped in curly braces | true | query name | - |
| x | Column to use for the x-axis of the chart | true | column name | - |
| y | Column(s) to use for the y-axis of the chart | true | column name \| array of column names | - |
| y2 | Column(s) to include on a secondary y-axis | false | column name \| array of column names | - |
| y2SeriesType | Chart type to apply to the series on the y2 axis | false | ["line", "bar", "scatter"] | "line" |
| series | Column to use as the series (groups) in a multi-series chart | false | column name | - |
| sort | Whether to apply default sort to your data. Default is x ascending for number and date x-axes, and y descending for category x-axes | false | ["true", "false"] | "true" |
| handleMissing | Treatment of missing values in the dataset | false | ["gap", "connect", "zero"] | "gap" |
| emptySet | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. | false | ["error", "warn", "pass"] | "error" |
| emptyMessage | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). | false | string | - |

### Formatting & Styling

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| xFmt | Format to use for x column | false | Excel-style format \| built-in format name \| custom format name | - |
| yFmt | Format to use for y column(s) | false | Excel-style format \| built-in format name \| custom format name | - |
| y2Fmt | Format to use for y2 column(s) | false | Excel-style format \| built-in format name \| custom format name | - |
| seriesLabelFmt | Format to use for series label ([see available formats](/core-concepts/formatting)) | false | Excel-style format \| built-in format name \| custom format name | "-" |
| step | Specifies whether the chart is displayed as a step line | false | ["true", "false"] | "false" |
| stepPosition | Configures the position of turn points for a step line chart | false | ["start", "middle", "end"] | "end" |
| lineColor | Color to override default series color. Only accepts a single color | false | CSS name \| hexademical \| RGB \| HSL | - |
| lineOpacity | % of the full color that should be rendered, with remainder being transparent | false | number (0 to 1) | 1 |
| lineType | Options to show breaks in a line (dashed or dotted) | false | ["solid", "dashed", "dotted"] | "solid" |
| lineWidth | Thickness of line (in pixels) | false | number | 2 |
| markers | Turn on/off markers (shapes rendered onto the points of a line) | false | ["true", "false"] | "false" |
| markerShape | Shape to use if markers=true | false | ["circle", "emptyCircle", "rect", "triangle", "diamond"] | "circle" |
| markerSize | Size of each shape (in pixels) | false | number | 8 |
| colorPalette | Array of custom colours to use for the chart. E.g., `{['#cf0d06','#eb5752','#e88a87']}` | false | array of color strings (CSS name \| hexademical \| RGB \| HSL) | - |
| seriesColors | Apply a specific color to each series in your chart. Unspecified series will receive colors from the built-in palette as normal. Note the double curly braces required in the syntax `seriesColors={{"Canada": "red", "US": "blue"}}` | false | object with series names and assigned colors | - |
| seriesOrder | Apply a specific order to the series in a multi-series chart. | false | Array of series names in the order they should be used in the chart seriesOrder="`{['series one', 'series two']"`} | default order implied by the data |
| labels | Show value labels | false | ["true", "false"] | "false" |
| labelSize | Font size of value labels | false | number | 11 |
| labelPosition | Where label will appear on your series | false | ["above", "middle", "below"] | "above" |
| labelColor | Font color of value labels | false | CSS name \| hexademical \| RGB \| HSL | - |
| labelFmt | Format to use for value labels | false | Excel-style format \| built-in format name \| custom format name | - |
| yLabelFmt | Format to use for value labels for series on the y axis. Overrides any other formats | false | Excel-style format \| built-in format name \| custom format name | - |
| y2LabelFmt | Format to use for value labels for series on the y2 axis. Overrides any other formats | false | Excel-style format \| built-in format name \| custom format name | - |
| showAllLabels | Allow all labels to appear on chart, including overlapping labels | false | ["true", "false"] | "false" |
| leftPadding | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off | false | number | - |
| rightPadding | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off | false | number | - |
| xLabelWrap | Whether to wrap x-axis labels when there is not enough space. Default behaviour is to truncate the labels. | false | ["true", "false"] | "false" |

### Axes

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| yLog | Whether to use a log scale for the y-axis | false | ["true", "false"] | "false" |
| yLogBase | Base to use when log scale is enabled | false | number | 10 |
| xAxisTitle | Name to show under x-axis. If 'true', formatted column name is used. Only works with swapXY=false | false | ["true", "string", "false"] | "false" |
| yAxisTitle | Name to show beside y-axis. If 'true', formatted column name is used. | false | ["true", "string", "false"] | "false" |
| y2AxisTitle | Name to show beside y2 axis. If 'true', formatted column name is used. | false | ["true", "string", "false"] | "false" |
| xGridlines | Turns on/off gridlines extending from x-axis tick marks (vertical lines when swapXY=false) | false | ["true", "false"] | "false" |
| yGridlines | Turns on/off gridlines extending from y-axis tick marks (horizontal lines when swapXY=false) | false | ["true", "false"] | "true" |
| y2Gridlines | Turns on/off gridlines extending from y2-axis tick marks (horizontal lines when swapXY=false) | false | ["true", "false"] | "true" |
| xAxisLabels | Turns on/off value labels on the x-axis | false | ["true", "false"] | "true" |
| yAxisLabels | Turns on/off value labels on the y-axis | false | ["true", "false"] | "true" |
| y2AxisLabels | Turns on/off value labels on the y2-axis | false | ["true", "false"] | "true" |
| xBaseline | Turns on/off thick axis line (line appears at y=0) | false | ["true", "false"] | "true" |
| yBaseline | Turns on/off thick axis line (line appears directly alongside the y-axis labels) | false | ["true", "false"] | "false" |
| y2Baseline | Turns on/off thick axis line (line appears directly alongside the y2-axis labels) | false | ["true", "false"] | "false" |
| xTickMarks | Turns on/off tick marks for each of the x-axis labels | false | ["true", "false"] | "false" |
| yTickMarks | Turns on/off tick marks for each of the y-axis labels | false | ["true", "false"] | "false" |
| y2TickMarks | Turns on/off tick marks for each of the y2-axis labels | false | ["true", "false"] | "false" |
| yMin | Starting value for the y-axis | false | number | - |
| yMax | Maximum value for the y-axis | false | number | - |
| yScale | Whether to scale the y-axis to fit your data. `yMin` and `yMax` take precedence over `yScale` | false | ["true", "false"] | "false" |
| y2Min | Starting value for the y2-axis | false | number | - |
| y2Max | Maximum value for the y2-axis | false | number | - |
| y2Scale | Whether to scale the y-axis to fit your data. `y2Min` and `y2Max` take precedence over `y2Scale` | false | ["true", "false"] | "false" |

### Chart

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| title | Chart title. Appears at top left of chart. | false | string | - |
| subtitle | Chart subtitle. Appears just under title. | false | string | - |
| legend | Turn legend on or off. Legend appears at top center of chart. | false | ["true", "false"] | true for multiple series |
| chartAreaHeight | Minimum height of the chart area (excl. header and footer) in pixels. Adjusting the height affects all viewport sizes and may impact the mobile UX. | false | number | 180 |
| renderer | Which chart renderer type (canvas or SVG) to use. See ECharts' [documentation on renderers](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/). | false | ["canvas", "svg"] | "canvas" |
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

Line charts can include [annotations](/components/charts/annotations) using the `ReferenceLine` and `ReferenceArea` components. These components are used within a chart component like so:

```html
<LineChart data="sales_data" x="date" y="sales">
	<ReferenceLine data="target_data" y="target" label="name" />
	<ReferenceArea xMin="2020-03-14" xMax="2020-05-01" />
</LineChart>
```

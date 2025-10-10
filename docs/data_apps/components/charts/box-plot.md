---
title: Box Plot
description: Summarize the distribution and range of a metric around the median value.
---

Use box plots to summarize the distribution and range of a metric around the median value.

**Example:**

```markdown
<BoxPlot 
    data="sales_distribution_by_channel"
    name=channel
    intervalBottom=first_quartile
    midpoint=median
    intervalTop=third_quartile
    yFmt=usd0
/>
```

## Data Structure
The BoxPlot component requires pre-aggregated data, with one row per box you would like to display. There are 2 ways to pass in the values needed to construct the box:

**1. Explicitly define each value (e.g., `min`, `intervalBottom`, `midpoint`, `intervalTop`, `max`)**


| name | intervalBottom | midpoint | intervalTop |
|------|----------------|----------|-------------|
| {boxplot.name} | {boxplot.intervalBottom} | {boxplot.midpoint} | {boxplot.intervalTop} |

This example table excludes whiskers which would be defined with `min` and `max` columns

**2. Define a `midpoint` and a `confidenceInterval` - this will add the interval to the midpoint to get the max, and subtract to get the min**


| name | midpoint | confidence_interval |
|------|----------|---------------------|
| {boxplot_with_confidence_interval.name} | {boxplot_with_confidence_interval.midpoint} | {boxplot_with_confidence_interval.confidence_interval} |

## Examples

### Basic Box Plot

**Example:**

```markdown
<BoxPlot 
    data="sales_distribution_by_channel"
    name=channel
    intervalBottom=first_quartile
    midpoint=median
    intervalTop=third_quartile
    yFmt=usd0
/>
```

### Horizontal Box Plot

**Example:**

```markdown
<BoxPlot 
    data="sales_distribution_by_channel"
    name=channel
    intervalBottom=first_quartile
    midpoint=median
    intervalTop=third_quartile
    yFmt=usd0
    swapXY=true
/>
```

### Box Plot with Whiskers

**Example:**

```markdown
<BoxPlot 
    data="sales_distribution_by_channel"
    name=channel
    min=min
    intervalBottom=first_quartile
    midpoint=median
    intervalTop=third_quartile
    max=max
    yFmt=usd0
/>
```

### Box Plot with Custom Colors

**Example:**

```markdown
<BoxPlot 
    data="sales_distribution_by_channel"
    name=channel
    intervalBottom=first_quartile
    midpoint=median
    intervalTop=third_quartile
    yFmt=usd0
    color=color
/>
```

## Options

### Data

| Property | Required | Type | Default | Description |
|----------|----------|------|---------|-------------|
| data | ✓ | query name | | Query name, wrapped in curly braces |
| name | ✓ | column name | | Column to use for the names of each box in your plot |
| min | | column name | | Column containing minimum values, appearing as whisker |
| intervalBottom | | column name | | Column containing values for bottom of box |
| midpoint | ✓ | column name | | Column containing values for midpoint of box |
| intervalTop | | column name | | Column containing values for top of box |
| max | | column name | | Column containing maximum values, appearing as whisker |
| confidenceInterval | | column name | | Column containing value to use in place of intervalBottom and intervalTop. Is subtracted from midpoint to get the bottom and added to midpoint to get the top |
| emptySet | | error/warn/pass | error | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. |
| emptyMessage | | string | "No records" | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). |

### Formatting & Styling

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| color | column name | | Column containing color strings |
| yFmt | Excel-style format \| built-in format name \| custom format name | | Format to use for y column ([see available formats](/core-concepts/formatting)) |
| seriesColors | object with series names and assigned colors | colors applied by order of series in data | Apply a specific color to each series in your chart. Unspecified series will receive colors from the built-in palette as normal. |
| leftPadding | number | | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off |
| rightPadding | number | | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off |
| xLabelWrap | true/false | false | Whether to wrap x-axis labels when there is not enough space. Default behaviour is to truncate the labels. |

### Axes

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| swapXY | true/false | false | Swap the x and y axes to create a horizontal chart |
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
| yMin | number | | Starting value for the y-axis |
| yMax | number | | Maximum value for the y-axis |

### Chart

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| title | string | | Chart title. Appears at top left of chart. |
| subtitle | string | | Chart subtitle. Appears just under title. |
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

Box plots can include [annotations](/components/charts/annotations) using the `ReferenceLine` and `ReferenceArea` components. These components are used within a chart component like so:

```html
<BoxPlot 
    data="box"
    name=experiment
    midpoint=value
    confidenceInterval=confidence
>
    <ReferenceLine y=0.04 label='Target'/>
</BoxPlot>
```

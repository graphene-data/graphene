---
title: Histogram
description: Display the distribution of a metric along a continuous range, aggregated into buckets.
---

Use histograms to display the distribution of a metric along a continuous range, aggregated into buckets.


**Example:**

```markdown
<Histogram
    data="orders"
    x=sales
/>
```

## Examples

### Histogram

**Example:**

```markdown
<Histogram
    data="orders_week"
    x=sales
    xAxisTitle="Weekly Sales"
/>
```

## Options

### Data

| Property | Required | Type | Default | Description |
|----------|----------|------|---------|-------------|
| data | ✓ | query name | | Query name, wrapped in curly braces |
| x | ✓ | column name | | Column which contains the data you want to summarize |
| emptySet | | error/warn/pass | error | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. |
| emptyMessage | | string | "No records" | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). |

### Formatting & Styling

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| xFmt | Excel-style format \| built-in format name \| custom format name | | Format to use for x column ([see available formats](/core-concepts/formatting)) |
| fillColor | CSS name \| hexademical \| RGB \| HSL | | Color to override default series color |
| fillOpacity | number (0 to 1) | 1 | % of the full color that should be rendered, with remainder being transparent |
| colorPalette | array of color strings (CSS name \| hexademical \| RGB \| HSL) | built-in color palette | Array of custom colours to use for the chart. E.g., `{['#cf0d06','#eb5752','#e88a87']}` |
| leftPadding | number | | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off |
| rightPadding | number | | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off |
| xLabelWrap | true/false | false | Whether to wrap x-axis labels when there is not enough space. Default behaviour is to truncate the labels. |

### Axes

| Property | Type | Default | Description |
|----------|------|---------|-------------|
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

Histograms can include [annotations](/components/charts/annotations) using the `ReferenceLine` and `ReferenceArea` components. These components are used within a chart component like so:

```html
<Histogram data="sales_data" x=category>
  <ReferenceLine y=20/>
  <ReferenceArea xMin=3 xMax=8/>
</Histogram>
```

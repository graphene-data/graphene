---
title: Bar Chart
description: Compare a metric across a small number of categories. 
---

Use bar or column charts to compare a metric across categories. Bar charts are best with a small number of categories and series, and should generally start at 0.

**Example:**

```markdown
<BarChart 
    data="orders_by_category_2021"
    x=month
    y=sales
    series=category
    title="Sales by Category"
/>
```

## Examples

### Default

**Example:**

```markdown
<BarChart 
    data="orders_by_month"
    x=month
    y=sales
/>
```

### Stacked

**Example:**

```markdown
<BarChart 
    data="orders_by_category_2021"
    x=month
    y=sales
    series=category
/>
```

### 100% Stacked

**Example:**

```markdown
<BarChart 
    data="orders_by_category_2021"
    x=month
    y=sales
    yFmt=pct0
    series=category
    type=stacked100
/>
```

### Grouped

**Example:**

```markdown
<BarChart 
    data="orders_by_category_2021"
    x=month
    y=sales
    series=category
    type=grouped
/>
```

### Horizontal

**Example:**

```markdown
<BarChart 
    data="orders_by_item_all_time"
    x=item
    y=sales 
    swapXY=true
    yFmt=usd0k
/>
```

### Horizontal Stacked

**Example:**

```markdown
<BarChart 
    data="categories_by_channel"
    x=category
    y=sales
    series=channel
    swapXY=true
/>
```

### Horizontal 100% Stacked

**Example:**

```markdown
<BarChart 
    data="categories_by_channel"
    x=category
    y=sales
    series=channel
    type=stacked100
    swapXY=true
/>
```

### Horizontal Grouped

**Example:**

```markdown
<BarChart
    data="categories_by_channel"
    x=category
    y=sales
    series=channel
    type=grouped
    swapXY=true
/>
```

### Value Labels

**Example:**

```markdown
<BarChart 
    data="orders_by_category_2021"
    x=month
    y=sales
    yFmt=usd1k
    series=category
    labels=true
/>
```

### Custom Color Palette

**Example:**

```markdown
<BarChart 
    data="orders_by_category_2021"
    x=month 
    y=sales 
    series=category 
    colorPalette={[
        '#cf0d06',
        '#eb5752',
        '#e88a87',
        '#fcdad9',
        ]}
/>
```

### Secondary / Dual y Axis

**Example:**

```markdown
<BarChart 
    data="orders_by_month" 
    x=month 
    y=sales
    yFmt=usd0k
    y2=num_orders
/>
```

### Secondary / Dual Axis with Line

**Example:**

```markdown
<BarChart 
    data="orders_by_month" 
    x=month 
    y=sales
    yFmt=usd0k
    y2=num_orders
    y2SeriesType=line
/>
```

## Options

### Data

| Property | Description | Required | Options | Default |
|----------|-------------|----------|---------|---------|
| data | Query name, wrapped in curly braces | true | query name | - |
| x | Column to use for the x-axis of the chart | false | column name | First column |
| y | Column(s) to use for the y-axis of the chart | false | column name \| array of column names | Any non-assigned numeric columns |
| y2 | Column(s) to include on a secondary y-axis | false | column name \| array of column names | - |
| y2SeriesType | Chart type to apply to the series on the y2 axis | false | bar, line, scatter | bar |
| series | Column to use as the series (groups) in a multi-series chart | false | column name | - |
| sort | Whether to apply default sort to your data. Default sort is x ascending for number and date x-axes, and y descending for category x-axes | false | true, false | true |
| type | Grouping method to use for multi-series charts | false | stacked, grouped, stacked100 | stacked |
| stackName | Name for an individual stack. If separate Bar components are used with different stackNames, the chart will show multiple stacks | false | string | - |
| emptySet | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. | false | error, warn, pass | error |
| emptyMessage | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). | false | string | No records |

### Formatting & Styling

| Property | Description | Options | Default |
|----------|-------------|---------|---------|
| xFmt | Format to use for x column (see available formats) | Excel-style format \| built-in format name \| custom format name | - |
| yFmt | Format to use for y column (see available formats) | Excel-style format \| built-in format name \| custom format name | - |
| y2Fmt | Format to use for y2 column(s) (see available formats) | Excel-style format \| built-in format name \| custom format name | - |
| seriesLabelFmt | Format to use for series label (see available formats) | Excel-style format \| built-in format name \| custom format name | - |
| fillColor | Color to override default series color. Only accepts a single color. | CSS name \| hexademical \| RGB \| HSL | - |
| fillOpacity | % of the full color that should be rendered, with remainder being transparent | number (0 to 1) | 1 |
| outlineWidth | Width of line surrounding each bar | number | 0 |
| outlineColor | Color to use for outline if outlineWidth > 0 | CSS name \| hexademical \| RGB \| HSL | - |
| colorPalette | Array of custom colours to use for the chart. E.g., `{['#cf0d06','#eb5752','#e88a87']}` | array of color strings (CSS name \| hexademical \| RGB \| HSL) | built-in color palette |
| seriesColors | Apply a specific color to each series in your chart. Unspecified series will receive colors from the built-in palette as normal. Note the double curly braces required in the syntax | object with series names and assigned colors seriesColors=`{{'Canada': 'red', 'US': 'blue'}}` | colors applied by order of series in data |
| seriesOrder | Apply a specific order to the series in a multi-series chart. | Array of series names in the order they should be used in the chart seriesOrder=`{['series one', 'series two']}` | default order implied by the data |
| leftPadding | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off | number | - |
| rightPadding | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off | number | - |
| xLabelWrap | Whether to wrap x-axis labels when there is not enough space. Default behaviour is to truncate the labels. | true, false | false |

### Value Labels

| Property | Description | Options | Default |
|----------|-------------|---------|---------|
| labels | Show value labels | true, false | false |
| stackTotalLabel | If using labels, whether to show a total at the top of stacked bar chart | true, false | true |
| seriesLabels | If using labels, whether to show series labels | true, false | true |
| labelSize | Font size of value labels | number | 11 |
| labelPosition | Where label will appear on your series | outside, inside | Single Series: outside, Stacked: inside, Grouped: outside |
| labelColor | Font color of value labels | CSS name \| hexademical \| RGB \| HSL | Automatic based on color contrast of background |
| labelFmt | Format to use for value labels (see available formats) | Excel-style format \| built-in format name \| custom format name | same as y column |
| yLabelFmt | Format to use for value labels for series on the y axis. Overrides any other formats (see available formats) | Excel-style format \| built-in format name \| custom format name | - |
| y2LabelFmt | Format to use for value labels for series on the y2 axis. Overrides any other formats (see available formats) | Excel-style format \| built-in format name \| custom format name | - |
| showAllLabels | Allow all labels to appear on chart, including overlapping labels | true, false | false |

### Axes

| Property | Description | Options | Default |
|----------|-------------|---------|---------|
| swapXY | Swap the x and y axes to create a horizontal chart | true, false | false |
| yLog | Whether to use a log scale for the y-axis | true, false | false |
| yLogBase | Base to use when log scale is enabled | number | 10 |
| xAxisTitle | Name to show under x-axis. If 'true', formatted column name is used. Only works with swapXY=false | true, string, false | false |
| yAxisTitle | Name to show beside y-axis. If 'true', formatted column name is used. | true, string, false | false |
| y2AxisTitle | Name to show beside y2 axis. If 'true', formatted column name is used. | true, string, false | false |
| xGridlines | Turns on/off gridlines extending from x-axis tick marks (vertical lines when swapXY=false) | true, false | false |
| yGridlines | Turns on/off gridlines extending from y-axis tick marks (horizontal lines when swapXY=false) | true, false | true |
| y2Gridlines | Turns on/off gridlines extending from y2-axis tick marks (horizontal lines when swapXY=false) | true, false | true |
| xAxisLabels | Turns on/off value labels on the x-axis | true, false | true |
| yAxisLabels | Turns on/off value labels on the y-axis | true, false | true |
| y2AxisLabels | Turns on/off value labels on the y2-axis | true, false | true |
| xBaseline | Turns on/off thick axis line (line appears at y=0) | true, false | true |
| yBaseline | Turns on/off thick axis line (line appears directly alongside the y-axis labels) | true, false | false |
| y2Baseline | Turns on/off thick axis line (line appears directly alongside the y2-axis labels) | true, false | false |
| xTickMarks | Turns on/off tick marks for each of the x-axis labels | true, false | false |
| yTickMarks | Turns on/off tick marks for each of the y-axis labels | true, false | false |
| y2TickMarks | Turns on/off tick marks for each of the y2-axis labels | true, false | false |
| yMin | Starting value for the y-axis | number | - |
| yMax | Maximum value for the y-axis | number | - |
| yScale | Whether to scale the y-axis to fit your data. `yMin` and `yMax` take precedence over `yScale` | true, false | false |
| y2Min | Starting value for the y2-axis | number | - |
| y2Max | Maximum value for the y2-axis | number | - |
| y2Scale | Whether to scale the y-axis to fit your data. `y2Min` and `y2Max` take precedence over `y2Scale` | true, false | false |
| yAxisColor | Turns on/off color on the y-axis (turned on by default when secondary y-axis is used). Can also be used to set a specific color | true, false, color string (CSS name \| hexademical \| RGB \| HSL) | true when y2 used; false otherwise |

### Chart

| Property | Description | Options | Default |
|----------|-------------|---------|---------|
| title | Chart title. Appears at top left of chart. | string | - |
| subtitle | Chart subtitle. Appears just under title. | string | - |
| legend | Turns legend on or off. Legend appears at top center of chart. | true, false | true for multiple series |
| chartAreaHeight | Minimum height of the chart area (excl. header and footer) in pixels. Adjusting the height affects all viewport sizes and may impact the mobile UX. | number | 180 |
| renderer | Which chart renderer type (canvas or SVG) to use. See ECharts' documentation on renderers. | canvas, svg | canvas |
| downloadableData | Whether to show the download button to allow users to download the data | true, false | true |
| downloadableImage | Whether to show the button to allow users to save the chart as an image | true, false | true |

### Custom Echarts Options

| Property | Description | Options |
|----------|-------------|---------|
| echartsOptions | Custom Echarts options to override the default options. See reference page for available options. | `{{exampleOption:'exampleValue'}}` |
| seriesOptions | Custom Echarts options to override the default options for all series in the chart. This loops through the series to apply the settings rather than having to specify every series manually using `echartsOptions` See reference page for available options. | `{{exampleSeriesOption:'exampleValue'}}` |
| printEchartsConfig | Helper prop for custom chart development - inserts a code block with the current echarts config onto the page so you can see the options used and debug your custom options | true, false | false |

### Interactivity

| Property | Description | Options |
|----------|-------------|---------|
| connectGroup | Group name to connect this chart to other charts for synchronized tooltip hovering. Charts with the same `connectGroup` name will become connected | string |

## Annotations


Bar charts can include [annotations](/components/charts/annotations) using the `ReferenceLine` and `ReferenceArea` components. These components are used within a chart component like so:

**Example:**

```html
<BarChart data="orders_by_month" x=month y=sales>
  <ReferenceArea xMin='2020-03-14' xMax='2021-05-01' label='COVID-19 Lockdown'/>
  <ReferenceLine data="target_data" y=target label=name/>
</BarChart>
```

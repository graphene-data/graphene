---
title: Heatmap
description: Show patterns in a single metric across two categorical dimensions, using colour to indicate size.
---

Use heatmaps to show patterns in a single metric across two categorical dimensions, using colour to indicate size.


**Example:**

```markdown
<Heatmap 
    data="orders" 
    x=day 
    y=category 
    value=order_count 
    valueFmt=usd 
/>
```

## Data Structure

Heatmap requires your data to contain 2 categorical columns (1 for the x-axis and 1 for the y-axis) and 1 numeric column.

#### Example


| region | product | sales |
|--------|---------|-------|
| {example.region} | {example.product} | {example.sales} |

### Unpivoting your Data
If you have data spread across columns, you can use the `UNPIVOT` feature in your SQL query to prepare the data for the heatmap.

#### Example
If you have a query result called `region_sales`:


| region | A | B | C |
|--------|---|---|---|
| {region_sales.region} | {region_sales.A} | {region_sales.B} | {region_sales.C} |

You can use `UNPIVOT` like so:


Which will return this table, which can be passed into the Heatmap:


| region | product | sales |
|--------|---------|-------|
| {region_sales_unpivoted.region} | {region_sales_unpivoted.product} | {region_sales_unpivoted.sales} |

> **Note on Date Columns**
> 
> Heatmap currently only works with string columns. If you would like to use a date column, cast it to a string in your SQL query before passing it into the Heatmap

## Examples

### Basic Heatmap

**Example:**

```markdown
<Heatmap 
    data="orders" 
    x=day 
    y=category 
    value=order_count 
    valueFmt=usd 
/>
```

### Custom Color Scale

**Example:**

```svelte
<Heatmap 
    data="orders" 
    x=day 
    y=category 
    value=order_count 
    valueFmt=usd 
    colorScale="[
        ['rgb(254,234,159)', 'rgb(254,234,159)'],
        ['rgb(218,66,41)', 'rgb(218,66,41)']
    ]"
/>
```

### Rotated Labels


**Example:**

```svelte
<Heatmap 
    data="item_state" 
    x=item 
    y=state 
    value=orders 
    xLabelRotation=-45
    colorScale={['white', 'maroon']} 
    title="Item Sales"
    subtitle="By State"
    rightPadding=40
    cellHeight=25
    nullsZero=false
/>
```

## Options

### Data

| Property | Required | Type | Default | Description |
|----------|----------|------|---------|-------------|
| data | ✓ | query name | | Query name, wrapped in curly braces |
| x | ✓ | column name | | Categorical column to use for the x-axis. If you want to use dates, cast them to strings in your query first |
| y | ✓ | column name | | Categorical column to use for the y-axis. If you want to use dates, cast them to strings in your query first |
| value | ✓ | column name | | Numeric column to use for the y-axis |
| min | | number | min of value column | Minimum number for the heatmap's color scale |
| max | | number | max of value column | Maximum number for the heatmap's color scale |
| emptySet | | error/warn/pass | error | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. |
| emptyMessage | | string | "No records" | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). |

### Formatting & Styling

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| nullsZero | true/false | true | Whether to treats nulls or missing values as zero |
| zeroDisplay | string | | String to display in place of zeros |
| colorScale | array of color codes - e.g., `{['navy', 'white', '#c9c9c9']}` | | Array of colors to form the gradient for the heatmap. |
| valueFmt | Excel-style format \| built-in format name \| custom format name | | Format to use for value column ([see available formats](/core-concepts/formatting)) |
| cellHeight | number | 30 | Number representing the height of cells in the heatmap |
| leftPadding | number | 0 | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off |
| rightPadding | number | 2 | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off |
| valueLabels | true/false | true | Turn on or off value labels in the heatmap cells |
| mobileValueLabels | true/false | false | Turn on or off value labels in the heatmap cells when app is viewed on a mobile device screen size |
| borders | true/false | true | Turn on or off borders around cells. Default is to show light grey border around each cell. To customize border appearance, use `echartsOptions` |

### Axes

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| xTickMarks | true/false | false | Turns on/off tick marks for the x-axis labels |
| yTickMarks | true/false | false | Turns on/off tick marks for the y-axis labels |
| xLabelRotation | number | 0 | Degrees to rotate the labels on the x-axis. Can be negative number to reverse direction. `45` and `-45` are common options |
| xAxisPosition | top/bottom | top | Position of x-axis and labels. Can be top or bottom. top recommended for longer charts |
| xSort | column name | | Column to sort x values by |
| xSortOrder | asc/desc | asc | Sets direction of sort |
| ySort | column name | | Column to sort y values by |
| ySortOrder | asc/desc | asc | Sets direction of sort |

### Chart

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| title | string | | Chart title. Appears at top left of chart. |
| subtitle | string | | Chart subtitle. Appears just under title. |
| chartAreaHeight | number | auto set based on y-axis values | Minimum height of the chart area (excl. header and footer) in pixels. Adjusting the height affects all viewport sizes and may impact the mobile UX. |
| legend | true/false | true | Turn on or off the legend |
| filter | true/false | false | Allow draggable filtering on the legend. Must be used with `legend=true` |
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

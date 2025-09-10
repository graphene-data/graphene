---
title: Calendar Heatmap
description: Display how a single metric varies over weeks and months in a familar GitHub-style format
---

Use calendar heatmaps to display how a single metric varies over weeks and months.

**Example:**

```markdown
<CalendarHeatmap 
    data={orders_by_day_2021}
    date=day
    value=sales
    title="Calendar Heatmap"
    subtitle="Daily Sales"
/>
```

## Examples

### Multi-Year

**Example:**

```markdown
<CalendarHeatmap 
    data={orders_by_day}
    date=day
    value=sales
/>
```

### Custom Color Scale

**Example:**

```markdown
<CalendarHeatmap
    data={orders_by_day_2021}
    date=day
    value=sales
    colorScale={[
        ['rgb(254,234,159)', 'rgb(254,234,159)'],
        ['rgb(218,66,41)', 'rgb(218,66,41)']
    ]}
/>
```

### Without Year Label

**Example:**

```markdown
<CalendarHeatmap 
    data={orders_by_day_2021}
    date=day
    value=sales
    yearLabel=false
/> 
```

## Options

### Data

| Property | Required | Type | Default | Description |
|----------|----------|------|---------|-------------|
| data | ✓ | query name | | Query name, wrapped in curly braces |
| date | ✓ | column name | | Date column to use for the calendar |
| value | ✓ | column name | | Numeric column to use for the y-axis |
| min | | number | min of value column | Minimum number for the calendar heatmap's color scale |
| max | | number | max of value column | Maximum number for the calendar heatmap's color scale |
| emptySet | | error/warn/pass | error | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. |
| emptyMessage | | string | "No records" | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). |

### Formatting & Styling

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| colorScale | array of color codes - e.g., `colorScale={['navy', 'white', '#c9c9c9']}` | | Array of colors to form the gradient for the heatmap. Remember to wrap your array in curly braces. |
| valueFmt | Excel-style format \| built-in format name \| custom format name | | Format to use for value column ([see available formats](/core-concepts/formatting)) |
| yearLabel | true/false | true | Turn on or off year label on left of chart |
| monthLabel | true/false | true | Turn on or off month label on top of chart |
| dayLabel | true/false | true | Turn on or off day label on left of chart |

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

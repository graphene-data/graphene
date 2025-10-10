---
title: Sparkline
description: Display a compact visual representation of a single metric over time.
---

Use sparklines to display a compact visual representation of a single metric over time or a continuous range.


**Example:**

```markdown
<Sparkline 
    data="sales_by_date" 
    dateCol=date 
    valueCol=sales 
/>
```

## Examples

### Connected Sparkline

```html
<Sparkline data="sales_by_date" dateCol=date valueCol=sales type=bar  valueFmt=eur dateFmt=mmm connectGroup=mysparkline/>
<Sparkline data="sales_by_date" dateCol=date valueCol=sales type=area color=maroon valueFmt=eur dateFmt=mmm connectGroup=mysparkline/>
<Sparkline data="sales_by_date" dateCol=date valueCol=sales type=line color=purple valueFmt=eur dateFmt=mmm connectGroup=mysparkline/>
```

## Options

### Data

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | Query name, wrapped in curly braces | true | query name | - |
| dateCol | Categorical column to use for the x-axis | true | column name | - |
| valueCol | Numeric column to use for the y-axis | true | column name | - |
| type | Chart type for sparkline | false | ['line', 'area', 'bar'] | "line" |
| emptySet | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. | false | ['error', 'warn', 'pass'] | "error" |
| emptyMessage | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). | false | string | "No records" |

### Formatting & Styling

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| color | Color to use for the visualization. For area sparklines, choose the color for the line and the area color will be automatically appplied in a lighter shade. | false | CSS name \| hexademical \| RGB \| HSL | - |
| valueFmt | Format to use for value column ([see available formats](/core-concepts/formatting)) | false | Excel-style format \| built-in format name \| custom format name | - |
| dateFmt | Format to use for date column ([see available formats](/core-concepts/formatting)) | false | Excel-style format \| built-in format name \| custom format name | - |

### Axes

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| yScale | Whether to truncate the y-axis to enhance visibility | false | ['true', 'false'] | "false" |

### Sizing

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| height | Height of sparkline in pixels | false | number | 15 |
| width | Width of sparkline in pixels | false | number | 50 |

### Interactivity

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| interactive | Turn on or off tooltip behaviour on hover. If off, chart will be a staticly rendered SVG (better for page performance). If on, you will be able to see dates/values when hovering over the sparkline | false | ['true', 'false'] | "true" |
| connectGroup | Group name to connect this sparkline to other charts for synchronized tooltip hovering. Charts with the same `connectGroup` name will become connected | false | string | - |

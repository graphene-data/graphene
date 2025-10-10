---
title: Big Value
description: Display a large value standalone, and optionally include a comparison and a sparkline.
---

Use big values to display a large value standalone, and optionally include a comparison and a sparkline.

## Example

```markdown
<BigValue 
  data="orders_with_comparisons" 
  value=num_orders
  sparkline=month
  comparison=order_growth
  comparisonFmt=pct1
  comparisonTitle="vs. Last Month"
/>
```

## Examples

### Default

```markdown
<BigValue 
  data="orders_with_comparisons" 
  value=num_orders
/>
```

### Comparisons

```markdown
<BigValue 
  data="orders_with_comparisons" 
  value=num_orders
  comparison=order_growth
  comparisonFmt=pct1
  comparisonTitle="MoM"
/>
```

### Multiple cards

Multiple cards will align themselves into a row.

```markdown
<BigValue 
  data="orders_with_comparisons" 
  value=sales
  fmt=usd0
  comparison=sales_growth
  comparisonFmt=pct1
  comparisonTitle="MoM"
/>
<BigValue 
  data="orders_with_comparisons" 
  value=num_orders
  title="Orders"
  comparison=order_growth
  comparisonFmt=pct1
  comparisonTitle="MoM"
/>
<BigValue 
  data="orders_with_comparisons" 
  value=aov
  title="Average Order Value"
  fmt=usd2
  comparison=aov_growth
  comparisonFmt=pct1
  comparisonTitle="MoM"
/>
```

### Linking to other pages

The link property makes the Value component clickable, allowing navigation to other pages.

```html
<BigValue 
  data="orders_with_comparisons" 
  value=num_orders
  sparkline=month
  comparison=order_growth
  comparisonFmt=pct1
  comparisonTitle="vs. Last Month"
  link='/components/data/big-value'
/>
```

### Non-Delta Comparisons

```html
<BigValue 
  data="orders_with_comparisons" 
  value=num_orders
  comparison=prev_month_orders
  comparisonTitle="Last Month"
  comparisonDelta=false
/>
```

### Sparkline

```html
<BigValue 
  data="orders_with_comparisons" 
  value=sales
  sparkline=month
/>
```

## Options

### Data

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | Query name, wrapped in curly braces | true | query name | - |
| value | Column to pull the main value from. | true | column name | - |
| title | Title of the card. | false | string | Title of the value column. |
| minWidth | Overrides min-width of component | false | % or px value | "18%" |
| maxWidth | Adds a max-width to the component | false | % or px value | - |
| fmt | Sets format for the value ([see available formats](/core-concepts/formatting)) | false | Excel-style format \| built-in format \| custom format | - |
| emptySet | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. | false | ['error', 'warn', 'pass'] | "error" |
| emptyMessage | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). | false | string | "No records" |
| link | Used to navigate to other pages. Can be a full external link like `https://google.com` or an internal link like `/sales/performance` | false | - | - |

### Comparison Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| comparison | Column to pull the comparison value from. | false | column name | - |
| comparisonTitle | Text to the right of the comparison. | false | string | Title of the comparison column. |
| comparisonDelta | Whether to display delta symbol and color | false | ['true', 'false'] | true |
| downIsGood | If present, negative comparison values appear in green, and positive values appear in red. | false | ['true', 'false'] | false |
| neutralMin | Sets the bottom of the range for 'neutral' values - neutral values appear in grey rather than red or green | false | number | 0 |
| neutralMax | Sets the top of the range for 'neutral' values - neutral values appear in grey rather than red or green | false | number | 0 |
| comparisonFmt | Sets format for the comparison ([see available formats](/core-concepts/formatting)) | false | Excel-style format \| built-in format \| custom format | - |

### Sparkline

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| sparkline | Column to pull the date from to create the sparkline. | false | column name | - |
| sparklineType | Chart type for sparkline | false | ['line', 'area', 'bar'] | "line" |
| sparklineValueFmt | Formatting for tooltip values | false | format code | same as fmt if supplied |
| sparklineDateFmt | Formatting for tooltip dates | false | format code | "YYYY-MM-DD" |
| sparklineColor | Color of visualization | false | CSS name \| hexademical \| RGB \| HSL | - |
| sparklineYScale | Whether to truncate the y-axis of the chart to enhance visibility | false | ['true', 'false'] | false |
| connectGroup | Group name to connect this sparkline to other charts for synchronized tooltip hovering. Charts with the same `connectGroup` name will become connected | false | string | - |
| description | Adds an info icon with description tooltip on hover | false | string | - |

Use big values to display a large value standalone, and optionally include a comparison and a sparkline.

Here's an example:

```markdown
<BigValue
  data=orders_with_comparisons
  value=num_orders
  sparkline=month
  comparison=order_growth
  comparisonFmt=pct1
  comparisonTitle="vs. Last Month"
/>
```

# Attributes

## Data

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | GSQL query or table name | true | query name | - |
| value | Column or expression to pull the main value from. | true | column name, stored expression name, GSQL expression | - |
| title | Title of the card. | false | string | Title of the value column. |
| minWidth | Overrides min-width of component | false | % or px value | `"18%"` |
| maxWidth | Adds a max-width to the component | false | % or px value | - |
| fmt | Sets format for the value ([see available formats](#value-formatting)) | false | Excel-style format, built-in format | - |
| emptySet | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. | false | `error`, `warn`, `pass` | `error` |
| emptyMessage | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). | false | string | `"No records"` |
| link | Used to navigate to other pages. Can be a full external link like `"https://google.com"` or an internal link like `"/sales/performance"` | false | - | - |

## Comparison

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| comparison | Column or expression to pull the comparison value from. | false | column name, stored expression name, GSQL expression | - |
| comparisonTitle | Text to the right of the comparison. | false | string | Title of the comparison column. |
| comparisonDelta | Whether to display delta symbol and color | false | `true`, `false` | `true` |
| downIsGood | If present, negative comparison values appear in green, and positive values appear in red. | false | `true`, `false` | `false` |
| neutralMin | Sets the bottom of the range for 'neutral' values - neutral values appear in grey rather than red or green | false | number | `0` |
| neutralMax | Sets the top of the range for 'neutral' values - neutral values appear in grey rather than red or green | false | number | `0` |
| comparisonFmt | Sets format for the comparison ([see available formats](#value-formatting)) | false | Excel-style format, built-in format | - |

## Sparkline

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| sparkline | Column or expression to pull the date from to create the sparkline. | false | column name, stored expression name, GSQL expression | - |
| sparklineType | Chart type for sparkline | false | `line`, `area`, `bar` | `line` |
| sparklineValueFmt | Formatting for tooltip values | false | format code | same as fmt if supplied |
| sparklineDateFmt | Formatting for tooltip dates | false | format code | `YYYY-MM-DD` |
| sparklineColor | Color of visualization | false | CSS name, hexademical, RGB, HSL | - |
| sparklineYScale | Whether to truncate the y-axis of the chart to enhance visibility | false | `true`, `false` | `false` |
| connectGroup | Group name to connect this sparkline to other charts for synchronized tooltip hovering. Charts with the same `connectGroup` name will become connected | false | string | - |
| description | Adds an info icon with description tooltip on hover | false | string | - |

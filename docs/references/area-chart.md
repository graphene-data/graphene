Use area charts to track how a metric with multiple series changes over time, or a continuous range. Area charts emphasize changes in the sum of series over the individual series.

Here's an example:

```markdown
<AreaChart
  data=orders_by_month
  x=month
  y=sales
/>
```

# Attributes

## General

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| title | Chart title. Appears at top left of chart. | false | string | - |
| subtitle | Chart subtitle. Appears just under title. | false | string | - |
| legend | Turn legend on or off. Legend appears at top center of chart. | false | `true`, `false` | `true` for multiple series |
| chartAreaHeight | Minimum height of the chart area (excl. header and footer) in pixels. Adjusting the height affects all viewport sizes and may impact the mobile UX. | false | number | `180` |
| renderer | Which chart renderer type (canvas or SVG) to use. See ECharts' [documentation on renderers](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/). | false | `canvas`, `svg` | `canvas` |
| downloadableData | Whether to show the download button to allow users to download the data | false | `true`, `false` | `true` |
| downloadableImage | Whether to show the button to allow users to save the chart as an image | false | `true`, `false` | `true` |

## Data

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | GSQL query or table name | true | query name | - |
| x | Column or expression to use for the x-axis of the chart | true | column name, stored expression name, GSQL expression | First column |
| y | Column(s) or expression(s) to use for the y-axis of the chart. Each will create its own series. Consider a split axis with `y2` if there is a difference of scale or unit of measure between the series. | true | column name, stored expression name, GSQL expression, list of any combination of these e.g. `"col1, my_expr"` | Any non-assigned numeric columns |
| series | Column or expression to use to define the series (groups) in a multi-series chart. Use when values of a particular column dictate the multiple series to plot, eg. `country` would create a series for every distinct country in the column. | false | column name, stored expression name, GSQL expression | - |
| sort | Whether to apply default sort to your data. Default sort is x ascending for number and date x-axes, and y descending for category x-axes | false | `true`, `false` | `true` |
| type | Grouping method to use for multi-series charts | false | `stacked`, `stacked100` | `stacked` |
| handleMissing | Treatment of missing values in the dataset | false | `gap`, `connect`, `zero` | `gap` for single series, `zero` for multi-series |
| emptySet | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. | false | `error`, `warn`, `pass` | `error` |
| emptyMessage | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). | false | string | "No records" |

## Formatting and styling

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| xFmt | Format to use for x column ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| yFmt | Format to use for y column ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| seriesLabelFmt | Format to use for series label ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| step | Specifies whether the chart is displayed as a step line | false | `true`, `false` | `false` |
| stepPosition | Configures the position of turn points for a step line chart | false | `start`, `middle`, `end` | `end` |
| fillColor | Color to override default series color. Only accepts a single color. | false | CSS name, hexademical, RGB, HSL | - |
| lineColor | Color to override default line color. Only accepts a single color. | false | CSS name, hexademical, RGB, HSL | - |
| fillOpacity | % of the full color that should be rendered, with remainder being transparent | false | number (0 to 1) | `0.7` |
| line | Show line on top of the area | false | `true`, `false` | `true` |
| colorPalette | List of custom colors to use for the chart | false | list of color strings (CSS name, hexademical, RGB, HSL) e.g. `"#cf0d06, #eb5752, #e88a87"` | built-in color palette |
| seriesOrder | Apply a specific order to the series in a multi-series chart. | false | list of series names in the order they should be used in the chart e.g. `"Canada, US"` | default order implied by the data |
| leftPadding | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off | false | number | - |
| rightPadding | Number representing the padding (whitespace) on the right side of the chart. Useful to avoid labels getting cut off | false | number | - |
| xLabelWrap | Whether to wrap x-axis labels when there is not enough space. Default behaviour is to truncate the labels. | false | `true`, `false` | `false` |

## Value Labels

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| labels | Show value labels | false | `true`, `false` | `false` |
| labelSize | Font size of value labels | false | number | `11` |
| labelPosition | Where label will appear on your series | false | `above`, `middle`, `below` | `above` |
| labelColor | Font color of value labels | false | CSS name, hexademical, RGB, HSL | Automatic based on color contrast of background |
| labelFmt | Format to use for value labels ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | same as y column |
| showAllLabels | Allow all labels to appear on chart, including overlapping labels | false | `true`, `false` | `false` |

## Axes

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| yLog | Whether to use a log scale for the y-axis | false | `true`, `false` | `false` |
| yLogBase | Base to use when log scale is enabled | false | number | `10` |
| xAxisTitle | Name to show under x-axis. If 'true', formatted column name is used. Only works with swapXY=false | false | `true`, `string`, `false` | `false` |
| yAxisTitle | Name to show beside y-axis. If 'true', formatted column name is used. | false | `true`, `string`, `false` | `false` |
| xGridlines | Turns on/off gridlines extending from x-axis tick marks (vertical lines when swapXY=false) | false | `true`, `false` | `false` |
| yGridlines | Turns on/off gridlines extending from y-axis tick marks (horizontal lines when swapXY=false) | false | `true`, `false` | `true` |
| xAxisLabels | Turns on/off value labels on the x-axis | false | `true`, `false` | `true` |
| yAxisLabels | Turns on/off value labels on the y-axis | false | `true`, `false` | `true` |
| xBaseline | Turns on/off thick axis line (line appears at y=0) | false | `true`, `false` | `true` |
| yBaseline | Turns on/off thick axis line (line appears directly alongside the y-axis labels) | false | `true`, `false` | `false` |
| xTickMarks | Turns on/off tick marks for each of the x-axis labels | false | `true`, `false` | `false` |
| yTickMarks | Turns on/off tick marks for each of the y-axis labels | false | `true`, `false` | `false` |
| yMin | Starting value for the y-axis | false | number | - |
| yMax | Maximum value for the y-axis | false | number | - |
| yScale | Whether to scale the y-axis to fit your data. `yMin` and `yMax` take precedence over `yScale` | false | `true`, `false` | `false` |

## Interactivity

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| connectGroup | Group name to connect this chart to other charts for synchronized tooltip hovering. Charts with the same `connectGroup` name will become connected | false | - | - |

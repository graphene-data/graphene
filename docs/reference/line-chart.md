Use line charts to display how one or more metrics vary over time. Line charts are suitable for plotting a large number of data points on the same chart.

Here's an example:

```markdown
<LineChart
  title="Monthly Sales"
  subtitle="Includes all categories"
  data=orders_by_month
  x=month
  y=sales_usd0k
  yAxisTitle="Sales per Month"
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
| x | Column or expression to use for the x-axis of the chart | true | column name, stored expression name, GSQL expression | - |
| y | Column(s) or expression(s) to use for the y-axis of the chart. Each will create its own series. Consider a split axis with `y2` if there is a difference of scale or unit of measure between the series. | true | column name, stored expression name, GSQL expression, list of any combination of these e.g. `"col1, my_expr"` | - |
| y2 | Column(s) or expression(s) to include on a secondary y-axis. | false | column name, stored expression name, GSQL expression, list of any combination of these e.g. `"col1, my_expr"` | - |
| y2SeriesType | Chart type to apply to the series on the y2 axis | false | `line`, `bar`, `scatter` | `line` |
| series | Column or expression to use to define the series (groups) in a multi-series chart. Use when values of a particular column dictate the multiple series to plot, eg. `country` would create a series for every distinct country in the column. | false | column name, stored expression name, GSQL expression | - |
| sort | Whether to apply default sort to your data. Default is x ascending for number and date x-axes, and y descending for category x-axes | false | `true`, `false` | `true` |
| handleMissing | Treatment of missing values in the dataset | false | `gap`, `connect`, `zero` | `gap` |
| emptySet | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. | false | `error`, `warn`, `pass` | `error` |
| emptyMessage | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). | false | string | - |

## Formatting and styling

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| xFmt | Format to use for x column ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| yFmt | Format to use for y column(s) ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| y2Fmt | Format to use for y2 column(s) ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| seriesLabelFmt | Format to use for series label ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| step | Specifies whether the chart is displayed as a step line | false | `true`, `false` | `false` |
| stepPosition | Configures the position of turn points for a step line chart | false | `start`, `middle`, `end` | `end` |
| lineColor | Color to override default series color. Only accepts a single color | false | CSS name, hexademical, RGB, HSL | - |
| lineOpacity | % of the full color that should be rendered, with remainder being transparent | false | number (0 to 1) | `1` |
| lineType | Options to show breaks in a line (dashed or dotted) | false | `solid`, `dashed`, `dotted` | `solid` |
| lineWidth | Thickness of line (in pixels) | false | number | `2` |
| markers | Turn on/off markers (shapes rendered onto the points of a line) | false | `true`, `false` | `false` |
| markerShape | Shape to use if markers=true | false | `circle`, `emptyCircle`, `rect`, `triangle`, `diamond` | `circle` |
| markerSize | Size of each shape (in pixels) | false | number | `8` |
| colorPalette | List of custom colors to use for the chart | false | list of color strings (CSS name, hexademical, RGB, HSL) e.g. `"#cf0d06, #eb5752, #e88a87"` | - |
| seriesOrder | Apply a specific order to the series in a multi-series chart. | false | list of series names in the order they should be used in the chart e.g. `"Canada, US"` | default order implied by the data |
| labels | Show value labels | false | `true`, `false` | `false` |
| labelSize | Font size of value labels | false | number | `11` |
| labelPosition | Where label will appear on your series | false | `above`, `middle`, `below` | `above` |
| labelColor | Font color of value labels | false | CSS name, hexademical, RGB, HSL | - |
| labelFmt | Format to use for value labels ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| yLabelFmt | Format to use for value labels for series on the y axis. Overrides any other formats ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| y2LabelFmt | Format to use for value labels for series on the y2 axis. Overrides any other formats ([see available formats](#value-formatting)) | false | Excel-style format, built-in format name | - |
| showAllLabels | Allow all labels to appear on chart, including overlapping labels | false | `true`, `false` | `false` |
| leftPadding | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off | false | number | - |
| rightPadding | Number representing the padding (whitespace) on the left side of the chart. Useful to avoid labels getting cut off | false | number | - |
| xLabelWrap | Whether to wrap x-axis labels when there is not enough space. Default behaviour is to truncate the labels. | false | `true`, `false` | `false` |

## Axes

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| yLog | Whether to use a log scale for the y-axis | false | `true`, `false` | `false` |
| yLogBase | Base to use when log scale is enabled | false | number | `10` |
| xAxisTitle | Name to show under x-axis. If 'true', formatted column name is used. Only works with swapXY=false | false | `true`, `string`, `false` | `false` |
| yAxisTitle | Name to show beside y-axis. If 'true', formatted column name is used. | false | `true`, `string`, `false` | `false` |
| y2AxisTitle | Name to show beside y2 axis. If 'true', formatted column name is used. | false | `true`, `string`, `false` | `false` |
| xGridlines | Turns on/off gridlines extending from x-axis tick marks (vertical lines when swapXY=false) | false | `true`, `false` | `false` |
| yGridlines | Turns on/off gridlines extending from y-axis tick marks (horizontal lines when swapXY=false) | false | `true`, `false` | `true` |
| y2Gridlines | Turns on/off gridlines extending from y2-axis tick marks (horizontal lines when swapXY=false) | false | `true`, `false` | `true` |
| xAxisLabels | Turns on/off value labels on the x-axis | false | `true`, `false` | `true` |
| yAxisLabels | Turns on/off value labels on the y-axis | false | `true`, `false` | `true` |
| y2AxisLabels | Turns on/off value labels on the y2-axis | false | `true`, `false` | `true` |
| xBaseline | Turns on/off thick axis line (line appears at y=0) | false | `true`, `false` | `true` |
| yBaseline | Turns on/off thick axis line (line appears directly alongside the y-axis labels) | false | `true`, `false` | `false` |
| y2Baseline | Turns on/off thick axis line (line appears directly alongside the y2-axis labels) | false | `true`, `false` | `false` |
| xTickMarks | Turns on/off tick marks for each of the x-axis labels | false | `true`, `false` | `false` |
| yTickMarks | Turns on/off tick marks for each of the y-axis labels | false | `true`, `false` | `false` |
| y2TickMarks | Turns on/off tick marks for each of the y2-axis labels | false | `true`, `false` | `false` |
| yMin | Starting value for the y-axis | false | number | - |
| yMax | Maximum value for the y-axis | false | number | - |
| yScale | Whether to scale the y-axis to fit your data. `yMin` and `yMax` take precedence over `yScale` | false | `true`, `false` | `false` |
| y2Min | Starting value for the y2-axis | false | number | - |
| y2Max | Maximum value for the y2-axis | false | number | - |
| y2Scale | Whether to scale the y-axis to fit your data. `y2Min` and `y2Max` take precedence over `y2Scale` | false | `true`, `false` | `false` |

## Interactivity

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| connectGroup | Group name to connect this chart to other charts for synchronized tooltip hovering. Charts with the same `connectGroup` name will become connected | false | - | - |

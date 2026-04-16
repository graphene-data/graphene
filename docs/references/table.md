Use a Table component to display a richly formatted table of data from a query. Tables are powerful default choice for data display that allow high information density, and are easy to read.

Here's an example:

```markdown
<Table data=orders_summary />
```

# Attributes

## Table

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | GSQL query or table name | true | query name | - |
| rows | Number of rows to show in the table before paginating results. Use `"rows=all"` to show all rows in the table. | false | number, `all` | `10` |
| title | Title for the table | false | string | - |
| subtitle | Subtitle - appears under the title | false | string | - |
| headerColor | Background color of the header row | false | Hex color code, css color name | - |
| headerFontColor | Font color of the header row | false | Hex color code, css color name | - |
| totalRow | Show a total row at the bottom of the table, defaults to sum of all numeric columns | false | `true`, `false` | `false` |
| totalRowColor | Background color of the total row | false | Hex color code, css color name | - |
| totalFontColor | Font color of the total row | false | Hex color code, css color name | - |
| rowNumbers | Turns on or off row index numbers | false | `true`, `false` | `false` |
| rowLines | Turns on or off borders at the bottom of each row | false | `true`, `false` | `true` |
| rowShading | Shades every second row in light grey | false | `true`, `false` | `false` |
| backgroundColor | Background color of the table | false | Hex color code, css color name | - |
| sortable | Enable sort for each column - click the column title to sort | false | `true`, `false` | `true` |
| sort | Column to sort by on initial page load. Sort direction is asc if unspecified. Can only sort by one column using this prop. If you need multi-column sort, use the order by clause in your sql in combination with this prop. | false | 'column name + asc/desc' | - |
| search | Add a search bar to the top of your table | false | `true`, `false` | `false` |
| downloadable | Enable download data button below the table on hover | false | `true`, `false` | `true` |
| formatColumnTitles | Enable auto-formatting of column titles. Turn off to show raw SQL column names | false | `true`, `false` | `true` |
| wrapTitles | Wrap column titles | false | `true`, `false` | `false` |
| compact | Enable a more compact table view that allows more content vertically and horizontally | false | `true`, `false` | `false` |
| link | Makes each row of your table a clickable link. Accepts a column or expression containing the link to use for each row in your table | false | column name, stored expression name, GSQL expression | - |
| showLinkCol | Whether to show the column supplied to the `link` attribute | false | `true`, `false` | `false` |
| generateMarkdown | Helper for writing Table syntax with many columns. When set to true, markdown for the Table including each `Column` contained within the query will be generated and displayed below the table. | false | `true`, `false` | `false` |
| emptySet | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. | false | `error`, `warn`, `pass` | `error` |
| emptyMessage | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). | false | string | "No records" |

## Groups

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| groupBy | Column or expression to use to create groups. Note that groups are currently limited to a single group column. | false | column name, stored expression name, GSQL expression | - |
| groupType | How the groups are shown in the table. Can be accordion (expand/collapse) or section (group column values are merged across rows) | false | `accordion`, `section` | `accordion` |
| subtotals | Whether to show aggregated totals for the groups | false | `true`, `false` | `false` |
| groupsOpen | [groupType=accordion] Whether to show the accordions as open on page load | false | `true`, `false` | `true` |
| accordionRowColor | [groupType=accordion] Background color for the accordion row | false | Hex color code, css color name | - |
| subtotalRowColor | [groupType=section] Background color for the subtotal row | false | Hex color code, css color name | - |
| subtotalFontColor | [groupType=section] Font color for the subtotal row | false | Hex color code, css color name | - |
| groupNamePosition | [groupType=section] Where the group label will appear in its cell | false | `top`, `middle`, `bottom` | `middle` |

# Column sub-component

Use the Column sub-component to choose specific columns to display in your table, and to apply options to specific columns. If you don't supply any columns to the table, it will display all columns from your query result.

Here's an example:

```markdown
<Table data=country_summary>
  <Column id=country />
  <Column id=category />
  <Column id=value_usd />
  <Column id=yoy title="Y/Y Growth" />
</Table>
```

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| id | Column id (from SQL query) | true | column name | - |
| title | Override title of column | false | string | column name (formatted) |
| description | Adds an info icon with description tooltip on hover | false | string | - |
| align | Align column text | false | `left`, `center`, `right` | `left` |
| totalAgg | Specify an aggregation function to use for the total row. Accepts predefined functions, custom strings or values | false | `sum`, `mean`, `weightedMean`, `median`, `min`, `max`, `count`, `countDistinct`, custom string or value | `sum` |
| weightCol | Column or expression to use as the weight values for weighted mean aggregation. If not specified, a weight of 1 for each value will be used and the result will be the same as the `mean` aggregation. | false | column name, stored expression name, GSQL expression | - |
| wrap | Wrap column text | false | `true`, `false` | `false` |
| wrapTitle | Wrap column title | false | `true`, `false` | `false` |
| contentType | Lets you specify how to treat the content within a column. See below for contentType-specific options. | false | `link`, `image`, `delta`, `colorscale`, `html` | - |
| colGroup | Group name to display above a group of columns. Columns with the same group name will get a shared header above them | false | string | - |
| redNegatives | Conditionally sets the font color to red based on whether the selected value is less than 0 | false | `true`, `false` | `false` |

Column attributes for specific contentTypes:

Images (`contentType=image`)

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| height | Height of image in pixels | false | number | original height of image |
| width | Width of image in pixels | false | number | original width of image |
| alt | Alt text for image | false | column name | Name of the image file (excluding the file extension) |

Links (`contentType=link`)

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| linkLabel | Text to display for link | false | column name, string | raw url |
| openInNewTab | Whether to open link in new tab | false | `true`, `false` | `false` |

Deltas (`contentType=delta`)

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| deltaSymbol | Whether to show the up/down delta arrow symbol | false | `true`, `false` | `true` |
| downIsGood | If present, negative comparison values appear in green, and positive values appear in red. | false | `true`, `false` | `false` |
| showValue | Whether to show the delta value. Set this to false to show only the delta arrow indicator. | false | `true`, `false` | `true` |
| neutralMin | Start of the range for 'neutral' values, which appear in grey font with a dash instead of an up/down arrow. By default, neutral is not applied to any values. | false | number | `0` |
| neutralMax | End of the range for 'neutral' values, which appear in grey font with a dash instead of an up/down arrow. By default, neutral is not applied to any values. | false | number | `0` |
| chip | Whether to display the delta as a 'chip', with a background color and border. | false | `true`, `false` | `false` |

Sparklines (`contentType=sparkline` | `contentType=sparkarea` | `contentType=sparkbar`)

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| sparkX | Column within an array cell to use as the x-axis for the spark viz. Arrays can be created inside a query using the `"array_agg()"` function from DuckDB | false | column from array cell | - |
| sparkY | Column within an array cell to use as the y-axis for the spark viz. Arrays can be created inside a query using the `"array_agg()"` function from DuckDB | false | column from array cell | - |
| sparkYScale | Whether to truncate the y-axis | false | `true`, `false` | `false` |
| sparkHeight | Height of the spark viz. Making the viz taller will increase the height of the full table row | false | number | `18` |
| sparkWidth | Width of the spark viz | false | number | `90` |
| sparkColor | Color of the spark viz | false | Hex color code, css color name | - |

Bar chart column (`contentType=bar`)

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| barColor | Color of the bars. Affects positive bars only. See `negativeBarColor` to change color of negative bars | false | Hex color code, css color name | - |
| negativeBarColor | Color of negative bars | false | Hex color code, css color name | - |
| hideLabels | Whether to hide the data labels on the bars | false | `true`, `false` | `false` |
| backgroundColor | Background color for bar chart | false | Hex color code, css color name | `transparent` |

Conditional formatting (`contentType=colorscale`)

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| colorScale | Color to use for the scale | false | - | `green` |
| colorMin | Set a minimum for the scale. Any values below that minimum will appear in the lowest color on the scale | false | number | min of column |
| colorMid | Set a midpoint for the scale | false | number | mid of column |
| colorMax | Set a maximum for the scale. Any values above that maximum will appear in the highest color on the scale | false | number | max of column |
| colorBreakpoints | List of numbers to use as breakpoints for each color in your color scale. Should line up with the colors you provide in `colorScale` | false | list of numbers | - |
| scaleColumn | Column or expression to use to define the color scale range. Values in this column will have their cell color determined by the value in the scaleColumn | false | column name, stored expression name, GSQL expression | - |

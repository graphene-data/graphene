---
title: Data Table
description: Display a richly formatted table of data, in a dense, readable format.
---

Use a DataTable component to display a richly formatted table of data from a query. Tables are powerful default choice for data display that allow high information density, and are easy to read.

## Examples

### Displaying All Columns in Query


```svelte
<DataTable data={orders_summary}/>
```

### Selecting Specific Columns

```svelte
<DataTable data={orders_summary}> 
    <Column id=state title="Sales State"/> 
    <Column id=item/> 
    <Column id=category/> 
    <Column id=sales fmt=usd/> 
    <Column id=channel/> 
</DataTable>
```

### Custom Column Formatting

You can use the `fmt` prop to format your columns using [built-in format names or Excel format codes](/core-concepts/formatting)

```svelte
<DataTable data={country_summary}>
	<Column id=country />
	<Column id=category />
	<Column id=value_usd fmt=eur/>
    <Column id=yoy title="Y/Y Growth" fmt=pct3/>
</DataTable>
```

### Search

```svelte
<DataTable data={orders_summary} search=true/>
```

### Sort

```svelte
<DataTable data={orders_summary} sort="sales desc">
    <Column id=category/> 
    <Column id=item/> 
    <Column id=sales fmt=usd/> 
</DataTable>
```

### Deltas

```svelte
<DataTable data={country_summary}>
	<Column id=country />
	<Column id=category />
	<Column id=value_usd />
    <Column id=yoy contentType=delta fmt=pct title="Y/Y Chg"/>
</DataTable>
```

### Sparklines

Sparklines require an array inside a cell of your table. You can create an array using the `array_agg()` function in DuckDB syntax.


```svelte
<DataTable data={categories}>
    <Column id=category/>
    <Column id=sales title="Orders" contentType=sparkline sparkX=date sparkY=sales />
    <Column id=sales title="Sales" contentType=sparkarea sparkX=date sparkY=sales sparkColor=#53768a/>
    <Column id=sales title="AOV" contentType=sparkbar sparkX=date sparkY=sales sparkColor=#97ba99/>
</DataTable>
```

### Bar Chart Column

```svelte
<DataTable data={country_summary}>
	<Column id=country />
	<Column id=category align=center/>
	<Column id=value_usd title="Sales" contentType=bar/>
  	<Column id=value_usd title="Sales" contentType=bar barColor=#aecfaf/>
  	<Column id=value_usd title="Sales" contentType=bar barColor=#ffe08a backgroundColor=#ebebeb/>
</DataTable>
```

### Total Row

Default total aggregation is `sum`

```svelte
<DataTable data={country_example} totalRow=true rows=5>
  <Column id=country/>
  <Column id=gdp_usd/>
  <Column id=gdp_growth fmt='pct2'/>
  <Column id=population fmt='#,##0"M"'/>
</DataTable>
```

### Conditional Formatting

#### Default (`colorScale=default`)

```svelte
<DataTable data={countries}>
    <Column id=country />
    <Column id=country_id align=center/>
    <Column id=category align=center/>
    <Column id=value_usd contentType=colorscale/>
</DataTable>
```

#### Custom Colors

```svelte
<DataTable data={orders_by_category} rowNumbers=true>
  <Column id=month/>
  <Column id=category/>
  <Column id=sales_usd0k contentType=colorscale colorScale=#a85ab8 align=center/>
  <Column id=num_orders_num0 contentType=colorscale colorScale=#e3af05 align=center/>
  <Column id=aov_usd2 contentType=colorscale colorScale=#c43957 align=center/>
</DataTable>
```

### Including Images

You can include images by indicating either an absolute path e.g. `https://www.example.com/images/image.png` or a relative path e.g. `/images/image.png`.

```svelte
<DataTable data={countries}>
	<Column id=flag contentType=image height=30px align=center />
	<Column id=country />
	<Column id=country_id align=center />
	<Column id=category />
	<Column id=value_usd />
</DataTable>
```

### Link Columns

#### Link Column with Unique Labels

```svelte
<DataTable data={countries}>
	<Column id=country_url contentType=link linkLabel=country />
	<Column id=country_id align=center />
	<Column id=category />
	<Column id=value_usd />
</DataTable>
```

#### Link Column with Consistent String Label

```svelte
<DataTable data={countries}>
	<Column id=country />
	<Column id=country_id align=center />
	<Column id=category />
	<Column id=value_usd />
	<Column id=country_url contentType=link linkLabel="Details &rarr;" />
</DataTable>
```

### HTML Content


```svelte
<DataTable data={html_in_table}>
    <Column id="HTML in Table" contentType=html/>
</DataTable>
```

To apply styling to most HTML tags, you should add the `class=markdown` attribute to the tag in your column. This will apply the same styling as the markdown renderer.

### Row Links

#### External Links

```svelte
<DataTable data={countries} search=true link=country_url>
	<Column id=country />
	<Column id=country_id align=center />
	<Column id=category />
	<Column id=value_usd />
</DataTable>
```

#### Link to Pages in Your App


```svelte
<DataTable data={orders} link=category_link />
```

By default, the link column of your table is hidden. If you would like it to be displayed in the table, you can use `showLinkCol=true`.

### Styling

#### Row Shading + Row Lines

```svelte
<DataTable data={countries} rowShading=true />
```

#### Row Shading + No Row Lines

```svelte
<DataTable data={countries} rowShading=true rowLines=false />
```

#### No Lines or Shading

```svelte
<DataTable data={countries} rowLines=false />
```

### Column Alignment

```svelte
<DataTable data={country_summary}>
	<Column id=country align=right />
	<Column id=country_id align=center />
	<Column id=category align=left />
	<Column id=value_usd align=left />
</DataTable>
```

### Custom Column Titles

```svelte
<DataTable data={country_summary}>
	<Column id=country title="Country Name" />
	<Column id=country_id align=center title="ID" />
	<Column id=category align=center title="Product Category" />
	<Column id=value_usd title="Sales in 2022" />
</DataTable>
```

### Raw Column Names

```svelte
<DataTable data={country_summary} formatColumnTitles=false />
```

### Groups - Accordion

#### Without subtotals

```svelte
<DataTable data={orders} groupBy=state>
 	<Column id=state/> 
	<Column id=category totalAgg=""/> 
	<Column id=item totalAgg=""/> 
	<Column id=orders/> 
	<Column id=sales fmt=usd/> 
	<Column id=growth fmt=pct1/> 
</DataTable>
```

#### With Subtotals

```svelte
<DataTable data={orders} groupBy=state subtotals=true> 
 	<Column id=state/> 
	<Column id=category totalAgg=""/> 
	<Column id=item totalAgg=""/> 
	<Column id=orders/> 
	<Column id=sales fmt=usd/> 
	<Column id=growth fmt=pct1/> 
</DataTable>
```

### Groups - Section

#### Without subtotals

```svelte
<DataTable data={orders} groupBy=state groupType=section/>
```

#### With Subtotals

```svelte
<DataTable data={orders} groupBy=state subtotals=true groupType=section>
 	<Column id=state totalAgg=countDistinct totalFmt='[=1]0 "state";0 "states"'/> 
	<Column id=category totalAgg=Total/> 
	<Column id=item  totalAgg=countDistinct totalFmt='0 "items"'/> 
	<Column id=orders/> 
	<Column id=sales fmt=usd1k/> 
	<Column id=growth contentType=delta neutralMin=-0.02 neutralMax=0.02 fmt=pct1 totalAgg=weightedMean weightCol=sales /> 
</DataTable>
```

### Column Groups

```svelte
<DataTable data={countries} totalRow=true rows=5 groupBy=continent groupType=section totalRowColor=#f2f2f2>
  <Column id=continent totalAgg="Total" totalFmt='# "Unique continents"'/>
  <Column id=country totalAgg=countDistinct totalFmt='0 "countries"'/>
  <Column id=gdp_usd totalAgg=sum fmt='$#,##0"B"' totalFmt='$#,##0.0,"T"' colGroup="GDP"/>
  <Column id=gdp_growth totalAgg=weightedMean weightCol=gdp_usd fmt='pct1' colGroup="GDP" contentType=delta/>
  <Column id=jobless_rate totalAgg=weightedMean weightCol=gdp_usd fmt='pct1' contentType=colorscale colorScale=negative colGroup="Labour Market"/>
  <Column id=population totalAgg=sum fmt='#,##0"M"' totalFmt='#,##0.0,"B"' colGroup="Labour Market"/>
  <Column id=interest_rate totalAgg=weightedMean weightCol=gdp_usd fmt='pct2' wrapTitle=false colGroup="Other"/>
  <Column id=inflation_rate totalAgg=weightedMean weightCol=gdp_usd fmt='pct2' colGroup="Other"/>
  <Column id=gov_budget totalAgg=weightedMean weightCol=gdp_usd fmt='0.0"%"' contentType=delta colGroup="Other"/>
  <Column id=current_account totalAgg=weightedMean weightCol=gdp_usd fmt='0.0"%"' colGroup="Other"/>
</DataTable>
```

### Wrap Titles

```svelte
<DataTable data={countries} wrapTitles=true /> 
```

# DataTable

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | Query name, wrapped in curly braces | true | query name | - |
| rows | Number of rows to show in the table before paginating results. Use `rows=all` to show all rows in the table. | false | number \| all | 10 |
| title | Title for the table | false | string | - |
| subtitle | Subtitle - appears under the title | false | string | - |
| headerColor | Background color of the header row | false | Hex color code \| css color name | - |
| headerFontColor | Font color of the header row | false | Hex color code \| css color name | - |
| totalRow | Show a total row at the bottom of the table, defaults to sum of all numeric columns | false | ['true', 'false'] | false |
| totalRowColor | Background color of the total row | false | Hex color code \| css color name | - |
| totalFontColor | Font color of the total row | false | Hex color code \| css color name | - |
| rowNumbers | Turns on or off row index numbers | false | ['true', 'false'] | false |
| rowLines | Turns on or off borders at the bottom of each row | false | ['true', 'false'] | true |
| rowShading | Shades every second row in light grey | false | ['true', 'false'] | false |
| backgroundColor | Background color of the table | false | Hex color code \| css color name | "-" |
| sortable | Enable sort for each column - click the column title to sort | false | ['true', 'false'] | true |
| sort | Column to sort by on initial page load. Sort direction is asc if unspecified. Can only sort by one column using this prop. If you need multi-column sort, use the order by clause in your sql in combination with this prop. | false | 'column name + asc/desc' | "-" |
| search | Add a search bar to the top of your table | false | ['true', 'false'] | false |
| downloadable | Enable download data button below the table on hover | false | ['true', 'false'] | true |
| formatColumnTitles | Enable auto-formatting of column titles. Turn off to show raw SQL column names | false | ['true', 'false'] | true |
| wrapTitles | Wrap column titles | false | ['true', 'false'] | false |
| compact | Enable a more compact table view that allows more content vertically and horizontally | false | ['true', 'false'] | false |
| link | Makes each row of your table a clickable link. Accepts the name of a column containing the link to use for each row in your table | false | column name | "-" |
| showLinkCol | Whether to show the column supplied to the `link` prop | false | ['true', 'false'] | false |
| generateMarkdown | Helper for writing DataTable syntax with many columns. When set to true, markdown for the DataTable including each `Column` contained within the query will be generated and displayed below the table. | false | ['true', 'false'] | false |
| emptySet | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. | false | ["error", "warn", "pass"] | "error" |
| emptyMessage | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). | false | string | "No records" |

### Groups
Groups allow you to create sections within your table, increasing the density of the content you're displaying. Groups are currently limited to 1 level, but will be expanded in future versions.

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| groupBy | Column to use to create groups. Note that groups are currently limited to a single group column. | false | column name | - |
| groupType | How the groups are shown in the table. Can be accordion (expand/collapse) or section (group column values are merged across rows) | false | ['accordion', 'section'] | "accordion" |
| subtotals | Whether to show aggregated totals for the groups | false | ['true', 'false'] | false |
| subtotalFmt | Specify an override format to use in the subtotal row ([see available formats](/core-concepts/formatting)). Custom strings or values are unformatted by default. | false | Excel-style format \| built-in format \| custom format | - |
| groupsOpen | [groupType=accordion] Whether to show the accordions as open on page load | false | ['true', 'false'] | true |
| accordionRowColor | [groupType=accordion] Background color for the accordion row | false | Hex color code \| css color name | - |
| subtotalRowColor | [groupType=section] Background color for the subtotal row | false | Hex color code \| css color name | - |
| subtotalFontColor | [groupType=section] Font color for the subtotal row | false | Hex color code \| css color name | - |
| groupNamePosition | [groupType=section] Where the group label will appear in its cell | false | ['top', 'middle', 'bottom'] | "middle" |

# Column

Use the `Column` component to choose specific columns to display in your table, and to apply options to specific columns. If you don't supply any columns to the table, it will display all columns from your query result.

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| id | Column id (from SQL query) | true | column name | - |
| title | Override title of column | false | string | column name (formatted) |
| description | Adds an info icon with description tooltip on hover | false | string | - |
| align | Align column text | false | ['left', 'center', 'right'] | "left" |
| fmt | Format the values in the column ([see available formats](/core-concepts/formatting)) | false | Excel-style format \| built-in format \| custom format | - |
| fmtColumn | Column to use to format values in this column. This is used to achieve different value formats by row. The fmtColumn should contain strings of format codes - either Graphene built-in formats or Excel codes. | false | column name | - |
| totalAgg | Specify an aggregation function to use for the total row. Accepts predefined functions, custom strings or values | false | ['sum', 'mean', 'weightedMean', 'median', 'min', 'max', 'count', 'countDistinct', 'custom string or value'] | "sum" |
| totalFmt | Specify an override format to use in the total row ([see available formats](/core-concepts/formatting)). Custom strings or values are unformatted by default. | false | Excel-style format \| built-in format \| custom format | - |
| weightCol | Column to use as the weight values for weighted mean aggregation. If not specified, a weight of 1 for each value will be used and the result will be the same as the `mean` aggregation. | false | column name | - |
| wrap | Wrap column text | false | ['true', 'false'] | "false" |
| wrapTitle | Wrap column title | false | ['true', 'false'] | "false" |
| contentType | Lets you specify how to treat the content within a column. See below for contentType-specific options. | false | ['link', 'image', 'delta', 'colorscale', 'html'] | - |
| colGroup | Group name to display above a group of columns. Columns with the same group name will get a shared header above them | false | string | - |
| redNegatives | Conditionally sets the font color to red based on whether the selected value is less than 0 | false | [`true`, `false`] | "false" |

### Images

`contentType=image`

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| height | Height of image in pixels | false | number | original height of image |
| width | Width of image in pixels | false | number | original width of image |
| alt | Alt text for image | false | column name | Name of the image file (excluding the file extension) |

### Links

`contentType=link`

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| linkLabel | Text to display for link | false | column name \| string | raw url |
| openInNewTab | Whether to open link in new tab | false | ['true', 'false'] | "false" |

### Deltas

`contentType=delta`

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| deltaSymbol | Whether to show the up/down delta arrow symbol | false | ['true', 'false'] | "true" |
| downIsGood | If present, negative comparison values appear in green, and positive values appear in red. | false | ['true', 'false'] | "false" |
| showValue | Whether to show the delta value. Set this to false to show only the delta arrow indicator. | false | ['true', 'false'] | "true" |
| neutralMin | Start of the range for 'neutral' values, which appear in grey font with a dash instead of an up/down arrow. By default, neutral is not applied to any values. | false | number | "0" |
| neutralMax | End of the range for 'neutral' values, which appear in grey font with a dash instead of an up/down arrow. By default, neutral is not applied to any values. | false | number | "0" |
| chip | Whether to display the delta as a 'chip', with a background color and border. | false | ['true', 'false'] | "false" |

### Sparklines

`contentType=sparkline`
`contentType=sparkarea`
`contentType=sparkbar`

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| sparkX | Column within an array cell to use as the x-axis for the spark viz. Arrays can be created inside a query using the `array_agg()` function from DuckDB | false | column from array cell | - |
| sparkY | Column within an array cell to use as the y-axis for the spark viz. Arrays can be created inside a query using the `array_agg()` function from DuckDB | false | column from array cell | - |
| sparkYScale | Whether to truncate the y-axis | false | ['true', 'false'] | "false" |
| sparkHeight | Height of the spark viz. Making the viz taller will increase the height of the full table row | false | number | 18 |
| sparkWidth | Width of the spark viz | false | number | 90 |
| sparkColor | Color of the spark viz | false | [ 'Hex color code', 'css color name'] | - |

### Bar Chart Column

`contentType=bar`

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| barColor | Color of the bars. Affects positive bars only. See `negativeBarColor` to change color of negative bars | false | [ 'Hex color code', 'css color name'] | - |
| negativeBarColor | Color of negative bars | false | [ 'Hex color code', 'css color name'] | - |
| hideLabels | Whether to hide the data labels on the bars | false | ['true', 'false'] | "false" |
| backgroundColor | Background color for bar chart | false | [ 'Hex color code', 'css color name'] | "transparent" |

### Conditional Formatting (Color Scales)

`contentType=colorscale`

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| colorScale | Color to use for the scale | false | - | "green" |
| colorMin | Set a minimum for the scale. Any values below that minimum will appear in the lowest color on the scale | false | number | min of column |
| colorMid | Set a midpoint for the scale | false | number | mid of column |
| colorMax | Set a maximum for the scale. Any values above that maximum will appear in the highest color on the scale | false | number | max of column |
| colorBreakpoints | Array of numbers to use as breakpoints for each color in your color scale. Should line up with the colors you provide in `colorScale` | false | array of numbers | - |
| scaleColumn | Column to use to define the color scale range. Values in this column will have their cell color determined by the value in the scaleColumn | false | column name | - |

### HTML

`contentType=html`

To apply styling to HTML tags, you will need to add the `class=markdown` attribute **to the HTML tag in your column**. This will apply the same styling as the markdown renderer. E.g., `<code class=markdown>Code</code>`

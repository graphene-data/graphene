---
title: Annotations
description: Add important context directly to a chart - highlight areas, or specific points to make it easier for your reader to draw insights.
---

Use annotations to add important context directly to a chart - highlight areas, or specific points to make it easier for your reader to draw insights.

## At a glance

Graphene currently offers 4 types of annotations, which can be defined inline or with a dataset:
- [`ReferenceLine`](#reference-line): draw a line on a chart (e.g. sales target, launch dates, linear regression)
- [`ReferenceArea`](#reference-area): highlight an area on a chart (e.g. holiday shopping periods, metric control ranges)
- [`ReferencePoint`](#reference-point): highlight specific points on a chart (e.g. anomalies, points of interest)
- [`Callout`](#callout): draw attention to data (e.g. data trend explanation)

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0>
    <ReferenceLine y=7500 label="Reference Line" hideValue labelPosition="aboveStart" color=positive/>
    <ReferenceArea xMin='2020-03-14' xMax='2020-08-15' label="Reference Area" color=warning/>
    <ReferencePoint x="2019-07-01" y=6590 label="Reference Point" labelPosition=bottom color=negative/>
    <Callout x="2021-05-01" y=11012 labelPosition=bottom labelWidth=fit>
        Callout
        Data trending up here
    </Callout>
</LineChart>
```

# Reference Line 

Reference lines allow you to add lines to a chart to provide additional context within the visualization. These lines can be produced by providing a specific value (`y=50` or `x='2020-03-14'`) or by providing a dataset (e.g., `date`, `event_name`).

If you provide coordinates for `[x, y]` and `[x2, y2]`, you can create sloped lines between points.

When a dataset is provided, `ReferenceLine` can generate multiple lines - one for each row in the dataset. This can be helpful for plotting things like important milestones, launch dates, or experiment start dates.

## Examples

### Y-axis Defined Inline

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yAxisTitle="Sales per Month" yFmt=usd0>
    <ReferenceLine y=9000 label="Target"/>
</LineChart>
```

### X-axis Defined Inline

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yAxisTitle="Sales per Month" yFmt=usd0>
    <ReferenceLine x='2019-09-18' label="Launch" hideValue=true/>
</LineChart>
```

### Y-axis Multiple Lines

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0 yAxisTitle="Sales per Month">
    <ReferenceLine y=9000 label="Target" labelPosition=belowEnd/>
    <ReferenceLine y=10500 label="Forecast"/>
</LineChart>
```

### X-axis from Data


**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0 yAxisTitle="Sales per Month">
    <ReferenceLine data="multiple_dates" x=start_date label=campaign_name hideValue/>
</LineChart>
```

### Sloped Line Inline

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0 yAxisTitle="Sales per Month">
    <ReferenceLine x='2019-01-01' y=6500 x2='2021-12-01' y2=12000 label="Growth Trend" labelPosition=belowEnd/>
</LineChart>
```

### Linear Regression from Data


**Example:**

```html
<ScatterPlot data="orders_by_state" x=sales y=num_orders xMin=0 yMin=0>
    <ReferenceLine data="regression" x=x y=y x2=x2 y2=y2 label=label color=base-content-muted lineType=solid/>
</ScatterPlot>
```

### Custom Styling

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales_usd0k yAxisTitle="Sales per Month">
    <ReferenceLine y=110000 color=negative hideValue=true lineWidth=3 lineType=solid/>
</LineChart>
```

### Label Positions

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0k yAxisTitle="Sales per Month">
    <ReferenceLine y=4000 label=aboveStart labelPosition=aboveStart hideValue/>
    <ReferenceLine y=4000 label=aboveCenter labelPosition=aboveCenter hideValue/>
    <ReferenceLine y=4000 label=aboveEnd labelPosition=aboveEnd hideValue/>
    <ReferenceLine y=4000 label=belowStart labelPosition=belowStart hideValue/>
    <ReferenceLine y=4000 label=belowCenter labelPosition=belowCenter hideValue/>
    <ReferenceLine y=4000 label=belowEnd labelPosition=belowEnd hideValue/>
</LineChart>
```

### Colours

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0k yAxisTitle="Sales per Month">
    <ReferenceLine y=1500 color=negative label=negative/>
    <ReferenceLine y=3500 color=warning label=warning/>
    <ReferenceLine y=5500 color=positive label=positive/>
    <ReferenceLine y=7500 color=info label=info/>
    <ReferenceLine y=9500 color=base-content-muted label=base-content-muted/>
    <ReferenceLine y=11500 color=#63178f label=custom/>
</LineChart>
```

## Options
A reference line can be produced by defining values inline or by supplying a dataset, and the required props are different for each of those cases.

### Defining Values Inline

| Property | Description | Required | Options |
|----------|-------------|----------|---------|
| x | x-axis value where line will be plotted, or coordinate where line will start if x2 is provided | false | number \| string \| date |
| y | y-axis value where line will be plotted, or coordinate where line will start if y2 is provided | false | number |
| x2 | x-axis value for line endpoint | false | number \| string \| date |
| y2 | y-axis value for line endpoint | false | number |
| label | Text to show as label for the line. If no label is provided, the value will be used. | false | string |

This table shows how you combine `x`, `y`, `x2`, and `y2` to create different types of lines:

| x | y | x2 | y2 | Result |
|---|----|----|----|---------|
| 5 | null | null | null | Vertical line at x=5 |
| null | 100 | null | null | Horizontal line at y=100 |
| 5 | 100 | null | null | Vertical line at x=5 (ignores y) |
| 5 | 100 | 10 | 200 | Sloped line from [5, 100] to [10, 200] |
| 5 | 100 | null | 200 | Vertical line from [5, 100] to [5, 200] |
| 5 | 100 | 10 | null | Horizontal line from [5, 100] to [10, 100] |

> **Warning:** If you provide `[x, y]` and `[x2, y2]`, coordinates must fall within the chart's boundaries in order for the line to be drawn.

### Supplying a Dataset

| Property | Description | Required | Options |
|----------|-------------|----------|---------|
| data | Query name, wrapped in curly braces | true | query name |
| x | Column containing x-axis values for lines (or starting points if x2 is provided) | false | column name |
| y | Column containing y-axis values for lines (or starting points if y2 is provided) | false | column name |
| x2 | Column containing x-axis values for line endpoints. | false | column name |
| y2 | Column containing y-axis values for line endpoints. | false | column name |
| label | Column containing a label to use for each line | false | column name |
| hideValue | Option to remove the value from the label | false | true/false (default: false) |

| x | y | x2 | y2 | Result |
|---|----|----|----|---------|
| x_col | null | null | null | Vertical lines at values in x_col |
| null | y_col | null | null | Horizontal lines at values in y_col |
| x_col | y_col | null | null | Vertical lines at x_col (ignores y_col) |
| x_col | y_col | x2_col | y2_col | Sloped Lines from [x_col, y_col] to [x2_col, y2_col] |

> **Warning:** If you provide `[x, y]` and `[x2, y2]`, coordinates must fall within the chart's boundaries in order for lines to be drawn.

### Styling

| Property | Description | Options | Default |
|----------|-------------|---------|---------|
| color | Color to override default line and label colors | CSS name \| hexademical \| RGB \| HSL | - |
| lineColor | Color to override default line color. If used, takes precedence over `color` | CSS name \| hexademical \| RGB \| HSL | - |
| lineType | Options to show breaks in a line (dashed or dotted) | solid, dashed, dotted | dashed |
| lineWidth | Thickness of line (in pixels) | number | 1.3 |
| symbolStart | The type of symbol used to mark the start of the line | circle, rect, roundRect, triangle, diamond, pin, arrow, none | circle |
| symbolStartSize | The size of the symbol at the start of the line | number | 8 |
| symbolEnd | The type of symbol used to mark the end of the line | circle, rect, roundRect, triangle, diamond, pin, arrow, none | circle |
| symbolEndSize | The size of the symbol at the end of the line | number | 8 |
| labelPosition | Where label will appear on the line | aboveStart, aboveCenter, aboveEnd, belowStart, belowCenter, belowEnd | aboveEnd |
| labelColor | Color to override default label color. If used, takes precedence over `color` | CSS name \| hexademical \| RGB \| HSL | - |
| labelBackground | Option to show a white semi-transparent background behind the label. Helps when label is shown in front of darker colours. | true, false | true |
| labelPadding | Padding between the text and the border of the label background | number | - |
| labelBorderWidth | The thickness of the border around the label (in pixels) | number | - |
| labelBorderRadius | The radius of rounded corners on the label background (in pixels) | number | - |
| labelBorderColor | The color of the border around the label background | CSS name \| hexademical \| RGB \| HSL | - |
| labelBorderType | The type of border around the label background (dashed or dotted) | solid, dotted, dashed | - |
| fontSize | The size of the font in the label | number | - |
| align | How to align the label to the symbol, and the text within the label | left, center, right | - |
| bold | Make the label text bold | true, false | false |
| italic | Make the label text italic | true, false | false |

# Reference Area

Reference areas allow you to add highlighted ranges to a chart. These ranges can be:
- Along the x-axis (e.g., recession date ranges)
- Along the y-axis (e.g., control threshold for a metric)
- Both (e.g, highlighting a specific series of points in the middle of the chart)

Reference areas can be produced by defining the x and y-axis values inline (e.g., `xMin='2020-03-14' xMax='2020-06-30'`) or by supplying a dataset (e.g., `start_date`, `end_date`, `name`).

When a dataset is provided, `ReferenceArea` can generate multiple areas - one for each row in the dataset. 

## Examples

### X-axis Defined Inline

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0 yAxisTitle="Sales per Month">
    <ReferenceArea xMin='2020-03-14' xMax='2020-08-15' label=First color=warning/>
    <ReferenceArea xMin='2021-03-14' xMax='2021-08-15' label=Second/>
</LineChart>
```

### Y-axis Defined Inline

**Example:**

```html
<LineChart data="orders_by_month" x=month y=num_orders yAxisTitle="Orders per Month">
    <ReferenceArea yMin=250 color=positive label="Good"/>
    <ReferenceArea yMin=100 yMax=250 color=warning label="Okay"/>
    <ReferenceArea yMin=0 yMax=100 color=negative label="Bad"/>
</LineChart>
```

### X-axis from Data

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0 yAxisTitle="Sales per Month">
    <ReferenceArea data="multiple_dates" xMin=start_date xMax=end_date label=campaign_name/>
</LineChart>
```

### Bar Chart

**Example:**

```html
<BarChart data="orders_by_category_2021" x=month y=sales yFmt=usd0 series=category>
    <ReferenceArea xMin='2021-01-01' xMax='2021-04-01'/>
</BarChart>
```

#### Continuous Axis Bar Charts
On a continous x-axis (dates or numbers), the reference area will start and stop at the exact point on the x-axis. This means it will appear in the middle of whichever bar is at that point. If you would prefer to see the area cover the full bar, there are 2 ways to achieve this:
1. Add a buffer on either side of the range you want to highlight (e.g., instead of ending the area at `2020-07-01`, end it at `2020-07-15`)
2. Change your x-axis to categorical data (using `xType=category`). If using a date axis, you may also want to retain the axis label formatting for dates - to achieve this, you can use the `xFmt` prop (e.g., `xFmt=mmm`)

### Reference Area Box

**Example:**

```html
<ScatterPlot data="countries" x=gdp_usd y=gdp_growth_pct1 tooltipTitle=country series=continent>
    <ReferenceArea xMin=16000 xMax=24000 yMin=-0.03 yMax=0.055 label="Large and stagnant" color=base-content-muted border=true/>
</ScatterPlot>
```

### Labels

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0>
    <ReferenceArea xMin='2019-07-01' xMax='2021-07-31' label=topLeft labelPosition=topLeft areaColor="hsla(206.25, 80%, 80%, 0.01)"/>
    <ReferenceArea xMin='2019-07-01' xMax='2021-07-31' label=top labelPosition=top areaColor="hsla(206.25, 80%, 80%, 0.01)"/>
    <ReferenceArea xMin='2019-07-01' xMax='2021-07-31' label=topRight labelPosition=topRight areaColor="hsla(206.25, 80%, 80%, 0.01)"/>
    <ReferenceArea xMin='2019-07-01' xMax='2021-07-31' label=left labelPosition=left areaColor="hsla(206.25, 80%, 80%, 0.01)"/>
    <ReferenceArea xMin='2019-07-01' xMax='2021-07-31' label=center labelPosition=center areaColor="hsla(206.25, 80%, 80%, 0.01)"/>
    <ReferenceArea xMin='2019-07-01' xMax='2021-07-31' label=right labelPosition=right areaColor="hsla(206.25, 80%, 80%, 0.01)"/>
    <ReferenceArea xMin='2019-07-01' xMax='2021-07-31' label=bottomLeft labelPosition=bottomLeft areaColor="hsla(206.25, 80%, 80%, 0.01)"/>
    <ReferenceArea xMin='2019-07-01' xMax='2021-07-31' label=bottom labelPosition=bottom areaColor="hsla(206.25, 80%, 80%, 0.01)"/>
    <ReferenceArea xMin='2019-07-01' xMax='2021-07-31' label=bottomRight labelPosition=bottomRight areaColor="hsla(206.25, 80%, 80%, 0.01)"/>
</LineChart>
```

#### Label Overlaps
Reference areas appear behind chart gridlines, including reference area labels. If you are seeing an overlap between the gridlines and the reference area label, you can avoi this by turning gridlines off (`yGridlines=false`).

### Colours

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0 >
    <ReferenceArea xMax='2019-04-01' label=info color=info/>
    <ReferenceArea xMin='2019-04-01' xMax='2019-11-01' label=negative color=negative/>
    <ReferenceArea xMin='2019-11-01' xMax='2020-07-01' label=warning color=warning/>
    <ReferenceArea xMin='2020-07-01' xMax='2021-02-01' label=positive color=positive/>
    <ReferenceArea xMin='2021-02-01' xMax='2021-09-01' label=base-content-muted color=base-content-muted/>
    <ReferenceArea xMin='2021-09-01' label=custom color=#f2dbff labelColor=#4d1070/>
</LineChart>
```

## Options
A reference area can be produced by defining values inline or by supplying a dataset, and the required props are different for each of those cases.

### Defining Values Inline

| Property | Description | Required | Options |
|----------|-------------|----------|---------|
| xMin | x-axis value where area should start. If left out, range will extend to the start of the x-axis. | false | number \| string \| date |
| xMax | x-axis value where area should end. If left out, range will extend to the end of the x-axis. | false | number \| string \| date |
| yMin | y-axis value where area should start. If left out, range will extend to the start of the y-axis. | false | number |
| yMax | y-axis value where area should end. If left out, range will extend to the end of the y-axis. | false | number |
| label | Text to show as label for the area | false | string |

- At least 1 of `xMin`, `xMax`, `yMin`, or `yMax` is required to plot an area.

### Supplying a Dataset

| Property | Description | Required | Options |
|----------|-------------|----------|---------|
| data | Query name, wrapped in curly braces | true | query name |
| xMin | Column containing x-axis values for area start. If left out, range will extend to the start of the x-axis. | false | column name |
| xMax | Column containing x-axis values for area end. If left out, range will extend to the end of the x-axis. | false | column name |
| yMin | Column containing y-axis values for area start. If left out, range will extend to the start of the y-axis. | false | column name |
| yMax | Column containing y-axis values for area end. If left out, range will extend to the end of the y-axis. | false | column name |
| label | Column containing a label to use for each area | false | column name |

- At least 1 of `xMin`, `xMax`, `yMin`, or `yMax` is required to plot an area.

### Styling

| Property | Description | Options | Default |
|----------|-------------|---------|---------|
| color | Color to override default area and label colors | CSS name \| hexademical \| RGB \| HSL | - |
| areaColor | Color to override default area color. If used, takes precedence over `color` | CSS name \| hexademical \| RGB \| HSL | - |
| opacity | Opacity of the highlighted area | number | - |
| border | Renders a border around the highlighted area | true, false | false |
| borderColor | Color to override default border color | CSS name \| hexademical \| RGB \| HSL | - |
| borderType | Options to show breaks in a line (dashed or dotted) | solid, dashed, dotted | dashed |
| borderWidth | Thickness of border (in pixels) | number | - |
| labelPosition | Where label will appear within the area | topLeft, top, topRight, left, center, right, bottomLeft, bottom, bottomRight | topLeft |
| labelColor | Color to override default label color. If used, takes precedence over `color` | CSS name \| hexademical \| RGB \| HSL | - |
| labelBackgroundColor | The color of the background behind the label | CSS name \| hexademical \| RGB \| HSL | - |
| labelPadding | Padding between the text and the border of the label background | number | - |
| labelBorderWidth | The thickness of the border around the label (in pixels) | number | - |
| labelBorderRadius | The radius of rounded corners on the label background (in pixels) | number | - |
| labelBorderColor | The color of the border around the label background | CSS name \| hexademical \| RGB \| HSL | - |
| labelBorderType | The type of border around the label background (dashed or dotted) | solid, dotted, dashed | - |
| fontSize | The size of the font in the label | number | - |
| align | How to align the label to the symbol, and the text within the label | left, center, right | - |
| bold | Make the label text bold | true, false | false |
| italic | Make the label text italic | true, false | false |

# Reference Point

Reference points allow you to add labels on certain points to emphasize them in the chart. They can be produced by providing a specific x/y coordinate (e.g. `x="2021-05-01"` `y=11012`) or by providing a dataset (e.g. `anomalies`, `points`).

When a dataset is provided, `ReferencePoint` will generate multiple points - one for each row in the dataset. This can be helpful for plotting a large number of points with a succinct syntax.

## Examples

### Defined Point

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0>
    <ReferencePoint x="2019-07-01" y=6590 label="2019-07-01 : Big drop" labelPosition=bottom/>
</LineChart>
```

### Points from Data

```sales_drops
select
    month,
    sales,
    concat('Sales dropped $', round(abs(sales_diff))::int::text) as label
from (
    select
        month,
        sales,
        sales - lag(sales) over (order by month) as sales_diff
    from ${orders_by_month}
)
where sales_diff < -2000
```

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0>
    <ReferencePoint data="sales_drops" x=month y=sales label=label labelPosition=bottom align=right />
</LineChart>
```

### Custom Styling

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0>
    <ReferencePoint
        x="2019-07-01"
        y=6590
        label="2019-07-01 : Big drop"
        labelPosition=right
        color=negative
        symbolSize=16
        symbolBorderWidth=1
        symbolBorderColor=negative
        symbolOpacity=0.25
    />
</LineChart>
```

### Label Positions

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0>
    <ReferencePoint x="2019-07-01" y=6590 label=top labelPosition=top/>
    <ReferencePoint x="2019-07-01" y=6590 label=right labelPosition=right/>
    <ReferencePoint x="2019-07-01" y=6590 label=bottom labelPosition=bottom/>
    <ReferencePoint x="2019-07-01" y=6590 label=left labelPosition=left/>
</LineChart>
```

#### Multiline label

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0>
    <ReferencePoint x="2019-07-01" y=6590 labelPosition=bottom align=left>
        A label with
        line breaks in it
        to allow longer text
    </ReferencePoint>
</LineChart>
```

### Colours

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0>
    <ReferencePoint x="2019-03-01" y=3000 color=info label=info />
    <ReferencePoint x="2019-09-01" y=3000 color=negative label=negative />
    <ReferencePoint x="2020-03-01" y=3000 color=warning label=warning />
    <ReferencePoint x="2020-09-01" y=3000 color=positive label=positive />
    <ReferencePoint x="2021-03-01" y=3000 color=base-content-muted label=base-content-muted />
    <ReferencePoint x="2021-09-01" y=3000 color=#63178f label=custom />
</LineChart>
```

## Options

### Defining Values Inline

| Property | Description | Required | Options |
|----------|-------------|----------|---------|
| x | x coordinate value where the point will be plotted | false | number \| string \| date |
| y | y coordinate value where the point will be plotted | false | number \| string \| date |
| label | Text to show as label for the point | true | string |

### Supplying a Dataset

| Property | Description | Required | Options |
|----------|-------------|----------|---------|
| data | Query name, wrapped in curly braces | true | query name |
| x | Column containing x-axis values for points | false | column name |
| y | Column containing y-axis values for points | false | column name |
| label | Column containing a label to use for each line | true | column name |

### Styling

| Property | Description | Options | Default |
|----------|-------------|---------|---------|
| color | Color to override default line and label colors | CSS name \| hexademical \| RGB \| HSL | base-content-muted |
| labelColor | Color to override default label color. If used, takes precedence over `color` | CSS name \| hexademical \| RGB \| HSL | - |
| labelWidth | The width available for the label. If text is longer than this width, it will wrap to new lines. | fit \| string \| number | fit |
| labelPadding | Padding between the text and the border of the label background | number | - |
| labelPosition | Where the label will appear relative to the point | top, right, bottom, left | top |
| labelBackgroundColor | The color of the background behind the label | CSS name \| hexademical \| RGB \| HSL | hsla(360, 100%, 100%, 0.7) |
| labelBorderWidth | The thickness of the border around the label (in pixels) | number | - |
| labelBorderRadius | The radius of rounded corners on the label background (in pixels) | number | - |
| labelBorderColor | The color of the border around the label background | CSS name \| hexademical \| RGB \| HSL | - |
| labelBorderType | The type of border around the label background (dashed or dotted) | solid, dotted, dashed | - |
| fontSize | The size of the font in the label | number | - |
| align | How to align the label to the symbol, and the text within the label | left, center, right | - |
| bold | Make the label text bold | true, false | false |
| italic | Make the label text italic | true, false | false |
| symbol | The type of symbol used to mark the x/y coordinate(s) | circle, rect, roundRect, triangle, diamond, pin, arrow, none | circle |
| symbolColor | Color to override default symbol color. If used, takes precedence over `color` | CSS name \| hexademical \| RGB \| HSL | - |
| symbolSize | The size of the symbol | number | 8 |
| symbolOpacity | The opacity of the symbol | number | - |
| symbolBorderWidth | The width of the border around the symbol | number | - |
| symbolBorderColor | The color of the border around the symbol | CSS name \| hexademical \| RGB \| HSL | - |
| preserveWhitespace | When true, stops multiline labels from having whitespace at the start/end of lines trimmed | true, false | false |

# Callout

Callouts are very similar to reference points, just with different default styling to optimize them for slightly different use cases. Callouts allow you to add a long label somewhere on a chart to describe a trend or provide insight on the data. They can be produced by providing a specific x/y coordinate (e.g. `x="2021-05-01"` `y=11012`) or by providing a dataset (e.g. `anomalies`, `points`).

When a dataset is provided, `Callout` will generate multiple points - one for each row in the dataset. This can be helpful for plotting a large number of points with a succinct syntax.

## Examples

### Defined Point

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0>
    <Callout x="2019-07-01" y=6590 label="Sales really dropped here" labelPosition=bottom/>
</LineChart>
```

### Points from Data

```sales_drops
select
    month,
    sales,
    concat('Sales dropped $', round(abs(sales_diff))::int::text) as label
from (
    select
        month,
        sales,
        sales - lag(sales) over (order by month) as sales_diff
    from ${orders_by_month}
)
where sales_diff < -2000
```

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0>
    <Callout data="sales_drops" x=month y=sales label=label labelPosition=bottom align=right />
</LineChart>
```

### Custom Styling

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0>
    <Callout
        x="2019-07-01"
        y=6590
        label="Sales really dropped here"
        labelPosition=right
        color=negative
        symbolSize=16
        symbolBorderWidth=1
        symbolBorderColor=negative
        symbolOpacity=0.25
    />
</LineChart>
```

### Label Positions

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0>
    <Callout x="2019-07-01" y=6590 label=top labelPosition=top/>
    <Callout x="2019-07-01" y=6590 label=right labelPosition=right/>
    <Callout x="2019-07-01" y=6590 label=bottom labelPosition=bottom/>
    <Callout x="2019-07-01" y=6590 label=left labelPosition=left/>
</LineChart>
```

#### Multiline label

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0>
    <Callout x="2019-07-01" y=6590 labelPosition=bottom align=left>
        Callout
        with
        line
        breaks
    </Callout>
</LineChart>
```

### Colours

**Example:**

```html
<LineChart data="orders_by_month" x=month y=sales yFmt=usd0>
    <Callout x="2019-03-01" y=3000 color=info label=info />
    <Callout x="2019-09-01" y=3000 color=negative label=negative />
    <Callout x="2020-03-01" y=3000 color=warning label=warning />
    <Callout x="2020-09-01" y=3000 color=positive label=positive />
    <Callout x="2021-03-01" y=3000 color=base-content-muted label=base-content-muted />
    <Callout x="2021-09-01" y=3000 color=#63178f label=custom />
</LineChart>
```

## Options

### Defining Values Inline

| Property | Description | Required | Options |
|----------|-------------|----------|---------|
| x | x coordinate value where the point will be plotted | false | number \| string \| date |
| y | y coordinate value where the point will be plotted | false | number \| string \| date |
| label | Text to show as label for the point | true | string |

### Supplying a Dataset

| Property | Description | Required | Options |
|----------|-------------|----------|---------|
| data | Query name, wrapped in curly braces | true | query name |
| x | Column containing x-axis values for points | false | column name |
| y | Column containing y-axis values for points | false | column name |
| label | Column containing a label to use for each line | true | column name |

### Styling

| Property | Description | Options | Default |
|----------|-------------|---------|---------|
| color | Color to override default line and label colors | CSS name \| hexademical \| RGB \| HSL | base-content-muted |
| labelColor | Color to override default label color. If used, takes precedence over `color` | CSS name \| hexademical \| RGB \| HSL | - |
| labelWidth | The width available for the label. If text is longer than this width, it will wrap to new lines. | fit \| string \| number | fit |
| labelPadding | Padding between the text and the border of the label background | number | - |
| labelPosition | Where the label will appear relative to the point | top, right, bottom, left | top |
| labelBackgroundColor | The color of the background behind the label | CSS name \| hexademical \| RGB \| HSL | hsla(360, 100%, 100%, 0.7) |
| labelBorderWidth | The thickness of the border around the label (in pixels) | number | - |
| labelBorderRadius | The radius of rounded corners on the label background (in pixels) | number | - |
| labelBorderColor | The color of the border around the label background | CSS name \| hexademical \| RGB \| HSL | - |
| labelBorderType | The type of border around the label background (dashed or dotted) | solid, dotted, dashed | - |
| fontSize | The size of the font in the label | number | - |
| align | How to align the label to the symbol, and the text within the label | left, center, right | - |
| bold | Make the label text bold | true, false | false |
| italic | Make the label text italic | true, false | false |
| symbol | The type of symbol used to mark the x/y coordinate(s) | circle, rect, roundRect, triangle, diamond, pin, arrow, none | circle |
| symbolColor | Color to override default symbol color. If used, takes precedence over `color` | CSS name \| hexademical \| RGB \| HSL | - |
| symbolSize | The size of the symbol | number | 8 |
| symbolOpacity | The opacity of the symbol | number | - |
| symbolBorderWidth | The width of the border around the symbol | number | - |
| symbolBorderColor | The color of the border around the symbol | CSS name \| hexademical \| RGB \| HSL | - |
| preserveWhitespace | When true, stops multiline labels from having whitespace at the start/end of lines trimmed | true, false | false |

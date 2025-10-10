---
title: Grid
description: Arrange components in a grid with a specified number of columns.
---

Use the grid component to arrange components in a grid with a specified number of columns. On smaller screen widths, the grid will stack the components vertically to maintain readability.


**Example:**

```svelte
<Grid cols=2>
    <LineChart data="orders_by_category" x=order_month y=orders/>
    <BarChart data="orders_by_category" x=order_month y=orders fillColor=#00b4e0/>
    <ScatterPlot data="orders_by_category" x=order_month y=orders fillColor=#015c08/>
    <AreaChart data="orders_by_category" x=order_month y=orders fillColor=#b8645e lineColor=#b8645e/>
</Grid>
```

## Group Component

To include multiple items inside one grid cell, use the `Group` component to wrap the items you want to include in that cell.

For example:

**Example:**

```html
<Grid cols=2>
    <LineChart data="orders_by_category" x=order_month y=orders/>
   <Group>
      Some text
    <BarChart data="orders_by_category" x=order_month y=orders fillColor=#00b4e0/>
   </Group>
</Grid>
```

This will stack "some text" above the bar chart, rather than giving it it's own cell.

## Options

| Property | Description | Options | Default |
|----------|-------------|---------|---------|
| cols | Number of columns in the grid on a full size screen | 1, 2, 3, 4, 5, 6 | 2 |
| gapSize | Space between grid elements | none, sm, md, lg | md |

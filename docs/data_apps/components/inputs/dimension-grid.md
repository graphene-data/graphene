---
title: Dimension Grid
description: Display an interactive grid of one dimensional columns to filter by many dimensions simultaneously.
---

Dimension grid produces an interactive grid of one dimension tables, one for each string column in the source table. The dimension grid can can also be used as an input. 



````markdown
<DimensionGrid data="orders" metric='sum(sales)' name=selected_dimensions /> 

<LineChart data="monthly_sales" handleMissing=zero/>
````

## Examples

### Basic Usage 

```html
<DimensionGrid data="my_query" />
```

### As an Input 

Dimension grid produces a condition for all of the selected dimensions which is suitable for referencing directly in a `where` or `filter` clause. For example `airline = 'Air Canada' and plane = '747`. Where no dimensions have been selected, DimensionGrid returns `true`. 

````html
<DimensionGrid 
    data="my_query" 
    name="selected_dimensions"
/>


````

### Multi Select 

Using the multiple prop, Dimension grid can filter by multiple rows in the same column. Default value is false


````html
<DimensionGrid 
    data="orders" 
    metric='sum(sales)' 
    name=multi_dimensions 
    multiple
/>

<LineChart data="monthly_sales_multi" y=sales_usd0/> 


````

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | Query name, wrapped in curly braces | true | string | - |
| metric | SQL aggregate which could be applied to `data` e.g. 'sum(sales)' | false | string | "count(*)" |
| name | Name of the dimension grid, used to reference the selected value elsewhere as `{inputs.name}` | false | string | - |
| title | Title for the dimension grid | false | string | - |
| subtitle | Subtitle - appears under the title | false | string | - |
| metricLabel | Label for the metric | false | string | - |
| fmt | Sets format for the value [(see available formats)](/core-concepts/formatting) | false | Excel-style format \| built-in format \| custom format | - |
| limit | Maximum number of rows to include in each table | false | number | "10" |
| multiple | Allows for multiple rows in a column to be selected and filtered | false | boolean | "false" |

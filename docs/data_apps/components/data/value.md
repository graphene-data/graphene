---
title: Value
description: Display a formatted value from a query inline in text.
---

Use a Value component to display a formatted value from a query inline in text.

By default, `Value` will display the value from the first row of the first column of the referenced data.

```markdown
<Value data={query_name} /> <!-- First row from the first column -->
```

## Specifying Rows and Columns

Optionally supply a `column` and/or a `row` argument to display other values from `data`. 

> **Info**
> 
> **Row Index**
> 
> `row` is zero-indexed, so `row=0` displays the first row.

```markdown
<!-- Show the **7th row** from column_name -->

<Value 
    data={query_name}
    column=column_name 
    row=6
/>
```

## Example

**Markdown:**

```markdown
The most recent month of data began <Value data={monthly_orders} />,
when there were <Value data={monthly_orders} column=orders/> orders.
```

**Results:**
![summary-sentence](/img/tutorial-img/needful-things-value-in-text-nowindow.png)

## Adding a Placeholder

Override errors with the optional `placeholder` argument. This is useful for drafting reports _before_ writing your queries.

```markdown
<Value placeholder="sales last year"/>
```

Sales in the last fiscal year were <Value placeholder="sales last year"/>, a change of <Value placeholder="X%"/> vs. the prior year.

## Formatting Values
Graphene supports a variety of formats - see [value formatting](/core-concepts/formatting) and the `fmt` prop below for more info.

## Aggregated Values

Values support basic aggregations such as, `min`, `max`, `median`, `sum`, `avg`


```markdown
<Value data={orders} column="sales" agg="avg" fmt="usd0" />
```

## Customize Color Values

```markdown
<Value data={orders} column="sales" agg="avg" fmt="usd0" color="#85BB65" />
```

## Red Negative Values


If the value is negative, the font color will automatically change to red, overriding any color specified by the color prop.

```markdown
<Value data={NegativeSales} column="max_sales" agg="avg" fmt="usd0" redNegatives="true" />
```

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | Query name, wrapped in curly braces | true | query name | - |
| column | Column to pull values from | false | column name | First column |
| row | Row number to display. 0 is the first row. | false | number | "0" |
| placeholder | Text to display in place of an error | false | string | - |
| fmt | Format to use for the value ([see available formats](/core-concepts/formatting)) | false | Excel-style format \| built-in format \| custom format | - |
| emptySet | Sets behaviour for empty datasets. Can throw an error, a warning, or allow empty. When set to 'error', empty datasets will block builds in `build:strict`. Note this only applies to initial page load - empty datasets caused by input component changes (dropdowns, etc.) are allowed. | false | ['error', 'warn', 'pass'] | "error" |
| emptyMessage | Text to display when an empty dataset is received - only applies when `emptySet` is 'warn' or 'pass', or when the empty dataset is a result of an input component change (dropdowns, etc.). | false | string | "No records" |
| agg | Adds aggregation to query, column name required. | false | ['sum', 'avg', 'min', 'median', 'max'] | null |
| color | Specifies the font color of the Value. | false | CSS name \| hexademical \| RGB \| HSL | - |
| redNegatives | Conditionally sets the font color to red based on whether the selected value is less than 0 | false | [`true`, `false`] | "false" |
| description | Adds an info icon with description tooltip on hover | false | string | - |

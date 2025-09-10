---
title: Date Input
description: Display a date picker for selecting a singledate or a range of dates.
---

A date input component allows the user to select a date or a range of dates. The selected dates can be used as inputs to queries or components.

To see how to filter a query using an input component, see [Filters](/core-concepts/filters).


````markdown
<DateInput
    name=date_filtering_a_query
    data={orders_by_day}
    dates=day
/>

<BarChart
    data={filtered_query}
    x=day
    y=sales
/>
````

## Examples

### Using Date Input from a Query

The Date selected can be accessed through the `inputs.[name].value` 

````markdown
<DateInput
    name=date_range_from_query
    data={orders_by_day}
    dates=day
/>

Date Selected: {inputs.date_input_from_query.value}
````

### With a Title

```markdown
<DateInput
    name=date_range_with_title
    data={orders_by_day}
    dates=day
    title="Select a Date Input"/>
```

## Date Range

Creates a date picker for selecting a date range to filter queries, with selectable preset date options.

### Filtering a Query with Range Calendar

The Date selected can be accessed through the `inputs.[name].start` & `inputs.[name].end`


````markdown
<DateInput
    name=range_filtering_a_query
    data={orders_by_day}
    dates=day
    title='Date Range'
    range
/>

<LineChart
    data={filtered_query_ranged}
    x=day
    y=sales
/>
````

### Default Value for Preset Ranges

````svelte
<DateInput
    name=name_of_date_range
    defaultValue={'Last 7 Days'}
    range
/>
````

### Customizing Single Preset Ranges

```svelte
<DateInput 
    name="date_range_2" 
    presetRanges={'Last 7 Days'} 
    range
/>
```

### Customizing Multiple Preset Ranges

````svelte
<DateInput
    name="date_range_3"
    range
    presetRanges={['Last 7 Days', 'Last 3 Months', 'Year to Date', 'All Time']}
/>
````

### Manually Specifying a Range

```markdown
<DateInput
    name=manual_date_range
    start=2019-01-01
    end=2019-12-31
    range
/>
```

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| name | Name of the DateInput, used to reference the selected values elsewhere as `{inputs.name.start`} or `{inputs.name.end`}` | true | string | - |
| data | Query name, wrapped in curly braces | false | query name | - |
| range | toggles between a ranged and single input calendar | false | ["true", "false"] | false |
| dates | Column name from the query containing Date Input to span | false | column name | - |
| start | A manually specified start date to use for the range | false | string formatted YYYY-MM-DD | - |
| end | A manually specified end date to use for the range | false | string formatted YYYY-MM-DD | - |
| title | Title to display in the Date Input component | false | string | - |
| presetRanges | Customize "Select a Range" drop down, by including present range options. **Range options**: `'Last 7 Days'` `'Last 30 Days'` `'Last 90 Days'` `'Last 3 Months'` `'Last 6 Months'` `'Last 12 Months'` `'Last Month'` `'Last Year'` `'Month to Date'` `'Year to Date'` `'All Time'` | false | string \| array of values e.g. `{['Last 7 Days', 'Last 30 Days']}` | undefined |
| defaultValue | Accepts preset in string format to apply default value in Date Input picker. **Range options**: `'Last 7 Days'` `'Last 30 Days'` `'Last 90 Days'` `'Last 3 Months'` `'Last 6 Months'` `'Last 12 Months'` `'Last Month'` `'Last Year'` `'Month to Date'` `'Year to Date'` `'All Time'` | false | string e.g. {'Last 7 Days'} or {'Last 6 Months'} | undefined |
| hideDuringPrint | Hide the component when the report is printed | false | ["true", "false"] | "true" |
| description | Adds an info icon with description tooltip on hover | false | string | - |

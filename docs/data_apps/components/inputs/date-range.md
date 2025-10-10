---
title: Date Range
description: Display a date picker for selecting a range of dates.
---

Creates a date picker that can be used to filter a query.
Includes a set of preset ranges for quick selection of common date ranges. These are relative to the supplied end date.

To see how to filter a query using an input component, see [Filters](/core-concepts/filters).

````markdown
<DateRange
    name=date_range_name
    data="orders_by_day"
    dates=day
/>

From {inputs.date_range_name.start} to {inputs.date_range_name.end}
````

## Examples

### Using Date Range from a Query

````markdown
<DateRange
    name=date_range_from_query
    data="orders_by_day"
    dates=day
/>

From {inputs.date_range_from_query.start} to {inputs.date_range_from_query.end}
````

### Manually Specifying a Range

```markdown
<DateRange
    name=manual_date_range
    start=2019-01-01
    end=2019-12-31
/>
```

### With a Title

```markdown
<DateRange
    name=date_range_with_title
    data="orders_by_day"
    dates=day
    title="Select a Date Range"
/>
```

### Visible During Print / Export

````markdown
<DateRange
    name=date_range_visible_during_print
    data="orders_by_day"
    dates=day
    hideDuringPrint="false"
/>
````

### Filtering a Query


````markdown
<DateRange
    name=range_filtering_a_query
    data="orders_by_day"
    dates=day
/>

<LineChart
    data="filtered_query"
    x=day
    y=sales
/>
````

### Customizing Single Preset Ranges

```svelte
<DateRange
    name="date_range_preset"
    presetRanges="'Last 7 Days'"
/>
```

### Customizing Multiple Preset Ranges

````svelte
<DateRange
    name="date_range_preset_2"
    presetRanges={['Last 7 Days', 'Last 3 Months', 'Year to Date', 'All Time']}
/>
````

### Default Value for Preset Ranges

````svelte
<DateRange
    name="date_range_preset_3"
    defaultValue="'Last 7 Days'"
/>
````

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| name | Name of the DateRange, used to reference the selected values elsewhere as `{inputs.name.start`} or `{inputs.name.end`}` | true | string | - |
| data | Query name, wrapped in curly braces | false | query name | - |
| dates | Column name from the query containing date range to span | false | column name | - |
| start | A manually specified start date to use for the range | false | string formatted YYYY-MM-DD | - |
| end | A manually specified end date to use for the range | false | string formatted YYYY-MM-DD | - |
| title | Title to display in the Date Range component | false | string | - |
| presetRanges | Customize "Select a Range" drop down, by including present range options. **Range options**: `'Last 7 Days'` `'Last 30 Days'` `'Last 90 Days'` `'Last 365 Days'` `'Last 3 Months'` `'Last 6 Months'` `'Last 12 Months'` `'Last Month'` `'Last Year'` `'Month to Date'` `'Month to Today'` `'Year to Date'` `'Year to Today'` `'All Time'` | false | string \| array of values e.g. `{['Last 7 Days', 'Last 30 Days']}` | undefined |
| defaultValue | Accepts preset in string format to apply default value in Date Range picker. **Range options**: `'Last 7 Days'` `'Last 30 Days'` `'Last 90 Days'` `'Last 365 Days'` `'Last 3 Months'` `'Last 6 Months'` `'Last 12 Months'` `'Last Month'` `'Last Year'` `'Month to Date'` `'Month to Today'` `'Year to Date'` `'Year to Today'` `'All Time'` | false | string e.g. {'Last 7 Days'} or {'Last 6 Months'} | undefined |
| hideDuringPrint | Hide the component when the report is printed | false | ["true", "false"] | "true" |
| description | Adds an info icon with description tooltip on hover | false | string | - |

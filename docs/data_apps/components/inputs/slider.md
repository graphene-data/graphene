---
title: Slider
description: Display a linear input to select a value from a range.
---

Creates a Slider input with default min, max and step values

````markdown
<Slider
    title="sales" 
    name=sales
    defaultValue=50
    fmt="usd0"
/>
````

Min and Max values can be defined, the step property and define the incremental value of the slider

````markdown
<Slider
    title="Months" 
    name=monthsWithSteps
    min=0
    max=36
    step=12
/>
````

showMaxMin property can hide the Max and Min values with false, by default showMaxMin is true

````markdown
<Slider
    title="Months" 
    name=monthsWithoutMinMax
    min=0
    max=36
    showMaxMin=false
/>
````

The default size of the slider can be altered with the size property using; medium, large or full

````markdown
<Slider
    title="Months Medium" 
    name=monthsMedium
    defaultValue=4
    min=0
    max=36
    size=medium
/>
````

````markdown
<Slider
    title="Months Large" 
    name=monthsLarge
    defaultValue=18
    min=0
    max=36
    size=large
/>
````

````markdown
<Slider
    title="Months Full" 
    name=monthsFull
    defaultValue=26
    min=0
    max=36
    size=full
/>
````


## Specifying Dynamic Columns

Supply data with a specified column name to define the slider's min and max values. The slider's range will be calculated based on the column's minimum and maximum values.

````markdown
<Slider
    title='data slider'
    name='RangeSlider'
    size=large
    step=100
    data={flight_data}
    range=fare
/>
````

Supply data with specified column names for minColumn, maxColumn, and/or defaultValue. The first row's value in each of these columns will determine the minimum, maximum, or default value, respectively.

````markdown
<Slider
    title='data slider'
    name='MaxColSlider'
    size=large
    step=100
    data={flight_data}
    maxColumn=max_fare
    min=0
    defaultValue=max_fare
/>
````

# Slider

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| name | name of the slider, used to reference the selected value elsewhere as `{inputs.name}` | true | - | - |
| defaultValue | Sets the initial value of the silder | false | - | - |
| min | Sets the minimum value on the slider. Negative Values accepted. | false | number | 0 |
| max | Sets the maximum value on the slider. This value must be larger than the min. | false | number | 100 |
| data | Query name, wrapped in curly braces | false | query name | - |
| range | Required for data - Take and sets the max and min values of a column | false | string - column name | - |
| maxColumn | Takes the first value of a column and assigns it to the max value | false | string - column name | - |
| minColumn | Takes the first value of a column and assigns it to the min value | false | string - column name | - |
| step | Defines the incremental value of the slider | false | number | 1 |
| showMinMax | Hides or shows min and max value markers on slider. | false | boolean | "true" |
| size | Sets the length of the slider | false | ["small", "medium", "large", "full"] | "small" |
| fmt | Sets format for the value ([see available formats](/core-concepts/formatting)) | false | Excel-style format \| built-in format \| custom format | - |
| description | Adds an info icon with description tooltip on hover | false | string | - |
| hideDuringPrint | Hide the component when the report is printed | false | ["true", "false"] | "true" |

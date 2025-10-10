---
title: Checkbox
description: Display a toggleable box for a boolean value.
---

Creates a checkbox with toggleable input. The Title and Name attributes can be defined, enabling the passing of true and false values. 

## Example

````markdown
<Checkbox
    title="Hide Months 0" 
    name=hide_months_0 
/>
````

### Checkbox using Default Value

Defining the checked property will set the initial checkbox value with true and false.

```markdown
<Checkbox
    title="Title of checkbox" 
    name=name_of_checkbox
    checked=true
/>

Selected Value: {inputs.name_of_checkbox}
```

### Filtering a Query with Checkbox


````markdown
<Checkbox
    title="Exclude low values" 
    name=exclude_low_value
/>

<BigValue fmt=num0 value=records_count data="orders"/>
````

# Checkbox

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| name | Name of the checkbox, used to reference the selected value elsewhere as `{inputs.name.value}` | true | - | - |
| title | Label for the checkbox. If undefined, will default to small checkbox | false | 'string' | - |
| checked | Initial value for checkbox. True value for checked, false for unchecked | false | boolean | false |
| description | Adds an info icon with description tooltip on hover | false | string | - |

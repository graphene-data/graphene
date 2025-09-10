---
title: Dropdown
description: Display a dropdown menu with a options from a query or hardcoded options.
---

Creates a dropdown menu with a list of options that can be selected. The selected option can be used to filter queries or in markdown.

To see how to filter a query using a dropdown, see [Filters](/core-concepts/filters).


````markdown
<Dropdown 
    data={categories} 
    name=category1 
    value=category_name 
    title="Select a Category" 
    defaultValue="Sinister Toys"
/>

Selected: {inputs.category1.value}
````

## Examples

### Dropdown using Options from a Query

````markdown
<Dropdown 
    data={categories} 
    name=category2 
    value=category_name 
/>
````

Selected: {inputs.category2.value}

### With a Title

````markdown
<Dropdown 
    data={categories} 
    name=category3 
    value=category_name 
    title="Select a Category" 
    defaultValue="Sinister Toys"
/>

Selected: {inputs.category3.value}
````

### With a Default Value

````markdown
<Dropdown
    data={categories} 
    name=category4
    value=category_name
    title="Select a Category"
    defaultValue="Odd Equipment"
/>

Selected: {inputs.category4.value}
````

### With Hardcoded Options

````markdown
<Dropdown name=hardcoded>
    <DropdownOption valueLabel="Option One" value="1" />
    <DropdownOption valueLabel="Option Two" value="2" />
    <DropdownOption valueLabel="Option Three" value="3" />
</Dropdown>

Selected: {inputs.hardcoded.value}
````

### Alternative Labels

This example uses a column called `abbrev`, which contains an alternate label for each category

````markdown
<Dropdown
    data={categories} 
    name=category_abbrev
    value=category_name
    label=abbrev
/>
````

Selected: {inputs.category_abbrev.value}

### Multi-Select

When using multi-select dropdowns, you need to use an alternative SQL expression:

`where column_name IN ${inputs.my_input.value}`

Note: 
- The use of the IN operator
- No single quotes used around the `${}`

````markdown
<Dropdown
    data={categories} 
    name=category_multi
    value=category_name
    multiple=true
/>

Selected: {inputs.category_multi.value}
````

### Filtering a Query


Starting with this table of orders:

````markdown
<DataTable data={order_history}/>
````

Use this input to filter the results:


````markdown
<Dropdown
    data={query_name} 
    name=name_of_dropdown
    value=column_name
/>


Filtered Row Count: {orders_filtered.length}

<DataTable data={orders_filtered}/>
````

### Multiple defaultValues

````svelte
<Dropdown
    data={query_name} 
    name=name_of_dropdown
    value=column_name
    multiple=true
	defaultValue={['Sinister Toys', 'Mysterious Apparel']}
/>

Selected: {inputs.category_multi_default.value}
````

### Select all by Default Value with Multiple

Select and return all values in the dropdown list, requires "multiple" prop.

````markdown
<Dropdown
    data={categories} 
    name=category_multi_selectAllByDefault
    value=category_name
    title="Select a Category"
    multiple=true
    selectAllByDefault=true
/>

Selected: {inputs.category_multi_selectAllByDefault.value}
````

# Dropdown

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| name | Name of the dropdown, used to reference the selected value elsewhere as `{inputs.name.value}` | true | - | - |
| data | Query name, wrapped in curly braces | false | query name | - |
| value | Column name from the query containing values to pick from | false | column name | - |
| multiple | Enables multi-select which returns a list | false | ['true', 'false'] | "false" |
| defaultValue | Value to use when the dropdown is first loaded. Must be one of the options in the dropdown. Arrays supported for multi-select. | false | value from dropdown \| array of values e.g. `{['Value 1', 'Value 2']}` | - |
| selectAllByDefault | Selects and returns all values, multiple property required | false | ['true', 'false'] | "false" |
| noDefault | Stops any default from being selected. Overrides any set `defaultValue`. | false | boolean | "false" |
| disableSelectAll | Removes the `Select all` button. Recommended for large datasets. | false | boolean | "false" |
| label | Column name from the query containing labels to display instead of the values (e.g., you may want to have the drop-down use `customer_id` as the value, but show `customer_name` to your users) | false | column name | Uses the column in value |
| title | Title to display above the dropdown | false | string | - |
| order | Column to sort options by, with optional ordering keyword | false | column name [ asc \| desc ] | Ascending based on dropdown value (or label, if specified) |
| where | SQL where fragment to filter options by (e.g., where sales > 40000) | false | SQL where clause | - |
| hideDuringPrint | Hide the component when the report is printed | false | ["true", "false"] | "true" |
| description | Adds an info icon with description tooltip on hover | false | string | - |

# DropdownOption

## Options

The DropdownOption component can be used to manually add options to a dropdown. This is useful to add a default option, or to add options that are not in a query.

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| value | Value to use when the option is selected | true | - | - |
| valueLabel | Label to display for the option in the dropdown | false | - | Uses the value |

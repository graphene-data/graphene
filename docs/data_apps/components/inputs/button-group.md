---
title: Button Group
description: Display a group of single-select buttons for quick filtering using a small set of options.
---

Creates a group of single-select buttons for quick filtering

To see how to filter a query using a Button Group, see [Filters](/core-concepts/filters).

## Examples

### Button Group using Options from a Query

```markdown
<ButtonGroup 
    data={categories} 
    name=category_picker 
    value=category
/>

Selected: {inputs.category_picker}
```

### With a Title

```markdown
<ButtonGroup 
    data={categories} 
    name=category_selector 
    value=category
    title="Select a Category"
/>

Selected: {inputs.category_selector}
```

### With a Default Value

````markdown
<ButtonGroup
    data={categories}
    name=selected_button1
    value=category
    defaultValue="Cursed Sporting Goods"
/>

Selected: {inputs.selected_button1}
````

### With Hardcoded Options

````markdown
<ButtonGroup name=hardcoded_options>
    <ButtonGroupItem valueLabel="Option One" value="1" />
    <ButtonGroupItem valueLabel="Option Two" value="2" />
    <ButtonGroupItem valueLabel="Option Three" value="3" />
</ButtonGroup>

Selected: {inputs.hardcoded_options}
````

### With Hardcoded Options and Default Value

````markdown
<ButtonGroup name=hardcoded_options_default>
    <ButtonGroupItem valueLabel="Option One" value="1" />
    <ButtonGroupItem valueLabel="Option Two" value="2" default />
    <ButtonGroupItem valueLabel="Option Three" value="3" />
</ButtonGroup>

Selected: {inputs.hardcoded_options_default}
````

### Alternative Labels

````markdown
<ButtonGroup
    data={categories} 
    name=alternative_labels_selector
    value=category
    label=short_category
/>

Selected: {inputs.alternative_labels_selector}
````

### Filtering a Query


````markdown
<ButtonGroup
    data={categories} 
    name=category_button_group
    value=category
/>

<DataTable data={filtered_query} emptySet=pass emptyMessage="No category selected"/>
````

### Style Buttons as Tabs

```markdown
<ButtonGroup 
    data={categories} 
    name=buttons_as_tabs 
    value=category
    display=tabs
/>

Selected: {inputs.buttons_as_tabs}
```

### Style Buttons as Tabs: With Hardcoded Options

````markdown
<ButtonGroup name=button_tabs_hardcoded_options display=tabs>
    <ButtonGroupItem valueLabel="Option One" value="1" />
    <ButtonGroupItem valueLabel="Option Two" value="2" />
    <ButtonGroupItem valueLabel="Option Three" value="3" />
</ButtonGroup>

Selected: {inputs.button_tabs_hardcoded_options}
````

# ButtonGroup

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| name | Name of the button group, used to reference the selected value elsewhere as `{inputs.name}` | true | - | - |
| preset | Preset values to use | false | dates | - |
| data | Query name, wrapped in curly braces | false | query name | - |
| value | Column name from the query containing values to pick from | false | column name | - |
| label | Column name from the query containing labels to display instead of the values (e.g., you may want to have the drop-down use `customer_id` as the value, but show `customer_name` to your users) | false | column name | Uses the column in value |
| title | Title to display above the button group | false | string | - |
| defaultValue | Sets initial active button and current value | false | value from button group, e.g. 'Cursed Sporting Goods' | - |
| order | Column to sort options by | false | column name | Uses the same order as the query in `data` |
| where | SQL where fragment to filter options by (e.g., where sales > 40000) | false | SQL where clause | - |
| display | Displays tabs with button functionality | false | ['tabs', 'buttons'] | "buttons" |
| description | Adds an info icon with description tooltip on hover. Appears next to title. | false | string | - |

# ButtonGroupItem

The ButtonGroupItem component can be used to manually add options to a button group. This is useful if you want to add a default option, or if you want to add options that are not in a query.

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| value | Value to use when the option is selected | true | - | - |
| valueLabel | Label to display for the option in the dropdown | false | string | Uses value |
| default | Sets the option as the default | false | ["true", "false"] | "false" |
| hideDuringPrint | Hide the component when the report is printed | false | ["true", "false"] | true |

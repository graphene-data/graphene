---
title: Text Input
description: Display a text box for freeform text input, useful for searching or filtering.
---

Creates a text input that can be used to filter or search

To see how to filter a query using a text input, see [Filters](/core-concepts/filters).

````markdown
<TextInput
    name=name_of_input
    title="Search"
/>

Selected: {inputs.text_input_name}
````

## Examples

### Basic Text Input

````markdown
<TextInput
    name=name_of_input
/>

Selected: {inputs.name_of_input}
````

### With Title

````markdown
<TextInput
    name=name_of_input
    title="Search"
/>

Selected: {inputs.text_input2}
````

### With Placeholder

````markdown
<TextInput
    name=name_of_input
    title="Freetext Search"
    placeholder="Start typing"
/>

Selected: {inputs.text_input3}
````

### With Default Text Prefilled

````markdown
<TextInput
    name=name_of_input
    title="Default Selected"
    defaultValue="Sporting"
/>

Selected: {inputs.text_input4}
````

### Fuzzy Finding (Searching)

`TextInput` provides an easy-to-use shortcut for [fuzzy finding](https://duckdb.org/docs/sql/functions/char#text-similarity-functions). Note that this is different than `LIKE`, as it does not require a direct substring, and is useful in situtations where spelling may be unknown, like names.

You can reference it by using the syntax `{inputs.your_input_name.search('column_name')}`, and it returns a number between 0 and 1.

## Usage

Assuming you had some TextInput `first_name_search`:

becomes

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| name | Name of the text input, used to reference the selected value elsewhere as `{inputs.name.value}` | true | string | - |
| title | Title displayed above the text input | false | string | - |
| placeholder | Alternative placeholder text displayed in the text input | false | string | "Type to search" |
| hideDuringPrint | Hide the component when the report is printed | false | ['true', 'false'] | "true" |
| description | Adds an info icon with description tooltip on hover | false | string | - |

Creates a dropdown menu with a list of options that can be selected. The selected option can be used to filter queries or in markdown.

Here's an example:

````markdown
```sql statuses
select distinct status from orders
```

<Dropdown
  title="Select Order Status"
  name="status_dropdown"
  data="statuses"
  value="status"
  defaultValue="Complete"
/>
````

The user-selected value would then be referenced in GSQL as `$status_dropdown`. For example:

```sql
select *
from orders
where status = $status_dropdown
```

Dropdown selections also sync into the page URL query string. Single-select dropdowns use one key, and multi-select dropdowns repeat the key for each selected value.

# Attributes

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| name | Name of the dropdown, used to reference the selected value elsewhere as `"$name"` | true | - | - |
| data | GSQL query or table name | false | query name | - |
| value | Column name from the query containing values to pick from | false | column name | - |
| multiple | Enables multi-select which returns a list and syncs repeated values into the URL query string | false | `true`, `false` | `false` |
| defaultValue | Value to use when the dropdown is first loaded. Must be one of the options in the dropdown. Lists supported for multi-select. | false | value from dropdown, list of values e.g. `"Value 1, Value 2"` | - |
| selectAllByDefault | Selects and returns all values, multiple attribute required | false | `true`, `false` | `false` |
| noDefault | Stops any default from being selected. Overrides any set `defaultValue`. | false | boolean | `false` |
| disableSelectAll | Removes the `"Select all"` button. Recommended for large datasets. | false | boolean | `false` |
| label | Column name from the query containing labels to display instead of the values (e.g., you may want to have the drop-down use `customer_id` as the value, but show `customer_name` to your users) | false | column name | Uses the column in value |
| title | Title to display above the dropdown | false | string | - |
| description | Adds an info icon with description tooltip on hover | false | string | - |

# DropdownOption sub-component

The `DropdownOption` sub-component can be used to manually add options to a dropdown. This is useful to add a default option, or to add options that are not in a query.

Here's an example:

```markdown
<Dropdown name=hardcoded>
  <DropdownOption valueLabel="Option One" value=1 />
  <DropdownOption valueLabel="Option Two" value=2 />
  <DropdownOption valueLabel="Option Three" value=3 />
</Dropdown>
```

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| value | Value to use when the option is selected | true | - | - |
| valueLabel | Label to display for the option in the dropdown | false | - | Uses the value |

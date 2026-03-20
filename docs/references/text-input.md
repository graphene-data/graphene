Creates a text input that can be used to filter or search.

Here's an example:

```markdown
<TextInput
  name=name_of_input
  title=Search
/>
```

The user-inputted text would then be referenced in GSQL via `$name_of_input`. For example:

```sql
select *
from users
where email ilike concat('%', $name_of_input, '%')
```

Text input values also sync into the page URL query string so a reload or shared link preserves the same filter state.

# Attributes

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| name | Name of the text input, used to reference the selected value elsewhere as `"$name"` | true | string | - |
| title | Title displayed above the text input | false | string | - |
| placeholder | Alternative placeholder text displayed in the text input | false | string | `"Type to search"` |
| hideDuringPrint | Hide the component when the report is printed | false | `true`, `false` | `true` |
| description | Adds an info icon with description tooltip on hover | false | string | - |

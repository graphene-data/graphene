Use a BigValue to display a single large value standalone.

Here's an example:

```markdown
<BigValue
  data=orders
  value=num_orders
  title="Total Orders"
/>
```

# Attributes

| Attribute | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| data | GSQL query or table name | true | query name | - |
| value | Column or expression to pull the main value from | true | column name, stored expression name, GSQL expression | - |
| title | Title displayed above the value | false | string | - |
| subtitle | Subtitle displayed below the title | false | string | - |

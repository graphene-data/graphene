---
title: Info
description: Display an info icon with descriptive tooltip
---

The Info component can be used on a standalone basis as shown on this page, or can be used as part of other components which support the `description` prop (including Column, BigValue, Value, and more).

**Example:**

```markdown
Data was sourced from the World Bank <Info description="World Economic Indicators dataset from past 12 months" />
```

## Examples

### Inline Usage

**Example:**

```markdown
Data was sourced from the World Bank <Info description="World Economic Indicators dataset from past 12 months" />
```

### Theme Color

**Example:**

```markdown
Data was sourced from the World Bank <Info description="World Economic Indicators dataset from past 12 months" color="primary" />
```

### Custom Color

**Example:**

```markdown
Data was sourced from the World Bank <Info description="World Economic Indicators dataset from past 12 months" color="red" />
```

## Options

| Property | Description | Required | Options | Default |
|----------|-------------|----------|---------|---------|
| description | Text content for the tooltip. | true | string | - |
| color | Color of the tooltip content. | false | string | base-content-muted |
| size | Size of the icon. | false | number | 4 |
| className | Custom class names for the tooltip trigger. | false | string | - |

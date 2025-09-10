---
title: Alert
description: Display a message in a styled container on the page.
---

Use alerts to display a message in a styled container on the page.

**Example:**

```markdown
<Alert>
This is a default alert
</Alert>

<Alert status="info">
This is a informational alert
</Alert>

<Alert status="positive">
This is a positive alert
</Alert>

<Alert status="warning">
This is a warning alert
</Alert>

<Alert status="negative">
This is a negative alert
</Alert>
```

## Options

| Property | Description | Options |
|----------|-------------|---------|
| status | Changes the color of the alert | info, positive, warning, negative |
| description | Adds an info icon with description tooltip on hover | string |

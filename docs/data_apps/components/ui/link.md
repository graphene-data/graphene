---
title: Link
description: Add an inline link into your markdown
---

> **Note:** You can also use [markdown syntax for links](/reference/markdown#links). This component is useful when you need to customize the behavior or styling of the link (e.g., opening in new tab vs. current tab)

Use the `Link` component to add styled and accessible links to your markdown pages. This component allows you to control the destination URL, link text, and whether it opens in a new tab.

## Default usage

**Example:**

```markdown
<Link 
    url="https://github.com/evidence-dev/evidence"
    label="Visit Example"
/>
```

### Open in a new tab

**Example:**

```markdown
<Link 
    url="https://github.com/evidence-dev/evidence"
    label="Visit Example"
    newTab=true
/>
```

## Options

| Property | Description | Required | Options | Default |
|----------|-------------|----------|---------|---------|
| url | The destination URL of the link. It can accept either a full external link (e.g. `https://google.com`) or link to another page within your evidence app (e.g. `/sales/performance`). | true | string | - |
| label | The text displayed for the link. | false | string | Click here |
| newTab | Whether the link should open in a new tab | false | true, false | false |
| class | Pass custom classes to style the link. Supports [Tailwind classes](https://tailwindcss.com). | false | string | - |

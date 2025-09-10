---
title: Tabs
description: Organize content across multiple panes.
---

Use Tabs to organize content across multiple panes.

**Example:**

```markdown
<Tabs>
    <Tab label="First Tab">
        Content of the First Tab

        You can use **markdown** here too!
    </Tab>
    <Tab label="Second Tab">
        Content of the Second Tab

        Here's a [link](https://www.google.com)
    </Tab>
</Tabs>
```

## Examples

### Full Width

**Example:**

```markdown
<Tabs fullWidth=true>
    <Tab label="First Tab">
        Content of the First Tab
    </Tab>
    <Tab label="Second Tab">
        Content of the Second Tab
    </Tab>
</Tabs>
```

### Theme Color

**Example:**

```markdown
<Tabs color=primary>
    <Tab label="Primary Tabs">
        Content of the First Tab
    </Tab>
    <Tab label="Second Tab">
        Content of the Second Tab
    </Tab>
</Tabs>
```

### Custom Color

**Example:**

```markdown
<Tabs color=#ff0000>
    <Tab label="Red Tabs">
        Content of the First Tab
    </Tab>
    <Tab label="Second Tab">
        Content of the Second Tab
    </Tab>
</Tabs>
```

### Background Color

**Example:**

```markdown
<Tabs background=true>
    <Tab label="First Tab">
        Content of the First Tab
    </Tab>
    <Tab label="Second Tab">
        Content of the Second Tab
    </Tab>
</Tabs>
```

### Persist Selected Tab to URL

**Example:**

```markdown
<Tabs id="example-tab">
    <Tab label="One">
        Click Second id Tab and notice the the url updates!
    </Tab>
    <Tab label="Two">
        Refresh the page and the tab you selected persists!
    </Tab>
</Tabs>
```

# Tabs

## Options

| Property | Description | Options | Default |
|----------|-------------|---------|---------|
| id | Unique Id for this set of tabs. When set, the selected tab is included in the URL so it can be shared. | string | - |
| color | Color for the active tab. Accepts theme tokens | Any valid hex, rgb, or hsl string | base-content |
| fullWidth | Tabs take up full width of page | true, false | false |
| background | Include background color on active tab. Color is automatically determined based on `color` prop | true, false | false |

# Tab

## Options

| Property | Description | Required | Options | Default |
|----------|-------------|----------|---------|---------|
| label | Label for the tab | true | string | - |
| id | Unique Id for this tab. Only needed if 2 tabs have the same label (not recommended). | false | string | - |
| printShowAll | On print/PDF, the Tabs will repeat to show all content by default. Turn this off to leave the component collapsed in print. | false | true, false | true |
| description | Adds an info icon with description tooltip on hover | false | string | - |

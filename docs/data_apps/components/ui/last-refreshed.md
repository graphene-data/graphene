---
title: Last Refreshed
description: Display text indicating the last time the data was refreshed.
---

Displays the last time the data was refreshed. This component is useful for showing users how up-to-date the data is.

**Example:**

```markdown
<LastRefreshed/>
```

## Examples

### Alternative Prefix

```markdown
<LastRefreshed prefix="Data last updated"/>
```

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| prefix | Text to display before the last refreshed time | false | string | "Last refreshed" |
| printShowDate | On print/PDF, will show the date and time rather than "X hours ago". | false | ['true', 'false'] | "true" |
| dateFmt | If `printShowDate` is `true`, format to use for the date ([see available formats](/core-concepts/formatting)) | false | Excel-style format \| built-in format \| custom format | - |

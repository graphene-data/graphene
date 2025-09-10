---
title: Big Link
description: Display a url link in a styled container.
---

Use big links to display a url link in a styled container. To style links like Buttons, use a [Link Button](/components/ui/link-button).

**Example:**

```markdown
<BigLink url='/components/ui/big-link'>My Big Link</BigLink> 
```

## Options

| Property | Description | Required | Options |
|----------|-------------|----------|---------|
| url | Renders a link that, when clicked, navigates to the specified URL. It can accept either a full external link (e.g. `https://google.com`) or link to another page within your evidence app (e.g. `/sales/performance`). | true | string |
| href | href deprecated, please use url | false | string |

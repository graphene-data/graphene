---
title: Image
description: Display an image on your page and control dimensions & styling
---

> **Note:** You can also use [markdown syntax for images](/reference/markdown#images). This component is useful when you need to customize the dimensions or styling of the image.

The `Image` component allows you to add responsive and styled images to your markdown pages. This component is useful for embedding images with optional alignment, width, and height settings, and includes accessibility features through the description attribute.

## Examples

### Custom size

**Example:**

```markdown
<Image 
    url="https://raw.githubusercontent.com/evidence-dev/media-kit/refs/heads/main/png/wordmark-gray-800.png"
    description="Sample placeholder image"
    height=80
/>
```

### Aligned Left

**Example:**

```markdown
<Image 
    url="https://raw.githubusercontent.com/evidence-dev/media-kit/refs/heads/main/png/wordmark-gray-800.png"
    description="Sample placeholder image"
    height=80
    align="left"
/>
```

### With Border & Custom Padding

**Example:**

```markdown
<Image 
    url="https://raw.githubusercontent.com/evidence-dev/media-kit/refs/heads/main/png/wordmark-gray-800.png" 
    description="Sample placeholder image"
    height=80
    border=true 
    class="p-4"
/> 
```

## Options

| Property | Description | Required | Options | Default |
|----------|-------------|----------|---------|---------|
| url | The URL of the image. | true | string | - |
| description | The description of the image for accessibility purposes. | false | string | - |
| width | The width of the image (in pixels) | false | number | - |
| height | The height of the image (in pixels) | false | number | - |
| border | Whether to display a border around the image | false | true, false | false |
| align | The alignment of the image | false | center, left, right | center |
| class | Pass custom classes to control the styling of an accordion item. Supports [tailwind classes](https://tailwindcss.com). | false | string | - |

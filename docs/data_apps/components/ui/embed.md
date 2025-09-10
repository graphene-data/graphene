---
title: Embed
description: Embed content onto your page, like videos or iframes from other applications
---

Use the `Embed` component to display external content, such as videos, maps, or other embeddable media, within your markdown pages. This component allows you to customize dimensions, add borders, and ensure responsive styling. 

## Default usage

```markdown
<Embed 
    url="https://www.youtube.com/embed/UiCioBZ5IDU?si=dychrQurRTlhz9DN"
    title="Sample Video"
/>
```

### Custom size

```markdown
<Embed 
    url="https://www.youtube.com/embed/UiCioBZ5IDU?si=dychrQurRTlhz9DN"
    title="Sample Video"
    width=800
    height=450
/>
```

### No border

```markdown
<Embed 
    url="https://www.youtube.com/embed/UiCioBZ5IDU?si=dychrQurRTlhz9DN"
    title="Sample Video"
    border=false
/>
```

## Options

| Name | Description | Required | Options | Default |
|------|-------------|----------|---------|---------|
| url | The URL of the embeddable content. | true | - | - |
| title | A description or title for the embed, useful for accessibility purposes. | false | - | "" |
| width | The width of the embed (in pixels). | false | number | "100%" |
| height | The height of the embed (in pixels). | false | number | 400 |
| border | Whether to display a border around the embed | false | ['true', 'false'] | "true" |
| class | Pass custom classes to control the styling of the embed wrapper. Supports [Tailwind classes](https://tailwindcss.com). | false | - | - |

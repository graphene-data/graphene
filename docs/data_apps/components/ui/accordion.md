---
title: Accordion
description: Organize content into collapsible sections.
---

Use accordions to organize content into collapsible sections.

**Example:**

```markdown 
<Accordion>
  <AccordionItem title="Item 1">

    This is the first item's accordion body.

    You can use **markdown** here too!

    Make sure to include an empty line after the component if you want to use markdown.

  </AccordionItem>
  <AccordionItem title="Item 2">

    This is the second item's accordion body with <b>bold text</b>.

  </AccordionItem>
  <AccordionItem title="Item 3">

    This is the third item's accordion body.

  </AccordionItem>
</Accordion>
```

## Examples 

### Single Accordion 

**Example:**

```markdown 
<Accordion single>
  <AccordionItem title="Item 1">
    <p>Content 1</p>
  </AccordionItem>
  <AccordionItem title="Item 2">
    <p>Content 2</p>
  </AccordionItem>
  <AccordionItem title="Item 3">
    <p>Content 3</p>
  </AccordionItem>
</Accordion>
```

### Overriding Styles 

Use the `class` options to override the styles on the accordion. 

**Example:**

```markdown 
<Accordion class="rounded-xl bg-gray-50 px-4 mt-4">
  <AccordionItem title="Item 1" class="border-none">
    <p>Content 1</p>
  </AccordionItem>
  <AccordionItem title="Item 2" class="border-none">
    <p>Content 2</p>
  </AccordionItem>
  <AccordionItem title="Item 3" class="border-none">
    <p>Content 3</p>
  </AccordionItem>
</Accordion>
```

### Title Slot  

Pass components into the accordion title by using the slot `title`. 

```growth

select 0.366 as positive, -0.366 as negative

```

**Example:**

```markdown 
<Accordion>
  <AccordionItem title="Item 1">
    <span slot='title'>Custom Title <Value data="growth" fmt=pct1 /></span>
    Content 1 
  </AccordionItem>
  <AccordionItem title="Item 2">
    <p>Content 2</p>
  </AccordionItem>
  <AccordionItem title="Item 3">
    <p>Content 3</p>
  </AccordionItem>
</Accordion>
```

## Options

### Accordion

| Property | Description | Options | Required |
|----------|-------------|---------|----------|
| single | When true, only a single accordian item can be open at once. | true, false | false |
| class | Pass custom classes to control the styling of the accordion body. Supports [tailwind classes](https://tailwindcss.com). | string | false |

### AccordionItem

| Property | Description | Required |
|----------|-------------|----------|
| title | The title of the accordion item. This will be displayed as the header. | true |
| class | Pass custom classes to control the styling of an accordion item. Supports [tailwind classes](https://tailwindcss.com). | false |
| description | Adds an info icon with description tooltip on hover | false |

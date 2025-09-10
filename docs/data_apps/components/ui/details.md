---
title: Details
description: Add a collapsible section of markdown content that can be expanded to reveal more information.
---

The details component allows you to add a collapsible section to your markdown. This is useful for adding additional information that you don't want to be visible by default, but can be expanded by the reader.

## Default state

**Example:**

````markdown
<Details title="Definitions">
    
    Definition of metrics in Solutions Targets

    ### Time to Proposal

    Average number of days it takes to create a proposal for a customer

    *Calculation:*
    Sum of the number of days it took to create each proposal, divided by the number of proposals created

    *Source:*
    Hubspot

</Details>
````

## Expanded state

**Example:**

```markdown
<Details title="Definitions" open=true>
    
    Definition of metrics in Solutions Targets

    ### Time to Proposal

    Average number of days it takes to create a proposal for a customer

    *Calculation:*
    Sum of the number of days it took to create each proposal, divided by the number of proposals created

    *Source:*
    Hubspot

</Details>
```

## Options

| Property | Description | Options | Default |
|----------|-------------|---------|---------|
| title | The text shown next to the triangle icon. | string | Details |
| open | Whether expanded by default. | true, false | false |
| printShowAll | On print/PDF, the Details component will expand by default. Turn this off to leave the component collapsed in print. | true, false | true |

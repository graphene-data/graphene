<script lang="ts">
  // Shared tooltip for compact contextual help. The popup uses viewport coordinates so
  // scroll containers do not clip it, and mouse and keyboard users get the same content.
  import {tick, type Snippet} from 'svelte'

  let {text, children, label, placement = 'auto'}: {text: string; children: Snippet; label?: string; placement?: 'auto' | 'top'} = $props()

  let trigger: HTMLElement
  let popup = $state<HTMLElement>()
  let visible = $state(false)
  let hovered = false
  let focused = false
  let left = $state(0)
  let top = $state(0)
  let arrowLeft = $state(0)
  let renderedPlacement = $state<'top' | 'bottom'>('top')
  let tooltipId = `tooltip-${Math.random().toString(36).slice(2)}`

  // Measure after rendering, then keep the popup above its trigger and inside the viewport.
  async function show() {
    visible = true
    await tick()
    let triggerRect = trigger.getBoundingClientRect()
    let popupRect = popup!.getBoundingClientRect()
    let triggerCenter = triggerRect.left + triggerRect.width / 2
    let maxLeft = Math.max(8, window.innerWidth - popupRect.width - 8)
    left = Math.min(Math.max(8, triggerCenter - popupRect.width / 2), maxLeft)
    arrowLeft = Math.min(Math.max(10, triggerCenter - left), popupRect.width - 10)

    let fitsAbove = triggerRect.top >= popupRect.height + 8
    renderedPlacement = placement === 'top' || fitsAbove ? 'top' : 'bottom'
    let preferredTop = renderedPlacement === 'top' ? triggerRect.top - popupRect.height - 8 : triggerRect.bottom + 8
    let maxTop = Math.max(8, window.innerHeight - popupRect.height - 8)
    top = Math.min(Math.max(8, preferredTop), maxTop)
  }

  function updateVisibility() {
    if (hovered || focused) void show()
    else visible = false
  }

  // Keep the shifted position valid while its anchor or viewport moves.
  $effect(() => {
    if (!visible) return
    let reposition = () => void show()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  })
</script>

<button
  type="button"
  class="tooltip-trigger"
  bind:this={trigger}
  aria-label={label}
  aria-describedby={tooltipId}
  onmouseenter={() => { hovered = true; updateVisibility() }}
  onmouseleave={() => { hovered = false; updateVisibility() }}
  onfocus={() => { focused = true; updateVisibility() }}
  onblur={() => { focused = false; updateVisibility() }}
>
  {@render children()}
</button>

{#if visible}
  <span bind:this={popup} id={tooltipId} class={`tooltip-popup tooltip-popup--${renderedPlacement}`} role="tooltip" style={`left:${left}px;top:${top}px;--arrow-offset:${arrowLeft}px`}>
    {text}
  </span>
{/if}

<style>
  .tooltip-trigger {display: inline-block; max-width: 100%; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; letter-spacing: inherit; text-align: inherit; cursor: inherit;}
  .tooltip-trigger:focus-visible {outline: 2px solid currentColor; outline-offset: 2px; border-radius: 2px;}
  .tooltip-popup {position: fixed; z-index: 1000; box-sizing: border-box; width: max-content; max-width: min(280px, calc(100vw - 16px)); padding: 8px 10px; border-radius: 6px; background: #24292f; box-shadow: 0 3px 10px rgb(0 0 0 / 18%); color: white; font-size: 13px; font-weight: 400; line-height: 1.4; letter-spacing: normal; text-align: left; text-transform: none; white-space: normal; pointer-events: none;}
  .tooltip-popup::after {position: absolute; content: '';}
  .tooltip-popup--top::after {top: 100%; left: var(--arrow-offset); border: 5px solid transparent; border-top-color: #24292f; transform: translateX(-50%);}
  .tooltip-popup--bottom::after {bottom: 100%; left: var(--arrow-offset); border: 5px solid transparent; border-bottom-color: #24292f; transform: translateX(-50%);}
</style>

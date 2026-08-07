<script lang="ts">
  // Shared hover tooltip for compact contextual help. The popup uses viewport coordinates
  // so scroll containers do not clip it.
  import {tick, type Snippet} from 'svelte'

  let {text, children, placement = 'auto'}: {text: string; children: Snippet; placement?: 'auto' | 'top'} = $props()

  let trigger: HTMLElement
  let popup = $state<HTMLElement>()
  let visible = $state(false)
  let left = $state(0)
  let top = $state(0)
  let arrowLeft = $state(0)
  let renderedPlacement = $state<'top' | 'bottom'>('top')

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

<span class="tooltip-trigger" role="presentation" bind:this={trigger} onmouseenter={show} onmouseleave={() => visible = false}>
  {@render children()}
</span>

{#if visible}
  <span bind:this={popup} class={`tooltip-popup tooltip-popup--${renderedPlacement}`} role="tooltip" style={`left:${left}px;top:${top}px;--arrow-offset:${arrowLeft}px`}>
    {text}
  </span>
{/if}

<style>
  .tooltip-trigger {display: inline-block; max-width: 100%;}
  .tooltip-popup {position: fixed; z-index: 1000; box-sizing: border-box; width: max-content; max-width: min(280px, calc(100vw - 16px)); padding: 8px 10px; border-radius: 6px; background: #24292f; box-shadow: 0 3px 10px rgb(0 0 0 / 18%); color: white; font-size: 13px; font-weight: 400; line-height: 1.4; letter-spacing: normal; text-align: left; text-transform: none; white-space: normal; pointer-events: none;}
  .tooltip-popup::after {position: absolute; content: '';}
  .tooltip-popup--top::after {top: 100%; left: var(--arrow-offset); border: 5px solid transparent; border-top-color: #24292f; transform: translateX(-50%);}
  .tooltip-popup--bottom::after {bottom: 100%; left: var(--arrow-offset); border: 5px solid transparent; border-bottom-color: #24292f; transform: translateX(-50%);}
</style>

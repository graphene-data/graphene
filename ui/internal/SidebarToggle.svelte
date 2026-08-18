<script>
  // The persistent menu button: always fixed to the top-left corner of the viewport.
  // Opens the sidebar on hover/focus, while a click pins it for touch and keyboard use.
  // The sidebar stays open until navigation or a second click when pinned.
  import Menu from '@lucide/svelte/icons/menu'
  import {sidebar} from './sidebar.svelte.ts'
</script>

<button
  class="sb-trigger"
  type="button"
  aria-label="Open navigation"
  aria-expanded={sidebar.open}
  onclick={sidebar.togglePin}
  onmouseenter={sidebar.enter}
  onfocus={sidebar.enter}
  onblur={sidebar.leave}
>
  <Menu size={16} strokeWidth={1.8} />
</button>

<style>
  .sb-trigger {
    position: fixed;
    top: 10px;
    left: 10px;
    z-index: 30;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid var(--color-border);
    padding: 0;
    border-radius: 8px;
    background: var(--color-surface);
    color: var(--color-tertiary);
    cursor: pointer;
    box-shadow: var(--shadow-card);
  }
  .sb-trigger:hover {
    color: var(--color-primary-strong);
    border-color: var(--color-border-strong);
  }
  .sb-trigger:focus-visible {
    outline: 2px solid var(--color-muted);
    outline-offset: 2px;
  }
</style>

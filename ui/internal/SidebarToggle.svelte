<script>
  // Hamburger button that opens the paired <Sidebar>. Positioning is up to the
  // host (typically fixed in a corner); hover state is shared via context so
  // moving between the button and the panel keeps the sidebar open.
  import {sidebar} from './sidebar.svelte.ts'
  let {style} = $props()
</script>

<button
  class="sb-trigger"
  type="button"
  aria-label="Toggle navigation"
  aria-expanded={sidebar.open}
  onmouseenter={sidebar.enter}
  onmouseleave={sidebar.leave}
  onfocus={sidebar.enter}
  onblur={sidebar.leave}
  style={style}
>
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 6h16M4 12h16M4 18h16"/>
  </svg>
</button>

<style>
  .sb-trigger {
    width: 2rem;
    height: 2rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--sidebar-foreground);
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 120ms ease, background-color 120ms ease;
    z-index: 39;
  }
  .sb-trigger:hover { opacity: 1; background: var(--sidebar-accent); }
  .sb-trigger:focus-visible {
    opacity: 1;
    outline: 2px solid var(--sidebar-ring);
    outline-offset: 2px;
  }
</style>

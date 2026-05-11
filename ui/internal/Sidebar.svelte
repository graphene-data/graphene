<script>
  // Content-agnostic sidebar shell. By default the panel slides in as an overlay
  // when the user hovers the paired SidebarToggle button or the panel itself;
  // alwaysOpen keeps the same shell visible for persistent navigation.
  import {sidebar} from './sidebar.svelte.ts'
  let {children, width = '16rem', alwaysOpen = false} = $props()
</script>

<nav
  id="nav"
  class="sb-panel pretty-scrollbar"
  style="--sb-w:{width}"
  data-open={alwaysOpen || sidebar.open}
  onmouseenter={() => { if (!alwaysOpen) sidebar.enter() }}
  onmouseleave={() => { if (!alwaysOpen) sidebar.leave() }}
>
  <div class="sb-inner">
    {@render children?.()}
  </div>
</nav>

<style>
  .sb-panel {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 40;
    height: 100vh;
    width: var(--sb-w);
    background: var(--sidebar);
    color: var(--sidebar-foreground);
    border-right: 1px solid var(--sidebar-border);
    transform: translateX(-102%);
    transition: transform 200ms ease;
    overflow-y: auto;
    overflow-x: hidden;
    /* Prevent rubber-band over-scroll from revealing content behind the panel. */
    overscroll-behavior: none;
    pointer-events: none;
  }
  .sb-panel[data-open='true'] {
    transform: translateX(0);
    pointer-events: auto;
  }

  .sb-inner {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-top: 24px;
    font-family: var(--ui-font-family);
  }

  /* ============================================================
     Styling primitives scoped to the panel so content can use
     them as plain CSS classes. Ported from shadcn-svelte.
     ============================================================ */

  /* Group: `p-2`. Items fill the width inside this padding, with `rounded-md`,
     matching shadcn exactly. */
  .sb-panel :global(.sb-group) {
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
    min-width: 0;
  }

  /* Group label: `h-8 px-2 text-xs font-medium` at 70% foreground */
  .sb-panel :global(.sb-group-label) {
    display: flex;
    align-items: center;
    height: 2rem;
    padding: 0 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-foreground);
    opacity: 0.7;
    border-radius: 0.375rem;
  }

  /* Menu (ul): `flex flex-col gap-1 w-full min-w-0`.
     Reset app.css's global <ul> list styling (list-disc, padding-inline-start). */
  .sb-panel :global(.sb-menu),
  .sb-panel :global(.sb-sub) {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }
  /* Only the top-level menu fills its group; sub-menus let their width be
     derived from `margin` + parent width, otherwise `width: 100%` + margin
     overflows the parent and breaks child ellipsis clipping. */
  .sb-panel :global(.sb-menu) { width: 100%; }
  .sb-panel :global(.sb-menu li),
  .sb-panel :global(.sb-sub li) {
    list-style: none;
    margin: 0;
    width: 100%;
    min-width: 0;
  }
  .sb-panel :global(.sb-menu li + li),
  .sb-panel :global(.sb-sub li + li) { margin-top: 0; }

  /* Sub menu: indented under its parent. Shadcn uses a `border-s` guide line
     here, but that only reads well when items have leading icons. Without
     icons, the line floats in empty space, so we drop it (and the paired
     translate-x-px trick that existed to cover it). */
  .sb-panel :global(.sb-sub) {
    margin: 0 0.875rem;
    padding: 0.125rem 0.625rem;
    gap: 0.25rem;
  }

  /* Menu item: `flex h-8 w-full items-center gap-2 rounded-md p-2 text-sm`,
     hover/active → `bg-sidebar-accent text-sidebar-accent-foreground`,
     active → `font-medium`, focus-visible → `ring-2`. */
  .sb-panel :global(.sb-item) {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.2rem;
    height: 2rem;
    padding: 0 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: var(--sidebar-foreground);
    text-decoration: none;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: start;
    white-space: nowrap;
    overflow: hidden;
    box-sizing: border-box;
  }
  .sb-panel :global(.sb-item:hover) {
    background: var(--sidebar-accent);
    color: var(--sidebar-accent-foreground);
    text-decoration: none;
  }
  .sb-panel :global(.sb-item.active) {
    background: var(--sidebar-accent);
    color: var(--sidebar-accent-foreground);
    font-weight: 500;
  }
  .sb-panel :global(.sb-item:focus-visible) {
    outline: 2px solid var(--sidebar-ring);
    outline-offset: -2px;
  }

  /* Sub-button variant: slightly shorter (h-7 vs h-8), per shadcn. */
  .sb-panel :global(.sb-sub .sb-item) {
    height: 1.75rem;
  }

  .sb-panel :global(.sb-item .sb-label) {
    flex: 1;
    min-width: 0; /* allow the flex child to shrink below its intrinsic size */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Chevron: 1rem Lucide SVG with 200ms rotate transition. */
  .sb-panel :global(.sb-chevron) {
    flex-shrink: 0;
    width: 1rem;
    height: 1rem;
    color: var(--sidebar-foreground);
    opacity: 0.6;
    transition: transform 200ms ease;
  }
  .sb-panel :global(.sb-chevron.open) { transform: rotate(90deg); }
</style>

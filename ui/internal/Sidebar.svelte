<script>
  // Floating sidebar shell — renders as an inset, rounded card that slides in when the
  // user hovers the paired SidebarToggle or the panel itself. top/inset set the clearance
  // below a top bar and the margin from the screen edges.
  import {sidebar} from './sidebar.svelte.ts'
  let {children, width = '18rem', top = '44px', inset = '10px'} = $props()

  let navEl = $state()

  // Close when the cursor moves past the panel's right edge, even without entering it
  // (e.g. opened via the hamburger button then moved right). Uses offsetLeft/offsetWidth
  // rather than getBoundingClientRect, which animates during the slide-in and would flash
  // the panel shut.
  function onDocMouseMove(e) {
    if (!sidebar.open || !navEl) return
    if (e.clientX > navEl.offsetLeft + navEl.offsetWidth) sidebar.leave()
  }
</script>

<svelte:document onmousemove={onDocMouseMove} />

<nav
  bind:this={navEl}
  id="nav"
  class="sb-panel pretty-scrollbar"
  style="--sb-w:{width}; --sb-top:{top}; --sb-inset:{inset}"
  data-open={sidebar.open}
  onmouseenter={sidebar.enter}
>
  <div class="sb-inner">
    {@render children?.()}
  </div>
</nav>

<style>
  /* Inset rounded card that clears the top bar (--sb-top) and keeps equal margins
     (--sb-inset) from the screen edges, matching the page/preview panels. */
  .sb-panel {
    position: fixed;
    top: var(--sb-top, 0);
    left: var(--sb-inset, 0);
    bottom: var(--sb-inset, 0);
    z-index: 40;
    width: var(--sb-w);
    background: var(--color-surface);
    color: var(--color-body);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    box-shadow: var(--shadow-panel);
    /* Slides in from the left; fully hidden until data-open='true'. */
    transform: translateX(calc(-100% - var(--sb-inset, 0px) - 12px));
    transition: transform 200ms ease;
    pointer-events: none;
    /* The panel itself doesn't scroll; inner regions manage their own overflow. */
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .sb-panel[data-open='true'] {
    transform: translateX(0);
    pointer-events: auto;
  }

  .sb-inner {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-top: 10px;
    font-family: var(--font-ui);
  }

  /* ============================================================
     Styling primitives scoped to the panel so content can use
     them as plain CSS classes. Ported from shadcn-svelte.
     ============================================================ */

  /* Group: `p-2`. Items fill the width inside this padding, with `rounded-md`,
     matching shadcn exactly. */
  /* Flex column that fills the card and lets inner regions manage their own overflow. */
  .sb-panel :global(.sb-content) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* Scrollable nav area with feathered top/bottom edges. */
  .sb-panel :global(.sb-nav-pages) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding: 0.25rem 0;
    -webkit-mask-image: var(--fade-edges);
    mask-image: var(--fade-edges);
  }

  /* Uppercase collapse-toggle eyebrow above a nav section. */
  .sb-panel :global(.sb-eyebrow) {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    width: 100%;
    padding: 0.375rem 1rem 0.25rem;
    border: none;
    background: transparent;
    color: var(--color-muted);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    text-align: left;
  }
  .sb-panel :global(.sb-eyebrow:hover) { color: var(--color-body); }
  .sb-panel :global(.sb-eyebrow-chevron) {
    flex-shrink: 0;
    transition: transform 150ms ease;
  }
  .sb-panel :global(.sb-eyebrow[aria-expanded='false'] .sb-eyebrow-chevron) {
    transform: rotate(-90deg);
  }

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
    color: var(--color-body);
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
    gap: 0.125rem;
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
    margin: 0;
    padding: 0.125rem 0 0.125rem 1.5rem;
    gap: 0.25rem;
  }

  /* Menu item: `flex h-8 w-full items-center gap-2 rounded-md p-2 text-sm`,
     hover/active → `bg-sidebar-accent text-sidebar-accent-foreground`,
     active → `font-medium`, focus-visible → `ring-2`. */
  .sb-panel :global(.sb-item) {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.5rem;
    height: 1.75rem;
    padding: 0 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: var(--color-body);
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
    background: var(--color-hover);
    color: var(--color-primary-strong);
    text-decoration: none;
  }
  .sb-panel :global(.sb-item.active) {
    background: var(--color-hover);
    color: var(--color-primary-strong);
    font-weight: 500;
  }
  .sb-panel :global(.sb-item:focus-visible) {
    outline: 2px solid var(--color-muted);
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

  /* Leading row icon (folder/file in PageNavGroup): muted, fixed size. */
  .sb-panel :global(.sb-icon) {
    flex-shrink: 0;
    display: inline-flex;
    color: var(--color-muted);
  }
</style>

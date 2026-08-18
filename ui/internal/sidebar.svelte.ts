// Shared hover state for <Sidebar> and <SidebarToggle>. Either component can
// drive open/close; the small leave delay lets the cursor travel between the
// button and the panel without it snapping shut.
let state = $state({open: false, pinned: false})
let closeTimer = 0

export const sidebar = {
  get open() {
    return state.open
  },
  enter() {
    clearTimeout(closeTimer)
    state.open = true
  },
  leave() {
    clearTimeout(closeTimer)
    if (state.pinned) return
    closeTimer = window.setTimeout(() => state.open = false, 60)
  },
  pin() {
    clearTimeout(closeTimer)
    state.pinned = true
    state.open = true
  },
  togglePin() {
    clearTimeout(closeTimer)
    state.pinned = !state.pinned
    state.open = state.pinned
  },
  unpin() {
    clearTimeout(closeTimer)
    state.pinned = false
    closeTimer = window.setTimeout(() => state.open = false, 60)
  },
}

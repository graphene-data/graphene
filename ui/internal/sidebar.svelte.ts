// Shared hover state for <Sidebar> and <SidebarToggle>. Either component can
// drive open/close; the small leave delay lets the cursor travel between the
// button and the panel without it snapping shut.
let state = $state({open: false, pinned: false})
let closeTimer: ReturnType<typeof setTimeout> | undefined

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
    closeTimer = setTimeout(() => (state.open = false), 120)
  },
  pin() {
    clearTimeout(closeTimer)
    state.pinned = true
    state.open = true
  },
  unpin() {
    state.pinned = false
    this.leave()
  },
}

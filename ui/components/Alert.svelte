<!-- Alert definitions render no inline content; their target owns the hover indicator. -->
<script lang="ts">
  import {getAlertStore, type PageAlert} from '../internal/alerts.ts'

  interface Props {
    id?: string; for: string; above?: number | string; below?: number | string
    every: string; to: string; key?: string; value?: string
  }
  let {id, for: target, above, below, every, to, key, value}: Props = $props()
  const alerts = getAlertStore()

  // Effects clean up both on navigation and when an edited definition changes target.
  $effect(() => {
    let targetId = target
    let alert: PageAlert = {id: id || target, above, below, every, to, key, value, triggeredKeys: alerts.states[id || target]?.triggeredKeys}
    alerts.update(state => ({...state, [targetId]: [...(state[targetId] || []), alert]}))
    return () => alerts.update(state => {
      let next = {...state, [targetId]: state[targetId].filter(item => item.id !== alert.id)}
      if (!next[targetId].length) delete next[targetId]
      return next
    })
  })
</script>

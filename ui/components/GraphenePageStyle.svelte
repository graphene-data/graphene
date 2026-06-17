<script lang="ts">
  import {onMount} from 'svelte'

  interface Props {
    css: string
  }

  let {css}: Props = $props()

  // Mount dashboard-authored styles with the page so soft navigation can cleanly
  // remove them without relying on Svelte's head manager in runtime-compiled pages.
  onMount(() => {
    let style = document.createElement('style')
    style.dataset.graphenePageStyle = ''
    style.textContent = css
    document.head.appendChild(style)
    return () => style.remove()
  })
</script>

<script lang="ts">
  import {getThemeStores} from '../component-utilities/themeStores'

  export let toggled = false
  export let color: string | undefined = undefined
  export let size = 10

  const {theme, resolveColor} = getThemeStores()
  let colorStore = resolveColor(color)

  $: colorStore = resolveColor(color)
  $: fill = $colorStore ?? $theme.colors['base-content']
</script>

<span aria-expanded={toggled} class="group-toggle">
  <svg viewBox="0 0 16 16" width={size} height={size}>
    <path
      fill={fill}
      fill-rule="evenodd"
      d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06z"
    />
  </svg>
</span>

<style>
  .group-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: auto 0 auto 0;
  }

  svg {
    display: inline-block;
    vertical-align: middle;
    transition: transform 0.15s ease-in;
  }

  [aria-expanded='true'] svg {
    transform: rotate(90deg);
  }
</style>

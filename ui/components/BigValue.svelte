<script lang="ts">
  import QueryLoad from './QueryLoad.svelte'

  interface Props {
    data: string | {rows?: any[]}
    value?: string
    fmt?: string
    title?: string
    subtitle?: string
  }

  let {data, value = undefined, fmt = undefined, title = undefined, subtitle = undefined}: Props = $props()

  function formatValue(input: any) {
    if (input === null || input === undefined) return '—'
    if (!fmt) return String(input)

    if (fmt.startsWith('num')) {
      let fraction = parseInt(fmt.replace(/[^0-9]/g, '') || '0', 10)
      let formatter = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: fraction,
        minimumFractionDigits: fraction,
      })
      return formatter.format(Number(input))
    }

    if (fmt.startsWith('pct')) {
      let fraction = parseInt(fmt.replace(/[^0-9]/g, '') || '0', 10)
      let formatter = new Intl.NumberFormat('en-US', {
        style: 'percent',
        maximumFractionDigits: fraction,
        minimumFractionDigits: fraction,
      })
      return formatter.format(Number(input))
    }

    return String(input)
  }
</script>

{#snippet bigValueContent(loaded: any[])}
  <div class="big-value">
    {#if title}<div class="big-value__title">{title}</div>{/if}
    {#if subtitle}<div class="big-value__subtitle">{subtitle}</div>{/if}
    <div class="big-value__value">{formatValue(loaded?.[0]?.[value])}</div>
  </div>
{/snippet}

<QueryLoad {data} fields={{value}} children={bigValueContent} />

<style>
  .big-value {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 8px 0;
  }

  .big-value__title {
    font-size: 11px;
    font-weight: 600;
    color: #aaa;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }

  .big-value__subtitle {
    font-size: 13px;
    color: var(--graphene-big-value-subtitle, #4b5563);
  }

  .big-value__value {
    font-size: 28px;
    letter-spacing: -0.02em;
    line-height: 1;
    font-family: var(--prose-font-family);
    font-optical-sizing: auto;
    font-weight: 600;
    color: #111;
  }
</style>

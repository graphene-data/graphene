<script lang="ts">
  import QueryLoad from './QueryLoad.svelte'

  export let data: string | {rows?: any[]}
  export let value: string | undefined = undefined
  export let fmt: string | undefined = undefined
  export let title: string | undefined = undefined
  export let subtitle: string | undefined = undefined

  function formatValue (input: any) {
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

<QueryLoad {data} fields={{value}} let:loaded>
  <div class="big-value">
    {#if title}<div class="big-value__title">{title}</div>{/if}
    {#if subtitle}<div class="big-value__subtitle">{subtitle}</div>{/if}
    <div class="big-value__value">{formatValue(loaded?.[0]?.[value])}</div>
  </div>
</QueryLoad>

<style>
  .big-value {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 8px 0;
  }

  .big-value__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--graphene-big-value-title, #111827);
  }

  .big-value__subtitle {
    font-size: 13px;
    color: var(--graphene-big-value-subtitle, #4b5563);
  }

  .big-value__value {
    font-size: 32px;
    font-weight: 600;
    color: var(--graphene-big-value-value, #111827);
  }
</style>

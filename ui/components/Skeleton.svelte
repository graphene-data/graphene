<script lang="ts">
  let {height}: {height: number} = $props()
</script>

<div class='ql-skeleton' style={`height:${height}px`} role="status" aria-live="polite">
  <span class="ql-skeleton__pulse"></span>
</div>

<style>
  .ql-skeleton {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    background: var(--chart-skeleton-bg, #f3f4f6);
    border-radius: 4px;
  }

  .ql-skeleton__pulse {
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.55) 50%, rgba(255, 255, 255, 0) 100%);
    animation: ql-pulse 1.4s ease-in-out infinite;
    content: '';
  }

  @keyframes ql-pulse {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
</style>

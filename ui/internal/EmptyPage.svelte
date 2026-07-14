<script lang="ts">
  let {title, message}: {title: string; message: string} = $props()
</script>

<section class="empty-page">
  <div class="empty-page__icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M7.5 3.75h6.25l3.75 3.75v12.75H7.5z" />
      <path d="M13.75 3.75V7.5h3.75M10.25 11.25h4.5M10.25 14.25h4.5" />
    </svg>
  </div>
  <h1>{title}</h1>
  <p>{message}</p>
</section>

<style>
  .empty-page {
    display: flex;
    align-items: center;
    flex-direction: column;
    margin: clamp(5rem, 18vh, 9rem) auto 0;
    text-align: center;
  }

  .empty-page__icon {
    display: grid;
    place-items: center;
    width: 3.25rem;
    height: 3.25rem;
    margin-bottom: 1.125rem;
    border: 1px solid var(--color-border);
    border-radius: 0.875rem;
    background: var(--color-surface);
    color: var(--color-tertiary);
    box-shadow: var(--shadow-card);
  }

  svg {
    width: 1.5rem;
    height: 1.5rem;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.4;
  }

  h1 {
    margin: 0;
    font-size: 1.25rem;
  }

  p {
    max-width: 25rem;
    margin: 0.5rem 0 0;
    color: var(--color-tertiary);
    font-family: var(--font-ui);
    font-size: 0.9375rem;
  }
</style>

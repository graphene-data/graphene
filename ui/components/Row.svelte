<div><slot></slot></div>

<style>
  div {
    display: flex;
    flex-direction: row;
    gap: 1.5rem;
  }

  /* Ensure styles apply to slotted children (not scoped) */
  div > :global(*) {
    flex: 1 1 0;
    min-width: 0; /* avoids some rendering instability */
  }
</style>

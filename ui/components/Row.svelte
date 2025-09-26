<div><slot></slot></div>

<style>
  div {
    display: flex;
    flex-direction: row;
    gap: 1rem;
  }

  /* Ensure styles apply to slotted children (not scoped) */
  div > :global(*) {
    flex: 1 1 0;
  }
</style>

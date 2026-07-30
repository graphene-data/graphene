<!-- Row lays children out evenly, shrinking them to 80px before wrapping onto another line. -->
<div><slot></slot></div>

<style>
  div {
    display: flex;
    flex-flow: row wrap;
    gap: 1.5rem;
  }

  /* Slotted children share each line evenly, but never become too narrow to use. */
  div > :global(*) {
    flex: 1 1 80px;
    min-width: 80px;
  }
</style>

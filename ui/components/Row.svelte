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

  /* Small charts and controls are more useful stacked than squeezed side-by-side on phones. */
  @media (max-width: 600px) {
    div > :global(*) { flex-basis: 100%; }
  }
</style>

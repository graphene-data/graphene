<script lang="ts">
  import {route, go} from '../router.ts'
  import Repos from './Repos.svelte'

  let pages = [
    {path: '/settings/repos', label: 'Repositories'},
  ]
</script>

<main>
  <aside class="sidebar">
    <h1>Settings</h1>
    <nav>
      {#each pages as page (page.path)}
        <a
          href={page.path}
          class="nav-item"
          class:active={$route === page.path}
          on:click|preventDefault={() => go(page.path)}
        >
          {page.label}
        </a>
      {/each}
    </nav>
  </aside>
  <section class="content">
    {#if $route === '/settings/repos'}
      <Repos />
    {/if}
  </section>
</main>

<style>
  main {
    display: flex;
    gap: 48px;
  }

  .sidebar {
    width: 200px;
    flex-shrink: 0;
    padding-top: 24px;
  }

  h1 {
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 24px;
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .nav-item {
    display: block;
    padding: 8px 12px;
    border-radius: 6px;
    color: #333;
    text-decoration: none;
    font-size: 14px;
  }

  .nav-item:hover {
    background: #f5f5f5;
  }

  .nav-item.active {
    background: #e9ecef;
    font-weight: 500;
  }

  .content {
    flex: 1;
    min-width: 0;
    padding-top: 24px;
  }
</style>

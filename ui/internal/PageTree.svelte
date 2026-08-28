<!-- Shared expandable page tree used anywhere Graphene presents the repository's page hierarchy. -->
<script>
  import Folder from '@lucide/svelte/icons/folder'
  import FolderOpen from '@lucide/svelte/icons/folder-open'
  import FileChartColumnIncreasing from '@lucide/svelte/icons/file-chart-column-increasing'

  let {nodes = [], openFolders, selectedPath = '', currentPath = '', onFolder, onFile} = $props()
</script>

<ul class="sb-menu page-tree">
  {#each nodes as node (node.path)}
    {@render Row(node)}
  {/each}
</ul>

{#snippet Row(node)}
  <li data-folder={node.type === 'folder' ? node.path : undefined}>
    {#if node.type === 'folder'}
      {@const open = openFolders.has(node.path)}
      <button class:active={node.path === selectedPath} class="sb-item" type="button" title={node.label} data-folder-toggle={node.path} aria-expanded={open} onclick={() => onFolder(node.path)}>
        <span class="sb-icon">{#if open}<FolderOpen size={15} strokeWidth={1.8} />{:else}<Folder size={15} strokeWidth={1.8} />{/if}</span>
        <span class="sb-label">{node.label}</span>
      </button>
      {#if open && node.children?.length}
        <ul class="sb-sub">
          {#each node.children as child (child.path)}
            {@render Row(child)}
          {/each}
        </ul>
      {/if}
    {:else}
      <a class:active={node.path === currentPath} class="sb-item" href={node.route} title={node.label} aria-current={node.path === currentPath ? 'page' : undefined} onclick={(event) => onFile(event, node.route)}>
        <span class="sb-icon"><FileChartColumnIncreasing size={15} strokeWidth={1.8} /></span>
        <span class="sb-label">{node.label}</span>
      </a>
    {/if}
  </li>
{/snippet}

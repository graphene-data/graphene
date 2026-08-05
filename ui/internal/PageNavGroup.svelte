<!-- Builds the shared local/Cloud page sidebar from canonical routes. Routes determine both link targets and folder hierarchy. -->
<script>
  import Folder from '@lucide/svelte/icons/folder'
  import FolderOpen from '@lucide/svelte/icons/folder-open'
  import FileChartColumnIncreasing from '@lucide/svelte/icons/file-chart-column-increasing'
  import {SvelteSet, SvelteMap} from 'svelte/reactivity'
  import {route} from './router.ts'
  import {prettyPrintFilename} from './utils.ts'

  let {files = [], onNavigate = undefined, baseRoute = '', projectName = ''} = $props()

  let tree = $state([])
  // eslint-disable-next-line svelte/no-unnecessary-state-wrap -- reassigned, needs $state
  let openFolders = $state(new SvelteSet())
  let treeSignature = $state('')
  let lastCurrent = $state('')

  let treeFiles = $derived(toTreeFiles(files))
  let currentTreePath = $derived(treeFiles.find(file => file.route === ($route.replace(/\/+$/, '') || '/'))?.treePath || '')

  // Rebuild when routes or labels change, initially opening the active page's parent folders.
  $effect(() => {
    let nextSignature = treeFiles.map(file => `${file.route}:${file.title || ''}`).join('|')
    if (nextSignature !== treeSignature) {
      treeSignature = nextSignature
      tree = buildTree(treeFiles)
      openFolders = mergeAncestorFolders(new SvelteSet(), currentTreePath)
    }
  })

  // Navigating should reveal the active page without closing folders the user opened manually.
  $effect(() => {
    if (currentTreePath !== lastCurrent) {
      openFolders = mergeAncestorFolders(openFolders, currentTreePath)
      lastCurrent = currentTreePath
    }
  })

  // Turn routes into paths used only to construct the visual tree. A route with descendants
  // becomes that folder's Home leaf: /reports + /reports/detail → reports/index.
  function toTreeFiles(pageFiles) {
    let visible = (pageFiles || []).filter(file => !file.hideInNav).map(file => ({...file, relativeRoute: relativeRouteFor(file.route)}))
    return visible.map(file => {
      let hasChildren = visible.some(other => other.relativeRoute.startsWith(file.relativeRoute + '/'))
      let treePath = file.relativeRoute
      if (!treePath) treePath = 'index'
      else if (hasChildren) treePath += '/index'
      return {...file, treePath}
    })
  }

  // Toggle one folder without mutating Svelte's reactive Set in place.
  function toggleFolder(path) {
    if (!path) return
    let next = new SvelteSet(openFolders)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    openFolders = next
  }

  // Build folder and file nodes from each page's slash-delimited tree path.
  function buildTree(files) {
    let root = []
    let folderMap = new SvelteMap()

    for (let file of files) {
      let segments = file.treePath.split('/')
      if (!segments.length) continue
      let fileName = segments.pop()
      let parentChildren = root
      let parentPath = ''

      for (let segment of segments) {
        parentPath = parentPath ? `${parentPath}/${segment}` : segment
        if (!folderMap.has(parentPath)) {
          let folderNode = {type: 'folder', name: segment, label: prettyPrintFilename(segment), path: parentPath, children: []}
          folderMap.set(parentPath, folderNode)
          parentChildren.push(folderNode)
        }
        parentChildren = folderMap.get(parentPath).children
      }

      if (!fileName) continue
      let fullPath = parentPath ? `${parentPath}/${fileName}` : fileName
      if (parentChildren.find(n => n.path === fullPath)) continue

      // Every page is a leaf. Synthetic index leaves show folder routes as Home links,
      // while folders themselves only expand and collapse.
      parentChildren.push({
        type: 'file',
        name: fileName,
        label: prettyPrintFilename(fileName, file.title),
        path: fullPath,
        route: file.route,
      })
    }

    return sortNodes(root)
  }

  // Keep Home first, then folders, then alphabetized page links.
  function sortNodes(nodes) {
    return nodes
      .map(n => n.type === 'folder' && n.children?.length ? {...n, children: sortNodes(n.children)} : n)
      .sort((a, b) => {
        let aHome = a.type === 'file' && a.name.toLowerCase() === 'index'
        let bHome = b.type === 'file' && b.name.toLowerCase() === 'index'
        if (aHome !== bHome) return aHome ? -1 : 1
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
        return a.label.localeCompare(b.label)
      })
  }

  // Add every parent of a page to the current set of expanded folders.
  function mergeAncestorFolders(openSet, filePath) {
    let next = new SvelteSet(openSet)
    if (!filePath) return next
    let parts = filePath.split('/')
    parts.pop()
    let aggregate = []
    for (let part of parts) {
      aggregate.push(part)
      next.add(aggregate.join('/'))
    }
    return next
  }

  // Remove Cloud's repo route prefix so the shared sidebar can build one tree per project.
  function relativeRouteFor(pageRoute) {
    let prefix = baseRoute ? '/' + baseRoute : ''
    return pageRoute.slice(prefix.length).replace(/^\/+|\/+$/g, '')
  }

  // Let Cloud use its client router; local links retain normal browser navigation.
  function handleLinkClick(event, href) {
    if (!onNavigate) return
    if (href.startsWith('http') || href.startsWith('//')) return
    event.preventDefault()
    onNavigate(href)
  }
</script>

<div class="sb-group">
  {#if projectName}
    <div class="sb-group-label">{projectName}</div>
  {/if}
  <ul class="sb-menu">
    {#each tree as node (node.path)}
      {@render Row(node)}
    {/each}
  </ul>
</div>

{#snippet FolderIcon(open)}
  {#if open}<FolderOpen size={15} strokeWidth={1.8} />{:else}<Folder size={15} strokeWidth={1.8} />{/if}
{/snippet}

{#snippet Row(node)}
  <li data-folder={node.type === 'folder' ? node.path : undefined}>
    {#if node.type === 'folder'}
      {@const open = openFolders.has(node.path)}
      <button
        class="sb-item"
        type="button"
        title={node.label}
        data-folder-toggle={node.path}
        aria-expanded={open}
        onclick={() => toggleFolder(node.path)}
      >
        <span class="sb-icon">{@render FolderIcon(open)}</span>
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
      <a
        class={node.path === currentTreePath ? 'sb-item active' : 'sb-item'}
        href={node.route}
        title={node.label}
        aria-current={node.path === currentTreePath ? 'page' : undefined}
        onclick={(e) => handleLinkClick(e, node.route)}
      >
        <span class="sb-icon"><FileChartColumnIncreasing size={15} strokeWidth={1.8} /></span>
        <span class="sb-label">{node.label}</span>
      </a>
    {/if}
  </li>
{/snippet}

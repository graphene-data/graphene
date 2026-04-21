<script>
  import {SvelteSet, SvelteMap} from 'svelte/reactivity'

  let {currentFile = '', files = [], onNavigate = undefined, baseRoute = ''} = $props()

  let tree = $state([])
  // eslint-disable-next-line svelte/no-unnecessary-state-wrap -- reassigned, needs $state
  let openFolders = $state(new SvelteSet())
  let treeSignature = $state('')
  let lastCurrent = $state('')

  let navFiles = $derived((files || []).map(normalizeNavFile))
  let normalizedFiles = $derived(navFiles.map(f => f.path))
  let titlesByPath = $derived(Object.fromEntries(navFiles.filter(f => !!f.title).map(f => [f.path, f.title])))

  let normalizedCurrent = $derived(deriveCurrentFile(currentFile, normalizedFiles))
  let currentRoute = $derived(normalizedCurrent ? pathToRoute(normalizedCurrent) : '/')

  function deriveCurrentFile(_currentFile, _normalizedFiles) {
    let fromProp = normalizeFilePath(_currentFile)
    let route = getLocationRoute()
    if (route && _normalizedFiles) {
      let match = _normalizedFiles.find(f => pathToRoute(f) === route)
      if (match) return match
    }
    return fromProp
  }

  function normalizeNavFile(file) {
    if (!file || typeof file.path !== 'string') throw new Error('PageNavGroup files must be {path, title?} objects')
    return {path: normalizeFilePath(file.path), title: file.title || undefined}
  }

  function normalizeFilePath(filePath) {
    return (filePath || '').replace(/^\.\//, '').replace(/\\/g, '/').replace(/^\/+/, '')
  }

  function getLocationRoute() {
    if (typeof window === 'undefined') return null
    return (window.location.pathname || '/').replace(/\/+$/, '') || '/'
  }

  $effect(() => {
    let nextSignature = navFiles.map(f => `${f.path}:${f.title || ''}`).join('|')
    if (nextSignature !== treeSignature) {
      treeSignature = nextSignature
      tree = buildTree(normalizedFiles, titlesByPath)
      openFolders = mergeAncestorFolders(new SvelteSet(), normalizedCurrent)
    }
  })

  $effect(() => {
    if (normalizedCurrent !== lastCurrent) {
      openFolders = mergeAncestorFolders(openFolders, normalizedCurrent)
      lastCurrent = normalizedCurrent
    }
  })

  function toggleFolder(path) {
    if (!path) return
    let next = new SvelteSet(openFolders)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    openFolders = next
  }

  function buildTree(paths, titleLookup = {}) {
    let root = []
    let folderMap = new SvelteMap()

    for (let filePath of paths) {
      let segments = filePath.split('/')
      if (!segments.length) continue
      let fileName = segments.pop()
      let parentChildren = root
      let parentPath = ''

      for (let segment of segments) {
        parentPath = parentPath ? `${parentPath}/${segment}` : segment
        if (!folderMap.has(parentPath)) {
          let folderNode = {type: 'folder', name: segment, label: formatLabel(segment, 'folder'), path: parentPath, children: [], route: null}
          folderMap.set(parentPath, folderNode)
          parentChildren.push(folderNode)
        }
        parentChildren = folderMap.get(parentPath).children
      }

      if (!fileName) continue
      let fullPath = parentPath ? `${parentPath}/${fileName}` : fileName

      // An index.md becomes the folder's own route rather than a separate leaf.
      if (fileName.toLowerCase() === 'index.md' && parentPath) {
        let folderNode = folderMap.get(parentPath)
        if (folderNode) {
          folderNode.route = pathToRoute(fullPath)
          if (titleLookup[fullPath]) folderNode.label = titleLookup[fullPath]
        }
        continue
      }

      if (parentChildren.find(n => n.path === fullPath)) continue
      parentChildren.push({
        type: 'file',
        name: fileName,
        label: formatLabel(fileName, 'file', titleLookup[fullPath]),
        path: fullPath,
        route: pathToRoute(fullPath),
      })
    }

    return sortNodes(root)
  }

  function sortNodes(nodes) {
    return nodes
      .map(n => n.type === 'folder' && n.children?.length ? {...n, children: sortNodes(n.children)} : n)
      .sort((a, b) => {
        if (a.label === 'Home') return -1
        if (b.label === 'Home') return 1
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
        return a.label.localeCompare(b.label)
      })
  }

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

  function formatLabel(value, type, explicitTitle = undefined) {
    if (explicitTitle) return explicitTitle
    let cleaned = type === 'file' ? value.replace(/\.md$/, '') : value
    if (cleaned.toLowerCase() === 'index') return 'Home'
    return cleaned.split(/[\s_-]+/).filter(Boolean)
      .map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' ')
  }

  function pathToRoute(path) {
    let clean = path.replace(/\.md$/, '')
    let prefix = baseRoute ? '/' + baseRoute : ''
    if (!clean || clean === 'index') return prefix || '/'
    return prefix + '/' + clean
  }

  function handleLinkClick(event, href) {
    if (!onNavigate) return
    if (href.startsWith('http') || href.startsWith('//')) return
    event.preventDefault()
    onNavigate(href)
  }
</script>

<div class="sb-group">
  <ul class="sb-menu">
    {#each tree as node (node.path)}
      {@render Row(node)}
    {/each}
  </ul>
</div>

{#snippet Chevron(open)}
  <svg
    class={open ? 'sb-chevron open' : 'sb-chevron'}
    viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true"
  ><path d="m9 18 6-6-6-6"/></svg>
{/snippet}

{#snippet ChevronSpacer()}
  <svg class="sb-chevron" viewBox="0 0 24 24" aria-hidden="true"></svg>
{/snippet}

{#snippet ChevronToggle(node, open)}
  <!-- role='button' inside the anchor so we don't nest <button> in <a> (invalid HTML). -->
  <span
    class="chev-toggle"
    role="button"
    tabindex="0"
    data-folder-toggle={node.path}
    aria-expanded={open}
    aria-label={(open ? 'Collapse ' : 'Expand ') + node.label}
    onclick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFolder(node.path) }}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleFolder(node.path) } }}
  >
    {@render Chevron(open)}
  </span>
{/snippet}

{#snippet Row(node)}
  <li data-folder={node.type === 'folder' ? node.path : undefined}>
    {#if node.type === 'folder'}
      {@const open = openFolders.has(node.path)}
      {#if node.route}
        <!-- Folder that also has an index.md: chevron toggles, label navigates. -->
        <a
          class={node.route === currentRoute ? 'sb-item active' : 'sb-item'}
          href={node.route}
          title={node.label}
          aria-current={node.route === currentRoute ? 'page' : undefined}
          onclick={(e) => handleLinkClick(e, node.route)}
        >
          {@render ChevronToggle(node, open)}
          <span class="sb-label">{node.label}</span>
        </a>
      {:else}
        <button
          class="sb-item"
          type="button"
          title={node.label}
          data-folder-toggle={node.path}
          aria-expanded={open}
          onclick={() => toggleFolder(node.path)}
        >
          {@render Chevron(open)}
          <span class="sb-label">{node.label}</span>
        </button>
      {/if}
      {#if open && node.children?.length}
        <ul class="sb-sub">
          {#each node.children as child (child.path)}
            {@render Row(child)}
          {/each}
        </ul>
      {/if}
    {:else}
      <a
        class={node.path === normalizedCurrent ? 'sb-item active' : 'sb-item'}
        href={node.route}
        title={node.label}
        aria-current={node.path === normalizedCurrent ? 'page' : undefined}
        onclick={(e) => handleLinkClick(e, node.route)}
      >
        <!-- Invisible chevron spacer so file labels align with folder labels. -->
        {@render ChevronSpacer()}
        <span class="sb-label">{node.label}</span>
      </a>
    {/if}
  </li>
{/snippet}

<style>
  /* Clickable chevron inside a folder-with-route link. Stops propagation so
     clicking here toggles the folder instead of navigating. */
  .chev-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: -0.25rem -0.25rem -0.25rem -0.25rem;
    padding: 0.25rem;
    border-radius: 0.25rem;
    cursor: pointer;
    flex-shrink: 0;
  }
  .chev-toggle:hover :global(.sb-chevron) { color: var(--sidebar-foreground, #252525); }
  .chev-toggle:focus-visible {
    outline: 2px solid var(--sidebar-ring, #b5b5b5);
    outline-offset: 1px;
  }

</style>

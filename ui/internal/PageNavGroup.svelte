<script>
  import {Folder, FolderOpen, FileChartColumnIncreasing} from '@lucide/svelte'
  import {SvelteSet, SvelteMap} from 'svelte/reactivity'

  let {currentFile = '', files = [], onNavigate = undefined, baseRoute = '', projectName = ''} = $props()

  let tree = $state([])
  // eslint-disable-next-line svelte/no-unnecessary-state-wrap -- reassigned, needs $state
  let openFolders = $state(new SvelteSet())
  let treeSignature = $state('')
  let lastCurrent = $state('')

  let navFiles = $derived((files || []).map(normalizeNavFile))
  let normalizedFiles = $derived(navFiles.map(f => f.path))
  let titlesByPath = $derived(Object.fromEntries(navFiles.filter(f => !!f.title).map(f => [f.path, f.title])))

  let normalizedCurrent = $derived(normalizeFilePath(currentFile))

  function normalizeNavFile(file) {
    if (!file || typeof file.path !== 'string') throw new Error('PageNavGroup files must be {path, title?} objects')
    return {path: normalizeFilePath(file.path), title: file.title || undefined}
  }

  function normalizeFilePath(filePath) {
    return (filePath || '').replace(/^\.\//, '').replace(/\\/g, '/').replace(/^\/+/, '')
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
          let folderNode = {type: 'folder', name: segment, label: formatLabel(segment, 'folder'), path: parentPath, children: []}
          folderMap.set(parentPath, folderNode)
          parentChildren.push(folderNode)
        }
        parentChildren = folderMap.get(parentPath).children
      }

      if (!fileName) continue
      let fullPath = parentPath ? `${parentPath}/${fileName}` : fileName
      if (parentChildren.find(n => n.path === fullPath)) continue

      // Every file is a leaf, including index.md — it shows up as its own "Home" page inside
      // the folder and routes to the folder path. Folders themselves only expand/collapse.
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
        // A folder's index page ("Home") sorts to the top, then folders, then files.
        let aHome = a.type === 'file' && a.name.toLowerCase() === 'index.md'
        let bHome = b.type === 'file' && b.name.toLowerCase() === 'index.md'
        if (aHome !== bHome) return aHome ? -1 : 1
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
    // A nested index.md resolves to its folder's route (path/to/folder/index.md → /path/to/folder).
    let clean = path.replace(/\.md$/, '').replace(/\/index$/, '')
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
        class={node.path === normalizedCurrent ? 'sb-item active' : 'sb-item'}
        href={node.route}
        title={node.label}
        aria-current={node.path === normalizedCurrent ? 'page' : undefined}
        onclick={(e) => handleLinkClick(e, node.route)}
      >
        <span class="sb-icon"><FileChartColumnIncreasing size={15} strokeWidth={1.8} /></span>
        <span class="sb-label">{node.label}</span>
      </a>
    {/if}
  </li>
{/snippet}

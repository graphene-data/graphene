<script>
  import {SvelteSet, SvelteMap} from 'svelte/reactivity'

  /** @type {string} */
  let {currentFile = '', files = [], onNavigate = undefined, baseRoute = ''} = $props()

  let tree = $state([])
  let flatNodes = $state([])
  // eslint-disable-next-line svelte/no-unnecessary-state-wrap -- openFolders is reassigned, needs $state
  let openFolders = $state(new SvelteSet())
  let treeSignature = $state('')
  let lastCurrent = $state('')

  let normalizedFiles = $derived((files || [])
    .map((file) => file.replace(/^\.\//, '').replace(/\\/g, '/')))


  let normalizedCurrent = $derived(deriveCurrentFile(currentFile, normalizedFiles, baseRoute))
  let currentRoute = $derived(normalizedCurrent ? pathToRoute(normalizedCurrent) : '/')

  function deriveCurrentFile (_currentFile, _normalizedFiles, _baseRoute) {
    let fromProp = normalizeFilePath(currentFile)
    let route = getLocationRoute()
    if (route && normalizedFiles) {
      let match = normalizedFiles.find((file) => pathToRoute(file) === route)
      if (match) return match
    }
    return fromProp
  }

  function normalizeFilePath (filePath) {
    return (filePath || '').replace(/^\.\//, '').replace(/\\/g, '/')
  }

  function getLocationRoute () {
    if (typeof window === 'undefined') return null
    let route = window.location.pathname || '/'
    route = route.replace(/\/+$/, '') || '/'
    return route
  }

  $effect(() => {
    let nextSignature = normalizedFiles.join('|')
    if (nextSignature !== treeSignature) {
      treeSignature = nextSignature
      tree = buildTree(normalizedFiles)
      flatNodes = flattenTree(tree)
      openFolders = createDefaultOpenFolders(tree, normalizedCurrent)
    }
  })

  $effect(() => {
    if (normalizedCurrent !== lastCurrent) {
      openFolders = mergeAncestorFolders(openFolders, normalizedCurrent)
      lastCurrent = normalizedCurrent
    }
  })

  function toggleFolder (path) {
    if (!path) return
    let next = new SvelteSet(openFolders)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    openFolders = next
  }

  function handleFolderRowKey (event, path) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    toggleFolder(path)
  }

  function isOpen (path, openSet = openFolders) {
    if (!path) return true
    return openSet.has(path)
  }

  function isVisible (node, openSet = openFolders) {
    return node.ancestors.every((path) => isOpen(path, openSet))
  }

  function buildTree (paths) {
    let root = []
    let folderMap = new SvelteMap()

    for (let filePath of paths) {
      let cleanPath = filePath.replace(/^\.\//, '').replace(/^\//, '')
      let segments = cleanPath.split('/')
      if (!segments.length) continue
      let fileName = segments.pop()
      let parentChildren = root
      let parentPath = ''

      for (let segment of segments) {
        parentPath = parentPath ? `${parentPath}/${segment}` : segment
        if (!folderMap.has(parentPath)) {
          let folderNode = {
            type: 'folder',
            name: segment,
            label: formatLabel(segment, 'folder'),
            path: parentPath,
            children: [],
            route: null,
          }
          folderMap.set(parentPath, folderNode)
          parentChildren.push(folderNode)
        }
        parentChildren = folderMap.get(parentPath).children
      }

      if (!fileName) continue
      let fullPath = parentPath ? `${parentPath}/${fileName}` : fileName

      if (fileName.toLowerCase() === 'index.md' && parentPath) {
        let folderNode = folderMap.get(parentPath)
        if (folderNode) folderNode.route = pathToRoute(fullPath)
        continue
      }

      let exists = parentChildren.find((node) => node.path === fullPath)
      if (exists) continue
      parentChildren.push({
        type: 'file',
        name: fileName,
        label: formatLabel(fileName, 'file'),
        path: fullPath,
        route: pathToRoute(fullPath),
      })
    }

    return sortNodes(root)
  }

  function sortNodes (nodes) {
    return nodes
      .map((node) => {
        if (node.type === 'folder' && node.children?.length) {
          return {...node, children: sortNodes(node.children)}
        }
        return node
      })
      .sort((a, b) => {
        if (a.label === 'Home') return -1
        if (b.label === 'Home') return 1
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
        return a.label.localeCompare(b.label)
      })
  }

  function flattenTree (nodes, depth = 0, ancestors = []) {
    let list = []
    for (let node of nodes) {
      if (node.type === 'folder') {
        let entry = {...node, depth, ancestors}
        list.push(entry)
        if (node.children?.length) {
          list.push(...flattenTree(node.children, depth + 1, [...ancestors, node.path]))
        }
        continue
      }
      list.push({...node, depth, ancestors})
    }
    return list
  }

  function createDefaultOpenFolders (_treeNodes, currentPath) {
    let next = new SvelteSet()
    return mergeAncestorFolders(next, currentPath)
  }

  function mergeAncestorFolders (openSet, filePath) {
    if (!filePath) return new SvelteSet(openSet)
    let parts = filePath.split('/')
    parts.pop()
    let aggregate = []
    let next = new SvelteSet(openSet)
    for (let part of parts) {
      aggregate.push(part)
      next.add(aggregate.join('/'))
    }
    return next
  }

  function formatLabel (value, type) {
    let cleaned = type === 'file' ? value.replace(/\.md$/, '') : value
    if (cleaned.toLowerCase() === 'index') return 'Home'
    return cleaned
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ')
  }

  function pathToRoute (path) {
    let clean = path.replace(/\.md$/, '')
    let prefix = baseRoute ? '/' + baseRoute : ''
    if (!clean || clean === 'index') return prefix || '/'
    return prefix + '/' + clean
  }

  function handleLinkClick (event, href) {
    if (!onNavigate) return
    if (href.startsWith('http') || href.startsWith('//')) return
    event.preventDefault()
    onNavigate(href)
  }
</script>

<ul>
  {#each flatNodes as node (node.path)}
    {#if node.type === 'folder'}
      <li class={isVisible(node, openFolders) ? '' : 'hidden'} style={`--depth:${node.depth}`} data-folder={node.path}>
        <div
          class={node.route ? 'folder-row' : 'folder-row clickable'}
          role={node.route ? undefined : 'button'}
          aria-expanded={node.route ? undefined : String(isOpen(node.path, openFolders))}
          onclick={node.route ? undefined : () => toggleFolder(node.path)}
          onkeydown={node.route ? undefined : (event) => handleFolderRowKey(event, node.path)}
        >
          <button
            class="toggle"
            type="button"
            data-folder-toggle={node.path}
            aria-expanded={isOpen(node.path, openFolders)}
            onclick={(event) => { event.stopPropagation(); toggleFolder(node.path) }}
            aria-label={(isOpen(node.path, openFolders) ? 'Collapse' : 'Expand') + ' ' + node.label}
          >
            <span class={isOpen(node.path, openFolders) ? 'chevron open' : 'chevron'}>▸</span>
          </button>
          {#if node.route}
            <a
              href={node.route}
              class={node.route === currentRoute ? 'active' : ''}
              aria-current={node.route === currentRoute ? 'page' : undefined}
              onclick={(e) => handleLinkClick(e, node.route)}
            >
              {node.label}
            </a>
          {:else}
            <span class="label">{node.label}</span>
          {/if}
        </div>
      </li>
    {:else}
      <li class={isVisible(node, openFolders) ? 'file' : 'file hidden'} style={`--depth:${node.depth}`}>
        <a
          href={node.route}
          class={node.path === normalizedCurrent ? 'active' : ''}
          aria-current={node.path === normalizedCurrent ? 'page' : undefined}
          onclick={(e) => handleLinkClick(e, node.route)}
        >
          <span>{node.label}</span>
        </a>
      </li>
    {/if}
  {/each}
</ul>

<style>
  ul {
    list-style: none;
    padding: 0 0.5rem 0 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    overflow: hidden;
  }

  li {
    --indent: calc(var(--depth, 0) * 1rem);
    padding-left: var(--indent);
    width: 100%;
    box-sizing: border-box;
  }

  li.file {
    padding-left: calc(var(--indent) + 1.5rem);
  }

  li.hidden {
    display: none;
  }

  .folder-row {
    display: flex;
    align-items: center;
    padding: 0.1rem 0.15rem;
    border-radius: 4px;
  }

  .folder-row.clickable {
    cursor: pointer;
  }

  .folder-row.clickable:focus-visible {
    outline: 2px solid rgba(15, 23, 42, 0.2);
    outline-offset: 2px;
  }

  .toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    color: var(--base-heading);
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 4px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 120ms ease;
    visibility: hidden;
  }

  .folder-row:hover .toggle,
  .folder-row:focus-within .toggle,
  .toggle:focus-visible {
    opacity: 1;
    pointer-events: auto;
    visibility: visible;
  }

  .toggle:hover,
  .toggle:focus-visible {
    background: rgba(15, 23, 42, 0.1);
    outline: none;
  }

  .chevron {
    display: inline-block;
    transition: transform 150ms ease;
    font-size: 0.7rem;
    color: var(--base-content-muted);
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .label {
    font-size: 0.85rem;
    padding: 0.2rem 0.35rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--base-heading);
  }

  .folder-row a {
    flex: 1;
    display: block;
    font-size: 0.85rem;
    padding: 0.2rem 0.35rem;
    border-radius: 4px;
    color: var(--base-heading);
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .folder-row a:hover,
  .folder-row a:focus-visible {
    background: rgba(15, 23, 42, 0.05);
    outline: none;
  }

  li.file a {
    display: flex;
    align-items: center;
    font-size: 0.85rem;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    color: var(--base-heading);
    text-decoration: none;
  }

  li.file a span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  li.file a:hover,
  li.file a:focus-visible {
    background: rgba(15, 23, 42, 0.05);
    outline: none;
  }

  a.active {
    color: var(--base-900, #0f172a);
  }
</style>

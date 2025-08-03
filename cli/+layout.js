import {browser, building, dev} from '$app/environment'
import {
  tableFromIPC,
  initDB,
  setParquetURLs,
  query as usqlQuery,
  updateSearchPath,
  arrowTableToJSON,
} from '@evidence-dev/universal-sql/client-duckdb'
import {profile} from '@evidence-dev/component-utilities/profile'
import {toasts} from '@evidence-dev/component-utilities/stores'
import {setTrackProxy} from '@evidence-dev/sdk/usql'
import {addBasePath} from '@evidence-dev/sdk/utils/svelte'
import md5 from 'blueimp-md5'

export const ssr = !dev
export const prerender = import.meta.env.VITE_EVIDENCE_SPA !== 'true'
export const trailingSlash = 'always'

const loadDB = async () => {
  let renderedFiles = {}

  if (!browser) {
    let {readFile} = await import('fs/promises');
    ({renderedFiles} = JSON.parse(await readFile('./static/data/manifest.json', 'utf-8').catch(() => '{}')))
  } else {
    let res = await fetch(addBasePath('/data/manifest.json'))
    if (res.ok) ({renderedFiles} = await res.json())
  }
  await profile(initDB)

  if (Object.keys(renderedFiles ?? {}).length === 0) {
    console.warn('No sources found, execute "npm run sources" to generate'.trim())
    if (dev) {
      toasts.add({
        id: 'MissingManifest',
        status: 'warning',
        title: 'No Sources Found',
        message: 'Configure and run sources to include data in your project.',
      }, 10000)
    }
  } else {
    await profile(setParquetURLs, renderedFiles, {addBasePath})
    await profile(updateSearchPath, Object.keys(renderedFiles))
  }
}

const database_initialization = profile(loadDB)

/**
 *
 * @param {string} routeHash
 * @param {string} paramsHash
 * @param {typeof fetch} fetch
 * @returns {Promise<Record<string, unknown[]>>}
 */
async function getPrerenderedQueries (routeHash, paramsHash, fetch) {
  // get every query that's run in the component
  let res = await fetch(addBasePath(`/api/${routeHash}/${paramsHash}/all-queries.json`))
  if (!res.ok) return {}

  let sql_cache_with_hashed_query_strings = await res.json()

  let resolved_entries = await Promise.all(Object.entries(sql_cache_with_hashed_query_strings).map(async ([query_name, query_hash]) => {
    let res = await fetch(addBasePath(`/api/prerendered_queries/${query_hash}.arrow`))
    if (!res.ok) return null

    let table = await tableFromIPC(res)
    return [query_name, arrowTableToJSON(table)]
  }))

  return Object.fromEntries(resolved_entries.filter(Boolean))
}

const system_routes = ['/settings', '/explore']

/** @type {Map<string, { inputs: Record<string, string> }>} */
const dummy_pages = new Map()

/** @satisfies {import("./$types").LayoutLoad} */
export const load = async ({fetch, route, params, url}) => {
  let [{customFormattingSettings}, pagesManifest, evidencemeta] = await Promise.all([
    fetch(addBasePath('/api/customFormattingSettings.json/GET.json')).then((x) => x.json()),
    fetch(addBasePath('/api/pagesManifest.json')).then((x) => x.json()),
    fetch(addBasePath(`/api/${route.id}/evidencemeta.json`))
      .then((x) => x.json())
      .catch(() => ({queries: []})),
  ])

  let routeHash = md5(route.id)
  let paramsHash = md5(Object.entries(params)
    .sort()
    .map(([key, value]) => `${key}\x1F${value}`)
    .join('\x1E'))
  let isUserPage =
		route.id && system_routes.every((system_route) => !route.id.startsWith(system_route))

  /** @type {App.PageData["data"]} */
  let data = {}

  let {
    inputs = setTrackProxy({
      label: '',
      value: '(SELECT NULL WHERE 0 /* An Input has not been set */)',
    }), /* Create a proxy by default */
  } = dummy_pages.get(url.pathname) ?? {}

  let is_dummy_page = dummy_pages.has(url.pathname)
  if ((dev || building) && !browser && !is_dummy_page) {
    dummy_pages.set(url.pathname, {inputs})
    await fetch(url)
    dummy_pages.delete(url.pathname)
  }

  if (!browser) await database_initialization
  // account for potential changes in manifest (source query hmr)
  if (!browser && dev) await initDB()

  // let SSR saturate the cache first
  if (browser && isUserPage && prerender) {
    data = await getPrerenderedQueries(routeHash, paramsHash, fetch)
  }

  /** @type {App.PageData["__db"]["query"]} */
  async function query (sql, {query_name, callback = (x) => x} = {}) {
    // if (browser) {
    // 	return (async () => {
    // 		await database_initialization;
    // 		const result = await usqlQuery(sql);
    // 		console.log(sql, result)
    // 		return callback(result);
    // 	})();
    // }

    let response = await fetch(addBasePath('/query'), {
 			method: 'POST',
 			headers: {'Content-Type': 'application/json'},
 			body: JSON.stringify({query_name, sql}),
  	})
  	if (!response.ok) {
  		throw new Error(`Query failed: ${response.statusText}`)
  	}
  	let result = await response.json()
  	return callback(result.rows)
  }

  let tree = pagesManifest
  for (let part of (route.id ?? '').split('/').slice(1)) {
    tree = tree.children[part]
    if (!tree) break
    if (tree.frontMatter?.title) {
      tree.title = tree.frontMatter.title
    } else if (tree.frontMatter?.breadcrumb) {
      let {breadcrumb} = tree.frontMatter
      for (let [param, value] of Object.entries(params)) {
        breadcrumb = breadcrumb.replaceAll(`\${params.${param}}`, value)
      }
      tree.title = (await query(breadcrumb))[0]?.breadcrumb
    }
  }

  return /** @type {App.PageData} */ ({
    __db: {
      query,
      async load () {
        return database_initialization
      },
      async updateParquetURLs (manifest) {
        // todo: maybe diff with old?
        let {renderedFiles} = JSON.parse(manifest)
        await profile(setParquetURLs, renderedFiles, {addBasePath})
      },
    },
    inputs,
    data,
    customFormattingSettings,
    isUserPage,
    evidencemeta,
    pagesManifest,
  })
}

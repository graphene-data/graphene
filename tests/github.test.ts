import {test, expect} from './fixtures.ts'
import {getDb} from '../server/db.ts'
import {setAuthOverride} from '../server/auth.ts'
import * as schema from '../schema.ts'
import {eq} from 'drizzle-orm'
import {orgId, userId} from '../server/dev.ts'

const INSTALLATION_ID = '100066946'

test('full GitHub integration flow: install, add repo, sync, remove', async ({page, cloud}) => {
  setAuthOverride({userId, orgId})

  // Step 1: Go to Settings/Repos and click "Connect GitHub"
  await page.goto(cloud.url + '/settings/repos')
  await expect(page.locator('h1:has-text("Repositories")')).toBeVisible()
  await expect(page.locator('button:has-text("Connect GitHub")')).toBeVisible()

  await expect(page).screenshot('01-repos-not-connected')

  // Listen for navigation to GitHub
  let githubRequest = page.waitForRequest(req => req.url().includes('github.com/apps/'))

  // Click Connect GitHub - this navigates to the API which redirects to GitHub
  await page.locator('.empty-state button:has-text("Connect GitHub")').click()

  // Wait for the GitHub redirect and capture the URL
  let request = await githubRequest
  let githubRedirectUrl = request.url()

  // Verify the redirect URL is correct
  expect(githubRedirectUrl).toContain('github.com/apps/')
  expect(githubRedirectUrl).toContain('/installations/new')
  expect(githubRedirectUrl).toMatch(/state=[\w]+/)

  // Extract the nonce from the redirect URL
  let stateMatch = githubRedirectUrl.match(/state=([\w]+)/)
  let nonce = stateMatch![1]

  // Step 2: Simulate GitHub redirecting back after user completes installation
  // The cookie was set by the server, so we reconstruct it with the same nonce
  await page.context().addCookies([{
    name: 'github_install_state',
    value: JSON.stringify({nonce, orgId}),
    domain: new URL(cloud.url).hostname,
    path: '/',
  }])

  // Navigate to the setup URL (simulating GitHub's redirect back)
  await page.goto(cloud.url + `/_api/github/setup?installation_id=${INSTALLATION_ID}&state=${nonce}`)

  // Should redirect to /settings/repos
  await expect(page).toHaveURL(/\/settings\/repos/)

  // Step 3: Should see the ecomm repo from GitHub
  let repoItem = page.locator('.repo-item').filter({hasText: 'grant-gh-test/ecomm'})
  await expect(repoItem).toBeVisible()

  await expect(page).screenshot('02-repos-available')

  // Click Add
  await repoItem.locator('.add-btn').click()

  // Should see configuration form
  await expect(page.locator('text=Configure grant-gh-test/ecomm')).toBeVisible()

  // Slug should be pre-filled
  await expect(page.locator('input[placeholder="my-repo"]')).toHaveValue('ecomm')

  await expect(page).screenshot('03-repos-configure')

  // Submit the form
  await page.locator('button:has-text("Add Repository")').click()

  // Should show Remove button (indicating it's added and synced)
  await expect(repoItem.locator('.remove-btn')).toBeVisible({timeout: 15000})

  await expect(page).screenshot('04-repos-added')

  // Step 4: Verify sync happened in DB
  let db = getDb()
  let repo = await db.select().from(schema.repos).where(eq(schema.repos.slug, 'ecomm')).get()
  expect(repo).toBeDefined()
  expect(repo!.syncResult).toBe('success')
  expect(repo!.lastSyncedAt).toBeDefined()

  // Check expected files were synced (index.md and models.gsql)
  let syncedFiles = await db.select().from(schema.files).where(eq(schema.files.repoId, repo!.id)).all()
  expect(syncedFiles).toHaveLength(2)

  let paths = syncedFiles.map(f => f.path).sort()
  expect(paths).toEqual(['index', 'models'])

  let extensions = syncedFiles.map(f => f.extension).sort()
  expect(extensions).toEqual(['gsql', 'md'])

  // Step 5: Remove the repo
  await repoItem.locator('.remove-btn').click()

  // Should show Add button again
  await expect(repoItem.locator('.add-btn')).toBeVisible()

  await expect(page).screenshot('05-repos-removed')

  // Verify repo is deleted from DB
  let deletedRepo = await db.select().from(schema.repos).where(eq(schema.repos.slug, 'ecomm')).get()
  expect(deletedRepo).toBeUndefined()

  // Files should also be deleted (cascade)
  let remainingFiles = await db.select().from(schema.files).where(eq(schema.files.repoId, repo!.id)).all()
  expect(remainingFiles).toHaveLength(0)
})

import {defineConfig, devices} from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  outputDir: './tests/results',
  timeout: 20_000,
  fullyParallel: false,
  workers: 1,
  expect: {
    timeout: process.env.DEBUG ? 0 : 2_000,
    toHaveScreenshot: {
      pathTemplate: '{testDir}/snapshots/{testFilePath}/{arg}{ext}',
    },
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    headless: true,
    actionTimeout: 0,
    trace: 'retain-on-failure',
    video: 'off',
    launchOptions: {devtools: !!process.env.DEBUG},
  },
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome'], browserName: 'chromium'},
    },
  ],
})

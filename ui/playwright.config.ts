import {defineConfig, devices} from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 20_000,
  expect: {timeout: 15_000},
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0, // process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    headless: true,
    actionTimeout: 0,
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome'], browserName: 'chromium'},
    },
  ],
})

import {defineConfig, devices} from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost',
    viewport: {width: 1280, height: 800},
  },
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },
  ],
})


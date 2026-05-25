import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  workers: 3,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'https://tstviarapida.co:8760',
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      'captchakeystring': '',
      'Content-Type': 'application/json',
    },
  },
});

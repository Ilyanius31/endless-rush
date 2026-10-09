import { defineConfig } from '@playwright/test';
import config from './playwright.config.ts';
import { previewBasePath } from './build.config.ts';

const basePath = previewBasePath();
const baseURL = `http://localhost:4173${basePath === './' ? '/' : basePath}`;

export default defineConfig(config, {
  use: { baseURL },
  webServer: {
    command: 'npm run preview',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});

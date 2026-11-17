import { randomBytes } from 'node:crypto';

import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against a local API and a local `ng serve`, never the live site.
// Two stacks start: "dev" (AUTH_MODE=dev, no login) and "signin" (AUTH_MODE=jwt with dummy
// GitHub credentials; real GitHub is never called). Both use the throwaway `cortex_e2e`
// database, never `cortex`.
const DB =
  process.env['E2E_DATABASE_URL'] ?? 'postgresql+asyncpg://localhost:5432/cortex_e2e';
const DEV = { api: 8710, web: 4710 };
const SIGNIN = { api: 8711, web: 4711 };

// Fresh on every run and never written anywhere.
const jwtSecret = process.env['E2E_JWT_SECRET'] ?? randomBytes(32).toString('hex');

const reuse = !process.env['CI'];

function api(port: number, env: Record<string, string>) {
  return {
    command: `uv run uvicorn app.main:app --port ${port}`,
    cwd: '../backend',
    url: `http://localhost:${port}/health`,
    reuseExistingServer: reuse,
    stdout: 'ignore' as const,
    timeout: 120_000,
    env: { DATABASE_URL: DB, ENVIRONMENT: 'dev', ...env },
  };
}

// `ng serve` (not a production build) keeps this a simple local proxy to the API; the production
// build is checked by the separate `frontend` CI job.
function web(ports: { api: number; web: number }, proxy: string) {
  return {
    command: `npx ng serve --port ${ports.web} --proxy-config e2e/${proxy}`,
    url: `http://localhost:${ports.web}`,
    reuseExistingServer: reuse,
    stdout: 'ignore' as const,
    timeout: 180_000,
  };
}

export default defineConfig({
  globalSetup: './e2e/global-setup.ts', // empties the user-data tables in cortex_e2e
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: 'test-results',
  use: { trace: 'on-first-retry', colorScheme: 'dark' },
  projects: [
    {
      name: 'dev',
      testMatch: 'dev.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${DEV.web}` },
    },
    {
      name: 'signin',
      testMatch: 'signin.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${SIGNIN.web}` },
    },
    // Only with SCREENSHOTS=1 (npm run e2e:screenshots); never part of the normal run.
    ...(process.env['SCREENSHOTS']
      ? [
          {
            name: 'screenshots',
            testMatch: 'screenshots.spec.ts',
            use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
          },
        ]
      : []),
    // Only with DEMO=1 (npm run e2e:demo): records the README demo video.
    ...(process.env['DEMO'] ? [{ name: 'demo', testMatch: 'demo.spec.ts', use: devices['Desktop Chrome'] }] : []),
  ],
  webServer: [
    api(DEV.api, { AUTH_MODE: 'dev', CORS_ORIGINS: `["http://localhost:${DEV.web}"]` }),
    web(DEV, 'proxy.dev.json'),
    api(SIGNIN.api, {
      AUTH_MODE: 'jwt',
      JWT_SECRET: jwtSecret,
      FRONTEND_URL: `http://localhost:${SIGNIN.web}`,
      CORS_ORIGINS: `["http://localhost:${SIGNIN.web}"]`,
      GITHUB_CLIENT_ID: 'e2e-dummy',
      GITHUB_CLIENT_SECRET: 'e2e-dummy',
    }),
    web(SIGNIN, 'proxy.signin.json'),
  ],
});

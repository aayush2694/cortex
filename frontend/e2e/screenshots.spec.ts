import { expect, test, type Page } from '@playwright/test';

import { SOLUTION } from './solution';

// Not part of the normal run: `npm run e2e:screenshots` (needs the same local stacks).
// Writes the README images to docs/screenshots/. All dark, 1280x800.
// The first test adds neutral sample data through the UI (the global setup emptied
// cortex_e2e), so the dashboard, flashcards and job board have something to show.
const OUT = '../docs/screenshots';
const DEV = 'http://localhost:4710';
const SIGNIN = 'http://localhost:4711';
const API_DOCS = 'http://localhost:8710/docs';

test.use({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cortex.appearance', 'dark'));
});

// Wait for every running animation to end (or be cancelled), so the picture is not half faded.
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => Promise.allSettled(document.getAnimations().map((a) => a.finished)));
}

const JOBS = [
  { company: 'Acme', role: 'Backend Engineer', stage: 'interview', next: 'System design round' },
  { company: 'Globex', role: 'Full Stack Developer', stage: 'applied', next: 'Recruiter call' },
  { company: 'Initech', role: 'Python Developer', stage: 'applied', next: '' },
  { company: 'Northwind', role: 'Software Engineer', stage: 'wishlist', next: 'Ask for a referral' },
];

test('sample data', async ({ page }) => {
  // Topic progress and flashcards.
  for (const [id, status] of [
    ['two-pointers', 'I know this'],
    ['sliding-window', 'Learning'],
    ['binary-search', 'Learning'],
  ]) {
    await page.goto(`${DEV}/topics/${id}`);
    await page.getByRole('radio', { name: status }).click();
    await expect(page.getByRole('radio', { name: status })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: /Add to review/ }).click();
    await expect(page.getByRole('button', { name: /Added \d+ card|Already in review/ })).toBeVisible();
  }

  // Job applications across the board.
  await page.goto(`${DEV}/jobs`);
  for (const j of JOBS) {
    await page.getByRole('button', { name: 'Add a job' }).click();
    const form = page.getByRole('dialog', { name: 'Add a job' });
    await form.getByLabel('Company', { exact: true }).fill(j.company);
    await form.getByLabel('Role', { exact: true }).fill(j.role);
    await form.locator('select[name=status]').selectOption(j.stage);
    await form.locator('select[name=source]').selectOption('Company site');
    if (j.next) await form.getByLabel('Next step', { exact: true }).fill(j.next);
    await form.getByRole('button', { name: 'Add job' }).click();
    await expect(form).toBeHidden();
    await expect(page.getByRole('button', { name: new RegExp(`^${j.company}`) })).toBeVisible();
  }
});

test('dashboard', async ({ page }) => {
  // A fixed daytime clock so the greeting does not depend on when the images are taken.
  const morning = new Date();
  morning.setHours(10, 0, 0, 0);
  await page.clock.setFixedTime(morning);
  await page.goto(`${DEV}/`);
  await expect(page.getByRole('heading', { level: 2, name: 'Today' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Activity' })).toBeVisible();
  await expect(page.locator('.skeleton')).toHaveCount(0);
  await settle(page);
  await page.screenshot({ path: `${OUT}/dashboard.png` });
});

test('topic map', async ({ page }) => {
  await page.goto(`${DEV}/map`);
  await expect(page.getByRole('link', { name: 'Two Pointers' })).toBeVisible();
  await page.screenshot({ path: `${OUT}/topic-map.png` });
});

test('topic guide', async ({ page }) => {
  await page.goto(`${DEV}/topics/two-pointers`);
  await expect(page.getByRole('heading', { level: 2, name: 'The idea' })).toBeVisible();
  await page.screenshot({ path: `${OUT}/topic-guide.png` });
});

test('pattern walkthrough', async ({ page }) => {
  await page.goto(`${DEV}/topics/sliding-window`);
  const label = page.getByText(/^Watch it work/);
  await expect(label).toBeVisible();
  const next = page.getByRole('button', { name: 'Next step (Right arrow)' });
  await expect(next).toBeVisible();
  for (let i = 0; i < 6; i++) await next.click();
  // Put the section label just below the sticky top bar.
  await label.evaluate((el) => {
    (el as HTMLElement).style.scrollMarginTop = '72px';
    el.scrollIntoView({ block: 'start' });
  });
  await settle(page);
  await page.screenshot({ path: `${OUT}/pattern-walkthrough.png` });
});

test('visualizer', async ({ page }) => {
  await page.goto(`${DEV}/visualizer/dijkstra`);
  const next = page.getByRole('button', { name: 'Next step (Right arrow)' });
  await expect(next).toBeVisible();
  for (let i = 0; i < 9; i++) await next.click();
  await settle(page);
  await page.screenshot({ path: `${OUT}/visualizer.png` });
});

test('practice question', async ({ page }) => {
  await page.goto(`${DEV}/practice/pair-with-target-sum`);
  await expect(page.getByRole('textbox', { name: 'Your Python solution' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Your Python solution' }).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(SOLUTION);
  await page.getByRole('button', { name: 'Run examples' }).click();
  await expect(page.getByText('3 of 3 passed')).toBeVisible({ timeout: 90_000 });
  await settle(page);
  await page.screenshot({ path: `${OUT}/practice.png` });
});

test('flashcards', async ({ page }) => {
  await page.goto(`${DEV}/review`);
  await page.getByRole('button', { name: /Show answer/ }).click();
  await expect(page.getByRole('group', { name: 'How well did you remember?' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${OUT}/flashcards.png` });
});

test('job board', async ({ page }) => {
  await page.goto(`${DEV}/jobs`);
  await expect(page.getByRole('button', { name: /^Acme/ })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${OUT}/job-board.png` });
});

test('API docs', async ({ page }) => {
  await page.goto(API_DOCS);
  await expect(page.locator('.opblock').first()).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: `${OUT}/api-docs.png` });
});

test('sign-in page', async ({ page }) => {
  await page.goto(`${SIGNIN}/signin`);
  await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible();
  await page.screenshot({ path: `${OUT}/sign-in.png` });
});

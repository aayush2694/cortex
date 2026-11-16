import { expect, test } from '@playwright/test';

import { SOLUTION } from './solution';

// Not part of the normal run: `npm run e2e:screenshots` (needs the same local stacks).
// Writes the README images to docs/screenshots/. All dark, 1280x800.
const OUT = '../docs/screenshots';
const DEV = 'http://localhost:4710';
const SIGNIN = 'http://localhost:4711';

test.use({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cortex.appearance', 'dark'));
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

test('practice question', async ({ page }) => {
  await page.goto(`${DEV}/practice/pair-with-target-sum`);
  await expect(page.getByRole('textbox', { name: 'Your Python solution' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Your Python solution' }).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(SOLUTION);
  await page.getByRole('button', { name: 'Run examples' }).click();
  await expect(page.getByText('3 of 3 passed')).toBeVisible({ timeout: 90_000 });
  // Let the result animation finish so the picture is not half faded.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  await page.screenshot({ path: `${OUT}/practice.png` });
});

test('sign-in page', async ({ page }) => {
  await page.goto(`${SIGNIN}/signin`);
  await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible();
  await page.screenshot({ path: `${OUT}/sign-in.png` });
});

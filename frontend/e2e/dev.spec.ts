import { expect, test } from '@playwright/test';

import { SOLUTION } from './solution';

test('learner journey in dev mode: map, guide, practice, progress', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cortex.appearance', 'dark'));

  // 1. The knowledge map loads and shows topics.
  await page.goto('/map');
  await expect(page.getByRole('heading', { name: 'Knowledge map' })).toBeVisible();
  const twoPointers = page.getByRole('link', { name: 'Two Pointers' });
  await expect(twoPointers).toBeVisible();

  // 2. Opening a topic shows its guide with the section headings.
  await twoPointers.click();
  await expect(page).toHaveURL(/\/topics\/two-pointers$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Two Pointers' })).toBeVisible();
  for (const heading of ['In short', 'The idea', 'How it works', 'Code', 'Common mistakes']) {
    await expect(page.getByRole('heading', { level: 2, name: heading, exact: true })).toBeVisible();
  }

  // The database was emptied before the run: nothing is solved and mastery is at its start.
  await page.goto('/practice');
  await expect(page.getByRole('link', { name: /Pair with target sum/ })).not.toContainText('Solved');
  await page.goto('/topics/two-pointers');
  await expect(page.locator('.mastery .mono')).toHaveText('0%');

  // 3. A practice question can be answered and shows feedback.
  await page.goto('/practice/pair-with-target-sum');
  await expect(page.getByRole('heading', { level: 1, name: 'Pair with target sum' })).toBeVisible();
  const editor = page.getByRole('textbox', { name: 'Your Python solution' });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(SOLUTION); // insertText skips the editor's auto-indent
  await page.getByRole('button', { name: 'Submit' }).click();
  // The first run downloads Python (Pyodide) from a CDN, so allow time.
  await expect(page.getByText('7 of 7 passed')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole('region', { name: 'Your submissions' }).getByText('Accepted').first()).toBeVisible();

  // 4. Progress reflects it: the list marks the problem solved, and the topic has mastery.
  await page.goto('/practice');
  const row = page.getByRole('link', { name: /Pair with target sum/ });
  await expect(row).toContainText('Solved');
  await page.goto('/topics/two-pointers');
  const mastery = page.locator('.mastery .mono');
  await expect(mastery).not.toHaveText('0%');
  await expect(mastery).toHaveText(/^[1-9]\d*%$/);
});

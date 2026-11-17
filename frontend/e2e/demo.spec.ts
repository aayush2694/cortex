import { mkdirSync, writeFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { SOLUTION } from './solution';

// Not part of the normal run: `npm run e2e:demo` records this journey as a video, then
// e2e/make-demo-gif.mjs turns it into docs/screenshots/demo.gif. Dark, 1280x800, dev stack.
// It also writes the moments to cut (the blank start, and Pyodide's first load) to
// test-results/demo/cuts.json, in seconds from the start of the video.
const DEV = 'http://localhost:4710';
const OUT = 'test-results/demo';
const SIZE = { width: 1280, height: 800 };

// A short pause so a viewer can follow; never used in place of waiting for content.
const beat = (page: Page, ms = 600) => page.waitForTimeout(ms);

test('demo: map, guide, practice, run', async ({ browser }) => {
  test.setTimeout(180_000);
  mkdirSync(OUT, { recursive: true });
  const context = await browser.newContext({
    viewport: SIZE,
    colorScheme: 'dark',
    recordVideo: { dir: OUT, size: SIZE },
  });
  await context.addInitScript(() => localStorage.setItem('cortex.appearance', 'dark'));
  const page = await context.newPage();
  const t0 = Date.now(); // the video starts with the page
  const at = () => (Date.now() - t0) / 1000;

  // Knowledge map.
  await page.goto(`${DEV}/map`);
  const twoPointers = page.getByRole('link', { name: 'Two Pointers' });
  await expect(twoPointers).toBeVisible();
  const start = at();
  await beat(page, 1500);

  // Two Pointers: the guide, scrolled a little.
  await twoPointers.click();
  await expect(page.getByRole('heading', { level: 2, name: 'The idea' })).toBeVisible();
  await beat(page, 900);
  await page.mouse.move(760, 500);
  for (let i = 0; i < 14; i++) {
    await page.mouse.wheel(0, 40);
    await page.waitForTimeout(60);
  }
  await beat(page, 1000);

  // The practice problem, from the practice list.
  await page.getByRole('link', { name: 'Practice', exact: true }).click();
  const problem = page.getByRole('link', { name: /Pair with target sum/ });
  await expect(problem).toBeVisible();
  await beat(page, 800);
  await problem.click();
  const editor = page.getByRole('textbox', { name: 'Your Python solution' });
  await expect(editor).toBeVisible();
  await beat(page, 600);

  // Type the solution a few characters at a time. insertText skips the editor's auto-indent
  // and bracket closing, so the text lands exactly as written.
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a'); // the first chunk replaces the starter code
  for (const chunk of SOLUTION.trimEnd().match(/\s+|[^\s]{1,3}/g) ?? []) {
    await page.keyboard.insertText(chunk);
    await page.waitForTimeout(40);
  }
  await beat(page, 500);

  // Run. Python (Pyodide) starts downloading when the page opens; if it is still loading
  // now, the run waits for it, and that wait is cut from the GIF.
  await page.getByRole('button', { name: 'Run examples' }).click();
  const runStarted = at();
  await expect(page.getByText('3 of 3 passed')).toBeVisible({ timeout: 90_000 });
  const passed = at();
  await beat(page, 300);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 40);
    await page.waitForTimeout(50);
  }
  await beat(page, 1600);
  const end = at();

  const slow = passed - runStarted > 1;
  const cut = slow ? { cutFrom: runStarted + 0.4, cutTo: passed - 0.1 } : { cutFrom: passed, cutTo: passed };
  writeFileSync(`${OUT}/cuts.json`, JSON.stringify({ start, ...cut, end, wait: passed - runStarted }, null, 2));
  const video = page.video();
  await context.close(); // finishes the video file
  writeFileSync(`${OUT}/video.txt`, (await video!.path()) + '\n');
});

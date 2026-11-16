import { expect, test } from '@playwright/test';

// The app runs here with AUTH_MODE=jwt and dummy GitHub credentials.

test('visiting the app redirects to the sign-in page', async ({ page }) => {
  await page.goto('/map');
  await expect(page).toHaveURL(/\/signin/);
  await expect(page.getByRole('heading', { name: 'Sign in to Cortex' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible();
});

test('the API refuses /me without a token', async ({ request }) => {
  const res = await request.get('/api/v1/me');
  expect(res.status()).toBe(401);
});

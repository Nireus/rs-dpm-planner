import { expect, test } from '@playwright/test';

test('renders the project foundation landing page', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('img', { name: 'RuneScape Ranged Rotation Planner logo' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Gear' })).toBeVisible();
});
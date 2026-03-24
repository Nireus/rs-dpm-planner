import { expect, test } from '@playwright/test';

test('renders the project foundation landing page', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'RuneScape Ranged Rotation Planner' }),
  ).toBeVisible();
  await expect(page.getByText('Phase 1 Foundation')).toBeVisible();
});

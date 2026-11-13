import { test, expect } from '@playwright/test';

test('signs in and sees the dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name=user]', 'tester');
  await page.fill('input[name=password]', 'tester');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/app\//);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

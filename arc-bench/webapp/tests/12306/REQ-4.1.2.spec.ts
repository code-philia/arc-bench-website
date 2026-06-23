import { test, expect } from '@playwright/test';
import { navigateToPersonalCenter } from './helpers';

test('REQ-4.1.2: Open the personal center home page after login', async ({ page }) => {
  // GIVEN: The user is logged in and is on the home page.
  // WHEN: Click the top "My 12306" entry.
  await navigateToPersonalCenter(page);

  // THEN: Navigate to the personal center home page and show the left menu items,
  // the icon, the user name, and the notice box text.
  const sidebar = page.locator('.personal-sidebar');
  await expect(sidebar.getByText(/Personal Center/i)).toBeVisible({ timeout: 10000 });
  await expect(sidebar.getByText(/Order center/i)).toBeVisible();
  await expect(sidebar.getByText(/^Personal$/i)).toBeVisible();
  await expect(sidebar.getByText(/Information management/i)).toBeVisible();

  // Notice box content
  await expect(page.getByText(/Welcome to 12306\.cn/i)).toBeVisible();
  await expect(page.getByText(/password is also used in other websites/i)).toBeVisible();
  await expect(page.getByText(/verify your e-mail address/i)).toBeVisible();
  await expect(page.getByText(/ticket booking/i)).toBeVisible();
});

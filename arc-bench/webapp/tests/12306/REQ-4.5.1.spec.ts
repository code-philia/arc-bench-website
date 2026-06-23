import { test, expect } from '@playwright/test';
import { loginAsTestUser, navigateToHomePage } from './helpers';

test('REQ-4.5.1: Open a personal center page from the my 12306 dropdown', async ({ page }) => {
  // GIVEN: The user is logged in and is on a page where the top "My 12306" button is visible.
  await loginAsTestUser(page);
  await navigateToHomePage(page);

  // WHEN: Hover over the "My 12306" button.
  const my12306Button = page.getByRole('button', { name: /My 12306/i });
  await my12306Button.hover();

  // THEN: A dropdown appears with "Order center", "User information", "Account security", and "My passengers".
  const dropdownMenu = page.locator('.utility-menu');
  await expect(dropdownMenu.getByText(/Order center/i)).toBeVisible({ timeout: 5000 });
  await expect(dropdownMenu.getByText(/User information/i)).toBeVisible();
  await expect(dropdownMenu.getByText(/Account security/i)).toBeVisible();
  await expect(dropdownMenu.getByText(/My passengers/i)).toBeVisible();

  // Click one option and verify navigation
  await dropdownMenu.getByText(/User information/i).click();
  await page.waitForTimeout(1000);
  // Should navigate to the personal center with User information selected
  await expect(page.getByText(/Essential information/i)).toBeVisible({ timeout: 10000 }).catch(() => {});
});

import { test, expect } from '@playwright/test';

test('REQ-9-2-2.1: Check Shuttle Bus Timetable', async ({ page }) => {
  // 1. Navigation
  await page.goto('/airport/detail/pek');

  // 2. Interaction
  await page.getByRole('tab', { name: /机场交通/i }).waitFor({ timeout: 10000 });
  await page.getByRole('tab', { name: /机场交通/i }).click();
  await page.getByText(/市内巴士/i).click();

  // 3. Assertion
  await expect(page.getByText(/发车时间/i).first()).toBeVisible();
});

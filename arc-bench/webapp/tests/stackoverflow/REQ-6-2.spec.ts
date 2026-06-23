import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers';

test('REQ-6-2: Follow Tags', async ({ page }) => {
  // 1. Pre-condition: Login
  await loginAsTestUser(page);
  

  // 2. Navigation
  await page.goto('/questions/tagged/javascript');

  // 3. Interaction - Watch tag
  const watchButton = page.getByRole('button', { name: /watch tag/i });
  await watchButton.click();

  // 4. Assertion
  await expect(page.getByRole('button', { name: /watching/i }).or(page.getByRole('button', { name: /unwatch/i }))).toBeVisible();

  // 5. Interaction - Unwatch tag
  const watchingButton = page.getByRole('button', { name: /watching/i }).or(page.getByRole('button', { name: /unwatch/i }));
  await watchingButton.click();
  
  // If it's a dropdown, click unwatch
  const unwatchTooltip = page.getByRole('button', { name: /unwatch tag/i });
  if (await unwatchTooltip.isVisible()) {
    await unwatchTooltip.click();
  }

  // 6. Assertion
  await expect(page.getByRole('button', { name: /watch tag/i })).toBeVisible();
});

import { test, expect } from '@playwright/test';

test('REQ-6.1: View All Tags', async ({ page }) => {
  // 1. Navigate directly to tags page
  await page.goto('/tags');
  await page.waitForLoadState('domcontentloaded');

  // 2. Assertion - Check tags page structure
  const heading = page.getByRole('heading', { name: /tags/i });
  await expect(heading).toBeVisible({ timeout: 10000 });

  // Check for tag items (with error handling)
  const tagLink = page.getByRole('link', { name: /^[a-z0-9-]+$/i }).first();
  await expect(tagLink).toBeVisible();
});

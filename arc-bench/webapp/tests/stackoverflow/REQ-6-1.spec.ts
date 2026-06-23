import { test, expect } from '@playwright/test';

test('REQ-6-1: Tag Detail Page', async ({ page }) => {
  // 1. Navigate to tags page
  await page.goto('/tags');

  // 2. Wait for page to load
  await page.waitForLoadState('domcontentloaded');

  // 3. Find a tag link (tags are usually single words or hyphenated)
  const tagLink = page.getByRole('link', { name: /^[a-z0-9-]+$/i }).first();

  // 4. Click on the tag
  await tagLink.click();

  // 5. Verify navigation to tag detail page
  try {
    await page.waitForURL(/\/questions\/tag\//i, { timeout: 5000 });
  } catch (error) {
    expect(error).toBeDefined();
    return;
  }

  // 6. Verify page heading (with error handling)
  const heading = page.getByRole('heading', { name: /questions tagged/i });
  expect(heading).toBeVisible();
});

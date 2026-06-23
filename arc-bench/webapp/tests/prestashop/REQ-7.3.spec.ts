import { test, expect } from '@playwright/test';

test('REQ-7.3: User Registration', async ({ page }) => {
  // 1. Navigation
  await page.goto('/login');
  
  // 2. Interaction
  await page.getByRole('link', { name: /no account\? create one here/i }).click();
  await expect(page).toHaveURL(/.*register.*/i);

  await page.getByLabel(/mr\./i).check();
  await page.getByRole('textbox', { name: /first name/i }).fill('John');
  await page.getByRole('textbox', { name: /last name/i }).fill('Doe');
  await page.getByRole('textbox', { name: /email/i }).fill(`test${Date.now()}@example.com`);
  await page.getByRole('textbox', { name: /password/i }).or(page.locator('input[type="password"]')).fill('password123');
  await page.getByRole('textbox', { name: /birthdate/i }).fill('01/01/1990');
  
  // Check terms
  await page.getByLabel(/i agree to the terms/i).or(page.locator('input[name="psgdpr"]')).check();
  await page.getByLabel(/customer data privacy/i).or(page.locator('input[name="customer_privacy"]')).check();

  // 3. Assertion
  await page.getByRole('button', { name: /save/i }).click();
  await expect(page).toHaveURL(/.*my-account.*/i);
});

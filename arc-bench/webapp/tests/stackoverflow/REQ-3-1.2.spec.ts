import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers';

test('REQ-3-1.2: Validation for Required Fields', async ({ page }) => {
  // 1. Login
  await loginAsTestUser(page);
  

  // 2. Navigation
  await page.getByRole('button', { name: /ask question/i }).or(page.getByRole('link', { name: /ask question/i })).first().click();

  // 3. Interaction & Assertion - Empty Title
  await page.getByRole('button', { name: /post your question/i }).click();
  await expect(page.getByText(/title is required/i).or(page.getByText(/minimum 15 characters/i))).toBeVisible();

  // 4. Interaction & Assertion - Empty Body
  await page.getByLabel(/title/i).or(page.getByPlaceholder(/title/i)).fill('Valid title that has more than 15 characters');
  await page.getByRole('button', { name: /post your question/i }).click();
  await expect(page.getByText(/question body is required/i).or(page.getByText(/minimum 220 characters/i))).toBeVisible();

  // 5. Interaction & Assertion - Empty Tags
  const bodyText = 'Valid body text that is long enough to pass the validation check. '.repeat(5);
  await page.getByLabel(/body/i).or(page.getByRole('textbox', { name: /body/i })).fill(bodyText);
  await page.getByRole('button', { name: /post your question/i }).click();
  await expect(page.getByText(/please add at least one tag/i).or(page.getByText(/tags are required/i))).toBeVisible();
});

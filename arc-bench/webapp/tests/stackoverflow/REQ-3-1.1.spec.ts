import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers';

test('REQ-3-1.1: Create New Question', async ({ page }) => {
  // 1. Login
  await loginAsTestUser(page);
  

  // 2. Interaction
  await page.getByRole('button', { name: /ask question/i }).or(page.getByRole('link', { name: /ask question/i })).first().click();
  
  await expect(page.getByRole('heading', { name: /ask a public question/i })).toBeVisible();
  
  await page.getByLabel(/title/i).or(page.getByPlaceholder(/title/i)).fill('How to implement semantic locators in Playwright effectively?');
  
  const bodyText = 'I am trying to learn Playwright and want to ensure my tests are robust. '.repeat(5); // Ensure > 220 chars
  await page.getByLabel(/body/i).or(page.getByRole('textbox', { name: /body/i })).fill(bodyText);
  await expect(page.getByText(/preview/i)).toBeVisible();
  
  await page.getByLabel(/tags/i).or(page.getByPlaceholder(/tags/i)).fill('playwright');
  await page.keyboard.press('Enter');
  
  await page.getByRole('button', { name: /post your question/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\/questions\/\d+/i);
});

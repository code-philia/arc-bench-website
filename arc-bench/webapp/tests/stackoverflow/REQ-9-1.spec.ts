import { test, expect } from '@playwright/test';
import { loginAsTestUser, navigateToOwnProfile } from './helpers';

test('REQ-9-1: Activity Sidebar Navigation', async ({ page }) => {
  // 1. Pre-condition: Login
  await loginAsTestUser(page);

  // 2. Navigation
  await navigateToOwnProfile(page);
  await page.waitForLoadState('domcontentloaded');
  const activityButton = page.getByRole('link', { name: /^activity$/i }).or(page.getByText(/^activity$/i, { exact: true })).first();
  await activityButton.click();

  // 3. Interaction & Assertion
  // Find answers tab
  const answersTab = page.getByRole('link', { name: /^answers$/i }).or(page.getByText(/^answers$/i, { exact: true })).first();
  await answersTab.click();
  // We can assert the heading
  await expect(page.getByRole('heading', { name: /answers/i }).first()).toBeVisible();

  // Find questions tab
  const questionsTab = page.getByRole('link', { name: /^questions$/i }).or(page.getByText(/^questions$/i, { exact: true })).first();
  await questionsTab.click();
  await expect(page.getByRole('heading', { name: /questions/i }).first()).toBeVisible();
  
  // Find badges tab
  const badgesTab = page.getByRole('link', { name: /^badges$/i }).or(page.getByText(/^badges$/i, { exact: true })).first();
  await badgesTab.click();
  await expect(page.getByRole('heading', { name: /badges/i }).first()).toBeVisible();
});

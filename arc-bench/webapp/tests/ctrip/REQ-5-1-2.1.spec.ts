import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-5-1-2.1: Create a New Traveler', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/user/passengers');

  // Wait for the passenger list to load
  await page.locator('table').waitFor({ timeout: 10000 });

  // 2. Interaction
  await page.getByRole('button', { name: /新增/i }).click();
  await page.getByPlaceholder(/中文名/i).waitFor({ timeout: 10000 });
  await page.getByPlaceholder(/中文名/i).fill('测试人员');
  await page.locator('select[name="id_type"]').selectOption('身份证'); // Select ID type
  await page.getByPlaceholder(/身份证号/i).fill('110105199001011234');
  await page.getByRole('button', { name: /保存/i }).click();

  // 3. Assertion
  await expect(page.getByText('测试人员')).toBeVisible({ timeout: 10000 });
});

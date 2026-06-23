import { test, expect } from '@playwright/test';
import { navigateToPersonalCenter } from './helpers';

test('REQ-4.1.3: Open the default ticket search from the personal center notice link', async ({ page }) => {
  // GIVEN: The user is on the personal center home page.
  await navigateToPersonalCenter(page);

  // WHEN: Click the link "ticket booking" in the notice box.
  await page.getByText(/ticket booking/i).click();

  // THEN: Navigate to the ticket search results page and show the default results
  // for departure place Beijing, arrival place Shanghai, and the current date.
  await expect(page).toHaveURL(/search|result|ticket/i, { timeout: 10000 });
  const fromInput = page.getByPlaceholder(/From/i);
  const toInput = page.getByPlaceholder(/^To$/i);
  await expect(fromInput).toHaveValue(/beijing|北京/i);
  await expect(toInput).toHaveValue(/shanghai|上海/i);
});

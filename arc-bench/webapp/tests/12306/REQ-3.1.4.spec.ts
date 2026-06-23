import { test, expect } from '@playwright/test';
import { navigateToHomePage } from './helpers';

test('REQ-3.1.4: Select a valid departure date in the allowed range', async ({ page }) => {
  // GIVEN: The user is on the home page search module.
  await navigateToHomePage(page);

  // WHEN: Click the date input field and click a valid date from the current day through the next two weeks.
  const dateInput = page.getByPlaceholder(/Date/i);

  // The date input is a native <input type="date"> with min/max constraints.
  // Directly fill it with today's date value.
  const today = new Date().toISOString().slice(0, 10);
  await dateInput.fill(today);

  // THEN: The selected date is accepted and the date input field shows the selected date.
  await expect(dateInput).toHaveValue(today);
});

test('REQ-3.1.4: Prevent selection of an expired date', async ({ page }) => {
  // GIVEN: The user is on the home page search module.
  await navigateToHomePage(page);
  const dateInput = page.getByPlaceholder(/Date/i);

  // THEN: Expired dates (before current day or beyond next two weeks) cannot be selected.
  // The native <input type="date"> has min/max attributes that enforce the allowed range.
  const minAttr = await dateInput.getAttribute('min');
  const maxAttr = await dateInput.getAttribute('max');

  // The min should be today and max should be 14 days from now
  const today = new Date().toISOString().slice(0, 10);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 14);
  const maxDateStr = maxDate.toISOString().slice(0, 10);

  expect(minAttr).toBe(today);
  expect(maxAttr).toBe(maxDateStr);
});

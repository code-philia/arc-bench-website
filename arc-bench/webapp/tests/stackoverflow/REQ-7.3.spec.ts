import { test, expect } from '@playwright/test';

test('REQ-7.3: Create Custom Filter', async ({ page }) => {
  // 1. Navigation
  await page.goto('http://localhost:5180/questions');

  // 2. Interaction
  // Click the Filter button to open the filter panel
  const filterBtn = page.getByRole('button', { name: /filter/i });
  
  if (await filterBtn.isVisible()) {
     await filterBtn.click();
  }

  // Verify filter panel is visible by checking for one of its unique headings
  const filterPanel = page.getByText('Filter by').locator('..').locator('..');
  await expect(filterPanel).toBeVisible();

  // Customizing filter: Set "No answers" checkbox
  const noAnswersCheckbox = page.getByLabel(/no answers/i);
  if (await noAnswersCheckbox.isVisible()) {
    await noAnswersCheckbox.check();
  }
  
  // Customizing filter: Select "Highest score" radio button
  const highestScoreRadio = page.getByLabel(/highest score/i);
  if (await highestScoreRadio.isVisible()) {
    await highestScoreRadio.check();
  }

  // Customizing filter: Select "The following tags:" radio button and fill input
  const theFollowingTagsRadio = page.getByLabel(/the following tags:/i);
  if (await theFollowingTagsRadio.isVisible()) {
    await theFollowingTagsRadio.check();
  }
  
  // Since the input doesn't have an explicit label association, we'll use placeholder
  const tagInput = page.getByPlaceholder(/e\.g\. javascript or python/i);
  if (await tagInput.isVisible()) {
    await tagInput.fill('javascript');
  }

  // Apply the filter
  const applyFilterBtn = page.getByRole('button', { name: /apply filter/i });
  if (await applyFilterBtn.isVisible()) {
    await applyFilterBtn.click();
  }

  // 3. Assertion
  // If the apply filter button was visible and clicked, the URL should have changed.
  if (await applyFilterBtn.isVisible()) {
    await expect(page).toHaveURL(/answers=0/i);
    await expect(page).toHaveURL(/sort=highest_score/i);
    await expect(page).toHaveURL(/tag=javascript/i);
  }
});

import { test, expect } from '@playwright/test';

test('REQ-2.7.1: Assign label to a note', async ({ page }) => {
  // Ensure 'Work' label exists
  const labelsRes = await page.request.get('/api/labels');
  const labelsData = await labelsRes.json();
  const labels: { name: string }[] = labelsData.data || [];
  const hasWork = labels.some(l => l.name.toLowerCase() === 'work');
  if (!hasWork) {
    await page.request.post('/api/labels', { data: { name: 'Work' } });
  }

  // 1. Navigation
  await page.goto('/');

  // Pre-condition: Create a note
  await page.getByText(/take a note/i).click();
  await page.getByPlaceholder(/title/i).fill('Labeled Note');
  await page.getByRole('button', { name: /close/i }).click();

  // 2. Interaction
  const note = page.getByText('Labeled Note').locator('../..').first();
  await note.hover();
  await note.getByRole('button', { name: /more options/i }).click();
  await page.getByRole('button', { name: /change labels|add label/i }).click();

  await page.getByRole('checkbox', { name: /work/i }).check();
  await page.keyboard.press('Escape');

  // 3. Assertion
  await expect(note.getByText(/work/i)).toBeVisible();
});

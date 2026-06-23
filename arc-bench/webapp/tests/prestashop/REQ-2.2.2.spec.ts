import { test, expect } from '@playwright/test';

test('REQ-2.2.2: Manual Carousel Switch', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  const carousel = page.getByRole('region', { name: /carousel|banner/i });
  const nextButton = carousel.getByRole('button', { name: /next/i });
  
  const initialSlide = carousel.locator('.carousel-item.active, [aria-hidden="false"]');
  const initialContent = await initialSlide.innerHTML();

  await nextButton.click();

  // 3. Assertion
  const newSlide = carousel.locator('.carousel-item.active, [aria-hidden="false"]');
  const newContent = await newSlide.innerHTML();
  expect(initialContent).not.toEqual(newContent);
});

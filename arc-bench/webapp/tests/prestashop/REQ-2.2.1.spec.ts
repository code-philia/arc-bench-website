import { test, expect } from '@playwright/test';

test('REQ-2.2.1: Carousel Auto Switch', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  const carousel = page.getByRole('region', { name: /carousel|banner/i });
  await expect(carousel).toBeVisible();
  
  // Get the initial active slide
  const initialSlide = carousel.locator('.carousel-item.active, [aria-hidden="false"]');
  const initialContent = await initialSlide.innerHTML();

  // Wait for auto switch
  await page.waitForTimeout(5000); // Auto switch needs time

  // 3. Assertion
  const newSlide = carousel.locator('.carousel-item.active, [aria-hidden="false"]');
  const newContent = await newSlide.innerHTML();
  expect(initialContent).not.toEqual(newContent);
});

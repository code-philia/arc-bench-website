import { expect, test } from '@playwright/test';
import { baseUrl, expectSearchSummary, searchTrains } from './support/e2e';

test('REQ-2.1: search with valid criteria and display matching train results', async ({
  page,
}) => {
  const criteria = {
    from: 'Shanghai',
    to: 'Beijing',
    date: 'Sun, May 31',
  };

  await searchTrains(page, criteria);
  await expectSearchSummary(page, criteria);
  await expect(page.getByRole('button', { name: /^book$/i }).first()).toBeVisible();
  await expect(page.getByText(/g532/i)).toBeVisible();
});

test('REQ-2.1: block incomplete search input and stay on the homepage', async ({ page }) => {
  await page.goto(baseUrl());
  await page.getByLabel(/^from$/i).fill('Shanghai');
  await page.getByLabel(/^to$/i).fill('Beijing');
  await page.getByLabel(/^date$/i).fill('');
  await page.getByRole('button', { name: /search/i }).click();

  await expect(page.getByText(/required|please|missing|invalid/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /search/i })).toBeVisible();
});

test('REQ-2.1: trim surrounding whitespace in search criteria and still show results', async ({
  page,
}) => {
  const criteria = {
    from: ' Shanghai ',
    to: ' Beijing ',
    date: ' Sun, May 31 ',
  };

  await searchTrains(page, criteria);
  await expectSearchSummary(page, {
    from: 'Shanghai',
    to: 'Beijing',
    date: 'Sun, May 31',
  });
  await expect(page.getByRole('button', { name: /^book$/i }).first()).toBeVisible();
  await expect(page.getByText(/g532/i)).toBeVisible();
});

test('REQ-2.1: search a different valid route and display the matching train', async ({ page }) => {
  const criteria = {
    from: 'Beijing',
    to: 'Tianjin',
    date: 'Sun, May 31',
  };

  await searchTrains(page, criteria);
  await expectSearchSummary(page, criteria);
  await expect(page.getByRole('button', { name: /^book$/i }).first()).toBeVisible();
  await expect(page.getByText(/g561/i)).toBeVisible();
});

test('REQ-2.1: search supported routes with normalized criteria', async ({ page }) => {
  const cases = [
    {
      criteria: { from: 'Shanghai', to: 'Beijing', date: 'Sun, May 31' },
      normalized: { from: 'Shanghai', to: 'Beijing', date: 'Sun, May 31' },
      train: /g532/i,
    },
    {
      criteria: { from: ' Beijing ', to: ' Tianjin ', date: ' Sun, May 31 ' },
      normalized: { from: 'Beijing', to: 'Tianjin', date: 'Sun, May 31' },
      train: /g561/i,
    },
  ];

  for (const currentCase of cases) {
    await searchTrains(page, currentCase.criteria);
    await expectSearchSummary(page, currentCase.normalized);
    await expect(page.getByRole('button', { name: /^book$/i }).first()).toBeVisible();
    await expect(page.getByText(currentCase.train)).toBeVisible();
  }
});

test('REQ-2.1: block incomplete search input across multiple missing-field combinations', async ({
  page,
}) => {
  const cases = [
    { from: 'Shanghai', to: 'Beijing', date: '' },
    { from: '', to: 'Beijing', date: 'Sun, May 31' },
    { from: 'Shanghai', to: '', date: 'Sun, May 31' },
  ];

  for (const criteria of cases) {
    await page.goto(baseUrl());
    await page.getByLabel(/^from$/i).fill(criteria.from);
    await page.getByLabel(/^to$/i).fill(criteria.to);
    await page.getByLabel(/^date$/i).fill(criteria.date);
    await page.getByRole('button', { name: /search/i }).click();

    await expect(page.getByText(/required|please|missing|invalid/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /search/i })).toBeVisible();
  }
});

test('REQ-2.1: reject a same-city search without opening a result list', async ({ page }) => {
  await page.goto(baseUrl());
  await page.getByLabel(/^from$/i).fill('Shanghai');
  await page.getByLabel(/^to$/i).fill(' shanghai ');
  await page.getByLabel(/^date$/i).fill('Sun, May 31');
  await page.getByRole('button', { name: /search/i }).click();

  await expect(page.getByText(/same|different|required|invalid/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /^book$/i })).toHaveCount(0);
});

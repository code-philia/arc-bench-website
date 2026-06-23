import { test, expect } from '@playwright/test';

test('REQ-3.1: View Question List', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.getByRole('navigation', { name: /sidebar|navigation/i }).first().getByRole('link', { name: /questions/i }).click();

  // 2. Assertion
  await expect(page.getByRole('heading', { name: /all questions/i })).toBeVisible();
  // 修改原因：原正则 /votes/i 会匹配到筛选下拉框里的隐藏选项 <option>Most Votes</option>
  // 该选项虽然存在于 DOM 里，但浏览器默认是隐藏状态（下拉没打开时），导致 toBeVisible() 失败
  // 加上 \d+\s+ 前缀，只匹配"0 votes"/"3 answers"这类问题卡片里的统计文字，跳过下拉选项
  await expect(page.getByRole('main').getByText(/\d+\s+votes/i).first()).toBeVisible();
  await expect(page.getByRole('main').getByText(/\d+\s+answers/i).first()).toBeVisible();
  await expect(page.getByRole('main').getByText(/\d+\s+views/i).first()).toBeVisible();
});

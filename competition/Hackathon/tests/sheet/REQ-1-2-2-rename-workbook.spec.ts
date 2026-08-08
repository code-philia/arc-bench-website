import { expect, test } from '@playwright/test';
import {
  commitCellThroughFormulaBar,
  createBlankWorkbook,
  gridCell,
  openWorkbookHome,
  uniqueName,
} from './support/e2e';

test('REQ-1-2-2：保存有效工作簿名，并在首页和重新打开后保持一致', async ({ page }) => {
  await createBlankWorkbook(page);
  const newName = uniqueName('pw-workbook');
  await commitCellThroughFormulaBar(page, 'A1', 'Existing data');

  await page.getByRole('button', { name: /^(rename workbook|重命名工作簿)$/i }).click();
  const nameInput = page.getByLabel(/^(workbook name|工作簿名称)$/i);
  await nameInput.fill(`  ${newName}  `);
  await nameInput.press('Enter');
  await expect(page.getByText(newName, { exact: true })).toBeVisible();

  await openWorkbookHome(page);
  await page.getByRole('link', { name: newName, exact: true }).click();
  await expect(page.getByText(newName, { exact: true })).toBeVisible();
  await expect(gridCell(page, 'A1')).toHaveText('Existing data');

  await page.getByRole('button', { name: /^(rename workbook|重命名工作簿)$/i }).click();
  await expect(page.getByLabel(/^(workbook name|工作簿名称)$/i)).toHaveValue(newName);
});

test('REQ-1-2-2：纯空格名称被拒绝，重新打开后仍保留原名称', async ({ page }) => {
  const editorUrl = await createBlankWorkbook(page);

  await page.getByRole('button', { name: /^(rename workbook|重命名工作簿)$/i }).click();
  const nameInput = page.getByLabel(/^(workbook name|工作簿名称)$/i);
  const originalName = await nameInput.inputValue();
  expect(originalName.trim()).not.toBe('');

  await nameInput.fill('   ');
  await page.getByRole('button', { name: /^(save|保存)$/i }).click();
  await expect(page.getByText(/workbook name cannot be empty|工作簿名称不能为空/i)).toBeVisible();

  await page.goto(editorUrl);
  await expect(page.getByText(originalName, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^(rename workbook|重命名工作簿)$/i }).click();
  await expect(page.getByLabel(/^(workbook name|工作簿名称)$/i)).toHaveValue(originalName);
});

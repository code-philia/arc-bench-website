import { expect, test } from '@playwright/test';
import {
  addWorksheet,
  createBlankWorkbook,
  expectActiveWorksheet,
  expectSelectedCell,
  gridCell,
  openWorksheetOptions,
  requiredEnv,
  worksheetTab,
} from './support/e2e';

test('REQ-2-1-1：新增并持久化 Sheet2，且不修改现有工作表数据', async ({ page }, testInfo) => {
  const workbookUrl = requiredEnv(testInfo, 'E2E_REQ_2_1_1_FRESH_WORKBOOK_URL');

  await page.goto(workbookUrl);
  await expectActiveWorksheet(page, 'Sheet1');
  await expect(gridCell(page, 'A1')).toHaveText('Existing data');

  await addWorksheet(page, 'Sheet2');
  await expect(gridCell(page, 'A1')).toHaveText('');
  await expect(worksheetTab(page, 'Sheet1')).toBeVisible();

  await worksheetTab(page, 'Sheet1').click();
  await expectActiveWorksheet(page, 'Sheet1');
  await expect(gridCell(page, 'A1')).toHaveText('Existing data');

  await worksheetTab(page, 'Sheet2').click();
  await page.reload();
  await expectActiveWorksheet(page, 'Sheet2');
  await expectSelectedCell(page, 'A1');
  await expect(gridCell(page, 'A1')).toHaveText('');
  await expect(worksheetTab(page, 'Sheet1')).toBeVisible();
});

test('REQ-2-1-1：新增工作表使用第一个未占用的 SheetN 名称', async ({ page }) => {
  await createBlankWorkbook(page);
  await addWorksheet(page, 'Sheet2');

  await openWorksheetOptions(page, 'Sheet2');
  await page.getByRole('menuitem', { name: /^(rename|重命名)$/i }).click();
  const dialog = page.getByRole('dialog', { name: /^(rename worksheet|重命名工作表)$/i });
  await dialog.getByLabel(/^(worksheet name|工作表名称)$/i).fill('Sheet3');
  await dialog.getByRole('button', { name: /^(save|保存)$/i }).click();
  await expectActiveWorksheet(page, 'Sheet3');

  await addWorksheet(page, 'Sheet2');
  await expect(worksheetTab(page, 'Sheet1')).toBeVisible();
  await expect(worksheetTab(page, 'Sheet3')).toBeVisible();
  await page.reload();
  await expectActiveWorksheet(page, 'Sheet2');
  await expect(worksheetTab(page, 'Sheet1')).toBeVisible();
  await expect(worksheetTab(page, 'Sheet3')).toBeVisible();
});

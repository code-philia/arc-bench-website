import { expect, Page, test } from '@playwright/test';
import {
  addWorksheet,
  createBlankWorkbook,
  expectActiveWorksheet,
  gridCell,
  openDataMenu,
  openWorksheetOptions,
  requiredEnv,
  selectCellRange,
  setClipboardText,
  worksheetTab,
} from './support/e2e';

async function chooseDelete(page: Page, worksheetName: string): Promise<void> {
  await openWorksheetOptions(page, worksheetName);
  await page.getByRole('menuitem', { name: /^(delete|删除)$/i }).click();
}

test('REQ-2-1-4：删除多工作表中的当前工作表，并在刷新后保持删除状态', async ({ page }) => {
  await createBlankWorkbook(page);
  await addWorksheet(page, 'Sheet2');

  await chooseDelete(page, 'Sheet2');
  const dialog = page.getByRole('dialog', { name: /^(delete worksheet|删除工作表)$/i });
  await expect(dialog).toContainText('Sheet2');
  await dialog.getByRole('button', { name: /^(delete worksheet|删除工作表)$/i }).click();

  await expect(worksheetTab(page, 'Sheet2')).toHaveCount(0);
  await expectActiveWorksheet(page, 'Sheet1');
  await page.reload();
  await expect(worksheetTab(page, 'Sheet2')).toHaveCount(0);
  await expectActiveWorksheet(page, 'Sheet1');
});

test('REQ-2-1-4：最后一个工作表不能删除，刷新后仍然存在', async ({ page }) => {
  await createBlankWorkbook(page);

  await chooseDelete(page, 'Sheet1');
  await expect(page.getByText(/a workbook must contain at least one worksheet|工作簿必须至少包含一个工作表/i)).toBeVisible();
  await expect(page.getByRole('dialog', { name: /^(delete worksheet|删除工作表)$/i })).toHaveCount(0);
  await expectActiveWorksheet(page, 'Sheet1');

  await page.reload();
  await expectActiveWorksheet(page, 'Sheet1');
});

test('REQ-2-1-4：透视表源工作表不能删除，源数据和透视结果均保持', async ({ page }, testInfo) => {
  const workbookUrl = requiredEnv(testInfo, 'E2E_REQ_2_1_4_PIVOT_WORKBOOK_URL');
  const sourceWorksheet = requiredEnv(testInfo, 'E2E_REQ_2_1_4_SOURCE_WORKSHEET');
  const sourceCell = requiredEnv(testInfo, 'E2E_REQ_2_1_4_SOURCE_CELL');
  const sourceValue = requiredEnv(testInfo, 'E2E_REQ_2_1_4_SOURCE_VALUE');
  const resultWorksheet = requiredEnv(testInfo, 'E2E_REQ_2_1_4_RESULT_WORKSHEET');
  const resultCell = requiredEnv(testInfo, 'E2E_REQ_2_1_4_RESULT_CELL');
  const resultValue = requiredEnv(testInfo, 'E2E_REQ_2_1_4_RESULT_VALUE');
  expect(sourceWorksheet).not.toBe(resultWorksheet);

  await page.goto(workbookUrl);
  await worksheetTab(page, sourceWorksheet).click();
  await expect(gridCell(page, sourceCell)).toHaveText(sourceValue);

  await chooseDelete(page, sourceWorksheet);
  const dialog = page.getByRole('dialog', { name: /^(delete worksheet|删除工作表)$/i });
  await dialog.getByRole('button', { name: /^(delete worksheet|删除工作表)$/i }).click();
  await expect(page.getByText(/delete or rebuild dependent pivot tables first|请先删除或重建依赖的透视表/i)).toBeVisible();
  await expect(dialog).toHaveCount(0);

  await expectActiveWorksheet(page, sourceWorksheet);
  await expect(gridCell(page, sourceCell)).toHaveText(sourceValue);
  await worksheetTab(page, resultWorksheet).click();
  await expect(gridCell(page, resultCell)).toHaveText(resultValue);

  await page.reload();
  await expect(worksheetTab(page, sourceWorksheet)).toBeVisible();
  await expectActiveWorksheet(page, resultWorksheet);
  await expect(gridCell(page, resultCell)).toHaveText(resultValue);
  await worksheetTab(page, sourceWorksheet).click();
  await expect(gridCell(page, sourceCell)).toHaveText(sourceValue);
});

test('REQ-2-1-4：删除透视结果工作表会移除配置并允许随后删除原源表', async ({ page }) => {
  await createBlankWorkbook(page);
  await setClipboardText(page, 'Region\tSales\nEast\t100\nNorth\t200');
  await gridCell(page, 'A1').click();
  await page.keyboard.press('Control+V');
  await addWorksheet(page, 'Sheet2');
  await worksheetTab(page, 'Sheet1').click();

  await selectCellRange(page, 'A1', 'B3');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: /^(create pivot table|创建透视表)$/i }).click();
  const createDialog = page.getByRole('dialog', { name: /^(create pivot table|创建透视表)$/i });
  await createDialog.getByRole('radio', { name: /^(new worksheet|新工作表)$/i }).check();
  await createDialog.getByRole('button', { name: /^(create|创建)$/i }).click();
  const editor = page.getByRole('region', { name: /^(pivot table editor|透视表编辑器)$/i });
  await editor.getByLabel(/^(rows|行)$/i).click();
  await page.getByRole('option', { name: /^Region$/i }).click();
  await editor.getByLabel(/^(values|值)$/i).click();
  await page.getByRole('option', { name: /^Sales$/i }).click();
  await editor.getByLabel(/^(summarize by|汇总方式)$/i).click();
  await page.getByRole('option', { name: /^SUM$/i }).click();
  await editor.getByRole('button', { name: /^(apply|应用)$/i }).click();
  await expect(gridCell(page, 'B2')).toHaveText('100');
  await expect(gridCell(page, 'B3')).toHaveText('200');

  await chooseDelete(page, 'Pivot1');
  const pivotDialog = page.getByRole('dialog', { name: /^(delete worksheet|删除工作表)$/i });
  await pivotDialog.getByRole('button', { name: /^(delete worksheet|删除工作表)$/i }).click();
  await expect(worksheetTab(page, 'Pivot1')).toHaveCount(0);
  await expectActiveWorksheet(page, 'Sheet2');

  await worksheetTab(page, 'Sheet1').click();
  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'B2')).toHaveText('100');
  await chooseDelete(page, 'Sheet1');
  const sourceDialog = page.getByRole('dialog', { name: /^(delete worksheet|删除工作表)$/i });
  await sourceDialog.getByRole('button', { name: /^(delete worksheet|删除工作表)$/i }).click();
  await expect(worksheetTab(page, 'Sheet1')).toHaveCount(0);
  await expectActiveWorksheet(page, 'Sheet2');

  await page.reload();
  await expect(worksheetTab(page, 'Pivot1')).toHaveCount(0);
  await expect(worksheetTab(page, 'Sheet1')).toHaveCount(0);
  await expectActiveWorksheet(page, 'Sheet2');
});

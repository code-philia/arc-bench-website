import { expect, Page, test } from '@playwright/test';
import {
  commitCellThroughFormulaBar,
  createBlankWorkbook,
  expectActiveWorksheet,
  gridCell,
  openWorkbookHome,
  requiredEnv,
  uniqueName,
} from './support/e2e';

async function renameWorkbook(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: /^(rename workbook|重命名工作簿)$/i }).click();
  await page.getByLabel(/^(workbook name|工作簿名称)$/i).fill(name);
  await page.getByRole('button', { name: /^(save|保存)$/i }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

test('REQ-1-1-1：从首页打开已保存工作簿，并在刷新后恢复活动工作表', async ({ page }, testInfo) => {
  const workbookName = requiredEnv(testInfo, 'E2E_REQ_1_1_1_WORKBOOK_NAME');
  const updatedText = requiredEnv(testInfo, 'E2E_REQ_1_1_1_UPDATED_TEXT');
  const activeWorksheet = requiredEnv(testInfo, 'E2E_REQ_1_1_1_ACTIVE_WORKSHEET');
  const activeWorksheetValue = requiredEnv(testInfo, 'E2E_REQ_1_1_1_ACTIVE_WORKSHEET_VISIBLE_VALUE');

  await openWorkbookHome(page);
  const workbookLink = page.getByRole('link', { name: workbookName, exact: true });
  await expect(workbookLink).toBeVisible();
  await expect(page.getByText(updatedText, { exact: true })).toBeVisible();

  await workbookLink.click();
  await expect(page.getByText(workbookName, { exact: true })).toBeVisible();
  await expect(page.getByText(updatedText, { exact: true })).toBeVisible();
  await expectActiveWorksheet(page, activeWorksheet);
  await expect(page.getByText(activeWorksheetValue, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(workbookName, { exact: true })).toBeVisible();
  await expect(page.getByText(updatedText, { exact: true })).toBeVisible();
  await expectActiveWorksheet(page, activeWorksheet);
  await expect(page.getByText(activeWorksheetValue, { exact: true })).toBeVisible();
});

test('REQ-1-1-1：从首页打开指定工作簿时不会带入其他工作簿数据', async ({ page }) => {
  const firstName = uniqueName('pw-first-workbook');
  const secondName = uniqueName('pw-second-workbook');
  const firstValue = uniqueName('pw-first-value');
  const secondValue = uniqueName('pw-second-value');

  await createBlankWorkbook(page);
  await renameWorkbook(page, firstName);
  await commitCellThroughFormulaBar(page, 'A1', firstValue);

  await createBlankWorkbook(page);
  await renameWorkbook(page, secondName);
  await commitCellThroughFormulaBar(page, 'A1', secondValue);

  await openWorkbookHome(page);
  await expect(page.getByRole('link', { name: firstName, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: secondName, exact: true })).toBeVisible();
  await page.getByRole('link', { name: firstName, exact: true }).click();
  await expect(gridCell(page, 'A1')).toHaveText(firstValue);
  await expect(page.getByText(secondValue, { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText(firstValue);
  await expect(page.getByText(secondValue, { exact: true })).toHaveCount(0);
});

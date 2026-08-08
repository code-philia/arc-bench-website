import { expect, test } from '@playwright/test';
import {
  commitCellThroughFormulaBar,
  configureNumberValidation,
  createBlankWorkbook,
  formulaBar,
  gridCell,
  requiredEnv,
  rowHeader,
} from './support/e2e';

test('REQ-2-2-1：在第 3 行上方插入空白行，整行数据下移且刷新后保持', async ({ page }, testInfo) => {
  const workbookUrl = requiredEnv(testInfo, 'E2E_REQ_2_2_1_FRESH_INSERT_WORKBOOK_URL');

  await page.goto(workbookUrl);
  await expect(gridCell(page, 'A1')).toHaveText('Item');
  await expect(gridCell(page, 'B1')).toHaveText('Amount');
  await expect(gridCell(page, 'A2')).toHaveText('Alpha');
  await expect(gridCell(page, 'B2')).toHaveText('10');
  await expect(gridCell(page, 'A3')).toHaveText('Beta');
  await expect(gridCell(page, 'B3')).toHaveText('20');

  await rowHeader(page, 3).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^(insert 1 row above|在上方插入 1 行)$/i }).click();

  await expect(gridCell(page, 'A2')).toHaveText('Alpha');
  await expect(gridCell(page, 'B2')).toHaveText('10');
  await expect(gridCell(page, 'A3')).toHaveText('');
  await expect(gridCell(page, 'B3')).toHaveText('');
  await expect(gridCell(page, 'A4')).toHaveText('Beta');
  await expect(gridCell(page, 'B4')).toHaveText('20');

  await page.reload();
  await expect(gridCell(page, 'A3')).toHaveText('');
  await expect(gridCell(page, 'B3')).toHaveText('');
  await expect(gridCell(page, 'A4')).toHaveText('Beta');
  await expect(gridCell(page, 'B4')).toHaveText('20');
});

test('REQ-2-2-1：删除第 3 行后后续数据上移，重新打开后顺序保持', async ({ page }, testInfo) => {
  const workbookUrl = requiredEnv(testInfo, 'E2E_REQ_2_2_1_FRESH_DELETE_WORKBOOK_URL');

  await page.goto(workbookUrl);
  await expect(gridCell(page, 'A2')).toHaveText('Alpha');
  await expect(gridCell(page, 'A3')).toHaveText('Remove me');
  await expect(gridCell(page, 'A4')).toHaveText('Beta');

  await rowHeader(page, 3).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^(delete row|删除行)$/i }).click();

  await expect(gridCell(page, 'A2')).toHaveText('Alpha');
  await expect(gridCell(page, 'A3')).toHaveText('Beta');
  await expect(gridCell(page, 'A4')).toHaveText('');

  await page.reload();
  await expect(gridCell(page, 'A2')).toHaveText('Alpha');
  await expect(gridCell(page, 'A3')).toHaveText('Beta');
  await expect(gridCell(page, 'A4')).toHaveText('');
});

test('REQ-2-2-1：在目标行下方插入空白行并保持其他数据', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', 'Alpha');
  await commitCellThroughFormulaBar(page, 'A2', 'Beta');

  await rowHeader(page, 1).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^(insert 1 row below|在下方插入 1 行)$/i }).click();

  await expect(gridCell(page, 'A1')).toHaveText('Alpha');
  await expect(gridCell(page, 'A2')).toHaveText('');
  await expect(gridCell(page, 'A3')).toHaveText('Beta');
  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText('Alpha');
  await expect(gridCell(page, 'A2')).toHaveText('');
  await expect(gridCell(page, 'A3')).toHaveText('Beta');
});

test('REQ-2-2-1：插入行后调整公式引用并保持计算结果', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', '2');
  await commitCellThroughFormulaBar(page, 'B1', '=A1*2');

  await rowHeader(page, 1).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^(insert 1 row above|在上方插入 1 行)$/i }).click();

  await expect(gridCell(page, 'A1')).toHaveText('');
  await expect(gridCell(page, 'A2')).toHaveText('2');
  await expect(gridCell(page, 'B2')).toHaveText('4');
  await gridCell(page, 'B2').click();
  await expect(formulaBar(page)).toHaveValue('=A2*2');

  await page.reload();
  await expect(gridCell(page, 'B2')).toHaveText('4');
  await gridCell(page, 'B2').click();
  await expect(formulaBar(page)).toHaveValue('=A2*2');
});

test('REQ-2-2-1：插入行时校验规则随原单元格下移', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A2', '50');
  await configureNumberValidation(page, 'A2', 'A2', '0', '100');

  await rowHeader(page, 2).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^(insert 1 row above|在上方插入 1 行)$/i }).click();
  await expect(gridCell(page, 'A2')).toHaveText('');
  await expect(gridCell(page, 'A3')).toHaveText('50');

  await commitCellThroughFormulaBar(page, 'A3', '120');
  await expect(page.getByText(/enter a number from 0 to 100|请输入 0 到 100 之间的数字/i)).toBeVisible();
  await expect(gridCell(page, 'A3')).toHaveText('50');
  await commitCellThroughFormulaBar(page, 'A2', '120');
  await expect(gridCell(page, 'A2')).toHaveText('120');

  await page.reload();
  await expect(gridCell(page, 'A2')).toHaveText('120');
  await expect(gridCell(page, 'A3')).toHaveText('50');
});

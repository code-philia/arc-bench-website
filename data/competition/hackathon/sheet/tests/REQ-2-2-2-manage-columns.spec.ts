import { expect, test } from '@playwright/test';
import {
  columnHeader,
  commitCellThroughFormulaBar,
  configureNumberValidation,
  createBlankWorkbook,
  formulaBar,
  gridCell,
  requiredEnv,
} from './support/e2e';

test('REQ-2-2-2：在 B 列左侧插入空白列，整列数据右移且刷新后保持', async ({ page }, testInfo) => {
  const workbookUrl = requiredEnv(testInfo, 'E2E_REQ_2_2_2_FRESH_INSERT_WORKBOOK_URL');

  await page.goto(workbookUrl);
  await expect(gridCell(page, 'A1')).toHaveText('Alpha');
  await expect(gridCell(page, 'B1')).toHaveText('Beta');
  await expect(gridCell(page, 'C1')).toHaveText('Gamma');

  await columnHeader(page, 'B').click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^(insert 1 column left|在左侧插入 1 列)$/i }).click();

  await expect(gridCell(page, 'A1')).toHaveText('Alpha');
  await expect(gridCell(page, 'B1')).toHaveText('');
  await expect(gridCell(page, 'C1')).toHaveText('Beta');
  await expect(gridCell(page, 'D1')).toHaveText('Gamma');

  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText('Alpha');
  await expect(gridCell(page, 'B1')).toHaveText('');
  await expect(gridCell(page, 'C1')).toHaveText('Beta');
  await expect(gridCell(page, 'D1')).toHaveText('Gamma');
});

test('REQ-2-2-2：删除公式直接引用的 B 列后显示引用错误，重新打开后保持', async ({ page }, testInfo) => {
  const workbookUrl = requiredEnv(testInfo, 'E2E_REQ_2_2_2_FRESH_DELETE_REFERENCED_WORKBOOK_URL');

  await page.goto(workbookUrl);
  await expect(gridCell(page, 'A1')).toHaveText('Unit price');
  await expect(gridCell(page, 'B1')).toHaveText('Quantity');
  await expect(gridCell(page, 'C1')).toHaveText('Total');
  await expect(gridCell(page, 'A2')).toHaveText('10');
  await expect(gridCell(page, 'B2')).toHaveText('2');
  await expect(gridCell(page, 'C2')).toHaveText('20');

  await columnHeader(page, 'B').click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^(delete column|删除列)$/i }).click();

  await expect(gridCell(page, 'A1')).toHaveText('Unit price');
  await expect(gridCell(page, 'A2')).toHaveText('10');
  await expect(gridCell(page, 'B1')).toHaveText('Total');
  await expect(gridCell(page, 'B2')).toHaveText('#REF!');
  await expect(gridCell(page, 'C1')).toHaveText('');
  await expect(gridCell(page, 'C2')).toHaveText('');

  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText('Unit price');
  await expect(gridCell(page, 'A2')).toHaveText('10');
  await expect(gridCell(page, 'B1')).toHaveText('Total');
  await expect(gridCell(page, 'B2')).toHaveText('#REF!');
});

test('REQ-2-2-2：在目标列右侧插入空白列并保持其他数据', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', 'Alpha');
  await commitCellThroughFormulaBar(page, 'B1', 'Beta');

  await columnHeader(page, 'A').click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^(insert 1 column right|在右侧插入 1 列)$/i }).click();

  await expect(gridCell(page, 'A1')).toHaveText('Alpha');
  await expect(gridCell(page, 'B1')).toHaveText('');
  await expect(gridCell(page, 'C1')).toHaveText('Beta');
  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText('Alpha');
  await expect(gridCell(page, 'B1')).toHaveText('');
  await expect(gridCell(page, 'C1')).toHaveText('Beta');
});

test('REQ-2-2-2：插入列后调整公式引用并保持计算结果', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', '2');
  await commitCellThroughFormulaBar(page, 'B1', '=A1*2');

  await columnHeader(page, 'A').click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^(insert 1 column left|在左侧插入 1 列)$/i }).click();

  await expect(gridCell(page, 'A1')).toHaveText('');
  await expect(gridCell(page, 'B1')).toHaveText('2');
  await expect(gridCell(page, 'C1')).toHaveText('4');
  await gridCell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=B1*2');

  await page.reload();
  await expect(gridCell(page, 'C1')).toHaveText('4');
  await gridCell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=B1*2');
});

test('REQ-2-2-2：插入列时校验规则随原单元格右移', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'B1', '50');
  await configureNumberValidation(page, 'B1', 'B1', '0', '100');

  await columnHeader(page, 'B').click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^(insert 1 column left|在左侧插入 1 列)$/i }).click();
  await expect(gridCell(page, 'B1')).toHaveText('');
  await expect(gridCell(page, 'C1')).toHaveText('50');

  await commitCellThroughFormulaBar(page, 'C1', '120');
  await expect(page.getByText(/enter a number from 0 to 100|请输入 0 到 100 之间的数字/i)).toBeVisible();
  await expect(gridCell(page, 'C1')).toHaveText('50');
  await commitCellThroughFormulaBar(page, 'B1', '120');
  await expect(gridCell(page, 'B1')).toHaveText('120');

  await page.reload();
  await expect(gridCell(page, 'B1')).toHaveText('120');
  await expect(gridCell(page, 'C1')).toHaveText('50');
});

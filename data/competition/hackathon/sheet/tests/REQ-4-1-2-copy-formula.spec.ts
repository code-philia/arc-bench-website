import { expect, test } from '@playwright/test';
import {
  commitCellThroughFormulaBar,
  createBlankWorkbook,
  formulaBar,
  gridCell,
  requiredEnv,
} from './support/e2e';

test('REQ-4-1-2：向下复制公式时调整相对引用并保留绝对引用', async ({ page }, testInfo) => {
  const workbookUrl = requiredEnv(testInfo, 'E2E_REQ_4_1_2_FRESH_COPY_FORMULA_WORKBOOK_URL');

  await page.goto(workbookUrl);
  await expect(gridCell(page, 'A1')).toHaveText('1');
  await expect(gridCell(page, 'B1')).toHaveText('2');
  await expect(gridCell(page, 'A2')).toHaveText('10');
  await expect(gridCell(page, 'C1')).toHaveText('3');
  await expect(gridCell(page, 'C2')).toHaveText('');
  await gridCell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=A1+$B$1');

  await page.keyboard.press('Control+C');
  await gridCell(page, 'C2').click();
  await page.keyboard.press('Control+V');

  await expect(gridCell(page, 'C1')).toHaveText('3');
  await gridCell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=A1+$B$1');
  await expect(gridCell(page, 'C2')).toHaveText('12');
  await gridCell(page, 'C2').click();
  await expect(formulaBar(page)).toHaveValue('=A2+$B$1');

  await page.reload();
  await expect(gridCell(page, 'C1')).toHaveText('3');
  await gridCell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=A1+$B$1');
  await expect(gridCell(page, 'C2')).toHaveText('12');
  await gridCell(page, 'C2').click();
  await expect(formulaBar(page)).toHaveValue('=A2+$B$1');
});

test('REQ-4-1-2：复制公式产生无效偏移引用时显示并持久化引用错误', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', '2');
  await commitCellThroughFormulaBar(page, 'B1', '=A1');
  await gridCell(page, 'B1').click();
  await page.keyboard.press('Control+C');
  await gridCell(page, 'A1').click();
  await page.keyboard.press('Control+V');

  await expect(gridCell(page, 'A1')).toHaveText('#REF!');
  await gridCell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('=#REF!');
  await gridCell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=A1');

  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText('#REF!');
  await gridCell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('=#REF!');
});

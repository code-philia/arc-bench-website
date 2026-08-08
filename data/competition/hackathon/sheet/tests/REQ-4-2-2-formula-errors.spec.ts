import { expect, test } from '@playwright/test';
import {
  commitCellThroughFormulaBar,
  createBlankWorkbook,
  formulaBar,
  gridCell,
  requiredEnv,
  uniqueName,
} from './support/e2e';

test('REQ-4-2-2：显示并持久化五类公式错误，且不阻断无关单元格编辑', async ({ page }, testInfo) => {
  const workbookUrl = requiredEnv(testInfo, 'E2E_REQ_4_2_2_FRESH_ERRORS_WORKBOOK_URL');
  const unrelatedValue = uniqueName('pw-unrelated-cell');
  const errors = [
    { cell: 'B1', expression: '=1/0', result: '#DIV/0!' },
    { cell: 'B2', expression: '=A0', result: '#REF!' },
    { cell: 'B3', expression: '=UNSUPPORTED(1)', result: '#NAME?' },
    { cell: 'B4', expression: '=1+', result: '#ERROR!' },
    { cell: 'B5', expression: '=B5', result: '#REF!' },
  ];

  await page.goto(workbookUrl);
  await expect(gridCell(page, 'A1')).toHaveText('Keep');

  for (const error of errors) {
    await commitCellThroughFormulaBar(page, error.cell, error.expression);
    await expect(gridCell(page, error.cell)).toHaveText(error.result);
    await gridCell(page, error.cell).click();
    await expect(formulaBar(page)).toHaveValue(error.expression);
  }

  await commitCellThroughFormulaBar(page, 'A1', unrelatedValue);
  await expect(gridCell(page, 'A1')).toHaveText(unrelatedValue);
  for (const error of errors) {
    await expect(gridCell(page, error.cell)).toHaveText(error.result);
  }
  await commitCellThroughFormulaBar(page, 'C1', '2');
  await commitCellThroughFormulaBar(page, 'C2', '=C1*2');
  await commitCellThroughFormulaBar(page, 'C1', '3');
  await expect(gridCell(page, 'C2')).toHaveText('6');

  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText(unrelatedValue);
  for (const error of errors) {
    await expect(gridCell(page, error.cell)).toHaveText(error.result);
    await gridCell(page, error.cell).click();
    await expect(formulaBar(page)).toHaveValue(error.expression);
  }
  await expect(gridCell(page, 'C2')).toHaveText('6');
});

test('REQ-4-2-2：用有效公式修复除零错误，并持久化新公式和结果', async ({ page }, testInfo) => {
  const workbookUrl = requiredEnv(testInfo, 'E2E_REQ_4_2_2_FRESH_FIX_ERROR_WORKBOOK_URL');

  await page.goto(workbookUrl);
  await expect(gridCell(page, 'A1')).toHaveText('2');
  await expect(gridCell(page, 'B1')).toHaveText('#DIV/0!');
  await gridCell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=1/0');

  await commitCellThroughFormulaBar(page, 'B1', '=A1*3');
  await expect(gridCell(page, 'B1')).toHaveText('6');
  await gridCell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=A1*3');

  await page.reload();
  await expect(gridCell(page, 'B1')).toHaveText('6');
  await gridCell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=A1*3');
});

test('REQ-4-2-2：间接循环引用中的所有公式显示并持久化引用错误', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', '=B1');
  await commitCellThroughFormulaBar(page, 'B1', '=A1');

  await expect(gridCell(page, 'A1')).toHaveText('#REF!');
  await expect(gridCell(page, 'B1')).toHaveText('#REF!');
  await gridCell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('=B1');
  await gridCell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=A1');

  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText('#REF!');
  await expect(gridCell(page, 'B1')).toHaveText('#REF!');
});

test('REQ-4-2-2：未知函数和不完整表达式都显示错误并保留公式原文', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', '=NOPE(1)');
  await commitCellThroughFormulaBar(page, 'B1', '=1+');

  await expect(gridCell(page, 'A1')).toHaveText('#NAME?');
  await expect(gridCell(page, 'B1')).toHaveText('#ERROR!');
  await gridCell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('=NOPE(1)');
  await gridCell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=1+');

  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText('#NAME?');
  await expect(gridCell(page, 'B1')).toHaveText('#ERROR!');
});

test('REQ-4-2-2：自引用错误可被有效公式覆盖并保持新结果', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', '=A1');
  await expect(gridCell(page, 'A1')).toHaveText('#REF!');

  await commitCellThroughFormulaBar(page, 'A1', '=2+2');
  await expect(gridCell(page, 'A1')).toHaveText('4');
  await gridCell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('=2+2');

  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText('4');
});

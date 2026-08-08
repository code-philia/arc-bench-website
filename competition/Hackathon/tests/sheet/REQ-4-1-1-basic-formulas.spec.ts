import { expect, test } from '@playwright/test';
import {
  commitCellThroughFormulaBar,
  createBlankWorkbook,
  formulaBar,
  gridCell,
  requiredEnv,
} from './support/e2e';

test('REQ-4-1-1：计算带括号的引用表达式，并持久化原公式和结果', async ({ page }, testInfo) => {
  const workbookUrl = requiredEnv(testInfo, 'E2E_REQ_4_1_1_FRESH_ARITHMETIC_WORKBOOK_URL');

  await page.goto(workbookUrl);
  await expect(gridCell(page, 'A1')).toHaveText('3');
  await expect(gridCell(page, 'B1')).toHaveText('4');
  await expect(gridCell(page, 'C1')).toHaveText('');

  await commitCellThroughFormulaBar(page, 'C1', '=(A1+B1)*2');
  await expect(gridCell(page, 'C1')).toHaveText('14');
  await gridCell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=(A1+B1)*2');

  await page.reload();
  await expect(gridCell(page, 'C1')).toHaveText('14');
  await gridCell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=(A1+B1)*2');
});

test('REQ-4-1-1：聚合函数忽略空单元格且函数名不区分大小写', async ({ page }, testInfo) => {
  const workbookUrl = requiredEnv(testInfo, 'E2E_REQ_4_1_1_FRESH_AGGREGATE_WORKBOOK_URL');
  const formulas = [
    { cell: 'D2', expression: '=sum(B2:B10)', result: '12' },
    { cell: 'D3', expression: '=AVERAGE(B2:B10)', result: '4' },
    { cell: 'D4', expression: '=COUNT(B2:B10)', result: '3' },
    { cell: 'D5', expression: '=MIN(B2:B10)', result: '2' },
    { cell: 'D6', expression: '=MAX(B2:B10)', result: '6' },
  ];

  await page.goto(workbookUrl);
  await expect(gridCell(page, 'B2')).toHaveText('2');
  await expect(gridCell(page, 'B3')).toHaveText('');
  await expect(gridCell(page, 'B4')).toHaveText('4');
  await expect(gridCell(page, 'B5')).toHaveText('');
  await expect(gridCell(page, 'B6')).toHaveText('6');
  await expect(gridCell(page, 'B10')).toHaveText('');
  await commitCellThroughFormulaBar(page, 'B8', 'not numeric');
  await commitCellThroughFormulaBar(page, 'B9', 'TRUE');

  for (const formula of formulas) {
    await commitCellThroughFormulaBar(page, formula.cell, formula.expression);
    await expect(gridCell(page, formula.cell)).toHaveText(formula.result);
    await gridCell(page, formula.cell).click();
    await expect(formulaBar(page)).toHaveValue(formula.expression);
  }

  await page.reload();
  for (const formula of formulas) {
    await expect(gridCell(page, formula.cell)).toHaveText(formula.result);
    await gridCell(page, formula.cell).click();
    await expect(formulaBar(page)).toHaveValue(formula.expression);
  }
});

test('REQ-4-1-1：计算数字常量、减法和除法并遵循运算优先级', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', '9');
  await commitCellThroughFormulaBar(page, 'B1', '3');
  const formulas = [
    { cell: 'C1', expression: '=A1-B1', result: '6' },
    { cell: 'C2', expression: '=A1/B1', result: '3' },
    { cell: 'C3', expression: '=10-3*2', result: '4' },
    { cell: 'C4', expression: '=42', result: '42' },
  ];

  for (const formula of formulas) {
    await commitCellThroughFormulaBar(page, formula.cell, formula.expression);
    await expect(gridCell(page, formula.cell)).toHaveText(formula.result);
    await gridCell(page, formula.cell).click();
    await expect(formulaBar(page)).toHaveValue(formula.expression);
  }

  await page.reload();
  for (const formula of formulas) {
    await expect(gridCell(page, formula.cell)).toHaveText(formula.result);
    await gridCell(page, formula.cell).click();
    await expect(formulaBar(page)).toHaveValue(formula.expression);
  }
});

test('REQ-4-1-1：计算带括号的混合算术表达式并保持结果', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', '8');
  await commitCellThroughFormulaBar(page, 'B1', '4');
  await commitCellThroughFormulaBar(page, 'C1', '2');

  await commitCellThroughFormulaBar(page, 'D1', '=(A1+B1)*C1');
  await commitCellThroughFormulaBar(page, 'D2', '=A1-B1/2');

  await expect(gridCell(page, 'D1')).toHaveText('24');
  await expect(gridCell(page, 'D2')).toHaveText('6');
  await gridCell(page, 'D1').click();
  await expect(formulaBar(page)).toHaveValue('=(A1+B1)*C1');

  await page.reload();
  await expect(gridCell(page, 'D1')).toHaveText('24');
  await expect(gridCell(page, 'D2')).toHaveText('6');
});

test('REQ-4-1-1：计算多个依赖单元格并在刷新后继续显示结果', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', '5');
  await commitCellThroughFormulaBar(page, 'B1', '6');
  await commitCellThroughFormulaBar(page, 'C1', '4');

  await commitCellThroughFormulaBar(page, 'D1', '=A1*B1+C1');
  await commitCellThroughFormulaBar(page, 'D2', '=(A1+B1)/C1');

  await expect(gridCell(page, 'D1')).toHaveText('34');
  await expect(gridCell(page, 'D2')).toHaveText('2.75');
  await page.reload();
  await expect(gridCell(page, 'D1')).toHaveText('34');
  await expect(gridCell(page, 'D2')).toHaveText('2.75');
});

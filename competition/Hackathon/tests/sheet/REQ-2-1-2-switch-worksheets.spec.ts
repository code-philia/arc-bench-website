import { expect, Page, test } from '@playwright/test';
import {
  addWorksheet,
  commitCellThroughFormulaBar,
  configureDropdownValidation,
  createBlankWorkbook,
  expectActiveWorksheet,
  expectSelectedCell,
  gridCell,
  openDataMenu,
  requiredEnv,
  selectCellRange,
  setClipboardText,
  worksheetTab,
} from './support/e2e';

async function expectWorksheetState(
  page: Page,
  worksheetName: string,
  selectedCell: string,
  cellValue: string,
): Promise<void> {
  await expectActiveWorksheet(page, worksheetName);
  await expectSelectedCell(page, selectedCell);
  await expect(gridCell(page, selectedCell)).toHaveText(cellValue);
  await expect(page.getByLabel(/^(formula bar|公式栏)$/i)).toHaveValue(cellValue);
}

test('REQ-2-1-2：切换工作表时恢复各自数据、选中单元格和公式栏', async ({ page }, testInfo) => {
  const workbookUrl = requiredEnv(testInfo, 'E2E_REQ_2_1_2_WORKBOOK_URL');
  const firstWorksheet = requiredEnv(testInfo, 'E2E_REQ_2_1_2_FIRST_WORKSHEET');
  const firstSelectedCell = requiredEnv(testInfo, 'E2E_REQ_2_1_2_FIRST_SELECTED_CELL');
  const firstCellValue = requiredEnv(testInfo, 'E2E_REQ_2_1_2_FIRST_CELL_VALUE');
  const secondWorksheet = requiredEnv(testInfo, 'E2E_REQ_2_1_2_SECOND_WORKSHEET');
  const secondSelectedCell = requiredEnv(testInfo, 'E2E_REQ_2_1_2_SECOND_SELECTED_CELL');
  const secondCellValue = requiredEnv(testInfo, 'E2E_REQ_2_1_2_SECOND_CELL_VALUE');
  expect(firstWorksheet).not.toBe(secondWorksheet);
  expect(firstCellValue).not.toBe(secondCellValue);

  await page.goto(workbookUrl);
  await expectWorksheetState(page, firstWorksheet, firstSelectedCell, firstCellValue);

  await worksheetTab(page, secondWorksheet).click();
  await expectWorksheetState(page, secondWorksheet, secondSelectedCell, secondCellValue);

  await worksheetTab(page, firstWorksheet).click();
  await expectWorksheetState(page, firstWorksheet, firstSelectedCell, firstCellValue);

  await page.reload();
  await expectWorksheetState(page, firstWorksheet, firstSelectedCell, firstCellValue);
});

test('REQ-2-1-2：切换工作表时恢复公式原文并隔离普通值', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', '2');
  await commitCellThroughFormulaBar(page, 'B1', '=A1*2');
  await gridCell(page, 'B1').click();
  await expectSelectedCell(page, 'B1');

  await addWorksheet(page, 'Sheet2');
  await commitCellThroughFormulaBar(page, 'A1', 'Other');
  await gridCell(page, 'A1').click();
  await worksheetTab(page, 'Sheet1').click();
  await expectActiveWorksheet(page, 'Sheet1');
  await expectSelectedCell(page, 'B1');
  await expect(gridCell(page, 'B1')).toHaveText('4');
  await expect(page.getByLabel(/^(formula bar|公式栏)$/i)).toHaveValue('=A1*2');

  await worksheetTab(page, 'Sheet2').click();
  await expectActiveWorksheet(page, 'Sheet2');
  await expectSelectedCell(page, 'A1');
  await expect(gridCell(page, 'A1')).toHaveText('Other');
  await expect(page.getByLabel(/^(formula bar|公式栏)$/i)).toHaveValue('Other');
  await page.reload();
  await expectActiveWorksheet(page, 'Sheet2');
  await expectSelectedCell(page, 'A1');
  await expect(gridCell(page, 'A1')).toHaveText('Other');
});

test('REQ-2-1-2：切换工作表时筛选与校验入口保持隔离', async ({ page }) => {
  await createBlankWorkbook(page);
  await setClipboardText(page, 'Region\tStatus\nEast\tOpen\nNorth\tClosed');
  await gridCell(page, 'A1').click();
  await page.keyboard.press('Control+V');
  await configureDropdownValidation(page, 'C2', 'C2', ['Open', 'Closed']);
  await selectCellRange(page, 'A1', 'B3');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: /^(create filter|创建筛选器)$/i }).click();

  const filterButton = page.getByRole('button', { name: /^(filter Region|筛选 Region)$/i });
  const dropdownButton = page.getByRole('button', {
    name: /^(open dropdown for C2|打开 C2 的下拉列表)$/i,
  });
  await expect(filterButton).toBeVisible();
  await expect(dropdownButton).toBeVisible();

  await addWorksheet(page, 'Sheet2');
  await expect(filterButton).toHaveCount(0);
  await expect(dropdownButton).toHaveCount(0);
  await commitCellThroughFormulaBar(page, 'A1', 'Other sheet');

  await worksheetTab(page, 'Sheet1').click();
  await expect(filterButton).toBeVisible();
  await expect(dropdownButton).toBeVisible();
  await expect(gridCell(page, 'A2')).toHaveText('East');

  await worksheetTab(page, 'Sheet2').click();
  await page.reload();
  await expectActiveWorksheet(page, 'Sheet2');
  await expect(gridCell(page, 'A1')).toHaveText('Other sheet');
  await expect(filterButton).toHaveCount(0);
  await expect(dropdownButton).toHaveCount(0);
});

test('REQ-2-1-2：在三张工作表之间切换时分别恢复各自选中单元格', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', 'Sheet1');
  await gridCell(page, 'A1').click();
  await addWorksheet(page, 'Sheet2');
  await commitCellThroughFormulaBar(page, 'B2', 'Sheet2');
  await gridCell(page, 'B2').click();
  await addWorksheet(page, 'Sheet3');
  await commitCellThroughFormulaBar(page, 'C3', 'Sheet3');
  await gridCell(page, 'C3').click();

  await worksheetTab(page, 'Sheet1').click();
  await expectActiveWorksheet(page, 'Sheet1');
  await expectSelectedCell(page, 'A1');
  await expect(gridCell(page, 'A1')).toHaveText('Sheet1');

  await worksheetTab(page, 'Sheet2').click();
  await expectActiveWorksheet(page, 'Sheet2');
  await expectSelectedCell(page, 'B2');
  await expect(gridCell(page, 'B2')).toHaveText('Sheet2');

  await worksheetTab(page, 'Sheet3').click();
  await expectActiveWorksheet(page, 'Sheet3');
  await expectSelectedCell(page, 'C3');
  await expect(gridCell(page, 'C3')).toHaveText('Sheet3');

  await page.reload();
  await expectActiveWorksheet(page, 'Sheet3');
  await expectSelectedCell(page, 'C3');
});

test('REQ-2-1-2：切换工作表时保持各自公式栏原文与计算结果', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', '2');
  await commitCellThroughFormulaBar(page, 'B1', '=A1*3');
  await addWorksheet(page, 'Sheet2');
  await commitCellThroughFormulaBar(page, 'A1', 'Other');

  await worksheetTab(page, 'Sheet1').click();
  await expectActiveWorksheet(page, 'Sheet1');
  await expect(gridCell(page, 'B1')).toHaveText('6');
  await gridCell(page, 'B1').click();
  await expect(page.getByLabel(/^(formula bar|公式栏)$/i)).toHaveValue('=A1*3');

  await worksheetTab(page, 'Sheet2').click();
  await expectActiveWorksheet(page, 'Sheet2');
  await expect(gridCell(page, 'A1')).toHaveText('Other');
  await gridCell(page, 'A1').click();
  await expect(page.getByLabel(/^(formula bar|公式栏)$/i)).toHaveValue('Other');
});

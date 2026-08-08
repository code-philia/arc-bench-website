import { expect, Locator, Page, test } from '@playwright/test';
import {
  columnHeader,
  commitCellThroughFormulaBar,
  createBlankWorkbook,
  expectActiveWorksheet,
  gridCell,
  openDataMenu,
  requiredEnv,
  rowHeader,
  selectCellRange,
  setClipboardText,
  worksheetTab,
} from './support/e2e';

async function chooseEditorOption(
  page: Page,
  editor: Locator,
  label: RegExp,
  option: RegExp,
): Promise<void> {
  await editor.getByLabel(label).click();
  await page.getByRole('option', { name: option }).click();
}

async function createPivotEditor(page: Page, start: string, end: string): Promise<Locator> {
  await selectCellRange(page, start, end);
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: /^(create pivot table|创建透视表)$/i }).click();
  const dialog = page.getByRole('dialog', { name: /^(create pivot table|创建透视表)$/i });
  await dialog.getByRole('radio', { name: /^(new worksheet|新工作表)$/i }).check();
  await dialog.getByRole('button', { name: /^(create|创建)$/i }).click();
  await expectActiveWorksheet(page, 'Pivot1');
  return page.getByRole('region', { name: /^(pivot table editor|透视表编辑器)$/i });
}

test('REQ-5-3-1：在 Pivot1 按 Region 汇总 Sales，并保持源表不变', async ({ page }, testInfo) => {
  const workbookUrl = requiredEnv(testInfo, 'E2E_REQ_5_3_1_FRESH_CREATE_PIVOT_WORKBOOK_URL');

  await page.goto(workbookUrl);
  await expectActiveWorksheet(page, 'Sheet1');
  const sourceRows = [
    { row: 2, region: 'East', sales: '1200' },
    { row: 3, region: 'North', sales: '800' },
    { row: 4, region: 'East', sales: '600' },
    { row: 5, region: 'South', sales: '1000' },
    { row: 6, region: 'North', sales: '700' },
  ];
  await expect(gridCell(page, 'A1')).toHaveText('Region');
  await expect(gridCell(page, 'B1')).toHaveText('Sales');
  for (const source of sourceRows) {
    await expect(gridCell(page, `A${source.row}`)).toHaveText(source.region);
    await expect(gridCell(page, `B${source.row}`)).toHaveText(source.sales);
  }

  await selectCellRange(page, 'A1', 'B6');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: /^(create pivot table|创建透视表)$/i }).click();
  const dialog = page.getByRole('dialog', { name: /^(create pivot table|创建透视表)$/i });
  await expect(dialog).toContainText('A1:B6');
  await dialog.getByRole('radio', { name: /^(new worksheet|新工作表)$/i }).check();
  await dialog.getByRole('button', { name: /^(create|创建)$/i }).click();

  await expectActiveWorksheet(page, 'Pivot1');
  const editor = page.getByRole('region', { name: /^(pivot table editor|透视表编辑器)$/i });
  await chooseEditorOption(page, editor, /^(rows|行)$/i, /^Region$/i);
  await chooseEditorOption(page, editor, /^(values|值)$/i, /^Sales$/i);
  await chooseEditorOption(page, editor, /^(summarize by|汇总方式)$/i, /^SUM$/i);
  await editor.getByRole('button', { name: /^(apply|应用)$/i }).click();

  await expect(gridCell(page, 'A1')).toHaveText('Region');
  await expect(gridCell(page, 'B1')).toHaveText('SUM of Sales');
  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'B2')).toHaveText('1800');
  await expect(gridCell(page, 'A3')).toHaveText('North');
  await expect(gridCell(page, 'B3')).toHaveText('1500');
  await expect(gridCell(page, 'A4')).toHaveText('South');
  await expect(gridCell(page, 'B4')).toHaveText('1000');
  await expect(gridCell(page, 'A5')).toHaveText('Grand Total');
  await expect(gridCell(page, 'B5')).toHaveText('4300');

  await worksheetTab(page, 'Sheet1').click();
  for (const source of sourceRows) {
    await expect(gridCell(page, `A${source.row}`)).toHaveText(source.region);
    await expect(gridCell(page, `B${source.row}`)).toHaveText(source.sales);
  }

  await worksheetTab(page, 'Pivot1').click();
  await page.reload();
  await expectActiveWorksheet(page, 'Pivot1');
  await expect(gridCell(page, 'B2')).toHaveText('1800');
  await expect(gridCell(page, 'B3')).toHaveText('1500');
  await expect(gridCell(page, 'B4')).toHaveText('1000');
  await expect(gridCell(page, 'B5')).toHaveText('4300');
});

test('REQ-5-3-1：刷新已有透视表后覆盖旧汇总，并持久化新结果', async ({ page }, testInfo) => {
  const workbookUrl = requiredEnv(testInfo, 'E2E_REQ_5_3_1_FRESH_REFRESH_PIVOT_WORKBOOK_URL');

  await page.goto(workbookUrl);
  await worksheetTab(page, 'Pivot1').click();
  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'B2')).toHaveText('1800');
  await expect(gridCell(page, 'A3')).toHaveText('North');
  await expect(gridCell(page, 'B3')).toHaveText('800');
  await expect(gridCell(page, 'A4')).toHaveText('Grand Total');
  await expect(gridCell(page, 'B4')).toHaveText('2600');

  await page.getByRole('button', { name: /^(refresh pivot table|刷新透视表)$/i }).click();
  await expect(gridCell(page, 'B2')).toHaveText('2100');
  await expect(gridCell(page, 'B3')).toHaveText('800');
  await expect(gridCell(page, 'B4')).toHaveText('2900');

  await worksheetTab(page, 'Sheet1').click();
  await expect(gridCell(page, 'A1')).toHaveText('Region');
  await expect(gridCell(page, 'B1')).toHaveText('Sales');
  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'B2')).toHaveText('1500');
  await expect(gridCell(page, 'A3')).toHaveText('North');
  await expect(gridCell(page, 'B3')).toHaveText('800');
  await expect(gridCell(page, 'A4')).toHaveText('East');
  await expect(gridCell(page, 'B4')).toHaveText('600');

  await worksheetTab(page, 'Pivot1').click();
  await page.reload();
  await expectActiveWorksheet(page, 'Pivot1');
  await expect(gridCell(page, 'B2')).toHaveText('2100');
  await expect(gridCell(page, 'B3')).toHaveText('800');
  await expect(gridCell(page, 'B4')).toHaveText('2900');
});

test('REQ-5-3-1：使用行列字段和 COUNT 生成二维汇总并持久化', async ({ page }) => {
  await createBlankWorkbook(page);
  await setClipboardText(page, [
    'Region\tQuarter\tSales',
    'East\tQ1\t100',
    'East\tQ1\t200',
    'East\tQ2\t150',
    'North\tQ1\t300',
    'North\tQ2\t',
  ].join('\n'));
  await gridCell(page, 'A1').click();
  await page.keyboard.press('Control+V');

  const editor = await createPivotEditor(page, 'A1', 'C6');
  await chooseEditorOption(page, editor, /^(rows|行)$/i, /^Region$/i);
  await chooseEditorOption(page, editor, /^(columns|列)$/i, /^Quarter$/i);
  await chooseEditorOption(page, editor, /^(values|值)$/i, /^Sales$/i);
  await chooseEditorOption(page, editor, /^(summarize by|汇总方式)$/i, /^COUNT$/i);
  await editor.getByRole('button', { name: /^(apply|应用)$/i }).click();

  await expect(gridCell(page, 'A1')).toHaveText('Region');
  await expect(gridCell(page, 'B1')).toHaveText('Q1');
  await expect(gridCell(page, 'C1')).toHaveText('Q2');
  await expect(gridCell(page, 'D1')).toHaveText('Grand Total');
  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'B2')).toHaveText('2');
  await expect(gridCell(page, 'C2')).toHaveText('1');
  await expect(gridCell(page, 'D2')).toHaveText('3');
  await expect(gridCell(page, 'A3')).toHaveText('North');
  await expect(gridCell(page, 'B3')).toHaveText('1');
  await expect(gridCell(page, 'C3')).toHaveText('0');
  await expect(gridCell(page, 'D3')).toHaveText('1');
  await expect(gridCell(page, 'A4')).toHaveText('Grand Total');
  await expect(gridCell(page, 'D4')).toHaveText('4');

  await page.reload();
  await expectActiveWorksheet(page, 'Pivot1');
  await expect(gridCell(page, 'B2')).toHaveText('2');
  await expect(gridCell(page, 'C2')).toHaveText('1');
  await expect(gridCell(page, 'D4')).toHaveText('4');
});

test('REQ-5-3-1：AVERAGE 忽略非数值记录并保持源数据不变', async ({ page }) => {
  await createBlankWorkbook(page);
  await setClipboardText(page, [
    'Region\tSales',
    'East\t100',
    'East\tnot numeric',
    'East\t300',
    'North\t200',
    'North\t',
  ].join('\n'));
  await gridCell(page, 'A1').click();
  await page.keyboard.press('Control+V');

  const editor = await createPivotEditor(page, 'A1', 'B6');
  await chooseEditorOption(page, editor, /^(rows|行)$/i, /^Region$/i);
  await chooseEditorOption(page, editor, /^(values|值)$/i, /^Sales$/i);
  await chooseEditorOption(page, editor, /^(summarize by|汇总方式)$/i, /^AVERAGE$/i);
  await editor.getByRole('button', { name: /^(apply|应用)$/i }).click();

  await expect(gridCell(page, 'A1')).toHaveText('Region');
  await expect(gridCell(page, 'B1')).toHaveText('AVERAGE of Sales');
  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'B2')).toHaveText('200');
  await expect(gridCell(page, 'A3')).toHaveText('North');
  await expect(gridCell(page, 'B3')).toHaveText('200');
  await expect(gridCell(page, 'A4')).toHaveText('Grand Total');
  await expect(gridCell(page, 'B4')).toHaveText('200');

  await worksheetTab(page, 'Sheet1').click();
  await expect(gridCell(page, 'B2')).toHaveText('100');
  await expect(gridCell(page, 'B3')).toHaveText('not numeric');
  await expect(gridCell(page, 'B4')).toHaveText('300');
  await worksheetTab(page, 'Pivot1').click();
  await page.reload();
  await expect(gridCell(page, 'B2')).toHaveText('200');
  await expect(gridCell(page, 'B3')).toHaveText('200');
  await expect(gridCell(page, 'B4')).toHaveText('200');
});

test('REQ-5-3-1：无效数值聚合显示错误并保留上一次成功结果', async ({ page }) => {
  await createBlankWorkbook(page);
  await setClipboardText(page, [
    'Region\tStatus',
    'East\tOpen',
    'East\tClosed',
    'North\tOpen',
  ].join('\n'));
  await gridCell(page, 'A1').click();
  await page.keyboard.press('Control+V');

  const editor = await createPivotEditor(page, 'A1', 'B4');
  await chooseEditorOption(page, editor, /^(rows|行)$/i, /^Region$/i);
  await chooseEditorOption(page, editor, /^(values|值)$/i, /^Status$/i);
  await chooseEditorOption(page, editor, /^(summarize by|汇总方式)$/i, /^COUNT$/i);
  await editor.getByRole('button', { name: /^(apply|应用)$/i }).click();
  await expect(gridCell(page, 'B2')).toHaveText('2');
  await expect(gridCell(page, 'B3')).toHaveText('1');
  await expect(gridCell(page, 'B4')).toHaveText('3');

  await chooseEditorOption(page, editor, /^(summarize by|汇总方式)$/i, /^SUM$/i);
  await editor.getByRole('button', { name: /^(apply|应用)$/i }).click();
  await expect(page.getByText(
    /^(value field requires numeric values|数值字段必须包含可解析数字)$/i,
  )).toBeVisible();
  await expect(gridCell(page, 'B2')).toHaveText('2');
  await expect(gridCell(page, 'B3')).toHaveText('1');
  await expect(gridCell(page, 'B4')).toHaveText('3');

  await worksheetTab(page, 'Sheet1').click();
  await expect(gridCell(page, 'B2')).toHaveText('Open');
  await expect(gridCell(page, 'B3')).toHaveText('Closed');
  await expect(gridCell(page, 'B4')).toHaveText('Open');
  await worksheetTab(page, 'Pivot1').click();
  await page.reload();
  await expect(gridCell(page, 'B2')).toHaveText('2');
  await expect(gridCell(page, 'B3')).toHaveText('1');
  await expect(gridCell(page, 'B4')).toHaveText('3');
});

test('REQ-5-3-1：刷新透视表时汇总被筛选隐藏的源记录', async ({ page }) => {
  await createBlankWorkbook(page);
  await setClipboardText(page, [
    'Region\tSales',
    'East\t100',
    'North\t200',
    'East\t300',
  ].join('\n'));
  await gridCell(page, 'A1').click();
  await page.keyboard.press('Control+V');

  const editor = await createPivotEditor(page, 'A1', 'B4');
  await chooseEditorOption(page, editor, /^(rows|行)$/i, /^Region$/i);
  await chooseEditorOption(page, editor, /^(values|值)$/i, /^Sales$/i);
  await chooseEditorOption(page, editor, /^(summarize by|汇总方式)$/i, /^SUM$/i);
  await editor.getByRole('button', { name: /^(apply|应用)$/i }).click();
  await expect(gridCell(page, 'B2')).toHaveText('400');
  await expect(gridCell(page, 'B3')).toHaveText('200');
  await expect(gridCell(page, 'B4')).toHaveText('600');

  await worksheetTab(page, 'Sheet1').click();
  await selectCellRange(page, 'A1', 'B4');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: /^(create filter|创建筛选器)$/i }).click();
  await page.getByRole('button', { name: /^(filter Region|筛选 Region)$/i }).click();
  const filterDialog = page.getByRole('dialog', { name: /^(filter Region|筛选 Region)$/i });
  await filterDialog.getByRole('button', { name: /^(clear selection|清除选择)$/i }).click();
  await filterDialog.getByRole('checkbox', { name: /^East$/i }).check();
  await filterDialog.getByRole('button', { name: /^(apply|应用)$/i }).click();
  await expect(gridCell(page, 'A3')).not.toBeVisible();

  await worksheetTab(page, 'Pivot1').click();
  await page.getByRole('button', { name: /^(refresh pivot table|刷新透视表)$/i }).click();
  await expect(gridCell(page, 'B2')).toHaveText('400');
  await expect(gridCell(page, 'B3')).toHaveText('200');
  await expect(gridCell(page, 'B4')).toHaveText('600');
  await page.reload();
  await expect(gridCell(page, 'B2')).toHaveText('400');
  await expect(gridCell(page, 'B3')).toHaveText('200');
  await expect(gridCell(page, 'B4')).toHaveText('600');
});

test('REQ-5-3-1：源区域插入行列后刷新会使用调整后的完整范围', async ({ page }) => {
  await createBlankWorkbook(page);
  await setClipboardText(page, [
    'Region\tSales',
    'East\t100',
    'North\t200',
    'East\t300',
  ].join('\n'));
  await gridCell(page, 'A1').click();
  await page.keyboard.press('Control+V');

  const editor = await createPivotEditor(page, 'A1', 'B4');
  await chooseEditorOption(page, editor, /^(rows|行)$/i, /^Region$/i);
  await chooseEditorOption(page, editor, /^(values|值)$/i, /^Sales$/i);
  await chooseEditorOption(page, editor, /^(summarize by|汇总方式)$/i, /^SUM$/i);
  await editor.getByRole('button', { name: /^(apply|应用)$/i }).click();
  await expect(gridCell(page, 'B2')).toHaveText('400');
  await expect(gridCell(page, 'B3')).toHaveText('200');
  await expect(gridCell(page, 'B4')).toHaveText('600');

  await worksheetTab(page, 'Sheet1').click();
  await rowHeader(page, 3).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^(insert 1 row below|在下方插入 1 行)$/i }).click();
  await commitCellThroughFormulaBar(page, 'A4', 'East');
  await commitCellThroughFormulaBar(page, 'B4', '50');
  await expect(gridCell(page, 'A5')).toHaveText('East');
  await expect(gridCell(page, 'B5')).toHaveText('300');

  await worksheetTab(page, 'Pivot1').click();
  await page.getByRole('button', { name: /^(refresh pivot table|刷新透视表)$/i }).click();
  await expect(gridCell(page, 'B2')).toHaveText('450');
  await expect(gridCell(page, 'B3')).toHaveText('200');
  await expect(gridCell(page, 'B4')).toHaveText('650');

  await worksheetTab(page, 'Sheet1').click();
  await columnHeader(page, 'B').click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^(insert 1 column left|在左侧插入 1 列)$/i }).click();
  await expect(gridCell(page, 'B1')).toHaveText('');
  await expect(gridCell(page, 'C1')).toHaveText('Sales');
  await expect(gridCell(page, 'C4')).toHaveText('50');

  await worksheetTab(page, 'Pivot1').click();
  await page.getByRole('button', { name: /^(refresh pivot table|刷新透视表)$/i }).click();
  await expect(gridCell(page, 'B2')).toHaveText('450');
  await expect(gridCell(page, 'B3')).toHaveText('200');
  await expect(gridCell(page, 'B4')).toHaveText('650');

  await page.reload();
  await expectActiveWorksheet(page, 'Pivot1');
  await expect(gridCell(page, 'B2')).toHaveText('450');
  await expect(gridCell(page, 'B3')).toHaveText('200');
  await expect(gridCell(page, 'B4')).toHaveText('650');
});

test('REQ-5-3-1：删除已选源字段后刷新显示错误并保留上次结果', async ({ page }) => {
  await createBlankWorkbook(page);
  await setClipboardText(page, [
    'Region\tSales',
    'East\t100',
    'North\t200',
    'East\t300',
  ].join('\n'));
  await gridCell(page, 'A1').click();
  await page.keyboard.press('Control+V');

  const editor = await createPivotEditor(page, 'A1', 'B4');
  await chooseEditorOption(page, editor, /^(rows|行)$/i, /^Region$/i);
  await chooseEditorOption(page, editor, /^(values|值)$/i, /^Sales$/i);
  await chooseEditorOption(page, editor, /^(summarize by|汇总方式)$/i, /^SUM$/i);
  await editor.getByRole('button', { name: /^(apply|应用)$/i }).click();
  await expect(gridCell(page, 'B2')).toHaveText('400');
  await expect(gridCell(page, 'B3')).toHaveText('200');
  await expect(gridCell(page, 'B4')).toHaveText('600');

  await worksheetTab(page, 'Sheet1').click();
  await columnHeader(page, 'B').click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^(delete column|删除列)$/i }).click();
  await expect(gridCell(page, 'A1')).toHaveText('Region');
  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'B1')).toHaveText('');

  await worksheetTab(page, 'Pivot1').click();
  await page.getByRole('button', { name: /^(refresh pivot table|刷新透视表)$/i }).click();
  await expect(page.getByText(
    /^(pivot field is no longer available\. select a new field\.|透视字段已不存在，请重新选择字段)$/i,
  )).toBeVisible();
  await expect(gridCell(page, 'B2')).toHaveText('400');
  await expect(gridCell(page, 'B3')).toHaveText('200');
  await expect(gridCell(page, 'B4')).toHaveText('600');

  await worksheetTab(page, 'Sheet1').click();
  await expect(gridCell(page, 'A1')).toHaveText('Region');
  await expect(gridCell(page, 'A2')).toHaveText('East');
  await worksheetTab(page, 'Pivot1').click();
  await page.reload();
  await expect(gridCell(page, 'B2')).toHaveText('400');
  await expect(gridCell(page, 'B3')).toHaveText('200');
  await expect(gridCell(page, 'B4')).toHaveText('600');
});

test('REQ-5-3-1：按状态字段生成 COUNT 透视表并在刷新后保持', async ({ page }) => {
  await createBlankWorkbook(page);
  await setClipboardText(page, [
    'Region\tStatus',
    'East\tOpen',
    'East\tClosed',
    'North\tOpen',
    'South\tOpen',
  ].join('\n'));
  await gridCell(page, 'A1').click();
  await page.keyboard.press('Control+V');

  const editor = await createPivotEditor(page, 'A1', 'B5');
  await chooseEditorOption(page, editor, /^(rows|行)$/i, /^Region$/i);
  await chooseEditorOption(page, editor, /^(values|值)$/i, /^Status$/i);
  await chooseEditorOption(page, editor, /^(summarize by|汇总方式)$/i, /^COUNT$/i);
  await editor.getByRole('button', { name: /^(apply|应用)$/i }).click();

  await expect(gridCell(page, 'A1')).toHaveText('Region');
  await expect(gridCell(page, 'B1')).toHaveText('COUNT of Status');
  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'B2')).toHaveText('2');
  await expect(gridCell(page, 'A3')).toHaveText('North');
  await expect(gridCell(page, 'B3')).toHaveText('1');
  await expect(gridCell(page, 'A4')).toHaveText('South');
  await expect(gridCell(page, 'B4')).toHaveText('1');
  await page.reload();
  await expect(gridCell(page, 'B2')).toHaveText('2');
  await expect(gridCell(page, 'B3')).toHaveText('1');
});

test('REQ-5-3-1：按地区汇总平均值并在源值变化后刷新', async ({ page }) => {
  await createBlankWorkbook(page);
  await setClipboardText(page, [
    'Region\tSales',
    'East\t100',
    'East\t200',
    'North\t300',
    'North\t500',
  ].join('\n'));
  await gridCell(page, 'A1').click();
  await page.keyboard.press('Control+V');

  const editor = await createPivotEditor(page, 'A1', 'B5');
  await chooseEditorOption(page, editor, /^(rows|行)$/i, /^Region$/i);
  await chooseEditorOption(page, editor, /^(values|值)$/i, /^Sales$/i);
  await chooseEditorOption(page, editor, /^(summarize by|汇总方式)$/i, /^AVERAGE$/i);
  await editor.getByRole('button', { name: /^(apply|应用)$/i }).click();

  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'B2')).toHaveText('150');
  await expect(gridCell(page, 'A3')).toHaveText('North');
  await expect(gridCell(page, 'B3')).toHaveText('400');
  await worksheetTab(page, 'Sheet1').click();
  await commitCellThroughFormulaBar(page, 'B2', '300');
  await worksheetTab(page, 'Pivot1').click();
  await page.getByRole('button', { name: /^(refresh pivot table|刷新透视表)$/i }).click();
  await expect(gridCell(page, 'B2')).toHaveText('200');
  await expect(gridCell(page, 'B3')).toHaveText('400');
});

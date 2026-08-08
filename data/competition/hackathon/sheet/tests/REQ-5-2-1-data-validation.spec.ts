import { expect, Locator, Page, test } from '@playwright/test';
import {
  commitCellThroughGrid,
  commitCellThroughFormulaBar,
  configureDropdownValidation,
  configureNumberValidation,
  createBlankWorkbook,
  formulaBar,
  gridCell,
  openDataMenu,
  selectCellRange,
} from './support/e2e';

async function openDataValidation(page: Page, start: string, end: string): Promise<Locator> {
  await selectCellRange(page, start, end);
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: /^(data validation|数据校验)$/i }).click();
  const dialog = page.getByRole('dialog', { name: /^(data validation|数据校验)$/i });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function chooseRuleType(page: Page, dialog: Locator, option: RegExp): Promise<void> {
  await dialog.getByLabel(/^(rule type|规则类型)$/i).click();
  await page.getByRole('option', { name: option }).click();
}

test('REQ-5-2-1：为 A1:A2 创建下拉规则，选择值并持久化独立入口', async ({ page }) => {
  await createBlankWorkbook(page);

  const dialog = await openDataValidation(page, 'A1', 'A2');
  await chooseRuleType(page, dialog, /^(dropdown|下拉列表)$/i);
  await dialog.getByLabel(/^(allowed values|允许值)$/i).fill('Not Started, In Progress, Completed');
  await dialog.getByRole('button', { name: /^(save|保存)$/i }).click();

  await page.getByRole('button', { name: /^(open dropdown for A1|打开 A1 的下拉列表)$/i }).click();
  await page.getByRole('option', { name: /^In Progress$/i }).click();
  await expect(gridCell(page, 'A1')).toHaveText('In Progress');
  await expect(page.getByRole('button', { name: /^(open dropdown for A2|打开 A2 的下拉列表)$/i })).toBeVisible();

  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText('In Progress');
  await expect(page.getByRole('button', { name: /^(open dropdown for A1|打开 A1 的下拉列表)$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^(open dropdown for A2|打开 A2 的下拉列表)$/i })).toBeVisible();
});

test('REQ-5-2-1：数值范围拒绝越界输入并在刷新后继续接受包含边界', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', '50');

  const dialog = await openDataValidation(page, 'A1', 'A1');
  await chooseRuleType(page, dialog, /^(number range|数值范围)$/i);
  await dialog.getByLabel(/^(minimum|最小值)$/i).fill('0');
  await dialog.getByLabel(/^(maximum|最大值)$/i).fill('100');
  await dialog.getByRole('button', { name: /^(save|保存)$/i }).click();

  await commitCellThroughFormulaBar(page, 'A1', '120');
  await expect(page.getByText(/enter a number from 0 to 100|请输入 0 到 100 之间的数字/i)).toBeVisible();
  await expect(gridCell(page, 'A1')).toHaveText('50');
  await gridCell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('50');

  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText('50');
  await commitCellThroughFormulaBar(page, 'A1', '101');
  await expect(page.getByText(/enter a number from 0 to 100|请输入 0 到 100 之间的数字/i)).toBeVisible();
  await expect(gridCell(page, 'A1')).toHaveText('50');

  await commitCellThroughFormulaBar(page, 'A1', '100');
  await expect(gridCell(page, 'A1')).toHaveText('100');
  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText('100');
});

test('REQ-5-2-1：网格内编辑违反数值规则时保留原值', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', '50');
  await configureNumberValidation(page, 'A1', 'A1', '0', '100');

  await commitCellThroughGrid(page, 'A1', '120');
  await expect(page.getByText(/enter a number from 0 to 100|请输入 0 到 100 之间的数字/i)).toBeVisible();
  await expect(gridCell(page, 'A1')).toHaveText('50');
  await gridCell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('50');

  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText('50');
});

test('REQ-5-2-1：修改和删除校验规则不会自动改写现有单元格值', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', '50');
  await configureNumberValidation(page, 'A1', 'A1', '0', '100');

  const editDialog = await openDataValidation(page, 'A1', 'A1');
  await expect(editDialog.getByLabel(/^(minimum|最小值)$/i)).toHaveValue('0');
  await expect(editDialog.getByLabel(/^(maximum|最大值)$/i)).toHaveValue('100');
  await editDialog.getByLabel(/^(minimum|最小值)$/i).fill('10');
  await editDialog.getByLabel(/^(maximum|最大值)$/i).fill('60');
  await editDialog.getByRole('button', { name: /^(save|保存)$/i }).click();
  await expect(gridCell(page, 'A1')).toHaveText('50');

  await commitCellThroughFormulaBar(page, 'A1', '5');
  await expect(page.getByText(/enter a number from 10 to 60|请输入 10 到 60 之间的数字/i)).toBeVisible();
  await expect(gridCell(page, 'A1')).toHaveText('50');

  const deleteDialog = await openDataValidation(page, 'A1', 'A1');
  await deleteDialog.getByRole('button', { name: /^(delete rule|删除规则)$/i }).click();
  await expect(gridCell(page, 'A1')).toHaveText('50');
  await commitCellThroughFormulaBar(page, 'A1', '5');
  await expect(gridCell(page, 'A1')).toHaveText('5');

  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText('5');
});

test('REQ-5-2-1：下拉规则拒绝未允许的值并在刷新后继续生效', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', 'Open');
  await configureDropdownValidation(page, 'A1', 'A1', ['Open', 'Closed']);

  await commitCellThroughFormulaBar(page, 'A1', 'Pending');
  await expect(page.getByText(
    /^(choose one of: Open, Closed|请选择以下值之一：Open, Closed)$/i,
  )).toBeVisible();
  await expect(gridCell(page, 'A1')).toHaveText('Open');
  await gridCell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('Open');

  await page.reload();
  await commitCellThroughFormulaBar(page, 'A1', 'Pending');
  await expect(page.getByText(
    /^(choose one of: Open, Closed|请选择以下值之一：Open, Closed)$/i,
  )).toBeVisible();
  await expect(gridCell(page, 'A1')).toHaveText('Open');
});

test('REQ-5-2-1：下拉规则可在多个单元格上选择不同允许值', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', 'Not Started');
  await configureDropdownValidation(page, 'A1', 'A2', ['Not Started', 'In Progress', 'Completed']);

  await commitCellThroughFormulaBar(page, 'A1', 'In Progress');
  await commitCellThroughFormulaBar(page, 'A2', 'Completed');
  await expect(gridCell(page, 'A1')).toHaveText('In Progress');
  await expect(gridCell(page, 'A2')).toHaveText('Completed');
  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText('In Progress');
  await expect(gridCell(page, 'A2')).toHaveText('Completed');
});

test('REQ-5-2-1：数值范围规则在边界值和越界值之间稳定切换', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'B2', '50');
  await configureNumberValidation(page, 'B2', 'B3', '0', '100');

  await commitCellThroughFormulaBar(page, 'B2', '0');
  await commitCellThroughFormulaBar(page, 'B3', '100');
  await expect(gridCell(page, 'B2')).toHaveText('0');
  await expect(gridCell(page, 'B3')).toHaveText('100');

  await commitCellThroughFormulaBar(page, 'B3', '101');
  await expect(page.getByText(/enter a number from 0 to 100|请输入 0 到 100 之间的数字/i)).toBeVisible();
  await expect(gridCell(page, 'B3')).toHaveText('100');
  await page.reload();
  await expect(gridCell(page, 'B2')).toHaveText('0');
  await expect(gridCell(page, 'B3')).toHaveText('100');
});

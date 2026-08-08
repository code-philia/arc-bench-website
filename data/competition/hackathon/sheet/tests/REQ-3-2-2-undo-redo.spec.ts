import { expect, test } from '@playwright/test';
import {
  columnHeader,
  commitCellThroughFormulaBar,
  configureDropdownValidation,
  createBlankWorkbook,
  formulaBar,
  gridCell,
  rowHeader,
  setClipboardText,
  uniqueName,
} from './support/e2e';

test('REQ-3-2-2：撤销单元格修改后重做，并在刷新后保留重做结果', async ({ page }) => {
  await createBlankWorkbook(page);
  const value = uniqueName('pw-redo-value');

  await commitCellThroughFormulaBar(page, 'A1', value);
  await expect(gridCell(page, 'A1')).toHaveText(value);

  await page.getByRole('button', { name: /^(undo|撤销)$/i }).click();
  await expect(gridCell(page, 'A1')).toHaveText('');
  await expect(formulaBar(page)).toHaveValue('');

  await page.getByRole('button', { name: /^(redo|重做)$/i }).click();
  await expect(gridCell(page, 'A1')).toHaveText(value);
  await gridCell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue(value);

  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText(value);
});

test('REQ-3-2-2：撤销后提交新修改会清除原重做分支', async ({ page }) => {
  await createBlankWorkbook(page);
  const oldBranchValue = uniqueName('pw-old-branch');
  const newBranchValue = uniqueName('pw-new-branch');

  await commitCellThroughFormulaBar(page, 'A1', oldBranchValue);
  await page.getByRole('button', { name: /^(undo|撤销)$/i }).click();
  await expect(gridCell(page, 'A1')).toHaveText('');
  await expect(page.getByRole('button', { name: /^(redo|重做)$/i })).toBeEnabled();

  await commitCellThroughFormulaBar(page, 'A1', newBranchValue);
  await expect(gridCell(page, 'A1')).toHaveText(newBranchValue);
  await expect(page.getByRole('button', { name: /^(redo|重做)$/i })).toBeDisabled();

  await page.keyboard.press('Control+Y');
  await expect(gridCell(page, 'A1')).toHaveText(newBranchValue);
  await expect(page.getByText(oldBranchValue, { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText(newBranchValue);
  await expect(page.getByText(oldBranchValue, { exact: true })).toHaveCount(0);
});

test('REQ-3-2-2：撤销和重做源值编辑会同步恢复依赖公式结果', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', '2');
  await commitCellThroughFormulaBar(page, 'B1', '=A1*2');
  await commitCellThroughFormulaBar(page, 'A1', '3');
  await expect(gridCell(page, 'B1')).toHaveText('6');

  await page.getByRole('button', { name: /^(undo|撤销)$/i }).click();
  await expect(gridCell(page, 'A1')).toHaveText('2');
  await expect(gridCell(page, 'B1')).toHaveText('4');
  await gridCell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=A1*2');

  await page.getByRole('button', { name: /^(redo|重做)$/i }).click();
  await expect(gridCell(page, 'A1')).toHaveText('3');
  await expect(gridCell(page, 'B1')).toHaveText('6');
  await gridCell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=A1*2');

  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText('3');
  await expect(gridCell(page, 'B1')).toHaveText('6');
  await gridCell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=A1*2');
});

test('REQ-3-2-2：撤销并重做批量粘贴会恢复整个矩形', async ({ page }) => {
  await createBlankWorkbook(page);
  await setClipboardText(page, 'A\tB\nC\tD');
  await gridCell(page, 'A1').click();
  await page.keyboard.press('Control+V');
  await expect(gridCell(page, 'A1')).toHaveText('A');
  await expect(gridCell(page, 'B2')).toHaveText('D');

  await page.getByRole('button', { name: /^(undo|撤销)$/i }).click();
  for (const coordinate of ['A1', 'B1', 'A2', 'B2']) {
    await expect(gridCell(page, coordinate)).toHaveText('');
  }

  await page.getByRole('button', { name: /^(redo|重做)$/i }).click();
  await expect(gridCell(page, 'A1')).toHaveText('A');
  await expect(gridCell(page, 'B1')).toHaveText('B');
  await expect(gridCell(page, 'A2')).toHaveText('C');
  await expect(gridCell(page, 'B2')).toHaveText('D');
  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText('A');
  await expect(gridCell(page, 'B2')).toHaveText('D');
});

test('REQ-3-2-2：撤销并重做区域移动会同时恢复源区域和目标区域', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', 'Left');
  await commitCellThroughFormulaBar(page, 'B1', 'Right');

  await gridCell(page, 'A1').dragTo(gridCell(page, 'B1'));
  await page.keyboard.press('Control+X');
  await gridCell(page, 'D1').click();
  await page.keyboard.press('Control+V');
  await expect(gridCell(page, 'A1')).toHaveText('');
  await expect(gridCell(page, 'D1')).toHaveText('Left');

  await page.getByRole('button', { name: /^(undo|撤销)$/i }).click();
  await expect(gridCell(page, 'A1')).toHaveText('Left');
  await expect(gridCell(page, 'B1')).toHaveText('Right');
  await expect(gridCell(page, 'D1')).toHaveText('');
  await expect(gridCell(page, 'E1')).toHaveText('');

  await page.getByRole('button', { name: /^(redo|重做)$/i }).click();
  await expect(gridCell(page, 'A1')).toHaveText('');
  await expect(gridCell(page, 'B1')).toHaveText('');
  await expect(gridCell(page, 'D1')).toHaveText('Left');
  await expect(gridCell(page, 'E1')).toHaveText('Right');
  await page.reload();
  await expect(gridCell(page, 'D1')).toHaveText('Left');
  await expect(gridCell(page, 'E1')).toHaveText('Right');
});

test('REQ-3-2-2：连续撤销和重做行列结构修改会恢复数据与校验入口', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', 'Keep');
  await configureDropdownValidation(page, 'A1', 'A1', ['Keep', 'Other']);

  const dropdownFor = (coordinate: string) => page.getByRole('button', {
    name: new RegExp(
      `^(open dropdown for ${coordinate}|打开 ${coordinate} 的下拉列表)$`,
      'i',
    ),
  });
  await expect(dropdownFor('A1')).toBeVisible();

  await rowHeader(page, 1).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^(insert 1 row above|在上方插入 1 行)$/i }).click();
  await columnHeader(page, 'A').click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^(insert 1 column left|在左侧插入 1 列)$/i }).click();
  await expect(gridCell(page, 'B2')).toHaveText('Keep');
  await expect(dropdownFor('B2')).toBeVisible();

  await page.getByRole('button', { name: /^(undo|撤销)$/i }).click();
  await expect(gridCell(page, 'A2')).toHaveText('Keep');
  await expect(dropdownFor('A2')).toBeVisible();
  await expect(dropdownFor('B2')).toHaveCount(0);
  await page.getByRole('button', { name: /^(undo|撤销)$/i }).click();
  await expect(gridCell(page, 'A1')).toHaveText('Keep');
  await expect(dropdownFor('A1')).toBeVisible();
  await expect(dropdownFor('A2')).toHaveCount(0);

  await page.getByRole('button', { name: /^(redo|重做)$/i }).click();
  await expect(gridCell(page, 'A2')).toHaveText('Keep');
  await expect(dropdownFor('A2')).toBeVisible();
  await page.getByRole('button', { name: /^(redo|重做)$/i }).click();
  await expect(gridCell(page, 'B2')).toHaveText('Keep');
  await expect(dropdownFor('B2')).toBeVisible();
  await page.reload();
  await expect(gridCell(page, 'B2')).toHaveText('Keep');
  await expect(dropdownFor('B2')).toBeVisible();
});

test('REQ-3-2-2：在一个工作簿撤销不会修改另一个工作簿', async ({ page }) => {
  const firstUrl = await createBlankWorkbook(page);
  const firstValue = uniqueName('pw-first-workbook');
  await commitCellThroughFormulaBar(page, 'A1', firstValue);

  await createBlankWorkbook(page);
  const secondValue = uniqueName('pw-second-workbook');
  await commitCellThroughFormulaBar(page, 'A1', secondValue);
  await page.getByRole('button', { name: /^(undo|撤销)$/i }).click();
  await expect(gridCell(page, 'A1')).toHaveText('');

  await page.goto(firstUrl);
  await expect(gridCell(page, 'A1')).toHaveText(firstValue);
  await expect(page.getByText(secondValue, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText(firstValue);
});

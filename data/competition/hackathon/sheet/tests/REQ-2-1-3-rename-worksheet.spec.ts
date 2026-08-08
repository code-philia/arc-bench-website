import { expect, Locator, Page, test } from '@playwright/test';
import {
  addWorksheet,
  commitCellThroughFormulaBar,
  createBlankWorkbook,
  expectActiveWorksheet,
  gridCell,
  openWorksheetOptions,
  uniqueName,
  worksheetTab,
} from './support/e2e';

async function openRenameDialog(page: Page, worksheetName: string): Promise<Locator> {
  await openWorksheetOptions(page, worksheetName);
  await page.getByRole('menuitem', { name: /^(rename|重命名)$/i }).click();
  const dialog = page.getByRole('dialog', { name: /^(rename worksheet|重命名工作表)$/i });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('REQ-2-1-3：保存唯一工作表名称，并在刷新后保持', async ({ page }) => {
  await createBlankWorkbook(page);
  await addWorksheet(page, 'Sheet2');
  await commitCellThroughFormulaBar(page, 'A1', 'Existing worksheet data');
  const newName = uniqueName('pw-sheet');

  const dialog = await openRenameDialog(page, 'Sheet2');
  await expect(dialog.getByLabel(/^(worksheet name|工作表名称)$/i)).toHaveValue('Sheet2');
  const nameInput = dialog.getByLabel(/^(worksheet name|工作表名称)$/i);
  await nameInput.fill(`  ${newName}  `);
  await nameInput.press('Enter');

  await expectActiveWorksheet(page, newName);
  await expect(worksheetTab(page, 'Sheet1')).toBeVisible();
  await page.reload();
  await expectActiveWorksheet(page, newName);
  await expect(gridCell(page, 'A1')).toHaveText('Existing worksheet data');

  const reopenedDialog = await openRenameDialog(page, newName);
  await expect(reopenedDialog.getByLabel(/^(worksheet name|工作表名称)$/i)).toHaveValue(newName);
});

test('REQ-2-1-3：重复工作表名称被拒绝，原名称保持不变', async ({ page }) => {
  const editorUrl = await createBlankWorkbook(page);
  await addWorksheet(page, 'Sheet2');

  const dialog = await openRenameDialog(page, 'Sheet2');
  await dialog.getByLabel(/^(worksheet name|工作表名称)$/i).fill('Sheet1');
  await dialog.getByRole('button', { name: /^(save|保存)$/i }).click();

  await expect(page.getByText(/worksheet name already exists|工作表名称已存在/i)).toBeVisible();
  await expect(worksheetTab(page, 'Sheet1')).toBeVisible();
  await expectActiveWorksheet(page, 'Sheet2');

  await page.goto(editorUrl);
  await expect(worksheetTab(page, 'Sheet1')).toBeVisible();
  await expectActiveWorksheet(page, 'Sheet2');
});

test('REQ-2-1-3：空工作表名称被拒绝，刷新后仍保留原名称', async ({ page }) => {
  const editorUrl = await createBlankWorkbook(page);

  const dialog = await openRenameDialog(page, 'Sheet1');
  await dialog.getByLabel(/^(worksheet name|工作表名称)$/i).fill('   ');
  await dialog.getByRole('button', { name: /^(save|保存)$/i }).click();

  await expect(page.getByText(/worksheet name cannot be empty|工作表名称不能为空/i)).toBeVisible();
  await expectActiveWorksheet(page, 'Sheet1');

  await page.goto(editorUrl);
  await expectActiveWorksheet(page, 'Sheet1');
  const reopenedDialog = await openRenameDialog(page, 'Sheet1');
  await expect(reopenedDialog.getByLabel(/^(worksheet name|工作表名称)$/i)).toHaveValue('Sheet1');
});

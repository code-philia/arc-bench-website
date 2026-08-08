import { expect, Page, test } from '@playwright/test';
import {
  addWorksheet,
  commitCellThroughFormulaBar,
  createBlankWorkbook,
  expectActiveWorksheet,
  formulaBar,
  gridCell,
  normalizeCsv,
  readDownload,
  requiredEnv,
  worksheetTab,
} from './support/e2e';

const EXPECTED_CSV = [
  '地区,说明,数量,空列,公式结果',
  '华东,"含,逗号",2,,4',
  '华北,"他说""好""',
  '下一行",3,,5',
].join('\n');

// The prepared URL must open a saved workbook whose active sheet contains
// this exact visible table; the last column cells are formulas evaluating to 4 and 5.

async function exportCsv(page: Page): Promise<string> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^(export csv|导出 CSV)$/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  return normalizeCsv(await readDownload(download));
}

test('REQ-1-3-2：导出活动工作表的计算结果与特殊文本，且刷新后原数据不变', async ({ page }, testInfo) => {
  const workbookUrl = requiredEnv(testInfo, 'E2E_REQ_1_3_2_EXPORT_WORKBOOK_URL');

  await page.goto(workbookUrl);
  const firstExport = await exportCsv(page);
  expect(firstExport).toBe(EXPECTED_CSV);

  await page.reload();
  const secondExport = await exportCsv(page);
  expect(secondExport).toBe(EXPECTED_CSV);
  expect(secondExport).toBe(firstExport);
});

test('REQ-1-3-2：导出公式结果不会改写原公式或活动工作表', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', '2');
  await commitCellThroughFormulaBar(page, 'B1', '=A1*2');

  expect(await exportCsv(page)).toBe('2,4');
  await expectActiveWorksheet(page, 'Sheet1');
  await expect(gridCell(page, 'A1')).toHaveText('2');
  await expect(gridCell(page, 'B1')).toHaveText('4');
  await gridCell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=A1*2');

  await page.reload();
  await expectActiveWorksheet(page, 'Sheet1');
  await expect(gridCell(page, 'A1')).toHaveText('2');
  await expect(gridCell(page, 'B1')).toHaveText('4');
  await gridCell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=A1*2');
});

test('REQ-1-3-2：导出当前活动的第二个工作表内容', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', 'Sheet1');
  await addWorksheet(page, 'Sheet2');
  await commitCellThroughFormulaBar(page, 'A1', 'Sheet2');

  expect(await exportCsv(page)).toBe('Sheet2');
  await expectActiveWorksheet(page, 'Sheet2');
});

test('REQ-1-3-2：切回 Sheet1 后导出仍只包含当前工作表内容', async ({ page }) => {
  await createBlankWorkbook(page);
  await commitCellThroughFormulaBar(page, 'A1', 'First');
  await addWorksheet(page, 'Sheet2');
  await commitCellThroughFormulaBar(page, 'A1', 'Second');
  await worksheetTab(page, 'Sheet1').click();

  expect(await exportCsv(page)).toBe('First');
  await expectActiveWorksheet(page, 'Sheet1');
});

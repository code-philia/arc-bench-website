import { expect, Page, test } from '@playwright/test';
import {
  createBlankWorkbook,
  gridCell,
  normalizeCsv,
  openDataMenu,
  readDownload,
  requiredEnv,
  selectCellRange,
  setClipboardText,
} from './support/e2e';

async function applyCondition(
  page: Page,
  header: string,
  condition: RegExp,
  value?: string,
): Promise<void> {
  await page.getByRole('button', {
    name: new RegExp(`^(filter ${header}|筛选 ${header})$`, 'i'),
  }).click();
  const dialog = page.getByRole('dialog', {
    name: new RegExp(`^(filter ${header}|筛选 ${header})$`, 'i'),
  });
  await dialog.getByLabel(/^(condition|条件)$/i).click();
  await page.getByRole('option', { name: condition }).click();
  if (value !== undefined) {
    await dialog.getByLabel(/^(value|值)$/i).fill(value);
  }
  await dialog.getByRole('button', { name: /^(apply|应用)$/i }).click();
}

test('REQ-5-1-2：组合 Region 值与 Sales 数值条件，刷新后保持并可无损清除', async ({ page }, testInfo) => {
  const workbookUrl = requiredEnv(
    testInfo,
    'E2E_REQ_5_1_2_FRESH_PIVOT_CONTEXT_WORKBOOK_URL',
  );

  await page.goto(workbookUrl);
  await selectCellRange(page, 'A1', 'C6');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: /^(create filter|创建筛选器)$/i }).click();

  await page.getByRole('button', { name: /^(filter Region|筛选 Region)$/i }).click();
  const regionDialog = page.getByRole('dialog', { name: /^(filter Region|筛选 Region)$/i });
  await regionDialog.getByRole('button', { name: /^(clear selection|清除选择)$/i }).click();
  await regionDialog.getByRole('checkbox', { name: /^East$/i }).check();
  await regionDialog.getByRole('button', { name: /^(apply|应用)$/i }).click();

  await page.getByRole('button', { name: /^(filter Sales|筛选 Sales)$/i }).click();
  const salesDialog = page.getByRole('dialog', { name: /^(filter Sales|筛选 Sales)$/i });
  await salesDialog.getByLabel(/^(condition|条件)$/i).click();
  await page.getByRole('option', { name: /^(greater than|大于)$/i }).click();
  await salesDialog.getByLabel(/^(value|值)$/i).fill('1000');
  await salesDialog.getByRole('button', { name: /^(apply|应用)$/i }).click();

  await expect(gridCell(page, 'A1')).toBeVisible();
  await expect(gridCell(page, 'A2')).toBeVisible();
  await expect(gridCell(page, 'A3')).not.toBeVisible();
  await expect(gridCell(page, 'A4')).not.toBeVisible();
  await expect(gridCell(page, 'A5')).toBeVisible();
  await expect(gridCell(page, 'A6')).not.toBeVisible();
  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'B2')).toHaveText('1200');
  await expect(gridCell(page, 'A5')).toHaveText('East');
  await expect(gridCell(page, 'B5')).toHaveText('1500');

  await page.reload();
  await expect(gridCell(page, 'A2')).toBeVisible();
  await expect(gridCell(page, 'A3')).not.toBeVisible();
  await expect(gridCell(page, 'A4')).not.toBeVisible();
  await expect(gridCell(page, 'A5')).toBeVisible();
  await expect(gridCell(page, 'A6')).not.toBeVisible();

  await openDataMenu(page);
  await page.getByRole('menuitem', { name: /^(clear filter|清除筛选)$/i }).click();
  const expectedRows = [
    { row: 2, region: 'East', sales: '1200', status: 'Open' },
    { row: 3, region: 'East', sales: '900', status: 'Closed' },
    { row: 4, region: 'North', sales: '2000', status: 'Open' },
    { row: 5, region: 'East', sales: '1500', status: 'Closed' },
    { row: 6, region: 'South', sales: '700', status: 'Open' },
  ];
  for (const expected of expectedRows) {
    await expect(gridCell(page, `A${expected.row}`)).toBeVisible();
    await expect(gridCell(page, `A${expected.row}`)).toHaveText(expected.region);
    await expect(gridCell(page, `B${expected.row}`)).toHaveText(expected.sales);
    await expect(gridCell(page, `C${expected.row}`)).toHaveText(expected.status);
  }

  await page.reload();
  for (const expected of expectedRows) {
    await expect(gridCell(page, `A${expected.row}`)).toBeVisible();
    await expect(gridCell(page, `A${expected.row}`)).toHaveText(expected.region);
    await expect(gridCell(page, `B${expected.row}`)).toHaveText(expected.sales);
    await expect(gridCell(page, `C${expected.row}`)).toHaveText(expected.status);
  }
});

test('REQ-5-1-2：组合文本包含、日期比较和为空条件，并支持非空条件', async ({ page }) => {
  await createBlankWorkbook(page);
  await setClipboardText(page, [
    'Name\tDate\tNote',
    'Alpha East\t2026-01-10\t',
    'Alpha West\t2026-02-10\tFilled',
    'Beta\t2025-12-01\t',
  ].join('\n'));
  await gridCell(page, 'A1').click();
  await page.keyboard.press('Control+V');
  await selectCellRange(page, 'A1', 'C4');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: /^(create filter|创建筛选器)$/i }).click();

  await applyCondition(page, 'Name', /^(text contains|文本包含)$/i, 'Alpha');
  await applyCondition(page, 'Date', /^(date is before|早于)$/i, '2026-02-01');
  await applyCondition(page, 'Note', /^(is empty|为空)$/i);

  await expect(gridCell(page, 'A2')).toBeVisible();
  await expect(gridCell(page, 'A2')).toHaveText('Alpha East');
  await expect(gridCell(page, 'A3')).not.toBeVisible();
  await expect(gridCell(page, 'A4')).not.toBeVisible();
  await page.reload();
  await expect(gridCell(page, 'A2')).toBeVisible();
  await expect(gridCell(page, 'A3')).not.toBeVisible();
  await expect(gridCell(page, 'A4')).not.toBeVisible();

  await openDataMenu(page);
  await page.getByRole('menuitem', { name: /^(clear filter|清除筛选)$/i }).click();
  await selectCellRange(page, 'A1', 'C4');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: /^(create filter|创建筛选器)$/i }).click();
  await applyCondition(page, 'Note', /^(is not empty|非空)$/i);
  await expect(gridCell(page, 'A2')).not.toBeVisible();
  await expect(gridCell(page, 'A3')).toBeVisible();
  await expect(gridCell(page, 'A3')).toHaveText('Alpha West');
  await expect(gridCell(page, 'A4')).not.toBeVisible();
  await page.reload();
  await expect(gridCell(page, 'A2')).not.toBeVisible();
  await expect(gridCell(page, 'A3')).toBeVisible();
  await expect(gridCell(page, 'A4')).not.toBeVisible();
});

test('REQ-5-1-2：CSV 导出包含被筛选隐藏的已保存行', async ({ page }) => {
  await createBlankWorkbook(page);
  const sourceCsv = [
    'Region,Sales',
    'East,100',
    'North,200',
    'East,300',
  ].join('\n');
  await setClipboardText(page, sourceCsv.replaceAll(',', '\t'));
  await gridCell(page, 'A1').click();
  await page.keyboard.press('Control+V');
  await selectCellRange(page, 'A1', 'B4');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: /^(create filter|创建筛选器)$/i }).click();
  await page.getByRole('button', { name: /^(filter Region|筛选 Region)$/i }).click();
  const dialog = page.getByRole('dialog', { name: /^(filter Region|筛选 Region)$/i });
  await dialog.getByRole('button', { name: /^(clear selection|清除选择)$/i }).click();
  await dialog.getByRole('checkbox', { name: /^East$/i }).check();
  await dialog.getByRole('button', { name: /^(apply|应用)$/i }).click();
  await expect(gridCell(page, 'A3')).not.toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^(export csv|导出 CSV)$/i }).click();
  const exported = normalizeCsv(await readDownload(await downloadPromise));
  expect(exported).toBe(sourceCsv);

  await page.reload();
  await expect(gridCell(page, 'A3')).not.toBeVisible();
});

test('REQ-5-1-2：清除筛选后再次应用不同条件仍保留已保存行', async ({ page }) => {
  await createBlankWorkbook(page);
  await setClipboardText(page, [
    'Region\tSales\tStatus',
    'East\t1200\tOpen',
    'East\t900\tClosed',
    'North\t2000\tOpen',
    'South\t700\tOpen',
  ].join('\n'));
  await gridCell(page, 'A1').click();
  await page.keyboard.press('Control+V');
  await selectCellRange(page, 'A1', 'C5');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: /^(create filter|创建筛选器)$/i }).click();
  await applyCondition(page, 'Region', /^(text contains|文本包含)$/i, 'East');
  await expect(gridCell(page, 'A2')).toBeVisible();
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: /^(clear filter|清除筛选)$/i }).click();
  await expect(gridCell(page, 'A3')).toBeVisible();
  await selectCellRange(page, 'A1', 'C5');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: /^(create filter|创建筛选器)$/i }).click();
  await applyCondition(page, 'Status', /^(text contains|文本包含)$/i, 'Open');
  await expect(gridCell(page, 'A2')).toBeVisible();
  await expect(gridCell(page, 'A4')).toBeVisible();
  await page.reload();
  await expect(gridCell(page, 'A2')).toBeVisible();
  await expect(gridCell(page, 'A4')).toBeVisible();
});

test('REQ-5-1-2：筛选到空结果后刷新仍保持空结果状态', async ({ page }) => {
  await createBlankWorkbook(page);
  await setClipboardText(page, [
    'Name\tDate\tNote',
    'Alpha East\t2026-01-10\tFilled',
    'Alpha West\t2026-02-10\tAlso filled',
  ].join('\n'));
  await gridCell(page, 'A1').click();
  await page.keyboard.press('Control+V');
  await selectCellRange(page, 'A1', 'C3');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: /^(create filter|创建筛选器)$/i }).click();
  await applyCondition(page, 'Name', /^(text contains|文本包含)$/i, 'Gamma');

  await expect(page.getByText(/no results|0 results|empty|无结果/i)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/no results|0 results|empty|无结果/i)).toBeVisible();
});

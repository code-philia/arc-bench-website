import { expect, Page, test } from '@playwright/test';
import {
  expectActiveWorksheet,
  gridCell,
  openWorkbookHome,
  uniqueName,
} from './support/e2e';

async function openCsvImport(page: Page): Promise<void> {
  await openWorkbookHome(page);
  await page.getByRole('button', { name: /^(import csv|导入 CSV)$/i }).click();
  await expect(page.getByRole('dialog', { name: /^(import csv|导入 CSV)$/i })).toBeVisible();
}

test('REQ-1-3-1：导入 UTF-8 CSV，并在刷新后保持原始行列与特殊字段', async ({ page }) => {
  const workbookName = uniqueName('pw-import');
  const csv = [
    '姓名,备注,数量,空列',
    '张三,"上海,浦东",42,',
    '李四,"他说""好""',
    '下一行",3,',
    'Alice,English text,007,',
  ].join('\r\n');

  await openCsvImport(page);
  await page.getByLabel(/^(csv file|CSV 文件)$/i).setInputFiles({
    name: `${workbookName}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });
  await page.getByRole('button', { name: /^(confirm import|确认导入)$/i }).click();

  await expect(page.getByText(workbookName, { exact: true })).toBeVisible();
  await expectActiveWorksheet(page, 'Sheet1');
  await expect(gridCell(page, 'A1')).toHaveText('姓名');
  await expect(gridCell(page, 'B1')).toHaveText('备注');
  await expect(gridCell(page, 'C1')).toHaveText('数量');
  await expect(gridCell(page, 'D1')).toHaveText('空列');
  await expect(gridCell(page, 'A2')).toHaveText('张三');
  await expect(gridCell(page, 'B2')).toHaveText('上海,浦东');
  await expect(gridCell(page, 'C2')).toHaveText('42');
  await expect(gridCell(page, 'D2')).toHaveText('');
  await expect(gridCell(page, 'A3')).toHaveText('李四');
  await expect(gridCell(page, 'B3')).toHaveText('他说"好"\n下一行');
  await expect(gridCell(page, 'C3')).toHaveText('3');
  await expect(gridCell(page, 'D3')).toHaveText('');
  await expect(gridCell(page, 'A4')).toHaveText('Alice');
  await expect(gridCell(page, 'B4')).toHaveText('English text');
  await expect(gridCell(page, 'C4')).toHaveText('007');
  await expect(gridCell(page, 'D4')).toHaveText('');

  await page.reload();
  await expect(page.getByText(workbookName, { exact: true })).toBeVisible();
  await expectActiveWorksheet(page, 'Sheet1');
  await expect(gridCell(page, 'B2')).toHaveText('上海,浦东');
  await expect(gridCell(page, 'B3')).toHaveText('他说"好"\n下一行');
  await expect(gridCell(page, 'D2')).toHaveText('');
  await expect(gridCell(page, 'D3')).toHaveText('');
  await expect(gridCell(page, 'B4')).toHaveText('English text');
  await expect(gridCell(page, 'C4')).toHaveText('007');
});

test('REQ-1-3-1：未闭合引号的 CSV 被拒绝，且不会留下部分工作簿', async ({ page }) => {
  const workbookName = uniqueName('pw-invalid-import');

  await openCsvImport(page);
  await page.getByLabel(/^(csv file|CSV 文件)$/i).setInputFiles({
    name: `${workbookName}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from('姓名,备注\r\n张三,"未闭合', 'utf8'),
  });
  await page.getByRole('button', { name: /^(confirm import|确认导入)$/i }).click();

  await expect(page.getByText(/invalid csv file format\. import failed\.|CSV 文件格式无效，导入失败/i)).toBeVisible();
  await openWorkbookHome(page);
  await expect(page.getByRole('link', { name: workbookName, exact: true })).toHaveCount(0);
});

test('REQ-1-3-1：导入带空字段的 CSV，并在刷新后保持空白列', async ({ page }) => {
  const workbookName = uniqueName('pw-import');
  const csv = ['城市,说明,数量', '北京,首都,1', '天津,,2', '上海,金融中心,3'].join('\r\n');

  await openCsvImport(page);
  await page.getByLabel(/^(csv file|CSV 文件)$/i).setInputFiles({
    name: `${workbookName}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });
  await page.getByRole('button', { name: /^(confirm import|确认导入)$/i }).click();

  await expect(page.getByText(workbookName, { exact: true })).toBeVisible();
  await expect(gridCell(page, 'A2')).toHaveText('北京');
  await expect(gridCell(page, 'B3')).toHaveText('');
  await expect(gridCell(page, 'C4')).toHaveText('3');

  await page.reload();
  await expect(gridCell(page, 'A2')).toHaveText('北京');
  await expect(gridCell(page, 'B3')).toHaveText('');
  await expect(gridCell(page, 'C4')).toHaveText('3');
});

test('REQ-1-3-1：导入单列 CSV，并保持只有一个有效数据列', async ({ page }) => {
  const workbookName = uniqueName('pw-single-column-import');
  const csv = ['标题', 'Alpha', 'Beta', 'Gamma'].join('\r\n');

  await openCsvImport(page);
  await page.getByLabel(/^(csv file|CSV 文件)$/i).setInputFiles({
    name: `${workbookName}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });
  await page.getByRole('button', { name: /^(confirm import|确认导入)$/i }).click();

  await expect(page.getByText(workbookName, { exact: true })).toBeVisible();
  await expect(gridCell(page, 'A1')).toHaveText('标题');
  await expect(gridCell(page, 'A4')).toHaveText('Gamma');
  await page.reload();
  await expect(gridCell(page, 'A1')).toHaveText('标题');
  await expect(gridCell(page, 'A4')).toHaveText('Gamma');
});

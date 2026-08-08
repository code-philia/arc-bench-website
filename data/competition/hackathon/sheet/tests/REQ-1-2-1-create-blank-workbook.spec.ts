import { expect, test } from '@playwright/test';
import {
  createBlankWorkbook,
  expectActiveWorksheet,
  expectSelectedCell,
  gridCell,
} from './support/e2e';

test('REQ-1-2-1：创建空白工作簿，并在刷新后保留 Sheet1 与 A1 选中状态', async ({ page }) => {
  await createBlankWorkbook(page);

  await page.reload();
  await expectActiveWorksheet(page, 'Sheet1');
  await expectSelectedCell(page, 'A1');
  await expect(gridCell(page, 'A1')).toHaveText('');
});

import { Download, expect, Locator, Page, TestInfo } from '@playwright/test';

export function baseUrl(): string {
  return process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
}

export function requiredEnv(testInfo: TestInfo, name: string): string {
  const value = process.env[name];
  testInfo.skip(!value, `Set ${name} to run this scenario.`);
  return value!;
}

export function uniqueName(prefix: string): string {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${suffix}`;
}

export async function openWorkbookHome(page: Page): Promise<void> {
  await page.goto(baseUrl());
}

export function worksheetTab(page: Page, name: string): Locator {
  return page.getByRole('tab', { name, exact: true });
}

export function gridCell(page: Page, coordinate: string): Locator {
  return page.getByRole('gridcell', { name: coordinate, exact: true });
}

export function formulaBar(page: Page): Locator {
  return page.getByLabel(/^(formula bar|公式栏)$/i);
}

export function inlineCellEditor(page: Page, coordinate: string): Locator {
  const escapedCoordinate = coordinate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return page.getByRole('textbox', {
    name: new RegExp(`^(edit ${escapedCoordinate}|编辑 ${escapedCoordinate})$`, 'i'),
  });
}

export function rowHeader(page: Page, rowNumber: number): Locator {
  return page.getByRole('rowheader', { name: String(rowNumber), exact: true });
}

export function columnHeader(page: Page, columnLetters: string): Locator {
  return page.getByRole('columnheader', { name: columnLetters, exact: true });
}

export function worksheetOptionsButton(page: Page, worksheetName: string): Locator {
  const escapedName = worksheetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return page.getByRole('button', {
    name: new RegExp(
      `^(worksheet options for ${escapedName}|${escapedName} 的工作表选项)$`,
      'i',
    ),
  });
}

export async function expectActiveWorksheet(page: Page, name: string): Promise<void> {
  await expect(worksheetTab(page, name)).toHaveAttribute('aria-selected', 'true');
}

export async function expectSelectedCell(page: Page, coordinate: string): Promise<void> {
  await expect(gridCell(page, coordinate)).toHaveAttribute('aria-selected', 'true');
}

export async function createBlankWorkbook(page: Page): Promise<string> {
  await openWorkbookHome(page);
  await page.getByRole('button', {
    name: /^(new blank workbook|新建空白工作簿)$/i,
  }).click();
  await page.getByRole('button', { name: /^(create|创建)$/i }).click();
  await expectActiveWorksheet(page, 'Sheet1');
  await expectSelectedCell(page, 'A1');
  return page.url();
}

export async function addWorksheet(page: Page, expectedName: string): Promise<void> {
  await page.getByRole('button', { name: /^(add sheet|新增工作表)$/i }).click();
  await expectActiveWorksheet(page, expectedName);
  await expectSelectedCell(page, 'A1');
}

export async function openWorksheetOptions(page: Page, worksheetName: string): Promise<void> {
  await worksheetOptionsButton(page, worksheetName).click();
}

export async function openDataMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(data|数据)$/i }).click();
}

export async function selectCellRange(page: Page, start: string, end: string): Promise<void> {
  if (start === end) {
    await gridCell(page, start).click();
    return;
  }

  await gridCell(page, start).dragTo(gridCell(page, end));
}

export async function commitCellThroughFormulaBar(
  page: Page,
  coordinate: string,
  content: string,
): Promise<void> {
  await gridCell(page, coordinate).click();
  await formulaBar(page).fill(content);
  await formulaBar(page).press('Enter');
}

export async function commitCellThroughGrid(
  page: Page,
  coordinate: string,
  content: string,
): Promise<void> {
  await gridCell(page, coordinate).dblclick();
  const editor = inlineCellEditor(page, coordinate);
  await expect(editor).toBeVisible();
  await editor.fill(content);
  await editor.press('Enter');
}

export async function configureNumberValidation(
  page: Page,
  start: string,
  end: string,
  minimum: string,
  maximum: string,
): Promise<void> {
  await selectCellRange(page, start, end);
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: /^(data validation|数据校验)$/i }).click();
  const dialog = page.getByRole('dialog', { name: /^(data validation|数据校验)$/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^(rule type|规则类型)$/i).click();
  await page.getByRole('option', { name: /^(number range|数值范围)$/i }).click();
  await dialog.getByLabel(/^(minimum|最小值)$/i).fill(minimum);
  await dialog.getByLabel(/^(maximum|最大值)$/i).fill(maximum);
  await dialog.getByRole('button', { name: /^(save|保存)$/i }).click();
}

export async function configureDropdownValidation(
  page: Page,
  start: string,
  end: string,
  allowedValues: string[],
): Promise<void> {
  await selectCellRange(page, start, end);
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: /^(data validation|数据校验)$/i }).click();
  const dialog = page.getByRole('dialog', { name: /^(data validation|数据校验)$/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^(rule type|规则类型)$/i).click();
  await page.getByRole('option', { name: /^(dropdown|下拉列表)$/i }).click();
  await dialog.getByLabel(/^(allowed values|允许值)$/i).fill(allowedValues.join(', '));
  await dialog.getByRole('button', { name: /^(save|保存)$/i }).click();
}

export async function setClipboardText(page: Page, content: string): Promise<void> {
  const origin = new URL(page.url()).origin;
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  await page.evaluate(async (text) => navigator.clipboard.writeText(text), content);
}

export async function readDownload(download: Download): Promise<string> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
}

export function normalizeCsv(csv: string): string {
  return csv
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n$/, '');
}

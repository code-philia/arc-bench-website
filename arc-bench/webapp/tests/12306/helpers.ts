import { Page, expect } from '@playwright/test';

function getLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Navigate to the home page and wait for it to load.
 */
export async function navigateToHomePage(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
}

/**
 * Navigate to the login page from the home page by clicking the "Login" link.
 */
export async function navigateToLoginPage(page: Page) {
  await navigateToHomePage(page);
  await page.getByRole('link', { name: /Login/i }).click();
  await page.waitForURL(/login/i, { timeout: 10000 });
}

/**
 * Navigate to the registration page from the home page by clicking the "Register" link.
 */
export async function navigateToRegistrationPage(page: Page) {
  await navigateToHomePage(page);
  await page.getByRole('link', { name: /Register/i }).click();
  await page.waitForURL(/register/i, { timeout: 10000 });
}

/**
 * Log in as the test user with valid credentials.
 * If already logged in (e.g., from a prior step in the same test), skips the login.
 * If login fails (e.g., password was changed by a prior test), resets the password first.
 */
export async function loginAsTestUser(page: Page) {
  // Check if already logged in by looking for the username in the header
  const alreadyLoggedIn = await page.locator('.utility-links').getByText(/testuser/i).isVisible().catch(() => false);
  if (alreadyLoggedIn) {
    return;
  }

  await navigateToLoginPage(page);
  await page.getByPlaceholder(/Email\/Username\/Mobile number/i).fill('testuser');
  await page.getByPlaceholder(/^Password$/i).fill('Test1234!');
  await page.getByRole('button', { name: /LOGIN/i }).click();
  // Wait for navigation or error
  await page.waitForTimeout(1000);

  // Check if login succeeded by looking for the user link in the header
  const loggedIn = await page.locator('.utility-links').getByText(/testuser/i).isVisible().catch(() => false);
  if (!loggedIn) {
    // Login likely failed due to a password change from a prior test.
    // Reset the password directly via the database API and retry.
    await resetTestUserPasswordViaApi(page);
    await navigateToLoginPage(page);
    await page.getByPlaceholder(/Email\/Username\/Mobile number/i).fill('testuser');
    await page.getByPlaceholder(/^Password$/i).fill('Test1234!');
    await page.getByRole('button', { name: /LOGIN/i }).click();
    await page.waitForTimeout(1000);
  }
}

/**
 * Reset the test user's password directly via the forgot-password API.
 * Uses the passport number as the ID number since the email may have been changed by prior tests.
 */
async function resetTestUserPasswordViaApi(page: Page) {
  // Try the original email first, then try with the passport number as ID
  const verifyResponse = await page.request.post('http://localhost:3000/api/auth/forgot-password/verify', {
    data: { email: 'testuser@example.com', idNumber: '1234567890' },
  });
  const verifyData = await verifyResponse.json();

  // If the original email doesn't work, try with the passport number
  let resetToken = verifyData.resetToken;
  if (!resetToken) {
    const verifyResponse2 = await page.request.post('http://localhost:3000/api/auth/forgot-password/verify', {
      data: { email: 'testuser@example.com', idNumber: 'E12345678' },
    });
    const verifyData2 = await verifyResponse2.json();
    resetToken = verifyData2.resetToken;
  }

  // If still no token, the email was likely changed; try finding it via the login endpoint
  // In that case, we directly reset via the DB by executing a Node script
  if (!resetToken) {
    const { execSync } = require('child_process');
    try {
      execSync(
        'node -e "const db=require(\'./src/database/init_db\');const{hashPassword}=require(\'./src/utils/security\');db.run(\'UPDATE users SET password_hash=?,email=? WHERE username=?\',[hashPassword(\'Test1234!\'),\'testuser@example.com\',\'testuser\'],()=>db.close())"',
        { cwd: 'D:/project/arc-bench-demo/12306/backend', timeout: 5000 },
      );
    } catch {
      // Ignore errors; the login retry will fail gracefully
    }
    return;
  }

  await page.request.post('http://localhost:3000/api/auth/forgot-password/reset', {
    data: { resetToken, newPassword: 'Test1234!', confirmNewPassword: 'Test1234!' },
  });
}

/**
 * Fill the registration form with the provided values.
 * Only fills fields that are provided; leaves others untouched.
 */
export async function fillRegistrationForm(page: Page, fields: {
  nationality?: string;
  name?: string;
  passportNumber?: string;
  passportExpirationDate?: string;
  dateOfBirth?: string;
  gender?: 'Male' | 'Female';
  username?: string;
  password?: string;
  confirmPassword?: string;
  emailAddress?: string;
}) {
  if (fields.nationality) {
    await page.getByLabel(/Nationality/i).selectOption({ label: fields.nationality });
  }
  if (fields.name) {
    await page.getByLabel(/^Name$/i).fill(fields.name);
  }
  if (fields.passportNumber) {
    await page.getByLabel(/Passport number/i).fill(fields.passportNumber);
  }
  if (fields.passportExpirationDate) {
    await page.getByLabel(/Passport expiration date/i).fill(fields.passportExpirationDate);
  }
  if (fields.dateOfBirth) {
    await page.getByLabel(/Date of birth/i).fill(fields.dateOfBirth);
  }
  if (fields.gender) {
    await page.getByLabel(new RegExp(`^${fields.gender}$`, 'i')).check();
  }
  if (fields.username) {
    await page.getByLabel(/Username/i).fill(fields.username);
  }
  if (fields.password) {
    await page.getByLabel(/^Password$/i).fill(fields.password);
  }
  if (fields.confirmPassword) {
    await page.getByLabel(/Confirm Password/i).fill(fields.confirmPassword);
  }
  if (fields.emailAddress) {
    await page.getByLabel(/Email address/i).fill(fields.emailAddress);
  }
}

/**
 * Fill the complete valid registration form and check the agreement checkbox.
 * Uses unique values that should not conflict with existing data.
 */
export async function fillValidRegistrationForm(page: Page, overrides?: {
  passportNumber?: string;
  username?: string;
}) {
  const timestamp = Date.now();
  await fillRegistrationForm(page, {
    nationality: 'China',
    name: 'Test User',
    passportNumber: overrides?.passportNumber ?? `E${timestamp}`,
    passportExpirationDate: '2030-12-31',
    dateOfBirth: '1990-01-01',
    gender: 'Male',
    username: overrides?.username ?? `testuser_${timestamp}`,
    password: 'Test1234!',
    confirmPassword: 'Test1234!',
    emailAddress: `test_${timestamp}@example.com`,
  });
  // Check the agreement checkbox
  await page.getByRole('checkbox', { name: /Terms of Service.*Privacy Policy/i }).check();
}

/**
 * Navigate to the forgot password page from the login page.
 */
export async function navigateToForgotPasswordPage(page: Page) {
  await navigateToLoginPage(page);
  await page.getByRole('link', { name: /Forgot password/i }).click();
  await page.waitForURL(/forgot.*password|reset.*password/i, { timeout: 10000 });
}

/**
 * Select a location in the From/To field by typing pinyin/Chinese and picking from the fuzzy-matched list.
 */
export async function selectLocationByTyping(page: Page, fieldPlaceholder: string, query: string) {
  const input = page.getByPlaceholder(new RegExp(fieldPlaceholder, 'i'));
  await input.click();
  await input.fill(query);
  // Wait for the fuzzy-matched list to appear
  await page.getByText(/Top destinations/i).waitFor({ state: 'visible', timeout: 5000 });
  // Wait a moment for any race conditions between API calls to resolve
  await page.waitForTimeout(500);
  // Click the first matching item in the list
  const listItems = page.locator('.location-option, .location-list button, [class*="location"] [class*="option"]').first();
  await listItems.click();
  // Verify the input was updated (in case a stale suggestion was clicked)
  const inputValue = await input.inputValue();
  if (!inputValue.toLowerCase().includes(query.toLowerCase())) {
    // The wrong option was selected; retry
    await input.click();
    await input.fill(query);
    await page.getByText(/Top destinations/i).waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(1000);
    await page.locator('.location-option, .location-list button, [class*="location"] [class*="option"]').first().click();
  }
}

/**
 * Select a location in the From/To field by clicking the input to open the tabbed selector,
 * switching to a specific tab, and clicking a location item.
 */
export async function selectLocationByTab(page: Page, fieldPlaceholder: string, tabName: string) {
  const input = page.getByPlaceholder(new RegExp(fieldPlaceholder, 'i'));
  await input.click();
  // Click the specified tab in the location selector
  await page.getByRole('tab', { name: new RegExp(tabName, 'i') }).click().catch(async () => {
    // Fallback: click the tab button by text
    await page.locator('.location-tab', { hasText: new RegExp(tabName, 'i') }).click();
  });
  // Click the first available location item in the tab content
  const tabPanel = page.getByRole('tabpanel');
  const locationItem = tabPanel.locator('.location-grid-item, button, li, [class*="item"], [class*="station"], [class*="city"]').first();
  await locationItem.click();
}

/**
 * Select a departure date from the date picker.
 * Dates are from current day through next two weeks only.
 */
export async function selectDepartureDate(page: Page, dateValue: string) {
  const dateInput = page.getByPlaceholder(/Date/i);
  // Try filling the date input directly first (works for native date inputs)
  await dateInput.fill(dateValue).catch(async () => {
    // Fallback: click to open the date picker, then click the target date cell
    await dateInput.click();
    await page.waitForTimeout(500);
    await page.getByText(new RegExp(`^${dateValue}$`), { exact: false }).first().click();
  });
}

/**
 * Perform a quick search from the home page with the given departure, arrival, and date.
 * Assumes the user is already on the home page.
 */
export async function performQuickSearch(page: Page, options: {
  from: string;
  to: string;
  date?: string;
}) {
  await selectLocationByTyping(page, 'From', options.from);
  await selectLocationByTyping(page, 'To', options.to);
  if (options.date) {
    await selectDepartureDate(page, options.date);
  }
  await page.getByRole('button', { name: /Search/i }).click();
}

/**
 * Navigate to the search results page by performing a quick search from the home page.
 * Uses Beijing -> Shanghai as default search conditions.
 */
export async function navigateToSearchResults(page: Page) {
  const today = getLocalDate();
  // Navigate directly to the search results URL for Beijing -> Shanghai
  await page.goto(`/tickets?from=${encodeURIComponent('Beijing(北京)')}&to=${encodeURIComponent('Shanghai(上海)')}&date=${encodeURIComponent(today)}`);
  // Wait for the search results to load (either results or the search panel)
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
}

/**
 * Navigate to the search results page via the navigation bar: hover "Booking" > click "Tickets".
 * This uses the default search conditions (Beijing -> Shanghai, current date).
 */
export async function navigateToSearchResultsViaNav(page: Page) {
  await navigateToHomePage(page);
  await page.locator('.main-nav').getByText(/Booking/i).hover();
  // Click the "Tickets" link in the navigation dropdown (scoped to nav-menu to avoid matching Quick Guide links)
  await page.locator('.nav-menu').getByRole('link', { name: /Tickets/i }).click();
  await page.waitForURL(/search|result|ticket/i, { timeout: 10000 });
}

/**
 * Navigate to a search results page that has no direct trains (for transfer journey tests).
 * Uses a route that is known to have no direct trains but has transfer plans (Beijing -> Wuhan).
 */
export async function navigateToNoDirectTrainResults(page: Page) {
  const today = getLocalDate();
  // Navigate directly to search results for Beijing -> Wuhan (has transfer plans but no direct trains)
  await page.goto(`/tickets?from=${encodeURIComponent('Beijing(北京)')}&to=${encodeURIComponent('Wuhan(武汉)')}&date=${encodeURIComponent(today)}`);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
}

// ─── Personal Center Navigation ───────────────────────────────────────────

/**
 * Log in and navigate to the personal center home page by clicking "My 12306".
 */
export async function navigateToPersonalCenter(page: Page) {
  await loginAsTestUser(page);
  // Wait for the My 12306 button to be visible (indicates login state is rendered)
  await page.locator('.utility-links').getByText(/My 12306/i).click();
  await page.waitForURL(/personal|center|account/i, { timeout: 10000 });
}

/**
 * Navigate to the Ticket Orders page from the personal center.
 * Clicks "Order center" then "Ticket orders" within the sidebar.
 */
export async function navigateToTicketOrders(page: Page) {
  await navigateToPersonalCenter(page);
  const sidebar = page.locator('.personal-sidebar');
  await sidebar.getByText(/Order center/i).click();
  await sidebar.getByText(/Ticket orders/i).click();
  await page.waitForTimeout(1000);
}

/**
 * Navigate to the User Information page from the personal center.
 * Clicks "Personal" then "User information" within the sidebar.
 */
export async function navigateToUserInformation(page: Page) {
  await navigateToPersonalCenter(page);
  const sidebar = page.locator('.personal-sidebar');
  await sidebar.getByText(/^Personal$/i).click();
  await sidebar.getByText(/User information/i).click();
  await page.waitForTimeout(1000);
}

/**
 * Navigate to the Account Security page from the personal center.
 * Clicks "Personal" then "Account security" within the sidebar.
 */
export async function navigateToAccountSecurity(page: Page) {
  await navigateToPersonalCenter(page);
  const sidebar = page.locator('.personal-sidebar');
  await sidebar.getByText(/^Personal$/i).click();
  await sidebar.getByText(/Account security/i).click();
  await page.waitForTimeout(1000);
}

/**
 * Navigate to the Verify Mobile Number page from the personal center.
 * Clicks "Personal" then "Verify mobile number" within the sidebar.
 */
export async function navigateToVerifyMobile(page: Page) {
  await navigateToPersonalCenter(page);
  const sidebar = page.locator('.personal-sidebar');
  await sidebar.getByText(/^Personal$/i).click();
  await sidebar.getByText(/Verify mobile number/i).click();
  await page.waitForTimeout(1000);
}

/**
 * Navigate to the My Passengers page from the personal center.
 * Clicks "Information management" then "My Passengers" within the sidebar.
 */
export async function navigateToMyPassengers(page: Page) {
  await navigateToPersonalCenter(page);
  const sidebar = page.locator('.personal-sidebar');
  await sidebar.getByText(/Information management/i).click();
  await sidebar.getByText(/My Passengers/i).click();
  await page.waitForTimeout(1000);
}

// ─── Booking Flow Helpers ─────────────────────────────────────────────────

/**
 * Log in as test user and navigate to search results page (Beijing -> Shanghai).
 */
export async function navigateToSearchResultsLoggedIn(page: Page) {
  await loginAsTestUser(page);
  await navigateToSearchResults(page);
}

/**
 * On a populated search results page, click the first "Book" button.
 * Assumes the user is already on the search results page.
 */
export async function clickFirstBookButton(page: Page) {
  // Find a Book button for a seat type that has available tickets (not "None left")
  // Each Book button is inside a .price-row that also contains a <small> with the remaining label
  const bookButtons = page.locator('.mini-book-button');
  const count = await bookButtons.count();

  for (let i = 0; i < count; i++) {
    const remainingLabel = await bookButtons.nth(i).evaluate(el => {
      const priceRow = el.closest('.price-row');
      if (!priceRow) return '';
      const smalls = priceRow.querySelectorAll('small');
      // The second <small> is the remaining label
      return smalls.length > 1 ? smalls[1].textContent || '' : '';
    });
    if (remainingLabel && !remainingLabel.includes('None left')) {
      await bookButtons.nth(i).click();
      return;
    }
  }

  // Fallback: click the first Book button
  const bookButton = page.getByRole('button', { name: /^Book$/i }).first();
  await expect(bookButton).toBeVisible({ timeout: 10000 });
  await bookButton.click();
}

/**
 * Open the booking form: log in, search, and click "Book" on the first result.
 */
export async function openBookingForm(page: Page) {
  await navigateToSearchResultsLoggedIn(page);
  // Wait for search results to fully load (book buttons visible)
  await expect(page.locator('.mini-book-button').first()).toBeVisible({ timeout: 10000 });
  await clickFirstBookButton(page);
  // Wait for the booking page to load
  await expect(page.locator('.booking-shell, .loading-box').first()).toBeVisible({ timeout: 10000 });
  // Wait for booking data to load (shell should appear, loading should disappear)
  await expect(page.locator('.booking-shell')).toBeVisible({ timeout: 10000 });
}

/**
 * On the booking form, select the first available passenger from the passenger list.
 */
export async function selectFirstPassengerOnBookingForm(page: Page) {
  // Wait for the passenger list to load before trying to select
  await expect(page.locator('.booking-passenger-chip').first()).toBeVisible({ timeout: 10000 }).catch(async () => {
    // Fallback: wait for any passenger-related element
    await page.locator('.booking-passenger-list').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  });
  // Click the chip label to toggle the passenger — this triggers React's onChange
  const passengerChip = page.locator('.booking-passenger-chip').first();
  const passengerCheckbox = page.locator('.booking-passenger-chip input[type="checkbox"]').first();
  // Try up to 3 times to select the passenger
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await page.waitForTimeout(300);
    const isChecked = await passengerCheckbox.isChecked().catch(() => false);
    if (isChecked) return;
    await passengerChip.click();
    // Also try checking the checkbox directly as a backup
    await passengerCheckbox.check().catch(() => {});
  }
  // Final verification
  await expect(passengerCheckbox).toBeChecked({ timeout: 5000 });
}

/**
 * On the booking form, select a ticket class that has remaining tickets.
 * This avoids "no tickets available" errors when the default class is sold out.
 */
async function selectAvailableTicketClass(page: Page) {
  // Read all seat info items to find one with remaining tickets
  const seatItems = page.locator('.booking-seat-item');
  const seatCount = await seatItems.count();
  for (let i = 0; i < seatCount; i++) {
    const text = await seatItems.nth(i).textContent();
    if (text && !text.includes('None left')) {
      // Extract the seat type name (text before the parenthesis)
      const match = text.match(/^([\w\s-]+)\s*\(/);
      if (match) {
        const ticketClassSelect = page.locator('.booking-passenger-table select').first();
        await ticketClassSelect.selectOption(match[1].trim());
        return;
      }
    }
  }
}

/**
 * Full booking flow: open booking form, select a passenger, and click "Place order".
 */
export async function submitBookingWithPassenger(page: Page) {
  await openBookingForm(page);
  // Wait for the booking form to fully load (passenger list visible)
  await expect(page.locator('.booking-passenger-chip').first()).toBeVisible({ timeout: 10000 });
  await selectFirstPassengerOnBookingForm(page);
  // Wait for the passenger row to appear in the table
  await expect(page.locator('.booking-passenger-table tbody tr').first()).toBeVisible({ timeout: 5000 });
  // Ensure a ticket class with remaining tickets is selected
  await selectAvailableTicketClass(page);
  await page.getByRole('button', { name: /Place order/i }).click();
  // Wait for the confirmation dialog to appear
  await expect(page.getByText(/Please confirm the following information/i)).toBeVisible({ timeout: 10000 });
}

/**
 * After submitting a booking, click "Confirm" in the confirmation dialog.
 */
export async function confirmOrder(page: Page) {
  await expect(page.getByText(/Please confirm the following information/i)).toBeVisible({ timeout: 10000 }).catch(() => {});
  // Click the Confirm button within the booking confirmation modal
  await page.locator('.booking-confirm-actions').getByRole('button', { name: /Confirm/i }).click();
  // Wait for navigation to payment page or success message
  await page.waitForTimeout(2000);
}

// ─── Self-contained Test Setup Helpers ─────────────────────────────────────

/**
 * Create an unpaid order by going through the full booking flow and stopping at the payment page.
 * Returns without paying, so the order remains in "Uncompleted orders".
 */
export async function createUnpaidOrder(page: Page) {
  await submitBookingWithPassenger(page);
  await confirmOrder(page);
  // Now on the payment page — the order is created but unpaid
  await page.waitForTimeout(2000);
}

/**
 * Create a paid order by going through the full booking flow and completing payment.
 * The order will appear in "Upcoming trips".
 */
export async function createPaidOrder(page: Page) {
  await submitBookingWithPassenger(page);
  await confirmOrder(page);
  // Wait for payment page to load
  await page.waitForTimeout(2000);
  // Click "Pay" on the payment page
  const payButton = page.getByRole('button', { name: /Pay/i }).first();
  await expect(payButton).toBeVisible({ timeout: 10000 }).catch(() => {});
  await payButton.click().catch(() => {});
  // Payment navigates to personal center — wait for navigation
  await page.waitForTimeout(3000);
}

/**
 * Cancel the order currently on the payment page.
 */
export async function cancelOrderOnPaymentPage(page: Page) {
  const cancelButton = page.getByRole('button', { name: /Cancel/i }).first();
  await expect(cancelButton).toBeVisible({ timeout: 10000 }).catch(() => {});
  await cancelButton.click().catch(() => {});
  await page.waitForTimeout(2000);
}

/**
 * Add a deletable passenger from the "My Passengers" page.
 * Returns the passport number used (for identification).
 */
export async function addDeletablePassenger(page: Page, nameSuffix: string): Promise<string> {
  const timestamp = Date.now();
  const passportNumber = `P${timestamp}${nameSuffix}`;
  await page.getByRole('button', { name: /Add new passengers/i }).click();
  await page.waitForTimeout(500);

  await page.getByLabel(/Nationality/i).selectOption({ label: 'China' }).catch(() => {});
  await page.getByLabel(/Name/i).fill(`Passenger ${nameSuffix}`);
  await page.getByLabel(/Passport number/i).fill(passportNumber);
  await page.getByLabel(/Passport expiration date/i).fill('2030-12-31');
  await page.getByLabel(/Date of birth/i).fill('1995-06-15');
  await page.getByLabel(/Gender/i).selectOption({ label: 'Male' }).catch(() => {});
  await page.getByLabel(/Email/i).fill(`passenger_${timestamp}${nameSuffix}@example.com`);
  await page.getByLabel(/Mobile number/i).fill('13800138000');
  await page.getByLabel(/Passenger type/i).selectOption({ label: 'Adult' }).catch(() => {});

  await page.getByRole('button', { name: /Determine/i }).click();
  await page.waitForTimeout(2000);
  return passportNumber;
}

/**
 * Restore the test user's password by using the account security password change form.
 * This is used after tests that change the password.
 */
export async function restoreTestUserPassword(page: Page, currentPassword: string) {
  // Use the forgot-password API to reset the password back to the default
  const verifyResponse = await page.request.post('http://localhost:3000/api/auth/forgot-password/verify', {
    data: { email: 'testuser@example.com', idNumber: '1234567890' },
  });
  const verifyData = await verifyResponse.json();
  if (!verifyData.resetToken) return;

  await page.request.post('http://localhost:3000/api/auth/forgot-password/reset', {
    data: { resetToken: verifyData.resetToken, newPassword: 'Test1234!', confirmNewPassword: 'Test1234!' },
  });
}

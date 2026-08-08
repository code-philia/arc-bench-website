# Currency
A currency conversion app that lets users switch the active base currency, manage visible currencies and calculation values, inspect and refresh exchange-rate data, and configure display-related preferences.

## REQ-1 Convert With Different Base Currencies
The app shall allow users to choose a visible currency as the active base currency so the conversion context updates across the supported currencies list.

**Dependencies:** None

### REQ-1.1 Select A Visible Base Currency
The app shall allow users to tap a visible currency entry to make it the current base currency.

**Dependencies:** None

**Scenarios:**
- Select USD As The Base Currency
  - **GIVEN:** The currency list is visible and selectable rows use resource-id "org.billthefarmer.currency:id/name".
  - **WHEN:** The user taps the entry with text "USD".
  - **THEN:** United States Dollar becomes the active base currency.

### REQ-1.2 Switch The Base Currency Repeatedly
The app shall allow users to switch the active base currency from one visible currency to another and update the displayed conversion context each time.

**Dependencies:** REQ-1.1

**Scenarios:**
- Switch From USD To GBP And CAD
  - **GIVEN:** The currency list is visible and USD is currently selected as the base currency.
  - **WHEN:** The user taps the row with text "GBP" and then taps the row with text "CAD", both using resource-id "org.billthefarmer.currency:id/name".
  - **THEN:** The active base currency changes first to GBP and then to CAD, and the displayed conversions follow the current selection.

## REQ-2 Manage Currency List And Calculation Value
The app shall allow users to add visible currencies, select currencies for list management, remove selected entries, trigger an overflow update, and set the base amount used for calculations.

**Dependencies:** None

### REQ-2.1 Open The Currency Picker
The app shall allow users to open the currency picker used to add or activate visible currencies.

**Dependencies:** None

**Scenarios:**
- Open The Currency Picker
  - **GIVEN:** The visible currency list is open.
  - **WHEN:** The user taps the add action with resource-id "org.billthefarmer.currency:id/action_add".
  - **THEN:** The app opens the currency picker.

### REQ-2.2 Add A Currency To The Visible List
The app shall allow users to choose a currency from the picker so it becomes available in the visible list.

**Dependencies:** REQ-2.1

**Scenarios:**
- Add AUD From The Currency Picker
  - **GIVEN:** The currency picker is open.
  - **WHEN:** The user taps the picker entry with resource-id "org.billthefarmer.currency:id/name" and text "AUD".
  - **THEN:** Australian Dollar is added or activated in the visible currency list.

### REQ-2.3 Select A Currency For Management
The app shall allow users to long-press a visible currency so it becomes selected for list-management actions.

**Dependencies:** None

**Scenarios:**
- Select USD For Management
  - **GIVEN:** The visible currency list contains an entry with resource-id "org.billthefarmer.currency:id/name" and text "USD".
  - **WHEN:** The user long-presses the "USD" row.
  - **THEN:** The USD entry becomes selected for a management action.

### REQ-2.4 Remove A Selected Currency
The app shall allow users to remove a currently selected currency from the visible list.

**Dependencies:** REQ-2.3

**Scenarios:**
- Remove The Selected USD Entry
  - **GIVEN:** The "USD" currency entry is selected for management.
  - **WHEN:** The user taps the remove action with resource-id "org.billthefarmer.currency:id/action_remove".
  - **THEN:** The selected USD entry is removed from the list.

### REQ-2.5 Open The Overflow Menu
The app shall allow users to open the overflow menu that contains additional currency-list actions.

**Dependencies:** None

**Scenarios:**
- Open More Options
  - **GIVEN:** The currency list screen is open.
  - **WHEN:** The user taps the button with content-desc "More options".
  - **THEN:** The overflow menu opens with additional commands.

### REQ-2.6 Trigger Rate Update From Overflow
The app shall allow users to start an update of currency-rate data from the overflow menu.

**Dependencies:** REQ-2.5

**Scenarios:**
- Trigger Update From Menu
  - **GIVEN:** The overflow menu is open.
  - **WHEN:** The user taps the menu item with resource-id "android:id/title" and text "Update".
  - **THEN:** The app starts refreshing exchange-rate data.

### REQ-2.7 Set The Calculation Amount
The app shall allow users to enter and confirm a base amount for calculating visible conversions.

**Dependencies:** None

**Scenarios:**
- Set The Base Amount To 1000
  - **GIVEN:** The amount field is available on the currency list screen.
  - **WHEN:** The user enters "1000" into the field with resource-id "org.billthefarmer.currency:id/value" and confirms with the positive button using resource-id "android:id/button1" and text "OK".
  - **THEN:** The app applies 1000 as the calculation amount and updates the visible conversions.

## REQ-3 Inspect And Refresh Exchange Rates
The app shall provide visible exchange-rate status feedback and a dedicated manual refresh control for the latest rate data.

**Dependencies:** None

### REQ-3.1 Inspect The Current Rate Status
The app shall provide a status indicator that users can tap to inspect the current rate-update state.

**Dependencies:** None

**Scenarios:**
- Tap The OK Status Indicator
  - **GIVEN:** A status element with resource-id "org.billthefarmer.currency:id/status" and text "OK" is visible.
  - **WHEN:** The user taps the status indicator.
  - **THEN:** The app affirms that the current update state is OK.

### REQ-3.2 Refresh Rates With The Refresh Action
The app shall allow users to manually refresh exchange-rate data by using the dedicated refresh action.

**Dependencies:** None

**Scenarios:**
- Refresh Rates With The Toolbar Action
  - **GIVEN:** The currency list screen is open.
  - **WHEN:** The user taps the refresh action with resource-id "org.billthefarmer.currency:id/action_refresh".
  - **THEN:** The app begins updating currency information with the latest available rates.

## REQ-4 Configure Currency Preferences
The app shall provide a settings flow where users can access roaming behavior and choose how many fraction digits are displayed for currency values.

**Dependencies:** None

### REQ-4.1 Open The Settings Screen
The app shall allow users to navigate to the settings list from the app interface.

**Dependencies:** None

**Scenarios:**
- Navigate To Settings
  - **GIVEN:** The current screen shows a top app bar button with content-desc "Navigate up".
  - **WHEN:** The user taps "Navigate up" and then taps the entry with resource-id "android:id/title" and text "Settings".
  - **THEN:** The settings list opens.

### REQ-4.2 Access The Roaming Preference
The app shall allow users to open or toggle the roaming-related update preference from the settings list.

**Dependencies:** REQ-4.1

**Scenarios:**
- Open The Roaming Preference
  - **GIVEN:** The settings list is open.
  - **WHEN:** The user taps the preference with resource-id "android:id/title" and text "Roaming".
  - **THEN:** The roaming-related preference is exposed or toggled.

### REQ-4.3 Open The Fraction Digits Selector
The app shall allow users to open the fraction-digit chooser from the settings list.

**Dependencies:** REQ-4.1

**Scenarios:**
- Open The Fraction Digits Dialog
  - **GIVEN:** The settings list is open.
  - **WHEN:** The user taps the preference with resource-id "android:id/title" and text "Fraction digits".
  - **THEN:** The fraction-digit chooser opens.

### REQ-4.4 Select Four Fraction Digits
The app shall allow users to choose a fraction-digit precision option for displayed currency values.

**Dependencies:** REQ-4.3

**Scenarios:**
- Apply Four Fraction Digits
  - **GIVEN:** The fraction-digit chooser is open.
  - **WHEN:** The user taps the option with resource-id "android:id/text1" and text "Four fraction digits".
  - **THEN:** Currency values are displayed with four fraction digits.

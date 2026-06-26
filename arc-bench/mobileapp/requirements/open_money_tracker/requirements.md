# Open Money Tracker
An app for recording categorized income and expense transactions and showing the resulting balance in the total amount view.

## REQ-1 Add And Categorize Income
The app shall allow users to open the income entry flow and save an income transaction with an amount and category.

**Dependencies:** None

### REQ-1.1 Open Income Entry Form
The app shall allow users to open the income transaction form from the main screen.

**Dependencies:** None

**Scenarios:**
- Open The Income Entry Screen
  - **GIVEN:** The Open Money Tracker app is open.
  - **WHEN:** The user taps the "Add Income" button with resource-id "com.blogspot.e_kanivets.moneytracker:id/btnAddIncome".
  - **THEN:** The income entry screen opens with the amount field "com.blogspot.e.kanivets.moneytracker:id/etPrice" and the category field "com.blogspot.e_kanivets.moneytracker:id/etCategory" available.

### REQ-1.2 Save Income Transaction
The app shall allow users to enter an income amount and category and save the transaction.

**Dependencies:** REQ-1.1

**Scenarios:**
- Save An Income Entry For Salary
  - **GIVEN:** The income entry screen is open.
  - **WHEN:** The user enters "123" into "com.blogspot.e.kanivets.moneytracker:id/etPrice", enters "salary" into "com.blogspot.e_kanivets.moneytracker:id/etCategory", and taps the done action "com.blogspot.e_kanivets.moneytracker:id/fabDone".
  - **THEN:** The transaction is saved and the total amount view "com.blogspot.e_kanivets.moneytracker:id/tvTotal" shows "+ 123 NON".

## REQ-2 Add And Categorize Expenses
The app shall allow users to open the expense entry flow and save an expense transaction with an amount and category.

**Dependencies:** None

### REQ-2.1 Open Expense Entry Form
The app shall allow users to open the expense transaction form from the main screen.

**Dependencies:** None

**Scenarios:**
- Open The Expense Entry Screen
  - **GIVEN:** The Open Money Tracker app is open.
  - **WHEN:** The user taps the "Add Expense" button with resource-id "com.blogspot.e_kanivets.moneytracker:id/btnAddExpense".
  - **THEN:** The expense entry screen opens with amount and category inputs available for editing.

### REQ-2.2 Save Expense Transaction
The app shall allow users to enter an expense amount and category and save the transaction.

**Dependencies:** REQ-2.1

**Scenarios:**
- Save An Expense Entry For Food
  - **GIVEN:** An income entry of "123" already exists and the expense entry screen is open.
  - **WHEN:** The user enters "200" into the price field, enters "food" into the category field, and taps the done action "com.blogspot.e_kanivets.moneytracker:id/fabDone".
  - **THEN:** The transaction is saved and the total amount view "com.blogspot.e_kanivets.moneytracker:id/tvTotal" shows "- 77 NON".

## REQ-3 Display And Update Total Amount
The app shall display a total amount that reflects the current net balance after income and expense transactions are recorded.

**Dependencies:** REQ-1.2, REQ-2.2

**Scenarios:**
- Recalculate The Balance After Income And Expense Changes
  - **GIVEN:** The main screen includes the total amount view "com.blogspot.e_kanivets.moneytracker:id/tvTotal".
  - **WHEN:** The user saves an income entry of "123" and later saves an expense entry of "200".
  - **THEN:** The total amount updates to "- 77 NON" to reflect the net balance.

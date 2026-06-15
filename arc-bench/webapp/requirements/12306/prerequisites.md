# Prerequisites for 12306 Test Suite

## 1. Pre-existing User Account

| Field | Value |
|-------|-------|
| Username | `testuser` |
| Password | `Test1234!` |
| Email | `testuser@example.com` |
| Passport number | `E12345678` |
| ID number | `1234567890` |
| Name | `Test User` |
| Nationality | `China` |
| Gender | `Male` |
| Passenger type | `Adult` |
| Mobile number | Any valid mobile |

Email `testuser@example.com` and ID number `1234567890` must belong to the **same** user account.

## 2. Data That Must NOT Exist

| Value | Type | Reason |
|-------|------|--------|
| `nonexistent_user_12345` | Username | Tests "User not found" |
| `9999999999` | ID number | Must not be associated with `testuser@example.com` |
| `WrongPassword1!` | Password | Must not be the actual password of `testuser` |

## 3. Train Route Data

### Beijing → Shanghai

- At least **2 direct trains** with different departure times.
- At least one **G/C/D** train and one **Other** type train.
- At least **2 different departure stations** in Beijing.
- At least **2 different arrival stations** in Shanghai.
- Departure times spanning at least **2 of**: 00:00-06:00, 06:00-12:00, 12:00-18:00, 18:00-24:00.
- At least **1 seat class with available tickets** (>0 remaining).
- At least **1 seat class with no remaining tickets** (e.g., "None left").

### Beijing → Lhasa

- **No direct train**.
- At least **2 transfer plans**, each with 2 train segments and a "Book" button.

### Beijing → Guangzhou

- At least **1 direct train**.

## 4. Location Selector Data

- Fuzzy match must work for: `beijing`, `shanghai`, `guangzhou`, `lhasa`.
- Tabbed selector must have tabs: "Popular", "ABCDE", "FGHIJ", "KLMNO", "PQRST", "UVWXYZ".
- "Popular" tab must have at least 1 selectable city/station.

## 5. Form Select Options

| Form | Field | Required Options |
|------|-------|-----------------|
| Registration | Nationality | `China` |
| Registration | Gender | `Male`, `Female` |
| Add Passenger | Nationality | `China` |
| Add Passenger | Gender | `Male`, `Female` |
| Add Passenger | Passenger type | `Adult`, `Child` |
| User Info Edit | Gender | `Male`, `Female` |
| User Info Edit | Passenger type | `Adult`, `Child` |
| Booking Form | Ticket class | `Business-class seat`, `First-class seat`, `Second-class seat`, `Standing ticket` |
| Booking Form | Ticket type | `Adult`, `Child` |
| Upcoming trips | Date type | `Search by booking date`, `Search by departure date` |

## 6. Default Search Conditions

Navigation-based entry defaults to Beijing → Shanghai, current date. Input values must match `/beijing|北京/` and `/shanghai|上海/`.

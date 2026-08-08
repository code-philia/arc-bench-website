# FakeStandby
An app that simulates fake standby mode and provides settings for exit behavior, quick access, security, startup automation, visual appearance, and project website access.

## REQ-1 Configure Exit And Security
The app shall allow users to configure how fake standby is exited and to control related quick-access and security settings from the settings list.

**Dependencies:** None

### REQ-1.1 Open The Escape Methods Dialog
The app shall allow users to open the escape-method selection dialog from the settings list.

**Dependencies:** None

**Scenarios:**
- Open Escape Methods
  - **GIVEN:** The settings list is visible.
  - **WHEN:** The user taps the entry with resource-id "android:id/title" and text "Escape methods".
  - **THEN:** The app opens a dialog for choosing an escape method.

### REQ-1.2 Choose An Escape Method
The app shall allow users to choose an available escape method for exiting fake standby from the selection dialog.

**Dependencies:** REQ-1.1

**Scenarios:**
- Select The Four Touch Option
  - **GIVEN:** The escape-method dialog is open.
  - **WHEN:** The user taps the option with resource-id "android:id/text1" and text "Tap the screen with 4 or more simultaneous touches".
  - **THEN:** The four-touch escape method is selected in the dialog.

### REQ-1.3 Confirm The Escape Method Selection
The app shall allow users to confirm the currently selected escape method and save it for fake standby.

**Dependencies:** REQ-1.2

**Scenarios:**
- Confirm The Selected Escape Method
  - **GIVEN:** The four-touch escape option is selected in the escape-method dialog.
  - **WHEN:** The user taps the confirmation button with resource-id "android:id/button1" and text "OK".
  - **THEN:** The selected escape method is saved and the dialog closes.

### REQ-1.4 Toggle The Persistent Start Notification
The app shall allow users to toggle the persistent notification used to start fake standby quickly.

**Dependencies:** None

**Scenarios:**
- Toggle The Start Notification Preference
  - **GIVEN:** The settings list is visible.
  - **WHEN:** The user taps the preference with resource-id "android:id/title" and text "Always show a notification to start the fake standby".
  - **THEN:** The persistent notification setting changes state.

### REQ-1.5 Enable Secure Mode
The app shall allow users to enable secure mode for fake standby from the settings list.

**Dependencies:** None

**Scenarios:**
- Turn On Secure Mode
  - **GIVEN:** The settings list is visible.
  - **WHEN:** The user taps the preference with resource-id "android:id/title" and text "Secure mode".
  - **THEN:** Secure mode is enabled for fake standby.

## REQ-2 Configure Startup And Appearance
The app shall allow users to control whether fake standby starts automatically and whether the standby display uses inverted colors.

**Dependencies:** None

### REQ-2.1 Toggle Start On Boot
The app shall allow users to toggle whether fake standby starts automatically after device reboot.

**Dependencies:** None

**Scenarios:**
- Change The Start On Boot Setting
  - **GIVEN:** The settings screen for package "android.jonas.fakestandby" is open.
  - **WHEN:** The user taps the option with resource-id "android:id/title" and text "Start fake standby on boot".
  - **THEN:** The automatic-start setting changes state.

### REQ-2.2 Toggle Invert Color
The app shall allow users to toggle color inversion for the fake standby view.

**Dependencies:** None

**Scenarios:**
- Change The Invert Color Setting
  - **GIVEN:** The settings screen for package "android.jonas.fakestandby" is open.
  - **WHEN:** The user taps the option with resource-id "android:id/title" and text "Invert color".
  - **THEN:** The color inversion setting changes state.

## REQ-3 Access Project Information
The app shall provide a shortcut that opens the project's website from the main list.

**Dependencies:** None

### REQ-3.1 Open The Project Website
The app shall allow users to open the project website by tapping the dedicated list item.

**Dependencies:** None

**Scenarios:**
- Visit The Project Website
  - **GIVEN:** The list item with resource-id "android:id/title" and text "Visit the project website" is visible.
  - **WHEN:** The user taps "Visit the project website".
  - **THEN:** The project webpage opens in the default browser or an in-app web view.

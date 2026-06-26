# SecScanQR
A QR and barcode utility app that supports scanning, code generation from multiple inputs, saving and sharing generated results, reviewing saved items, and standard Android navigation patterns.

## REQ-1 Scan Codes And Navigate
The app shall provide a scan entry point and support navigation between sections and screens through bottom navigation, the Android Back action, and the app bar Up action.

**Dependencies:** None

### REQ-1.1 Open Scanner Interface
The app shall allow users to open the QR scanner from the scan entry point.

**Dependencies:** None

**Scenarios:**
- Open The Scanner From Scan
  - **GIVEN:** The SecScanQR app is open.
  - **WHEN:** The user taps the scanning entry point with text "Scan".
  - **THEN:** The QR scanner interface opens.

### REQ-1.2 Switch Sections With Bottom Navigation
The app shall allow users to switch to another section by tapping a bottom navigation item.

**Dependencies:** REQ-1.1

**Scenarios:**
- Change Sections From The Scanner
  - **GIVEN:** The scanner interface is open.
  - **WHEN:** The user taps the bottom navigation label with resource-id "de.t_dankworth.secscanqr:id/largeLabel".
  - **THEN:** The app opens the section associated with the selected bottom navigation item.

### REQ-1.3 Return With System Back
The app shall allow users to return to the previous screen by invoking the Android system Back action.

**Dependencies:** None

**Scenarios:**
- Go Back From A Secondary Screen
  - **GIVEN:** The user is on a secondary screen in package "de.t_dankworth.secscanqr".
  - **WHEN:** The user performs the Android system Back action.
  - **THEN:** The app returns to the previous screen.

### REQ-1.4 Navigate Up To Parent Screen
The app shall allow users to move one level up in the current navigation hierarchy by using the app bar navigation control.

**Dependencies:** None

**Scenarios:**
- Return To A Parent View With Navigate Up
  - **GIVEN:** The user is viewing a sub-screen that shows an app bar navigation control.
  - **WHEN:** The user taps the control with content description "Navigate up".
  - **THEN:** The current sub-screen closes and the parent view is shown.

## REQ-2 Generate Save Share And Review Codes
The app shall allow users to open the generator area, create QR codes and barcodes from supported inputs, save generated outputs, share barcodes, and review saved results in history.

**Dependencies:** None

### REQ-2.1 Open Generator Menu
The app shall allow users to open the generator menu from the main navigation.

**Dependencies:** None

**Scenarios:**
- Open The Generate Section
  - **GIVEN:** The app is open.
  - **WHEN:** The user taps the entry with text "Generate".
  - **THEN:** The generator menu is displayed.

### REQ-2.2 Generate And Save Text QR Codes
The app shall allow users to create a QR code from text input and save the generated result.

**Dependencies:** REQ-2.1

**Scenarios:**
- Generate And Save A Text QR Code
  - **GIVEN:** The generator menu is open.
  - **WHEN:** The user selects "Convert text into a QR-Code", enters "Hello" into "de.t_dankworth.secscanqr:id/txtQR", taps "GENERATE" on "de.t_dankworth.secscanqr:id/btnGenerateText", and then taps the save control "de.t_dankworth.secscanqr:id/btnSave".
  - **THEN:** A QR preview is generated and the text-based QR code is saved.

### REQ-2.3 Generate And Save Geo QR Codes
The app shall allow users to create a QR code from geo coordinates and save the generated result.

**Dependencies:** REQ-2.1

**Scenarios:**
- Generate And Save A Geo QR Code
  - **GIVEN:** The generator menu is open.
  - **WHEN:** The user selects "Create a QR-Code in the format of a geo location", enters 43.73 into "de.t_dankworth.secscanqr:id/tfLatitude", enters 10.73 into "de.t_dankworth.secscanqr:id/tfLongtitude", taps "GENERATE", and then taps "de.t_dankworth.secscanqr:id/btnSave".
  - **THEN:** A geo QR preview is generated and the geo QR code is saved.

### REQ-2.4 Generate Refresh Save And Share Barcodes
The app shall allow users to generate a barcode from text, refresh the preview after editing the value, save the result, and open the platform share sheet.

**Dependencies:** REQ-2.1

**Scenarios:**
- Generate A Barcode From Text
  - **GIVEN:** The generator menu is open.
  - **WHEN:** The user selects "Create different kinds of Barcodes", enters "Hello" into "de.t_dankworth.secscanqr:id/tfBarcode", and taps "de.t_dankworth.secscanqr:id/btnGenerateBarcode".
  - **THEN:** A barcode preview is generated for the entered text value.
- Refresh The Barcode Preview
  - **GIVEN:** The barcode generator screen is open and a barcode preview has already been generated.
  - **WHEN:** The user replaces the value in "de.t_dankworth.secscanqr:id/tfBarcode" with "1" and taps "de.t_dankworth.secscanqr:id/btnGenerateBarcode" again.
  - **THEN:** The barcode preview is refreshed for the updated input value.
- Save A Generated Barcode
  - **GIVEN:** A generated barcode preview is visible on the barcode generator screen.
  - **WHEN:** The user taps the button with text "SAVE".
  - **THEN:** The generated barcode is saved.
- Share And Dismiss A Generated Barcode
  - **GIVEN:** A generated barcode preview is visible on the barcode generator screen.
  - **WHEN:** The user taps the button with text "SHARE" and dismisses the Android share sheet with the system Back action in package "android".
  - **THEN:** The platform share sheet is opened and then dismissed, returning the user to the app.

### REQ-2.5 Review Saved Codes In History
The app shall allow users to open the history section and review previously saved QR codes and barcodes.

**Dependencies:** REQ-2.2, REQ-2.3, REQ-2.4

**Scenarios:**
- Review Generated Codes In History
  - **GIVEN:** Text QR codes, geo QR codes, or barcodes have been generated and saved.
  - **WHEN:** The user returns to the main view and taps the entry with text "History".
  - **THEN:** The saved items list opens and shows the newly generated codes for review.

# Notes
A notes editor that supports note creation and file saving, content enhancement tools, and Android integrations for printing, sharing, and backup.

## REQ-1 Create Open And Save Notes
The editor shall support starting a fresh note, opening the note picker dialog, and saving the current note through a Save As dialog.

**Dependencies:** None

### REQ-1.1 Start A New Note
The app shall provide a new note action that opens a fresh editor for composing note content.

**Dependencies:** None

**Scenarios:**
- Open A Fresh Note Editor
  - **GIVEN:** The note editor is open.
  - **WHEN:** The user taps the new note action with resource-id "org.billthefarmer.notes:id/newNote".
  - **THEN:** A fresh editing screen is shown for composing a new note.

### REQ-1.2 Open Note Picker
The app shall provide an open note action that shows the note picker dialog from the editor.

**Dependencies:** None

**Scenarios:**
- Show The Open Note Dialog
  - **GIVEN:** The note editor is open.
  - **WHEN:** The user taps the open note control with resource-id "org.billthefarmer.notes:id/openNote".
  - **THEN:** An open dialog is displayed for selecting a note file, including the negative button "CANCEL" with resource-id "android:id/button2".

### REQ-1.3 Cancel Open Note Dialog
The app shall allow users to dismiss the open note dialog without loading a file.

**Dependencies:** REQ-1.2

**Scenarios:**
- Dismiss The Open Note Dialog
  - **GIVEN:** The open note dialog is displayed.
  - **WHEN:** The user taps the negative button "CANCEL" with resource-id "android:id/button2".
  - **THEN:** The dialog is dismissed and the editor remains open without loading a note file.

### REQ-1.4 Save Note As A Named File
The app shall provide a Save As action from the overflow menu, accept a file name in the Save As dialog, and save the current note under that name.

**Dependencies:** None

**Scenarios:**
- Show The Save As Dialog
  - **GIVEN:** The note editor is open with editable content.
  - **WHEN:** The user opens the overflow menu with content-desc "More options" and selects "Save as…".
  - **THEN:** A Save As dialog is displayed with the input field resource-id "org.billthefarmer.notes:id/pathText" and the positive button "SAVE" using resource-id "android:id/button1".
- Save The Note As test.md
  - **GIVEN:** The Save As dialog is open with the input field resource-id "org.billthefarmer.notes:id/pathText" and the positive button "SAVE" using resource-id "android:id/button1".
  - **WHEN:** The user enters "test.md" into resource-id "org.billthefarmer.notes:id/pathText" and confirms with the positive button "SAVE" using resource-id "android:id/button1".
  - **THEN:** The note is saved under the name "test.md", the dialog closes, and the editor remains visible.

## REQ-2 Enhance Note Content
The app shall provide overflow actions for inserting dates, invoking media selection, and editing styles or scripts through dedicated dialogs.

**Dependencies:** None

### REQ-2.1 Insert Date Into The Note
The app shall provide an action that inserts a date stamp into the current note content.

**Dependencies:** None

**Scenarios:**
- Insert A Date Stamp
  - **GIVEN:** The note editor is open with the cursor in the note.
  - **WHEN:** The user opens the overflow menu with content-desc "More options" and selects the item with resource-id "android:id/title" and text "Add date".
  - **THEN:** A date stamp is inserted into the note content.

### REQ-2.2 Add Media
The app shall provide an Add Media action that opens the Android document picker and lets users return to the editor without attaching a file.

**Dependencies:** None

**Scenarios:**
- Open The Android Document Picker
  - **GIVEN:** The note editor is open.
  - **WHEN:** The user opens the overflow menu with content-desc "More options" and selects the item with resource-id "android:id/title" and text "Add media…".
  - **THEN:** The system picker opens in package "com.google.android.documentsui".
- Leave The Media Picker Without Selecting A File
  - **GIVEN:** The Android document picker is open after the user selected the overflow item with resource-id "android:id/title" and text "Add media…".
  - **WHEN:** The user presses Back.
  - **THEN:** The app returns to the note editor without attaching media.

### REQ-2.3 Edit Styles
The app shall provide a styles editor dialog from the overflow menu and apply style changes when the dialog is confirmed.

**Dependencies:** None

**Scenarios:**
- Open The Styles Dialog
  - **GIVEN:** The note editor is open.
  - **WHEN:** The user opens the overflow menu with content-desc "More options" and selects the item with resource-id "android:id/title" and text "Edit styles…".
  - **THEN:** A style-edit dialog is displayed.
- Confirm The Styles Dialog
  - **GIVEN:** The style-edit dialog is open after the user selected the overflow item with resource-id "android:id/title" and text "Edit styles…".
  - **WHEN:** The user confirms with resource-id "org.billthefarmer.notes:id/accept".
  - **THEN:** The styles are applied and the editor view is restored.

### REQ-2.4 Open Script Editor
The app shall provide a script editor dialog from the overflow menu.

**Dependencies:** None

**Scenarios:**
- Open The Script Dialog
  - **GIVEN:** The note editor is open.
  - **WHEN:** The user opens the overflow menu with content-desc "More options" and selects the item with resource-id "android:id/title" and text "Edit script…".
  - **THEN:** A script editor dialog is displayed.

### REQ-2.5 Apply Script Changes
The app shall apply script changes when the user confirms the script editor dialog.

**Dependencies:** REQ-2.4

**Scenarios:**
- Confirm The Script Dialog
  - **GIVEN:** The script editor dialog is open after the user selected the overflow item with resource-id "android:id/title" and text "Edit script…".
  - **WHEN:** The user confirms with resource-id "org.billthefarmer.notes:id/accept".
  - **THEN:** The script changes are saved or applied and the editor view is restored.

## REQ-3 Use Android Integrations
The editor shall integrate with Android system flows for printing, sharing, and backing up note content.

**Dependencies:** None

### REQ-3.1 Print Note
The app shall provide a print action that launches the Android print flow and lets users return to the editor afterward.

**Dependencies:** None

**Scenarios:**
- Launch The Android Print Flow
  - **GIVEN:** The note editor is open.
  - **WHEN:** The user opens the overflow menu with content-desc "More options" and selects the item with resource-id "android:id/title" and text "Print…".
  - **THEN:** The system print flow opens in package "com.android.printspooler".
- Leave Print And Return To The Editor
  - **GIVEN:** The Android print flow is open after the user selected the overflow item with resource-id "android:id/title" and text "Print…".
  - **WHEN:** The user presses Back.
  - **THEN:** The app returns to the note editor.

### REQ-3.2 Share Note
The app shall provide a share action that opens the Android sharing UI and lets users return to the editor after dismissing it.

**Dependencies:** None

**Scenarios:**
- Launch The Android Share UI
  - **GIVEN:** The note editor is open.
  - **WHEN:** The user opens the overflow menu with content-desc "More options" and selects the item with resource-id "android:id/title" and text "Share…".
  - **THEN:** The Android sharing UI is displayed.
- Leave Share And Return To The Editor
  - **GIVEN:** The Android sharing UI is open after the user selected the overflow item with resource-id "android:id/title" and text "Share…".
  - **WHEN:** The user presses Back.
  - **THEN:** The app returns to the note editor.

### REQ-3.3 Back Up Note
The app shall provide a backup action that opens the backup confirmation flow and initiates backup when the user confirms it.

**Dependencies:** None

**Scenarios:**
- Start The Backup Flow
  - **GIVEN:** The note editor is open.
  - **WHEN:** The user opens the overflow menu with content-desc "More options" and selects the item with resource-id "android:id/title" and text "Backup…".
  - **THEN:** A save prompt is displayed with the positive button "SAVE" using resource-id "android:id/button1".
- Confirm Backup With The SAVE Button
  - **GIVEN:** The backup flow is open and the "SAVE" button with resource-id "android:id/button1" is visible after the user selected the overflow item with resource-id "android:id/title" and text "Backup…".
  - **WHEN:** The user taps the "SAVE" button using resource-id "android:id/button1".
  - **THEN:** The backup operation is initiated.

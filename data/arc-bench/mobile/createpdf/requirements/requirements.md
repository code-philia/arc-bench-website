# Create PDF
An Android PDF creator and document manager that lets users convert images into PDFs, handle initial confirmations and settings, navigate through menus, and open, rename, or share created files.

## REQ-1 Convert Images Into A PDF
The app shall allow users to move past the initial entry flow, reach the image-to-PDF tool, select images, and generate a PDF with the required confirmations.

**Dependencies:** None

### REQ-1.1 Skip The Onboarding Flow
The app shall allow users to skip the onboarding screen and proceed into the app.

**Dependencies:** None

**Scenarios:**
- Skip The Intro Screen
  - **GIVEN:** The app is launched and the onboarding screen is shown.
  - **WHEN:** The user taps the skip button with resource-id "swati4star.createpdf:id/btn_skip".
  - **THEN:** The app proceeds from the intro flow to the next startup step.

### REQ-1.2 Confirm The Initial Dialog
The app shall allow users to acknowledge the initial confirmation dialog that appears after onboarding is skipped.

**Dependencies:** REQ-1.1

**Scenarios:**
- Accept The First Startup Confirmation
  - **GIVEN:** The onboarding flow has been skipped and a confirmation or system dialog is displayed.
  - **WHEN:** The user taps the positive button with resource-id "android:id/button1".
  - **THEN:** The app continues to the startup settings area.

### REQ-1.3 Toggle The Startup Setting
The app shall allow users to change the available startup toggle setting before entering the main tool flow.

**Dependencies:** REQ-1.2

**Scenarios:**
- Change The Initial Toggle State
  - **GIVEN:** The startup settings area is visible.
  - **WHEN:** The user taps the switch control with resource-id "android:id/switch_widget".
  - **THEN:** The toggle state changes and the app remains ready for the next navigation step.

### REQ-1.4 Open The Main Navigation Flow
The app shall allow users to move through the navigation controls that lead from the startup area to the main tool options.

**Dependencies:** REQ-1.3

**Scenarios:**
- Proceed Through The Navigation Controls
  - **GIVEN:** The startup settings area is visible after the initial toggle has been handled.
  - **WHEN:** The user taps a control identified by class "android.widget.ImageButton", triggers a confirmation, and accepts it with the positive button using resource-id "android:id/button1".
  - **THEN:** The app proceeds to the main navigation flow for its tools and options.

### REQ-1.5 Open The Images To PDF Tool
The app shall allow users to navigate through its menus and open the image-to-PDF conversion tool.

**Dependencies:** REQ-1.4

**Scenarios:**
- Navigate To The Images To PDF Feature
  - **GIVEN:** The app is in its main navigation flow.
  - **WHEN:** The user taps an option with resource-id "swati4star.createpdf:id/option_name", taps a control identified by class "android.widget.ImageButton" to expose the drawer or menu, selects a menu label with resource-id "swati4star.createpdf:id/design_menu_item_text", and taps the option with resource-id "swati4star.createpdf:id/option_name" and text "Images to PDF".
  - **THEN:** The image-to-PDF conversion screen is opened.

### REQ-1.6 Start Image Selection
The app shall allow users to open the image picker from the image-to-PDF conversion screen.

**Dependencies:** REQ-1.5

**Scenarios:**
- Open The Image Picker
  - **GIVEN:** The "Images to PDF" screen is open.
  - **WHEN:** The user taps the button with resource-id "swati4star.createpdf:id/addImages" and text "SELECT IMAGES".
  - **THEN:** The image picker is opened.

### REQ-1.7 Select Images And Apply The Selection
The app shall allow users to select images in the picker and apply the selection to the PDF creation flow.

**Dependencies:** REQ-1.6

**Scenarios:**
- Select One Image And Apply
  - **GIVEN:** The image picker is open.
  - **WHEN:** The user toggles the checkbox with resource-id "swati4star.createpdf:id/check_view" and confirms the choice with the action button using resource-id "swati4star.createpdf:id/button_apply" and text "Apply(1)".
  - **THEN:** The selected image is attached to the PDF creation flow.

### REQ-1.8 Generate A PDF From The Selected Images
The app shall allow users to generate a PDF after selecting images for conversion.

**Dependencies:** REQ-1.7

**Scenarios:**
- Create A PDF After Image Selection
  - **GIVEN:** At least one image has already been selected for conversion.
  - **WHEN:** The user taps the create button with resource-id "swati4star.createpdf:id/pdfCreate" and text "CREATE PDF" and confirms with the positive dialog button using resource-id "swati4star.createpdf:id/md_buttonDefaultPositive" and text "OK".
  - **THEN:** The app proceeds to generate a PDF from the selected images.

## REQ-2 Manage Existing PDF Files
The app shall allow users to open the in-app file list and perform file-level actions such as opening, renaming, and sharing created PDF documents.

**Dependencies:** None

### REQ-2.1 Open The View Files List
The app shall allow users to open the in-app list of created documents from the main options area.

**Dependencies:** REQ-1.1

**Scenarios:**
- Open The Document List From Main Options
  - **GIVEN:** The introductory screen has been skipped and the app is at its main options area.
  - **WHEN:** The user taps the entry with resource-id "swati4star.createpdf:id/option_name" and text "View Files".
  - **THEN:** The in-app document list is displayed.

### REQ-2.2 Open File Actions For A Listed Document
The app shall allow users to select a listed document and open its file action dialog.

**Dependencies:** REQ-2.1

**Scenarios:**
- Select A File And Open Its Action Dialog
  - **GIVEN:** The in-app document list is open.
  - **WHEN:** The user toggles the selection checkbox with resource-id "swati4star.createpdf:id/checkbox" and taps the file entry label with resource-id "swati4star.createpdf:id/fileName".
  - **THEN:** The Material-style file action dialog is opened for the selected document.

### REQ-2.3 Open A PDF File
The app shall allow users to open a listed PDF document from the file action dialog.

**Dependencies:** REQ-2.2

**Scenarios:**
- Open A Document From The File Action Dialog
  - **GIVEN:** The file action dialog for a listed document is open.
  - **WHEN:** The user selects the dialog item with resource-id "swati4star.createpdf:id/md_title" and text "Open File".
  - **THEN:** The selected PDF is opened in a document viewer.

### REQ-2.4 Rename A PDF File
The app shall allow users to rename a listed PDF document from the file action dialog.

**Dependencies:** REQ-2.2

**Scenarios:**
- Rename A Listed Document
  - **GIVEN:** The document list is available after previously using the file action dialog.
  - **WHEN:** The user returns to the list with the top-left navigation control rendered as class "android.widget.ImageButton", taps the same file entry again, selects the action with resource-id "swati4star.createpdf:id/md_title" and text "Rename File", enters "moutain.pdf" into the input with resource-id "android:id/input", and confirms with the positive button using resource-id "swati4star.createpdf:id/md_buttonDefaultPositive".
  - **THEN:** The file name is updated to "moutain.pdf" in the list.

### REQ-2.5 Share A PDF File
The app shall allow users to share a listed PDF document from the file action dialog through the Android share flow.

**Dependencies:** REQ-2.2

**Scenarios:**
- Share A Listed Document
  - **GIVEN:** The document list is available after previously using the file action dialog.
  - **WHEN:** The user taps the same file entry again, reopens the action dialog, and selects the action with resource-id "swati4star.createpdf:id/md_title" and text "Share File".
  - **THEN:** The Android system share interface is opened for the selected document.

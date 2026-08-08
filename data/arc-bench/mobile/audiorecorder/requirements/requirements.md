# Audio Recorder
An app for recording audio, managing saved recordings, and configuring recording parameters such as audio format and sample rate.

## REQ-1 Record And Manage Audio
The app shall allow users to start a recording, stop and save it, open a saved recording, rename it, and share it.

**Dependencies:** None

### REQ-1.1 Start Stop And Save Recording
The app shall allow users to start a new audio recording and stop it to save the recording.

**Dependencies:** None

**Scenarios:**
- Record And Save An Audio Clip
  - **GIVEN:** The Audio Recorder app is open.
  - **WHEN:** The user taps the record action (resource-id "com.github.axet.audiorecorder:id/fab") and then taps the done action (resource-id "com.github.axet.audiorecorder:id/recording_done").
  - **THEN:** The recording is saved and appears in the recordings list.

### REQ-1.2 Open A Recording
The app shall allow users to open a saved recording by tapping its title entry in the recordings list.

**Dependencies:** REQ-1.1

**Scenarios:**
- Open A Saved Recording
  - **GIVEN:** A recording exists in the recordings list.
  - **WHEN:** The user taps the recording title entry (resource-id "com.github.axet.audiorecorder:id/recording_title").
  - **THEN:** The app opens the selected recording.

### REQ-1.3 Rename Recording
The app shall allow users to rename a recording by opening the edit action, entering a new title, and confirming the change.

**Dependencies:** REQ-1.2

**Scenarios:**
- Rename A Recording To KK
  - **GIVEN:** The recording playback/details screen is open.
  - **WHEN:** The user taps the edit control (resource-id "com.github.axet.audiorecorder:id/recording_player_edit"), enters "KK" into the dialog input (resource-id "com.github.axet.audiorecorder:id/custom"), and confirms with the positive button (resource-id "android:id/button1").
  - **THEN:** The recording title is updated to "KK".

### REQ-1.4 Share Recording
The app shall allow users to share a recording from the playback/details screen using the share action.

**Dependencies:** REQ-1.2

**Scenarios:**
- Share A Recording Using System Share Sheet
  - **GIVEN:** The recording playback/details screen is open.
  - **WHEN:** The user taps the share action (resource-id "com.github.axet.audiorecorder:id/recording_player_share").
  - **THEN:** The Android system share interface is opened for the recording file.

## REQ-2 Configure Recording Parameters
The app shall provide a navigable settings flow that leads to the main preferences screen, where users can configure audio format and sample rate for recording or playback.

**Dependencies:** None

### REQ-2.1 Open Settings Page
The app shall allow users to navigate from the app interface to the main settings page where recording preferences are available.

**Dependencies:** None

**Scenarios:**
- Open Recording Settings
  - **GIVEN:** The app is open.
  - **WHEN:** The user navigates to settings by tapping an element with class "android.widget.ImageView", proceeds via a container with class "android.widget.RelativeLayout", selects a list entry header labeled by resource-id "android:id/title", uses another "android.widget.ImageView" to move through screens, and focuses the main preferences in an "android.widget.FrameLayout".
  - **THEN:** The main settings page is open and ready for preference changes.

### REQ-2.2 Select Audio Format
The app shall allow users to open the "Audio Format" setting and select an available format option.

**Dependencies:** REQ-2.1

**Scenarios:**
- Change Audio Format In Settings
  - **GIVEN:** The settings page is open.
  - **WHEN:** The user opens the "Audio Format" preference labeled by resource-id "android:id/title" and selects an option row (resource-id "android:id/text1").
  - **THEN:** The selected audio format option is applied.

### REQ-2.3 Set Sample Rate
The app shall allow users to open the "Sample Rate" setting and select an available sample rate option.

**Dependencies:** REQ-2.1

**Scenarios:**
- Set Sample Rate To 22 kHz In Settings
  - **GIVEN:** The settings page is open.
  - **WHEN:** The user opens the "Sample Rate" preference labeled by resource-id "android:id/title" and selects the option row (resource-id "android:id/text1") with text "22 kHz".
  - **THEN:** The sample rate is set to "22 kHz".

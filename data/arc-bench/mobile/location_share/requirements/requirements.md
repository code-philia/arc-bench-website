# Location Share
An app for sharing the current location, opening location details, and configuring the link provider used for generated location links.

## REQ-1 Share Or Copy Location
The app shall allow users to share the current location through the Android share sheet and copy a shareable location link to the clipboard.

**Dependencies:** None

### REQ-1.1 Share Current Location
The app shall allow users to open the Android system share interface for the current location or generated location link.

**Dependencies:** None

**Scenarios:**
- Open The System Share Sheet
  - **GIVEN:** The Location Share app is open and the main sharing controls are visible.
  - **WHEN:** The user taps the share control identified by resource-id "ca.cmetcalfe.locationshare:id/shareButton".
  - **THEN:** The Android system share interface opens for the current location or generated location link.
- Return From The Share Sheet
  - **GIVEN:** The Android system share interface is open from the Location Share app.
  - **WHEN:** The user performs the Android back action.
  - **THEN:** The app returns to the prior screen where the sharing controls are visible again.

### REQ-1.2 Copy Shareable Location Link
The app shall allow users to copy the current location or generated location link to the clipboard.

**Dependencies:** None

**Scenarios:**
- Copy The Current Location Link
  - **GIVEN:** The Location Share app is open and the main sharing controls are visible.
  - **WHEN:** The user taps the copy control identified by resource-id "ca.cmetcalfe.locationshare:id/copyButton".
  - **THEN:** The current location or generated location link is copied to the clipboard.

## REQ-2 View Location Details
The app shall allow users to open a dedicated viewing interface for the current location and inspect the corresponding location content.

**Dependencies:** None

### REQ-2.1 Open Location Details View
The app shall allow users to open the dedicated location viewing interface from the main screen.

**Dependencies:** None

**Scenarios:**
- Open The Location Viewing Interface
  - **GIVEN:** The app is open.
  - **WHEN:** The user taps the button identified by resource-id "ca.cmetcalfe.locationshare:id/viewButton" in the package "ca.cmetcalfe.locationshare".
  - **THEN:** The app transitions to the location viewing interface and presents the corresponding location content.

## REQ-3 Configure Link Provider
The app shall allow users to open settings and choose which link provider is used when location links are generated or shared.

**Dependencies:** None

### REQ-3.1 Open Link Settings
The app shall allow users to open the settings screen from the app bar overflow menu.

**Dependencies:** None

**Scenarios:**
- Open Settings From More Options
  - **GIVEN:** The app is open.
  - **WHEN:** The user taps the app bar overflow with content-desc "More options" and selects the first menu entry represented by an "android.widget.RelativeLayout" at index 0.
  - **THEN:** The settings screen is opened.

### REQ-3.2 Select Link Type
The app shall allow users to open the "Link type" setting and apply an available link provider option for subsequent shares.

**Dependencies:** REQ-3.1

**Scenarios:**
- Set Google Maps As The Active Link Provider
  - **GIVEN:** The settings screen is open.
  - **WHEN:** The user taps the "Link type" item identified by resource-id "android:id/title" and text "Link type", then selects the option identified by resource-id "android:id/text1" and text "Google Maps".
  - **THEN:** Google Maps is applied as the active link provider for subsequent shares.

# Forecastie
A weather app that presents today's and later forecasts, supports switching the forecast city, and allows users to configure temperature units from settings.

## REQ-1 Browse Current And Future Forecasts
The app shall present the current day's weather on the main screen and provide navigation to future forecast periods.

**Dependencies:** None

### REQ-1.1 View Today's Weather
The app shall show the current day's weather summary when the main forecast screen is opened.

**Dependencies:** None

**Scenarios:**
- View Today Section On Launch
  - **GIVEN:** The user opens the app.
  - **THEN:** The current temperature is visible in resource-id "cz.martykan.forecastie:id/todayTemperature" and the text "TODAY" is shown.

### REQ-1.2 View Future Forecast Options
The app shall display forecast period options for upcoming days on the main forecast screen.

**Dependencies:** None

**Scenarios:**
- Show Tomorrow And Later Options
  - **GIVEN:** The user opens the main forecast screen.
  - **THEN:** The texts "TOMORROW" and "LATER" are visible as forecast period options.

### REQ-1.3 Open Later Forecast View
The app shall open a future forecast view when the user selects the later forecast option.

**Dependencies:** REQ-1.2

**Scenarios:**
- Open The Later Forecast View
  - **GIVEN:** The user is on the main weather screen where the "LATER" option is visible.
  - **WHEN:** The user taps the "LATER" option.
  - **THEN:** A later forecast view is shown and day temperatures are displayed in resource-id "cz.martykan.forecastie:id/itemTemperature".

## REQ-2 Switch Forecast City
The app shall display the active city and provide a search flow for switching the forecast to another city.

**Dependencies:** None

### REQ-2.1 View Active City
The app shall display the currently selected city on the main forecast screen.

**Dependencies:** None

**Scenarios:**
- View Default City
  - **GIVEN:** The user opens the app.
  - **THEN:** The currently selected city text is visible on the forecast screen.

### REQ-2.2 Open City Search
The app shall provide a search action that opens the city search prompt from the main forecast screen.

**Dependencies:** None

**Scenarios:**
- Open The Search For City Prompt
  - **GIVEN:** The user is on the main weather screen.
  - **WHEN:** The user taps the search action with resource-id "cz.martykan.forecastie:id/action_search".
  - **THEN:** A prompt with the text "Search for city" is displayed.

### REQ-2.3 Search And Switch City
The app shall accept a city query and refresh the forecast for the selected city after the user confirms the search.

**Dependencies:** REQ-2.2

**Scenarios:**
- Search And Switch To Beijing
  - **GIVEN:** The city search prompt is open.
  - **WHEN:** The user enters "beijing" in the search field identified by resource-id "cz.martykan.forecastie:id/customPanel" and confirms with "OK".
  - **THEN:** The app updates to show the city text "Beijing, CN" and the current temperature is visible in resource-id "cz.martykan.forecastie:id/todayTemperature".

## REQ-3 Configure Temperature Units
The app shall provide a settings flow for choosing how forecast temperatures are displayed.

**Dependencies:** None

### REQ-3.1 Open Settings Page
The app shall allow users to open the settings screen from the overflow menu on the main forecast screen.

**Dependencies:** None

**Scenarios:**
- Open Settings From Overflow
  - **GIVEN:** The user is on the main weather screen.
  - **WHEN:** The user taps the overflow button with content-desc "More options" and selects "Settings".
  - **THEN:** The settings screen is displayed.

### REQ-3.2 Open Temperature Unit Options
The app shall allow users to open the temperature unit preference and view the available unit options.

**Dependencies:** REQ-3.1

**Scenarios:**
- Open Temperature Unit Selection
  - **GIVEN:** The settings screen is open.
  - **WHEN:** The user taps "Temperature units".
  - **THEN:** The options "Celsius", "Fahrenheit", and "Kelvin" are visible.

### REQ-3.3 Apply Temperature Unit Selection
The app shall allow users to choose a temperature unit and apply that unit to the displayed forecast values.

**Dependencies:** REQ-3.2

**Scenarios:**
- Change Temperature Unit To Kelvin
  - **GIVEN:** The temperature unit options are open.
  - **WHEN:** The user selects "Kelvin" and taps the button with content-desc "Navigate up" to return.
  - **THEN:** The forecast temperatures are displayed in Kelvin, for example with a value like "294.3 K".

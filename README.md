# WhatsApp Sheet CRM

A Chrome Extension that integrates WhatsApp Web with Google Sheets, providing a real-time CRM side panel for managing customer contacts directly while chatting.

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [File Structure](#file-structure)
- [Detailed Function Reference](#detailed-function-reference)
  - [phoneExtractor.js - Phone Extraction Module](#phoneextractorjs---phone-extraction-module)
  - [content.js - DOM Injection & Event Handling](#contentjs---dom-injection--event-handling)
  - [background.js - Service Worker & API Handler](#backgroundjs---service-worker--api-handler)
  - [panel.js - Side Panel CRM Interface](#paneljs---side-panel-crm-interface)
  - [dashboard.js - Status Dashboard](#dashboardjs---status-dashboard)
- [Configuration](#configuration)
- [Code Style Guidelines](#code-style-guidelines)
- [Installation & Setup](#installation--setup)

---

## Features

- **Automatic Phone Detection**: Extracts phone numbers from active WhatsApp chats (supports saved contacts, unsaved numbers, and business accounts)
- **Real-time CRM Panel**: Side panel displays contact information from Google Sheets
- **Inline Editing**: Edit contact details directly in the panel with auto-save
- **Status Dashboard**: Popup window showing workflow status counts with priority alerts
- **Grouped View**: Browse contacts by status with filtering by month and status
- **Auto-refresh**: Automatic data updates every 10 seconds in group view
- **Bangladesh Phone Format**: Optimized regex for BD mobile numbers (+8801XXXXXXXXX, 01XXXXXXXXX)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     WhatsApp Web (web.whatsapp.com)             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────┐   ┌─────────────────────┐ │
│  │   phoneExtractor.js             │   │   panel.html        │ │
│  │  - Extracts phone numbers       │   │   (iframe)          │ │
│  │  - BD phone regex               │   │                     │ │
│  │  - Drawer detection             │   │   panel.js          │ │
│  ├─────────────────────────────────┤   │   - Displays data   │ │
│  │   content.js                    │◄──┤   - Handles edits   │ │
│  │  - Injects CRM side panel       │   │   - Group view      │ │
│  │  - Monitors chat changes        │   │                     │ │
│  │  - Adjusts WhatsApp layout      │   │                     │ │
│  └───────────────┬─────────────────┘   └──────────┬──────────┘ │
│                  │                                │            │
└──────────────────┼────────────────────────────────┼────────────┘
                   │  chrome.runtime.sendMessage    │
                   ▼                                ▼
         ┌─────────────────────────────────────────────────────┐
         │                  background.js                       │
         │              (Service Worker)                        │
         │  - Google Sheets API authentication                  │
         │  - CRUD operations on spreadsheet                    │
         │  - Phone number search & caching                     │
         │  - Dashboard data aggregation                        │
         └─────────────────────┬───────────────────────────────┘
                               │
                               ▼
         ┌─────────────────────────────────────────────────────┐
         │               Google Sheets API                      │
         │         (SPREADSHEET_ID / SHEET_NAME)               │
         └─────────────────────────────────────────────────────┘
```

---

## File Structure

```
WhatsApp Sheet CRM/
├── manifest.json       # Extension configuration (Manifest V3)
├── config.js           # Centralized configuration (OAuth, Sheet IDs)
├── background.js       # Service worker - API calls & message handling
├── phoneExtractor.js   # Phone extraction utilities (loaded first)
├── content.js          # Content script - DOM injection & event handling
├── panel.html          # Side panel HTML structure
├── panel.js            # Side panel logic & UI interactions
├── style.css           # Styles for content script & side panel
├── dashboard.html      # Status dashboard popup HTML
├── dashboard.js        # Dashboard logic & rendering
├── dashboard.css       # Dashboard-specific styles
├── icons/              # Extension icons (16, 32, 48, 128px)
└── README.md           # This documentation
```

---

## Detailed Function Reference

### phoneExtractor.js - Phone Extraction Module

Contains all phone number extraction logic. Loaded before content.js to share functions globally.

#### Utility Functions

| Function             | Description                                                   |
| -------------------- | ------------------------------------------------------------- |
| `_sleep(ms)`         | Promise-based delay utility                                   |
| `_onlyDigits(s)`     | Strips all non-digit characters from a string                 |
| `_hasMinLen(s, len)` | Checks if digit-only string has minimum length (default: 8)   |
| `_isVisible(el)`     | Checks if DOM element is visible (not hidden, has dimensions) |

#### Phone Extraction Functions (Priority Order)

| Function                        | Description                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_extractFromDataAttrs()`       | **Primary**: Scans `data-id`, `data-jid`, `data-chatid` attributes in `#main` for phone numbers. Filters out LID (business) identifiers.               |
| `_extractFromHeaderSubtitle()`  | **For Saved Contacts**: Extracts phone from subtitle area below contact name. Targets `span.copyable-text[data-testid="selectable-text"]`. Uses BD phone regex. |
| `_extractFromHeaderTel()`       | Looks for `tel:` links in conversation header                                                                                                           |
| `_extractFromHeaderText()`      | Parses header text for phone-like patterns (unsaved contacts show number as name)                                                                       |
| `_extractFromHeaderAria()`      | Extracts from `aria-label` attributes on header buttons                                                                                                 |
| `_extractFromUrl()`             | Parses URL hash/query params for phone numbers (wa.me links, ?phone=, #/t/...)                                                                          |
| `_extractFromLeftPaneSelected()`| Reads phone from selected chat in left sidebar                                                                                                          |
| `_findBdPhonesInText(text)`     | **BD Phone Regex**: Finds Bangladesh mobile numbers (`8801XXXXXXXXX` or `01[3-9]XXXXXXXX`)                                                              |

#### Drawer Extraction Functions (For Business/LID Contacts)

| Function                             | Description                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `_hasLidContext()`                   | Detects if current chat is a business (LID) account                                              |
| `_isDrawerOpen()`                    | Checks if contact info drawer is open using multiple detection strategies                        |
| `_extractPhoneFromDrawerSection(drawer)` | Unified extraction from open drawer's contact info section                                   |
| `_extractFromInfoDrawer(options)`    | Opens drawer if needed, extracts phone, closes drawer. `aggressive: true` for longer waits.      |
| `_extractFromDrawerCopyableSpan()`   | Direct scan of drawer's copyable phone text spans                                                |
| `_waitForMainArea(maxWait)`          | Waits for `#main` chat area to be visible in DOM                                                 |

#### Main Extraction Orchestrator

| Function              | Description                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `extractPhoneNumber()` | **Main Entry Point**: Coordinates all extraction methods. Returns cleaned phone number or null. Priority: DataAttrs → HeaderSubtitle → Drawer fallback |

---

### content.js - DOM Injection & Event Handling

The content script runs on WhatsApp Web and handles CRM panel injection and event monitoring.
Uses functions from phoneExtractor.js for phone extraction.

#### DOM Injection Functions

| Function                | Description                                                  |
| ----------------------- | ------------------------------------------------------------ |
| `adjustWhatsAppLayout()` | Resizes WhatsApp app container to make room for CRM panel   |
| `injectIframe()`         | Creates and injects the CRM panel iframe into WhatsApp page |

#### Event Handling Functions

| Function                       | Description                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `runExtractionAndSearch(reason)` | Debounced extraction runner. Sends last 6 digits to background for search.           |
| `initChatSearchListener()`     | Attaches click listener to `#app` for chat selection detection                          |
| `initDomObservers()`           | Sets up MutationObserver on `#main` and hashchange listener for navigation detection    |

---

### background.js - Service Worker & API Handler

The background service worker handles all Google Sheets API operations and inter-component messaging.

#### Authentication

| Function         | Description                                            |
| ---------------- | ------------------------------------------------------ |
| `getAuthToken()` | Prompts OAuth2 authentication and returns access token |

#### Utility Functions

| Function                       | Description                                                 |
| ------------------------------ | ----------------------------------------------------------- |
| `columnToLetter(column)`       | Converts column index to letter (0 → 'A', 1 → 'B', etc.)    |
| `parseDateOnly(dstr)`          | Parses "YYYY-MM-DD" string to local midnight Date           |
| `parseSheetDateFlexible(dstr)` | Parses multiple date formats: ISO, YYYY-MM-DD, DD-MM-YYYY   |
| `daysBetweenTodayLocal(d)`     | Calculates whole calendar days between today and given date |

#### Message Handlers (chrome.runtime.onMessage)

| Action              | Description                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `getHeadersRequest` | Fetches column headers from row 1 (A1:U1)                                                                                       |
| `searchLast6Digits` | Searches phone column (M) for matching last 6 digits. Uses 15-second cache. Returns matching rows via `displayRowData` message. |
| `fetchAllData`      | Fetches all data rows (A2:U) for group view                                                                                     |
| `updateCellValue`   | Updates a specific cell. If Column A (status), also updates timestamp in Column P.                                              |
| `openWhatsAppChat`  | Injects script into WhatsApp tab to search and open a chat by phone number                                                      |
| `getDashboardData`  | Aggregates status counts for dashboard. Includes "Unchanged (36h+)" metric for stale contacts.                                  |

#### Caching

| Variable            | Description                                            |
| ------------------- | ------------------------------------------------------ |
| `cachedPhoneColumn` | In-memory cache for phone column (M). TTL: 15 seconds. |

#### Dashboard Window Management

| Function                   | Description                                  |
| -------------------------- | -------------------------------------------- |
| `openDashboard()`          | Opens/reopens dashboard popup window         |
| `chrome.runtime.onStartup` | Auto-opens dashboard when Chrome starts      |
| `chrome.windows.onRemoved` | Cleans up window ID when dashboard is closed |

---

### panel.js - Side Panel CRM Interface

The panel script manages the CRM user interface displayed in the side panel iframe.

#### State Variables

| Variable             | Description                                      |
| -------------------- | ------------------------------------------------ |
| `sheetHeaders`       | Column headers from row 1                        |
| `allSheetData`       | Cached sheet data for group view                 |
| `isGroupView`        | Toggle between single contact and grouped view   |
| `singleTemplateRoot` | Cached DOM reference for single contact template |
| `currentRowIndex`    | Active row being displayed/edited                |
| `refreshIntervalId`  | Interval ID for auto-refresh in group view       |

#### Configuration

| Variable          | Description                                                            |
| ----------------- | ---------------------------------------------------------------------- |
| `dropdownOptions` | Predefined options for dropdown columns (0: Status, 2: Payment Status) |
| `statusToClass`   | Maps status values to CSS classes for color-coding                     |

#### Core Display Functions

| Function                                       | Description                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| `getHeaders()`                                 | Fetches column headers on load                                        |
| `displaySingleRow(rowData, rowIndex)`          | Renders single contact view                                           |
| `displayMultipleMatches(matches)`              | Renders view when multiple contacts match (shows status circles)      |
| `generateSingleContactHTML(rowData, rowIndex)` | Generates HTML for contact details with dropdowns and editable fields |

#### Template Management (Performance Optimization)

| Function                                         | Description                                        |
| ------------------------------------------------ | -------------------------------------------------- |
| `initSingleContactTemplate(rowData, rowIndex)`   | Builds DOM template once, wires up event listeners |
| `updateSingleContactTemplate(rowData, rowIndex)` | Reuses existing template, only updates values      |
| `attachSingleTemplateListeners()`                | Attaches edit/save/dropdown listeners to template  |

#### Edit & Save Functions

| Function                                               | Description                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| `addEditListeners(rowIndex, contextElement)`           | Attaches dblclick-to-edit, Enter/Escape handlers, save button logic  |
| `saveUpdate(rowIndex, columnIndex, newValue, element)` | Sends update to background, shows feedback (Saving.../Saved!/Error!) |

#### Grouped View Functions

| Function                 | Description                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| `renderGroupedView()`    | Renders contacts grouped by status with filtering. Implements selection history per filter context. |
| `toggleGroupView()`      | Switches between single contact and grouped view. Starts/stops auto-refresh.                        |
| `refreshGroupViewData()` | Fetches latest data and re-renders group view (called every 10s)                                    |

#### Filter & Preferences

| Function                          | Description                                                |
| --------------------------------- | ---------------------------------------------------------- |
| `populateStatusFilter()`          | Populates status dropdown from `dropdownOptions[0]`        |
| `saveFilterPreferences()`         | Saves month/status filter to chrome.storage.local          |
| `loadAndApplyFilterPreferences()` | Loads and applies saved filter preferences                 |
| `updateFilterColor()`             | Updates dropdown background color based on selected status |

#### Date Helpers

| Function                       | Description                               |
| ------------------------------ | ----------------------------------------- |
| `parseDateOnly(dstr)`          | Parses YYYY-MM-DD to local Date           |
| `parseSheetDateFlexible(dstr)` | Flexible date parser for multiple formats |
| `daysBetweenTodayLocal(d)`     | Calendar day difference from today        |

#### Message Handlers

| Action           | Description                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `displayRowData` | Receives matched rows from background, displays single or multiple |
| `displayNoMatch` | Shows "No matching contact found" message                          |
| `displayError`   | Shows error message                                                |

---

### dashboard.js - Status Dashboard

Standalone popup window showing workflow status counts with visual alerts.

| Function                        | Description                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `fetchAndDisplayStatusCounts()` | Requests `getDashboardData` from background, renders cards                                          |
| `renderDashboard(statusCounts)` | Creates status cards with priority sorting. "Unchanged (36h+)" shown first with blinking red alert. |

#### Visual Indicators

- **Critical (≥20 or Unchanged)**: Red background, blinking animation
- **Warning (≥10)**: Yellow/orange, slower blink
- **Normal (<10)**: Green, subtle pulse
- **Closed**: Hidden from dashboard

---

## Configuration

All sensitive configuration is centralized in `config.js`:

```javascript
const CONFIG = {
  CLIENT_ID: "...", // OAuth2 client for Google Sheets API
  SPREADSHEET_ID: "...", // Target Google Spreadsheet ID
  SHEET_NAME: "🔵Team Blue🔵", // Specific sheet tab name
  get PHONE_COLUMN_RANGE() {
    // Auto-generated: 'SheetName'!M:M
    return `'${this.SHEET_NAME}'!M:M`;
  },
};
```

### Sheet Column Layout (Expected)

| Column | Index | Description                     |
| ------ | ----- | ------------------------------- |
| A      | 0     | Status (dropdown)               |
| B      | 1     | Date                            |
| C      | 2     | Payment Status (dropdown)       |
| ...    | ...   | ...                             |
| M      | 12    | Phone Number (search column)    |
| P      | 15    | Status Timestamp (auto-updated) |

---

## Code Style Guidelines

### Semicolons

- Do not use semicolons if not required in statements
- JavaScript's automatic semicolon insertion (ASI) is acceptable
- Only use semicolons when explicitly necessary to avoid ambiguity

### Configuration Management

- Keep all sensitive values in `config.js` file
- Never hardcode OAuth client IDs, spreadsheet IDs, or sheet names in other files
- Always import from CONFIG object:

  ```javascript
  // In background.js (Service Worker context)
  importScripts("config.js");
  const { SPREADSHEET_ID, SHEET_NAME } = CONFIG;

  // In panel.js (Page context via <script> tag)
  const { SPREADSHEET_ID, SHEET_NAME } = CONFIG;
  ```

### Best Practices

- Keep OAuth `client_id` synced between `config.js` and `manifest.json`
- Use const declarations for configuration values
- Prefer template literals for string interpolation
- Use `_` prefix for private/internal helper functions

---

## Installation & Setup

1. **Clone/Download** this extension folder

2. **Configure Google Cloud Project**:
   - Create OAuth 2.0 credentials (Chrome Extension type)
   - Enable Google Sheets API
   - Add extension ID to authorized origins

3. **Update Configuration**:
   - Edit `config.js` with your `CLIENT_ID` and `SPREADSHEET_ID`
   - Update `manifest.json` with matching `client_id`

4. **Load Extension**:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extension folder

5. **Authorize**:
   - Visit WhatsApp Web
   - Click any chat to trigger OAuth prompt
   - Grant Google Sheets access

---

## Troubleshooting

### Phone Not Extracted

- Check console for `[CRM]` prefixed log messages
- For saved contacts, phone appears in subtitle (uses `_extractFromHeaderSubtitle`)
- For business accounts, drawer may need to open (`_extractFromInfoDrawer`)

### No Match Found

- Verify phone column (M) contains the number
- Check last 6 digits match (extension searches by last 6 digits)
- Clear cache by waiting 15 seconds or reloading extension

### Dashboard Not Opening

- Check if popup was blocked by browser
- Manually open via extension action button

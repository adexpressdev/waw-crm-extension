# WhatsApp Sheet CRM

A Chrome Extension that integrates Google Sheets with WhatsApp Web, providing a side-panel CRM (Customer Relationship Management) system for managing customer contacts directly within WhatsApp.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Project Structure](#project-structure)
- [File Descriptions](#file-descriptions)
  - [config.js](#configjs)
  - [manifest.json](#manifestjson)
  - [background.js](#backgroundjs)
  - [content.js](#contentjs)
  - [panel.html & panel.js](#panelhtml--paneljs)
  - [dashboard.html & dashboard.js](#dashboardhtml--dashboardjs)
  - [style.css](#stylecss)
  - [dashboard.css](#dashboardcss)
- [Data Flow](#data-flow)
- [Configuration](#configuration)
- [Installation](#installation)

---

## Overview

**WhatsApp Sheet CRM** is a Chrome extension designed for the "AdExpress" team to manage customer data stored in a Google Sheet while using WhatsApp Web. When you open a chat in WhatsApp Web, the extension automatically:

1. Extracts the phone number from the chat
2. Searches the connected Google Sheet for matching contacts
3. Displays customer information in a side panel
4. Allows inline editing of customer data
5. Provides a workflow dashboard showing status counts

---

## Architecture

The extension follows a Manifest V3 architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CHROME BROWSER                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                    WhatsApp Web (Tab)                          │     │
│  │  ┌──────────────────────────┐  ┌─────────────────────────┐     │     │
│  │  │     Content Script        │  │    Side Panel (Iframe)  │     │     │
│  │  │    (content.js)           │  │    (panel.html/js)      │     │     │
│  │  │                           │  │                         │     │     │
│  │  │  • Phone Extraction       │  │  • Display Contact Data │     │     │
│  │  │  • DOM Manipulation       │◄─┤  • Inline Editing      │      │     │
│  │  │  • Event Listeners        │  │  • Group View          │      │     │
│  │  │  • Layout Adjustment      │  │  • Filtering           │      │     │
│  │  └──────────┬───────────────┘  └──────────┬──────────────┘      │     │
│  │             │                               │                   │     │
│  └─────────────┼───────────────────────────────┼───────────────────┘     │
│                │                               │                        │
│                │ Runtime Messages              │ Runtime Messages       │
│                ▼                               ▼                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    Service Worker (background.js)                │  │
│  │  ┌─────────────────────────────────────────────────────────────┐│  │
│  │  │  Configuration (config.js imported via importScripts())     ││  │
│  │  └─────────────────────────────────────────────────────────────┘│  │
│  │                                                                   │  │
│  │  • OAuth Authentication      • Phone Column Caching              │  │
│  │  • API Request Handler       • Dashboard Data Processing         │  │
│  │  • Cell Update Logic         • WhatsApp Chat Injection          │  │
│  └────────────┬─────────────────────────────────────────────────────┘  │
│               │                                                          │
│               │ HTTPS API Calls                                          │
│               ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    Dashboard Popup Window                        │  │
│  │                  (dashboard.html/js/css)                         │  │
│  │                                                                   │  │
│  │  • Status Visualization    • Auto-refresh (10s intervals)        │  │
│  │  • Urgency Indicators      • Sorting Logic                       │  │
│  └───────────────────────────────────────────────────────────────────  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────┘
                                │
                                │ Google Sheets API v4
                                ▼
                  ┌─────────────────────────────┐
                  │    Google Spreadsheet       │
                  │  (External Data Source)     │
                  │                             │
                  │  • Customer Records         │
                  │  • Status & Timestamps      │
                  │  • Phone Numbers (Col M)    │
                  └─────────────────────────────┘

Key Communication Patterns:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Content Script → Service Worker: Phone search requests
2. Panel → Service Worker: Data fetch & update requests
3. Service Worker → Google Sheets API: CRUD operations
4. Service Worker → Panel/Content: Response messages
5. Dashboard → Service Worker: Dashboard data requests
```

---

## Features

- **Automatic Phone Extraction**: Detects phone numbers from WhatsApp conversations using multiple extraction methods
- **Real-time Google Sheets Integration**: Read and write data directly to Google Sheets via the Sheets API
- **Side Panel CRM**: Displays customer details in a panel alongside WhatsApp Web
- **Inline Editing**: Double-click to edit fields, with automatic save to the sheet
- **Status Tracking**: Color-coded status indicators for quick visual reference
- **Group View**: View all contacts grouped by status with filtering by month and status
- **Status Dashboard**: Popup window showing status counts with urgency indicators
- **Auto-Refresh**: Both panel and dashboard automatically refresh data at intervals
- **Selection History**: Remembers your last selection per filter context in group view
- **Smart Caching**: 15-second cache for phone column to minimize API calls
- **Multiple Match Handling**: Shows all matches when multiple contacts share the same phone number

---

## Project Structure

```
New Excel Extension/
├── manifest.json          # Chrome extension manifest (v3)
├── config.js              # Centralized configuration (OAuth, Spreadsheet ID, Sheet Name)
├── background.js          # Service worker for API calls and message handling
├── content.js             # Injected into WhatsApp Web for DOM manipulation
├── panel.html             # Side panel UI structure
├── panel.js               # Side panel logic and event handling
├── style.css              # Styles for the side panel
├── dashboard.html         # Status dashboard popup structure
├── dashboard.js           # Dashboard logic for status visualization
├── dashboard.css          # Styles for the dashboard
└── icons/                 # Extension icons (16, 32, 48, 128px)
```

---

## File Descriptions

### config.js

**Purpose**: Centralized configuration file containing all sensitive values and environment-specific settings.

**Architecture Role**: Single source of truth for configuration that is imported by both Service Worker (background.js) and UI contexts (panel.js).

#### Structure:

```javascript
const CONFIG = {
  CLIENT_ID: "...", // OAuth2 client ID
  SPREADSHEET_ID: "...", // Target Google Sheet ID
  SHEET_NAME: "🔵Team Blue🔵", // Specific sheet tab name

  // Computed property
  get PHONE_COLUMN_RANGE() {
    return `'${this.SHEET_NAME}'!M:M`;
  },
};
```

#### Configuration Properties:

| Property             | Type   | Description                                           | Usage                                                   |
| -------------------- | ------ | ----------------------------------------------------- | ------------------------------------------------------- |
| `CLIENT_ID`          | String | OAuth2 client ID for Google Sheets API authentication | Used by Chrome's identity API, must match manifest.json |
| `SPREADSHEET_ID`     | String | Unique identifier for the Google Spreadsheet          | Extracted from sheet URL                                |
| `SHEET_NAME`         | String | Name of the specific sheet tab within the spreadsheet | Must match exactly, including emojis                    |
| `PHONE_COLUMN_RANGE` | Getter | Auto-generated A1 notation range for phone column (M) | Dynamically computed from SHEET_NAME                    |

#### Import Methods:

- **Service Worker (background.js)**: `importScripts('config.js')`
- **Page Context (panel.html)**: `<script src="config.js"></script>` tag

**Note**: This file must be kept in sync with `manifest.json` for OAuth client ID.

---

### manifest.json

**Purpose**: Chrome Extension configuration file defining permissions, resources, and extension behavior.

**Manifest Version**: 3 (latest Chrome extension standard)

#### Key Sections:

```json
{
  "manifest_version": 3,
  "name": "WhatsApp Sheet CRM",
  "version": "8",
  "description": "Displays and edits Google Sheet data...",

  "permissions": [
    "identity", // For OAuth2 authentication
    "storage", // For local data persistence
    "scripting", // For dynamic script injection
    "tabs" // For tab management
  ],

  "host_permissions": [
    "https://sheets.googleapis.com/", // Google Sheets API
    "https://web.whatsapp.com/*" // WhatsApp Web access
  ],

  "oauth2": {
    "client_id": "...", // Must match config.js CLIENT_ID
    "scopes": ["https://www.googleapis.com/auth/spreadsheets"]
  },

  "background": {
    "service_worker": "background.js" // Persistent background process
  },

  "content_scripts": [
    {
      "matches": ["https://web.whatsapp.com/"],
      "js": ["content.js"],
      "css": ["style.css"]
    }
  ],

  "web_accessible_resources": [
    {
      "resources": ["panel.html", "panel.js", "style.css", "config.js"],
      "matches": ["https://web.whatsapp.com/*"]
    }
  ]
}
```

#### Permission Explanations:

| Permission         | Purpose                                           | Risk Level                        |
| ------------------ | ------------------------------------------------- | --------------------------------- |
| `identity`         | Google OAuth2 authentication for Sheets API       | Low - Standard OAuth              |
| `storage`          | Store filter preferences and selection history    | Low - Local only                  |
| `scripting`        | Inject scripts into WhatsApp to search/open chats | Medium - Requires user trust      |
| `tabs`             | Query and manage browser tabs                     | Low - Read-only for WhatsApp tabs |
| `host_permissions` | Access to specific domains only                   | Low - Restricted scope            |

---

### config.js

Centralized configuration file containing sensitive values used across the extension.

**Configuration Values:**

- `CLIENT_ID`: OAuth2 client ID for Google Sheets API authentication
- `SPREADSHEET_ID`: The unique ID of the Google Spreadsheet to connect to
- `SHEET_NAME`: The name of the specific sheet tab within the spreadsheet
- `PHONE_COLUMN_RANGE`: Auto-generated range for the phone column (Column M)

**Usage:**

- Imported by `background.js` via `importScripts()`
- Loaded by `panel.js` via `<script>` tag in `panel.html`
- Must be manually synced with `manifest.json` for OAuth client ID

**Note**: When changing configuration, update `config.js` and reload the extension. For OAuth changes, also update `manifest.json`.

---

### background.js

**Purpose**: Service Worker that handles all Google Sheets API communication, authentication, and cross-component messaging.

**Architecture Role**: Central orchestrator between UI components (panel, content script) and external services (Google Sheets API).

#### Core Responsibilities:

1. **OAuth Authentication**: Manages Google OAuth2 tokens
2. **API Communication**: All Google Sheets read/write operations
3. **Message Routing**: Handles messages from content script and panel
4. **Data Caching**: Implements intelligent caching to reduce API calls
5. **Dashboard Management**: Opens and manages dashboard popup window

#### Global Variables:

| Variable             | Type        | Description                                             |
| -------------------- | ----------- | ------------------------------------------------------- |
| `dashboardWindowId`  | Number/null | Tracks the dashboard popup window ID                    |
| `SPREADSHEET_ID`     | String      | Imported from CONFIG                                    |
| `SHEET_NAME`         | String      | Imported from CONFIG                                    |
| `PHONE_COLUMN_RANGE` | String      | Imported from CONFIG (computed)                         |
| `cachedPhoneColumn`  | Object/null | Cache object: `{ values: Array, fetchedAt: timestamp }` |
| `PHONE_CACHE_TTL_MS` | Number      | Cache time-to-live: 15000ms (15 seconds)                |

#### Authentication Functions:

##### `getAuthToken()`

**Purpose**: Authenticates with Google using OAuth2 and retrieves access token.

**Returns**: `Promise<string>` - OAuth2 access token

**Flow**:

```
1. Call chrome.identity.getAuthToken({ interactive: true })
2. If successful: return token
3. If error: reject with error message
4. Token is automatically cached by Chrome
```

**Error Handling**: Rejects promise with descriptive error message on failure.

---

#### Utility Functions:

##### `columnToLetter(column)`

**Purpose**: Converts zero-based column index to Excel-style letter notation.

**Parameters**:

- `column` (Number): Zero-based column index (0 = A, 1 = B, etc.)

**Returns**: `String` - Column letter (A, B, C, ..., Z, AA, AB, etc.)

**Example**:

```javascript
columnToLetter(0); // "A"
columnToLetter(12); // "M"
columnToLetter(15); // "P"
```

**Implementation**: Uses `String.fromCharCode(65 + column)` for single letters.

---

#### Date Helper Functions:

##### `parseDateOnly(dstr)`

**Purpose**: Parses date strings into local midnight Date objects, handling multiple formats.

**Parameters**:

- `dstr` (String): Date string in "YYYY-MM-DD" or ISO format

**Returns**: `Date` object at local midnight, or `null` if invalid

**Formats Supported**:

- "YYYY-MM-DD" → Local midnight
- ISO strings → Normalized to local midnight

**Use Case**: Ensures consistent date comparison by removing time components.

---

##### `parseSheetDateFlexible(dstr)`

**Purpose**: Flexible date parser supporting multiple date formats from Google Sheets.

**Parameters**:

- `dstr` (String): Date string in various formats

**Returns**: `Date` object (preserves time if present), or `null` if invalid

**Formats Supported**:

1. ISO with time: "YYYY-MM-DDTHH:mm:ss.sssZ" → Full datetime
2. Date-only: "YYYY-MM-DD" → Local midnight
3. DD-MM-YYYY: "25-01-2026" → Local midnight
4. Fallback: Any parseable date format

**Logic**:

```javascript
if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
  // ISO format with time
  return new Date(s);
}
if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
  // YYYY-MM-DD format
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
  // DD-MM-YYYY format
  const [dd, mm, yyyy] = s.split("-").map(Number);
  return new Date(yyyy, mm - 1, dd);
}
// Fallback to Date constructor
return new Date(s);
```

---

##### `daysBetweenTodayLocal(d)`

**Purpose**: Calculates whole calendar days between today (at midnight) and a given date.

**Parameters**:

- `d` (Date): Target date object

**Returns**: `Number` - Number of days (positive if date is in past, negative if future)

**Algorithm**:

```javascript
1. Get today's date at midnight (00:00:00)
2. Get target date at midnight (00:00:00)
3. Calculate difference in milliseconds
4. Divide by 86400000 (milliseconds per day)
5. Floor to get whole days
```

**Example**:

```javascript
const date = new Date("2026-01-18");
daysBetweenTodayLocal(date); // 2 (if today is 2026-01-20)
```

**Use Case**: Determines if contacts are "unchanged" for 36+ hours in dashboard.

---

#### Message Handlers:

The service worker listens for messages via `chrome.runtime.onMessage.addListener()` and handles various actions:

##### Action: `getHeadersRequest`

**Purpose**: Fetches column headers (first row) from the Google Sheet.

**Request Parameters**: None

**Response**:

```javascript
{
    success: true,
    data: ['Status', 'Date', 'Payment Status', ...]  // Array of header names
}
```

**API Call**:

```
GET https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/'{SHEET_NAME}'!A1:U1
```

**Error Handling**: Returns `{ success: false, message: errorMessage }` on failure.

---

##### Action: `searchLast6Digits`

**Purpose**: Searches column M (phone numbers) for matches ending with specified 6 digits.

**Request Parameters**:

```javascript
{
    action: 'searchLast6Digits',
    digits: '123456'  // Last 6 digits of phone number
}
```

**Flow**:

```
1. Check cache: If phone column cached < 15s ago, use cache
2. Otherwise: Fetch column M from Google Sheets
3. Cache the result with timestamp
4. Find all rows where phone ends with provided digits
5. Batch fetch full row data (A:U) for all matches
6. Send results back to content script via chrome.runtime.sendMessage()
```

**Response Messages**:

```javascript
// Multiple/Single match
{
    action: 'displayRowData',
    matches: [
        { data: [...], rowIndex: 5 },
        { data: [...], rowIndex: 12 }
    ]
}

// No match
{ action: 'displayNoMatch' }

// Error
{ action: 'displayError', message: 'Error message' }
```

**Performance Optimization**:

- Uses in-memory cache to avoid repeated API calls during rapid chat switching
- Batch fetches all matching rows in single API call using `batchGet`
- Reverses matches array to show most recent first

**API Calls**:

```
1. GET .../values/{PHONE_COLUMN_RANGE}  (cached)
2. GET .../values:batchGet?ranges={range1}&ranges={range2}...
```

---

##### Action: `fetchAllData`

**Purpose**: Retrieves all customer data from the sheet for group view.

**Request Parameters**: None

**Response**:

```javascript
{
    success: true,
    data: [
        ['Status', 'Date', 'Payment', ...],  // Row 2
        ['Status', 'Date', 'Payment', ...],  // Row 3
        // ... all subsequent rows
    ]
}
```

**API Call**:

```
GET https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/'{SHEET_NAME}'!A2:U
```

**Use Case**: Powers the group view feature in panel.js.

---

##### Action: `updateCellValue`

**Purpose**: Updates a cell value and conditionally updates timestamp when status changes.

**Request Parameters**:

```javascript
{
    action: 'updateCellValue',
    rowIndex: 5,           // Row number (1-based)
    columnIndex: 0,        // Column index (0-based)
    newValue: 'Closed'     // New cell value
}
```

**Flow**:

```
1. Convert columnIndex to letter (e.g., 0 → "A", 12 → "M")
2. Build range string: 'Sheet Name'!A5
3. Create primary update request

4. IF columnIndex === 0 (Status column):
   a. Get current date in DD-MM-YYYY format
   b. Create secondary update for column P (timestamp)
   c. Add to update promises array

5. Execute all updates in parallel using Promise.all()
6. Check all responses for errors
7. Send success/failure response
```

**Timestamp Logic**:

```javascript
if (parseInt(request.columnIndex) === 0) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const timestampValue = `${dd}-${mm}-${yyyy}`;

  // Update column P with current date
  const timestampRange = `'${SHEET_NAME}'!P${request.rowIndex}`;
  // ... create PUT request
}
```

**API Calls**:

```
1. PUT .../values/{range}?valueInputOption=USER_ENTERED
   Body: { values: [[newValue]] }

2. [Conditional] PUT .../values/{timestampRange}?valueInputOption=USER_ENTERED
   Body: { values: [[timestamp]] }
```

**Response**:

```javascript
{
  success: true;
} // or { success: false, message: errorMessage }
```

**Error Handling**: Returns detailed error message if any API call fails.

---

##### Action: `openWhatsAppChat`

**Purpose**: Injects script into WhatsApp Web to search and open a specific chat by phone number.

**Request Parameters**:

```javascript
{
    action: 'openWhatsAppChat',
    phone: '+8801712345678'  // Phone number (any format)
}
```

**Flow**:

```
1. Strip all non-digit characters from phone number
2. Find open WhatsApp Web tab
3. Inject function into MAIN world (not ISOLATED)
4. Function searches for phone in WhatsApp's search box
5. Clicks first result or presses Enter
```

**Injection Strategy**:

```javascript
await chrome.scripting.executeScript({
  target: { tabId },
  world: "MAIN", // Access WhatsApp's actual DOM & JS
  func: injectSearchAndOpen,
  args: [phone],
});
```

**Injected Function Logic**:

```javascript
function injectSearchAndOpen(number) {
  // 1. Find search box using multiple selectors
  // 2. Click "New Chat" button if search box hidden
  // 3. Insert phone number into search box
  // 4. Wait for results (650ms)
  // 5. Click first result or press Enter
}
```

**Search Box Selectors** (tried in order):

```javascript
[
  'div[data-testid="chat-list-search"] div[contenteditable="true"]',
  '#side [contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"][aria-label*="Search"]',
  'div[contenteditable="true"][title*="Search"]',
  '#side [contenteditable="true"][data-tab]',
];
```

**Error Handling**: Returns error if no WhatsApp tab found or injection fails.

---

##### Action: `getDashboardData`

**Purpose**: Fetches all customer data and calculates status counts for the dashboard.

**Request Parameters**: None

**Response**:

```javascript
{
    success: true,
    data: {
        'Waiting for approval': 15,
        'Closed': 8,
        'Code Pending...': 3,
        'Unchanged (36h+)': 7,
        // ... other statuses
    }
}
```

**Processing Logic**:

```javascript
1. Fetch rows A2:P (all data including timestamps)
2. Initialize statusCounts object
3. Initialize unchangedCount = 0

4. For each row:
   a. Count status from column A
   b. Get timestamp from column P (index 15)
   c. If status !== 'Closed':
      - If no timestamp: unchangedCount++
      - If timestamp > 36 hours old: unchangedCount++

5. Add 'Unchanged (36h+)' to statusCounts if > 0
6. Return statusCounts object
```

**36-Hour Calculation**:

```javascript
const now = new Date();
const thirtySixHoursAgo = now.getTime() - 36 * 60 * 60 * 1000;

// For each row:
const dt = parseSheetDateFlexible(timestampString);
const timestamp = dt ? dt.getTime() : NaN;

if (isNaN(timestamp) || timestamp < thirtySixHoursAgo) {
  unchangedCount++;
}
```

**Use Case**: Powers the dashboard popup with real-time status counts.

---

#### Dashboard Management Functions:

##### `openDashboard()`

**Purpose**: Creates or refreshes the dashboard popup window.

**Behavior**:

```
1. Define window options (900x720 popup)
2. If dashboardWindowId exists:
   a. Try to close existing window
   b. Ignore error if already closed by user
3. Create new popup window
4. Store new window ID in dashboardWindowId
```

**Window Configuration**:

```javascript
{
    url: chrome.runtime.getURL('dashboard.html'),
    type: 'popup',
    width: 900,
    height: 720
}
```

**Triggers**:

- `chrome.runtime.onStartup`: Opens on browser startup
- Manual close detection: Resets `dashboardWindowId` when closed

**Event Listeners**:

```javascript
chrome.runtime.onStartup.addListener(openDashboard);

chrome.windows.onRemoved.addListener((closedWindowId) => {
  if (closedWindowId === dashboardWindowId) {
    dashboardWindowId = null; // Reset to allow reopening
  }
});
```

---

#### Caching Strategy:

**Phone Column Cache**:

```javascript
cachedPhoneColumn = {
    values: [['8801712345678'], ['8801823456789'], ...],
    fetchedAt: 1706000000000  // Unix timestamp
}
```

**Cache Logic**:

```javascript
const now = Date.now();
if (cachedPhoneColumn && (now - cachedPhoneColumn.fetchedAt) < PHONE_CACHE_TTL_MS) {
    // Use cached data (< 15 seconds old)
    phoneNumbersInSheet = cachedPhoneColumn.values;
} else {
    // Fetch fresh data and update cache
    const response = await fetch(...);
    phoneNumbersInSheet = data.values;
    cachedPhoneColumn = { values: phoneNumbersInSheet, fetchedAt: now };
}
```

**Benefits**:

- Reduces API quota usage
- Improves response time during rapid chat switching
- Minimal staleness (15 seconds acceptable for phone lookups)

---

### content.js

**Purpose**: Content script injected into WhatsApp Web that extracts phone numbers and manages the side panel UI.

**Architecture Role**: Bridge between WhatsApp Web's DOM and the extension's Service Worker. Handles all DOM manipulation and phone extraction logic.

#### Core Responsibilities:

1. **Phone Number Extraction**: Multi-method approach to detect phone numbers
2. **DOM Manipulation**: Injects side panel iframe and adjusts WhatsApp layout
3. **Event Handling**: Listens for chat switches (clicks, hashchange, mutations)
4. **Message Passing**: Sends phone search requests to Service Worker

#### Global Constants & Variables:

| Variable           | Type        | Description                                           |
| ------------------ | ----------- | ----------------------------------------------------- |
| `_isExtractingNow` | Boolean     | Prevents concurrent extraction operations             |
| `_lastDigitsSent`  | String/null | Tracks last 6 digits sent to avoid duplicate searches |
| `DBG`              | Boolean     | Debug flag for logging extraction paths               |

---

#### Phone Extraction Architecture:

The extension uses a **waterfall strategy** with 8 different extraction methods, tried in priority order:

```
Priority 1: Quick DOM Selectors (No Delays)
├─ _extractFromLeftPaneSelected()    [Left sidebar selected row]
├─ _extractFromDataAttrs()           [data-id, data-jid attributes]
├─ _extractFromHeaderTel()           [tel: links in header]
├─ _extractFromHeaderAria()          [aria-label attributes]
├─ _extractFromHeaderText()          [Visible header text patterns]
└─ _extractFromUrl()                 [URL parameters and hash]

Priority 2: Delayed/Drawer Methods (If Priority 1 fails)
├─ _hasLidContext()                  [Detect business/LID accounts]
├─ _extractFromInfoDrawer()          [Open contact info drawer]
└─ _extractFromDrawerCopyableSpan()  [Scan copyable text in drawer]
```

---

#### Helper Functions:

##### `_sleep(ms)`

**Purpose**: Async sleep utility for DOM waiting.

**Returns**: `Promise` that resolves after specified milliseconds.

```javascript
const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await _sleep(300); // Wait 300ms
```

---

##### `_onlyDigits(s)`

**Purpose**: Strips all non-digit characters from a string.

**Parameters**: `s` (String) - Input string

**Returns**: String containing only digits (0-9)

```javascript
_onlyDigits("+880 1712-345678"); // '8801712345678'
_onlyDigits("(123) 456-7890"); // '1234567890'
```

---

##### `_hasMinLen(s, len = 8)`

**Purpose**: Validates that a string has minimum digit count.

**Parameters**:

- `s` (String) - Input string
- `len` (Number) - Minimum length (default: 8)

**Returns**: `Boolean` - True if digit count >= len

```javascript
_hasMinLen("123456789"); // true (9 >= 8)
_hasMinLen("1234567", 8); // false (7 < 8)
_hasMinLen("+880171234", 10); // true (11 >= 10)
```

---

##### `_isVisible(el)`

**Purpose**: Checks if an element is currently visible in the DOM.

**Parameters**: `el` (HTMLElement) - Element to check

**Returns**: `Boolean` - True if visible

**Checks**:

1. Element exists
2. `display` !== 'none'
3. `visibility` !== 'hidden'
4. `opacity` !== '0'
5. `width` > 0 and `height` > 0

```javascript
const element = document.querySelector(".hidden-div");
if (_isVisible(element)) {
  // Element is visible
}
```

---

#### Phone Extraction Functions:

##### `_extractFromDataAttrs()`

**Purpose**: Searches for phone numbers in WhatsApp's data attributes.

**Strategy**: Scans #main for elements with data-\* attributes containing phone numbers.

**Selectors Checked**:

```javascript
["[data-id]", "[data-jid]", "[data-chatid]", "[data-conversation-id]"];
```

**Pattern Matching**:

```javascript
// Matches: 8801712345678@c.us or 8801712345678@s.whatsapp.net
const pattern = /(?:^|_)(\d{6,})(?=@(?:c\.us|s\.whatsapp\.net)|$)/;
```

**LID Filtering**: Skips attributes containing `@lid_` (business accounts use different ID format).

**Returns**: String of digits or `null`

**Example Data**:

```html
<div data-id="8801712345678@c.us">...</div>
<!-- Extracts: "8801712345678" -->
```

---

##### `_hasLidContext()`

**Purpose**: Detects if current chat is a business account (uses LID instead of phone).

**Strategy**: Searches for `@lid_` patterns in visible elements.

**Selectors**:

```javascript
[
  '#main [data-id*="@lid_"]',
  '#main [data-jid*="@lid_"]',
  '[aria-selected="true"] [data-id*="@lid_"]',
  '[aria-selected="true"] [data-jid*="@lid_"]',
];
```

**Returns**: `Boolean` - True if LID context detected

**Impact**: When true, changes extraction priority to favor drawer methods.

---

##### `_extractFromHeaderTel()`

**Purpose**: Extracts phone from `tel:` links in conversation header.

**Strategy**: Searches header for anchor tags with `href="tel:..."`.

**Selectors**:

```javascript
const header = document.querySelector(
  "#main header, " +
    '[data-testid="conversation-header"], ' +
    '[data-testid="conversation-info-header"], ' +
    '[role="banner"]',
);
const tel = header.querySelector('a[href^="tel:"]');
```

**Returns**: Digits from href or `null`

**Example**:

```html
<a href="tel:+8801712345678">Call</a>
<!-- Extracts: "8801712345678" -->
```

---

##### `_extractFromHeaderAria()`

**Purpose**: Extracts phone from aria-label attributes in header.

**Strategy**: Checks aria-label on header buttons and elements.

**Selectors**:

```javascript
[
  '#main header [role="button"][aria-label]',
  "#main header [aria-label]",
  '[data-testid="conversation-header"] [aria-label]',
  '[data-testid="conversation-info-header"] [aria-label]',
];
```

**Returns**: Digits from aria-label or `null`

**Example**:

```html
<button aria-label="Contact: +880 1712345678">...</button>
<!-- Extracts: "8801712345678" -->
```

---

##### `_extractFromHeaderText()`

**Purpose**: Parses visible header text for phone number patterns.

**Strategy**: Reads text content from header title/name elements.

**Pattern**:

```javascript
const rx = /(\+?\d[\d\s\-().]{6,})/g;
```

**Logic**:

```javascript
1. Find header element
2. Target name/title node
3. Extract innerText/textContent
4. Regex match all phone-like patterns
5. Return longest match (most complete number)
```

**Returns**: Longest phone number found or `null`

**Example Text**:

```
"John Doe +880 1712-345678"
<!-- Extracts: "8801712345678" -->
```

---

##### `_extractFromUrl()`

**Purpose**: Extracts phone from URL parameters and hash.

**Strategy**: Parses `location.href` for phone-related parameters.

**Query Parameters Checked**:

```javascript
["phone", "chat", "jid", "id", "number"];
```

**Hash Patterns**:

```javascript
// Patterns like: #/t/8801712345678, #/c/123..., #...&chat=123...
h.match(/(?:^|[/?&])(t|c|chat|jid)=?(\d{6,})/i);
h.match(/\/(t|c)\/(\d{6,})/i);
```

**Path Pattern**:

```javascript
// /8801712345678 or /8801712345678@s.whatsapp.net
(u.pathname || "").match(/(\d{6,})(?=@|$)/);
```

**Returns**: Digits from URL or `null`

**Example URLs**:

```
https://web.whatsapp.com/?phone=8801712345678
https://web.whatsapp.com/#/t/8801712345678
https://web.whatsapp.com/8801712345678@c.us
```

---

##### `_extractFromLeftPaneSelected()`

**Purpose**: Reads phone from the selected (or visible) chat item in left sidebar.

**Strategy**:

1. Find all visible chat rows
2. Prefer explicitly selected row (`aria-selected="true"`)
3. Fallback: Use row with largest visible area (most likely active)

**Selectors**:

```javascript
['[data-testid="cell-frame-container"]', '[role="row"]', '[role="listitem"]'];
```

**Selection Logic**:

```javascript
// 1. Try to find selected row
let selected = allRows.find(
  (el) =>
    el.getAttribute("aria-selected") === "true" ||
    el.getAttribute("data-selected") === "true",
);

// 2. If none selected, find row with largest visible area
if (!selected) {
  selected = allRows
    .map((el) => ({ el, area: visibleWidth * visibleHeight }))
    .sort((a, b) => b.area - a.area)[0].el;
}
```

**Data Sources**:

1. data-\* attributes (data-id, data-jid, etc.)
2. Title attributes on child elements
3. Visible text content

**Returns**: Phone number or `null`

---

##### `_findBdPhonesInText(text)`

**Purpose**: Specialized parser for Bangladesh mobile numbers in text.

**Patterns Detected**:

1. **International**: `+8801XXXXXXXXX` (13 digits total)
2. **Local**: `01XXXXXXXXX` (11 digits, starting with 013-019)

**Algorithm**:

```javascript
1. Strip all non-digits from text
2. Scan for patterns:
   - "8801" followed by 9 more digits → 13-digit number
   - "01" followed by digit 3-9, then 8 more digits → 11-digit number
3. Deduplicate using Set
4. Return array of all found numbers
```

**Returns**: `Array<String>` - Array of phone numbers found

**Example**:

```javascript
_findBdPhonesInText("Call +8801712345678 or 01823456789");
// Returns: ["8801712345678", "01823456789"]
```

---

##### `_extractFromInfoDrawer({ aggressive = false })`

**Purpose**: Opens contact info drawer and scrapes phone number.

**Parameters**:

- `aggressive` (Boolean): If true, waits longer for drawer to load (for business accounts)

**Strategy**:

```
1. Check if drawer already open
2. If not, click header to open
3. Wait for drawer to appear (max 1.5s normal, longer if aggressive)
4. FAST PATH: Look for "About and phone number" section with copyable text
5. FALLBACK: Tree walker scan of all visible text nodes
6. Close drawer if opened by this function
```

**Drawer Selectors**:

```javascript
[
  '[data-testid="conversation-info-drawer"]',
  '[data-testid="contact-info"]',
  'div[role="dialog"][data-animate-modal="true"]',
  'aside[aria-label], [role="region"][aria-label]',
];
```

**Fast Path - About Section**:

```javascript
const aboutSection = drawer.querySelector(
  ".x13mwh8y.x1q3qbx4.x1wg5k15.x3psx0u.xat24cr.x1280gxy...",
);
const phoneEl = aboutSection.querySelector("._ajxt .copyable-text");
```

**Wait Logic**:

```javascript
const spins = aggressive ? 25 : 12; // 25 × 60ms or 12 × 60ms
for (let i = 0; i < spins; i++) {
  await _sleep(60);
  // Check if drawer visible
  if (rect.width > 10 && rect.height > 10 && opacity > 0.3) {
    break; // Found!
  }
}
```

**Returns**: Phone number or `null`

**Performance**:

- Normal mode: ~720ms max
- Aggressive mode: ~1500ms max
- Fast path (if drawer already open): <100ms

---

##### `_extractFromDrawerCopyableSpan()`

**Purpose**: Scans existing (already open) drawer for copyable phone text.

**Strategy**: Targets WhatsApp's specific CSS classes for copyable phone fields.

**Selectors**:

```javascript
("._ajxu .copyable-text",
  "._ajxt .copyable-text",
  ".copyable-text.selectable-text");
```

**Priority**:

1. Check "About and phone number" section first
2. Fallback to general drawer scan

**Returns**: Phone number or `null`

**Use Case**: Called after drawer operations or as fallback when drawer is already open.

---

##### `extractPhoneNumber()` - Main Aggregator

**Purpose**: Orchestrates all extraction methods with intelligent fallback logic.

**Algorithm**:

```
1. Try quick methods (non-drawer):
   - Left pane selected
   - Data attributes
   - Header tel links
   - Header aria labels
   - Header text
   - URL parameters

2. If found: Return immediately (< 50ms)

3. If NOT found AND is LID context:
   - Try quick methods again (header/URL might have loaded)
   - Open drawer aggressively (longer wait)
   - Try drawer copyable spans
   - Last resort: URL/left pane again

4. If NOT found AND NOT LID:
   - Try quick methods again
   - Wait up to 600ms for DOM to settle
   - Poll every 80ms during settle period
   - Final fallback: Open drawer

5. Return phone or null
```

**Returns**: `String` (digits only) or `null`

**Typical Execution Times**:

- **Fast path** (regular chat, data-\* available): 10-50ms
- **Header text** (unsaved number): 50-200ms
- **Drawer required** (business account): 800-1500ms

**Logging**: All steps logged with `[CRM] Step:` prefix for debugging.

---

#### Layout & UI Functions:

##### `adjustWhatsAppLayout()`

**Purpose**: Resizes WhatsApp's #app container to make room for side panel.

**Implementation**:

```javascript
const app = document.querySelector("#app");
if (app) {
  app.style.width = "calc(100% - 290px)";
  app.style.transition = "width 0.3s ease-in-out";
}
```

**Effect**: Smoothly shrinks WhatsApp to left, creating space on right for panel.

---

##### `injectIframe()`

**Purpose**: Creates and injects the side panel iframe into WhatsApp Web.

**Implementation**:

```javascript
1. Check if iframe already exists (prevent duplicates)
2. Create iframe element
3. Set ID: 'sheet-viewer-iframe'
4. Set src: chrome.runtime.getURL('panel.html')
5. Append to document.body
6. Call adjustWhatsAppLayout()
```

**iframe Properties**:

- **ID**: `sheet-viewer-iframe`
- **Position**: Fixed, right side
- **Width**: 290px
- **Height**: 100vh
- **Z-index**: 9999 (on top of WhatsApp)

---

#### Event Handling:

##### `runExtractionAndSearch(reason)`

**Purpose**: Unified function that runs extraction and sends search request.

**Parameters**:

- `reason` (String): Debug info about what triggered the extraction

**Flow**:

```
1. Check if extraction already running (prevent concurrency)
2. Set _isExtractingNow = true
3. Call extractPhoneNumber()
4. Get last 6 digits
5. If same as last search: Skip (avoid duplicate)
6. Update _lastDigitsSent
7. Send message to Service Worker:
   { action: 'searchLast6Digits', digits: last6Digits }
8. Finally: Set _isExtractingNow = false
```

**Concurrency Protection**: Only one extraction can run at a time.

**Deduplication**: Skips search if same 6 digits as previous search.

**Trigger Reasons**:

- `'click'` - User clicked chat in left pane
- `'hashchange'` - URL hash changed
- `'mutation'` - DOM mutation detected in #main header

---

##### `initChatSearchListener()`

**Purpose**: Sets up click listener for chat switches.

**Strategy**: Single delegated listener on #app container (efficient).

**Implementation**:

```javascript
appContainer.addEventListener("click", (event) => {
  const chatTarget = event.target.closest(
    '[data-testid="cell-frame-container"], ' +
      '[role="listitem"], ' +
      '[role="row"], ' +
      '[data-id*="@c.us"], ' +
      'div[role="row"][aria-selected="true"]',
  );

  if (!chatTarget) return; // Not a chat click

  setTimeout(() => runExtractionAndSearch("click"), 130);
});
```

**Delay**: 130ms delay allows WhatsApp to update its UI before extraction.

---

##### `initDomObservers()`

**Purpose**: Sets up observers for hash changes and DOM mutations.

**Hash Change Observer**:

```javascript
window.addEventListener("hashchange", () => {
  setTimeout(() => runExtractionAndSearch("hashchange"), 130);
});
```

**Mutation Observer**:

```javascript
const mo = new MutationObserver((mutations) => {
  let headerTouched = false;

  for (const m of mutations) {
    const t = m.target;
    if (t.closest('#main header, [data-testid="conversation-header"]')) {
      headerTouched = true;
      break;
    }
  }

  if (headerTouched) {
    setTimeout(() => runExtractionAndSearch("mutation"), 150);
  }
});

mo.observe(mainEl, { childList: true, subtree: true });
```

**Optimization**: Only triggers on header-related mutations (filters out irrelevant changes).

---

#### Initialization:

Script executes immediately when loaded into WhatsApp Web:

```javascript
injectIframe(); // Create side panel
initChatSearchListener(); // Set up click handler
initDomObservers(); // Set up hash/mutation observers
```

**Load Order**:

1. Style.css applied (via manifest)
2. content.js executes
3. Iframe injected
4. Listeners attached
5. Ready to detect chat switches

---

### panel.html & panel.js

**Purpose**: Side panel UI that displays customer data and provides editing capabilities.

**Architecture Role**: User interface layer that consumes data from Service Worker and sends update requests back.

---

#### panel.html Structure:

```html
<body>
  <div class="header-container">
    <h3>AdExpress Side CRM</h3>

    <div class="controls-line">
      <div id="multi-status-indicator"></div>
      <!-- Status circles -->

      <div class="header-controls">
        <select id="month-filter">
          ...
        </select>
        <!-- Month filter -->
        <select id="status-filter">
          ...
        </select>
        <!-- Status filter -->
        <button id="group-view-btn">...</button>
        <!-- Toggle button -->
      </div>
    </div>
  </div>

  <div id="status">Loading...</div>
  <!-- Status messages -->
  <div id="data-container"></div>
  <!-- Single/multiple contacts -->
  <div id="grouped-data-container"></div>
  <!-- Group view -->

  <script src="config.js"></script>
  <script src="panel.js"></script>
</body>
```

---

#### panel.js - Global Configuration:

```javascript
// Import from CONFIG
const { SPREADSHEET_ID, SHEET_NAME } = CONFIG;

// DOM Elements
const statusDiv = document.getElementById("status");
const dataContainer = document.getElementById("data-container");
const groupedDataContainer = document.getElementById("grouped-data-container");
const groupViewBtn = document.getElementById("group-view-btn");
const monthFilter = document.getElementById("month-filter");
const statusFilter = document.getElementById("status-filter");

// State Variables
let sheetHeaders = []; // Column headers from row 1
let allSheetData = []; // All rows for group view
let isGroupView = false; // Current view mode
let hasScrolledToInitialItem = false; // Scroll state
let refreshIntervalId = null; // Auto-refresh timer

// Single Contact Template State (Performance Optimization)
let singleTemplateInitialized = false;
let singleTemplateRoot = null; // Cached DOM reference
let currentRowIndex = null; // Currently displayed row
```

---

#### Data Configuration:

##### Dropdown Options:

```javascript
const dropdownOptions = {
    0: ['Waiting for approval', 'Code Pending...', 'Farzana voice', ...],
    2: ['payment number sended', 'Approved', 'Dont like the audio', ...]
};
```

**Column Mapping**:

- **Column 0** (Status): Primary workflow status
- **Column 2** (Payment Status): Payment-related statuses

##### Status-to-CSS Mapping:

```javascript
const statusToClass = {
  "Waiting for approval": "status-waiting-for-approval",
  "Code Pending...": "status-code-pending",
  Closed: "status-closed",
  "Bill due": "status-bill-due",
  // ... more mappings
};
```

**Purpose**: Maps status values to CSS classes for color-coding.

---

#### Core Display Functions:

##### `getHeaders()`

**Purpose**: Fetches column headers from the sheet on panel load.

**Flow**:

```
1. Send message: { action: 'getHeadersRequest' }
2. Set 15-second timeout for error handling
3. On response: Store in sheetHeaders array
4. On error: Display error message in statusDiv
```

**Timeout Protection**:

```javascript
headerTimeout = setTimeout(() => {
  statusDiv.textContent = "Error: Request to background service timed out.";
}, 15000);
```

---

##### `displaySingleRow(rowData, rowIndex)`

**Purpose**: Displays a single contact using optimized template reuse.

**Parameters**:

- `rowData` (Array): Row data from sheet
- `rowIndex` (Number): Sheet row number

**Flow**:

```
1. Clear multi-status indicator
2. Hide status div
3. Call updateSingleContactTemplate() to reuse/create template
```

**Performance**: Reuses existing DOM instead of rebuilding on each contact switch.

---

##### `displayMultipleMatches(matches)`

**Purpose**: Displays multiple contacts when phone number has multiple matches.

**Parameters**:

- `matches` (Array): Array of `{ data: [], rowIndex: Number }` objects

**Flow**:

```
1. Reset single template cache (switching to multi view)
2. Create status circles in multi-status-indicator
3. Generate HTML for all contacts
4. Add dividers between contacts
5. Attach edit listeners for each contact
```

**Status Circles**:

```javascript
matches.forEach((match) => {
  const status = match.data[0] || "Uncategorized";
  const statusClass = statusToClass[status] || "status-uncategorized";

  const circle = document.createElement("div");
  circle.classList.add("status-circle", statusClass);
  circle.title = status;
  indicatorContainer.appendChild(circle);
});
```

**Visual**: Colored circles in header show status of each match at a glance.

---

##### `generateSingleContactHTML(rowData, rowIndex)`

**Purpose**: Generates HTML markup for a single contact's detail view.

**Parameters**:

- `rowData` (Array): Cell values
- `rowIndex` (Number): Sheet row number

**Returns**: HTML string

**Structure**:

```html
<div class="details-view" data-row-context="${rowIndex}">
  <div class="detail-item ${statusClass}" data-column-index="0">
    <strong>Status</strong>
    <select data-row-index="..." data-column-index="0">
      <option>Waiting for approval</option>
      ...
    </select>
  </div>

  <div class="detail-item" data-column-index="1">
    <strong>Date</strong>
    <p contenteditable="false">25/01/2026</p>
    <button class="save-btn">Save</button>
  </div>

  <!-- ... more fields -->
</div>
```

**Field Types**:

1. **Dropdown**: If column index in `dropdownOptions`
2. **Text + Save Button**: All other columns

**Color Coding**:

- **Status** (Column 0): Dynamic class from `statusToClass`
- **Column 4**: `bg-off-white`
- **Column 6**: `bg-light-purple`
- **Column 8**: `bg-light-green`
- **Column 9**: `bg-light-blue`
- **Column 10**: `bg-light-red`

---

#### Template Optimization Functions:

##### `initSingleContactTemplate(rowData, rowIndex)`

**Purpose**: Builds the single contact template for the first time.

**Flow**:

```
1. Generate full HTML using generateSingleContactHTML()
2. Inject into dataContainer
3. Get reference to .details-view element
4. Store reference in singleTemplateRoot
5. Set singleTemplateInitialized = true
6. Store currentRowIndex
7. Call attachSingleTemplateListeners()
```

**One-Time Setup**: Event listeners attached only once for performance.

---

##### `updateSingleContactTemplate(rowData, rowIndex)`

**Purpose**: Updates template values without rebuilding DOM.

**Flow**:

```
1. If template not initialized: Call initSingleContactTemplate()
2. Update currentRowIndex
3. For each .detail-item:
   a. Get column index
   b. Get new cell value
   c. If dropdown: Update select.value
   d. If text: Update p.textContent
   e. Update status class if Column 0
```

**Performance Benefit**:

- **Without template**: ~15-30ms per contact switch (DOM rebuild)
- **With template**: ~2-5ms per contact switch (value updates only)

---

##### `attachSingleTemplateListeners()`

**Purpose**: Wires up editing/saving event listeners to the template.

**Text Field Listeners**:

```javascript
p.addEventListener("dblclick", (e) => {
  e.target.dataset.originalValue = e.target.textContent;
  e.target.contentEditable = "true";
  e.target.focus();
});

p.addEventListener("input", (e) => {
  if (e.target.textContent !== e.target.dataset.originalValue) {
    saveBtn.classList.add("visible"); // Show save button
  }
});

p.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    triggerSave();
  }
  if (e.key === "Escape") {
    p.textContent = p.dataset.originalValue;
    saveBtn.classList.remove("visible");
  }
});
```

**Dropdown Listeners**:

```javascript
select.addEventListener("change", (e) => {
  const columnIndex = e.target.dataset.columnIndex;
  const newValue = e.target.value;
  saveUpdate(currentRowIndex, columnIndex, newValue, select);

  // Update status color if Column 0
  if (parseInt(columnIndex) === 0) {
    detailItem.classList.remove(...Object.values(statusToClass));
    const newClass = statusToClass[newValue];
    if (newClass) detailItem.classList.add(newClass);
  }
});
```

---

#### Editing Functions:

##### `addEditListeners(rowIndex, contextElement)`

**Purpose**: Attaches event listeners for multi-match view (each contact needs its own listeners).

**Parameters**:

- `rowIndex` (Number): Sheet row number
- `contextElement` (HTMLElement): Container for this specific contact

**Key Difference from Template**: Uses closure to capture specific rowIndex for each contact.

---

##### `saveUpdate(rowIndex, columnIndex, newValue, element)`

**Purpose**: Sends update request to Service Worker and provides UI feedback.

**Parameters**:

- `rowIndex` (Number): Sheet row (1-based)
- `columnIndex` (Number): Column index (0-based)
- `newValue` (String): New cell value
- `element` (HTMLElement): Element for feedback display

**Flow**:

```
1. Show "Saving..." feedback
2. Send message: {
     action: 'updateCellValue',
     rowIndex, columnIndex, newValue
   }
3. On success:
   - Show "Saved!" for 2 seconds
   - Update originalValue
4. On error:
   - Show "Error!"
   - Revert to original value
```

**Feedback States**:

- **Idle**: "Save" (hidden)
- **Saving**: "Saving..." (visible)
- **Success**: "Saved!" (visible for 2s, then hidden)
- **Error**: "Error!" (visible, reverts value)

---

#### Group View Functions:

##### `renderGroupedView()`

**Purpose**: Renders all contacts grouped by status with filtering and selection memory.

**Flow**:

```
1. Get current filter context (month + status)
2. Load selection history from Chrome storage
3. Filter data by month/status/"unchanged"
4. Find last selected phone in this context
5. Group data by status
6. Generate HTML with status groups
7. Highlight previously selected contact
8. Attach click listeners with history tracking
9. Auto-scroll to selected item (once per view entry)
```

**Selection History Logic**:

```javascript
const contextKey = `${month}-${status}`; // e.g., "7-Waiting for approval"
const contextHistory = selectionHistory[contextKey] || [];

// Find last selected phone that's still visible
for (let i = contextHistory.length - 1; i >= 0; i--) {
  if (visiblePhones.has(contextHistory[i])) {
    phoneToHighlight = contextHistory[i];
    break;
  }
}
```

**Click Handler**:

```javascript
item.addEventListener("click", async () => {
  // 1. Update UI immediately
  // 2. Update history for this context
  // 3. Trim history to MAX_HISTORY_PER_CONTEXT (10)
  // 4. Save to Chrome storage
  // 5. Send openWhatsAppChat message
});
```

**Filter - "Unchanged (36h+)"**:

```javascript
if (status === "unchanged") {
  const thirtySixHoursAgo = now.getTime() - 36 * 60 * 60 * 1000;

  dataToRender = allSheetData.filter((rowWithIndex) => {
    const status = rowWithIndex.data[0];
    if (status === "Closed") return false;

    const timestampString = rowWithIndex.data[15]; // Column P
    if (!timestampString) return true; // No timestamp = unchanged

    const ts = parseSheetDateFlexible(timestampString).getTime();
    return isNaN(ts) || ts < thirtySixHoursAgo;
  });
}
```

---

##### `toggleGroupView()`

**Purpose**: Switches between single contact view and group view.

**Flow When Entering Group View**:

```
1. Reset scroll flag
2. Clear multi-status indicator
3. Update button icon (chart → back)
4. Show month/status filters
5. Hide data-container, show grouped-data-container
6. Send fetchAllData message
7. On response: Store data, call renderGroupedView()
8. Start 10-second auto-refresh interval
```

**Flow When Exiting Group View**:

```
1. Stop auto-refresh interval
2. Update button icon (back → chart)
3. Hide filters
4. Show data-container, hide grouped-data-container
5. Show status message
```

---

##### `refreshGroupViewData()`

**Purpose**: Auto-refreshes group view data every 10 seconds.

**Safety Check**: Only runs if `isGroupView === true`.

**Flow**:

```
1. Send fetchAllData message
2. On response: Update allSheetData
3. Call renderGroupedView() to re-render with new data
4. Log refresh success
```

---

##### `populateStatusFilter()`

**Purpose**: Populates status dropdown from `dropdownOptions[0]`.

**Run Time**: DOMContentLoaded

**Items Added**:

1. All statuses from `dropdownOptions[0]`
2. "Uncategorized" option (value: 'uncategorized')

---

##### `saveFilterPreferences()`

**Purpose**: Persists filter selections to Chrome storage.

**Saved Data**:

```javascript
{
    filterPreferences: {
        month: '7',
        status: 'Waiting for approval'
    }
}
```

**Trigger**: `change` event on month/status filters.

---

##### `loadAndApplyFilterPreferences()`

**Purpose**: Restores saved filter preferences on panel load.

**Run Time**: DOMContentLoaded

**Flow**:

```
1. Read filterPreferences from Chrome storage
2. Apply month and status values to dropdowns
3. If already in group view: Re-render
4. Call updateFilterColor()
```

---

##### `updateFilterColor()`

**Purpose**: Applies color styling to status filter dropdown based on selection.

**Logic**:

```javascript
const selectedStatus = statusFilter.value;

// Remove all status classes
Object.values(statusToClass).forEach((className) => {
  statusFilter.classList.remove(className);
});

// Add class for selected status
const classToAdd = statusToClass[selectedStatus] || "status-all";
statusFilter.classList.add(classToAdd);
```

**Visual Effect**: Dropdown background color matches selected status color.

---

#### Message Listeners:

##### `chrome.runtime.onMessage.addListener((request) => {...})`

**Messages Handled**:

1. **displayRowData**:
   - Shows single or multiple contacts
   - Triggered by background.js after phone search

2. **displayNoMatch**:
   - Clears display
   - Shows "No matching contact found"
   - Resets template cache

3. **displayError**:
   - Displays error message
   - Resets template cache

**Conditional Logic**: All handlers check `if (isGroupView) return;` to avoid interfering with group view.

---

#### Date Helper Functions:

##### `parseDateOnly(dstr)`

**Purpose**: Parses "YYYY-MM-DD" to local midnight Date object.

**Returns**: Date or `null`

---

##### `parseSheetDateFlexible(dstr)`

**Purpose**: Flexible date parser (same as background.js).

**Supported Formats**:

- ISO with time
- YYYY-MM-DD
- DD-MM-YYYY
- Fallback to Date constructor

---

##### `daysBetweenTodayLocal(d)`

**Purpose**: Calculates whole calendar days between today and date.

**Returns**: Number of days

---

#### Initialization (DOMContentLoaded):

```javascript
document.addEventListener("DOMContentLoaded", () => {
  getHeaders(); // Fetch column headers
  populateStatusFilter(); // Populate status dropdown
  loadAndApplyFilterPreferences(); // Restore saved filters

  groupViewBtn.addEventListener("click", toggleGroupView);

  monthFilter.addEventListener("change", () => {
    renderGroupedView();
    saveFilterPreferences();
  });

  statusFilter.addEventListener("change", () => {
    renderGroupedView();
    saveFilterPreferences();
    updateFilterColor();
  });
});
```

---

### dashboard.html & dashboard.js

**Purpose**: Standalone popup window that visualizes workflow status counts with urgency indicators.

**Architecture Role**: Independent monitoring interface that polls Service Worker for aggregated statistics.

---

#### dashboard.html Structure:

```html
<body>
  <header>
    <h1>AdExpress Status Dashboard</h1>
    <p>Live counts from Google Sheet</p>
  </header>

  <main id="dashboard-grid"></main>

  <div id="loader">
    <div class="spinner"></div>
    <p>Loading Latest Data...</p>
  </div>

  <footer>Last updated: <span id="last-updated"></span></footer>

  <script src="dashboard.js"></script>
</body>
```

---

#### dashboard.js Functions:

##### `fetchAndDisplayStatusCounts()`

**Purpose**: Requests dashboard data from Service Worker and triggers rendering.

**Flow**:

```
1. Show loader
2. Clear dashboard grid
3. Send message: { action: 'getDashboardData' }
4. On response:
   a. Hide loader
   b. Call renderDashboard(response.data)
   c. Update "Last updated" timestamp
5. On error:
   - Display error message in grid
```

**Trigger Points**:

- **Initial Load**: DOMContentLoaded event
- **Auto-Refresh**: Every 10 seconds via setInterval

---

##### `renderDashboard(statusCounts)`

**Purpose**: Creates visual status cards with color-coded urgency levels.

**Parameters**:

- `statusCounts` (Object): `{ 'Status Name': count, ... }`

**Sorting Logic**:

```javascript
const sortedStatuses = Object.entries(statusCounts).sort((a, b) => {
  // Rule 1: "Unchanged (36h+)" always first
  if (a[0] === "Unchanged (36h+)") return -1;
  if (b[0] === "Unchanged (36h+)") return 1;

  // Rule 2: "Waiting for approval" second
  if (a[0] === "Waiting for approval") return -1;
  if (b[0] === "Waiting for approval") return 1;

  // Rule 3: Sort by count (descending)
  return b[1] - a[1];
});
```

**Card Generation**:

```javascript
sortedStatuses.forEach(([status, count]) => {
  const card = document.createElement("div");
  card.className = "status-card";

  // Special handling
  if (status === "Unchanged (36h+)") {
    card.classList.add("unchanged-card"); // Larger card
    card.classList.add("level-critical", "blinking-critical");
  } else if (status === "Closed") {
    return; // Don't display "Closed" cards
  }
  // Urgency levels
  else if (count >= 20) {
    card.classList.add("level-critical", "blinking-critical");
  } else if (count >= 10) {
    card.classList.add("level-warning", "blinking-warning");
  } else {
    card.classList.add("level-normal", "blinking-normal");
  }

  card.innerHTML = `
        <div class="status-count">${count}</div>
        <div class="status-name">${status}</div>
    `;

  dashboardGrid.appendChild(card);
});
```

**Urgency Levels**:

| Level        | Condition                        | Color             | Animation             |
| ------------ | -------------------------------- | ----------------- | --------------------- |
| **Critical** | count ≥ 20 OR "Unchanged (36h+)" | Red (`#ef4444`)   | Blinking red border   |
| **Warning**  | count ≥ 10                       | Amber (`#f59e0b`) | Blinking amber border |
| **Normal**   | count < 10                       | Blue (`#3b82f6`)  | Blinking blue border  |

**Special Cards**:

- **"Unchanged (36h+)"**: Full-width card, always first, red gradient
- **"Closed"**: Hidden (not displayed)

---

#### Auto-Refresh:

```javascript
// Initial load
fetchAndDisplayStatusCounts();

// Refresh every 10 seconds
setInterval(fetchAndDisplayStatusCounts, 10000);
```

**Refresh Cycle**:

```
0s  → Fetch data
10s → Fetch data
20s → Fetch data
...
```

**Performance**: Minimal impact, only fetches aggregated counts (not full data).

---

### style.css

**Purpose**: Dark theme styling for the side panel, matching WhatsApp Web's aesthetic.

#### Design System:

**Color Palette**:

- **Background**: `#0d1418` (Dark blue-gray)
- **Surface**: `#1f2c33` (Lighter blue-gray for cards)
- **Text**: `#e1e3e5` (Off-white)
- **Accent**: `#00a884` (WhatsApp green)
- **Borders**: `#2a2f32` (Subtle borders)

#### Key Sections:

##### Header:

```css
.header-container {
  position: sticky;
  top: 0;
  z-index: 10000;
  background-color: #1f2c33;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}
```

**Behavior**: Sticks to top during scroll, maintains visibility of controls.

##### Detail Items (Card-style):

```css
.detail-item {
  background-color: #1f2c33;
  border: 1px solid #2a2f32;
  border-radius: 8px;
  padding: 12px;
  border-left: 4px solid transparent; /* Status indicator */
}
```

##### Status Color Classes:

Each status has unique styling:

```css
.status-waiting-for-approval {
  border-left-color: #22c55e; /* Green */
  background-color: rgba(34, 197, 94, 0.1);
}

.status-closed {
  border-left-color: #ef4444; /* Red */
  background-color: rgba(239, 68, 68, 0.1);
}

/* ... more status styles */
```

##### Editable Fields:

```css
.detail-item p[contenteditable="true"] {
  background-color: #2a2f32;
  border: 1px solid #00a884;
  box-shadow: 0 0 0 2px rgba(0, 168, 132, 0.2);
}
```

**Visual**: Clear indication when field is in edit mode.

##### Save Button:

```css
.save-btn {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

.save-btn.visible {
  opacity: 1;
  pointer-events: all;
}
```

**Behavior**: Hidden by default, fades in when changes are made.

##### Group View:

```css
.grouped-contact-item {
  padding: 12px 15px;
  cursor: pointer;
  transition: all 0.2s;
}

.grouped-contact-item.selected-contact {
  background-color: rgba(0, 168, 132, 0.2);
  border-left: 4px solid #00a884;
}
```

**Visual**: Selected contact highlighted in green.

##### Iframe Positioning:

```css
#sheet-viewer-iframe {
  position: fixed;
  top: 0;
  right: 0;
  width: 290px;
  height: 100vh;
  border: none;
  z-index: 9999;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.3);
}
```

**Layout**: Fixed to right side, full height, above WhatsApp elements.

#### Responsive Considerations:

- Flexible gap spacing: `gap: 12px`
- Min-height for touch targets: `min-height: 36px`
- Smooth transitions: `transition: 0.2s ease`

---

### dashboard.css

**Purpose**: Modern glassmorphism design for the dashboard popup with gradient background.

#### Design System:

**CSS Variables**:

```css
:root {
  --bg-color: #0f172a; /* Deep space blue */
  --card-bg: rgba(30, 41, 59, 0.5); /* Semi-transparent */
  --text-color: #f1f5f9; /* Almost white */
  --level-normal-color: #3b82f6; /* Blue */
  --level-warning-color: #f59e0b; /* Amber */
  --level-critical-color: #ef4444; /* Red */
}
```

#### Key Sections:

##### Background:

```css
body {
  background-color: var(--bg-color);
  background-image:
    radial-gradient(circle at 1% 1%, rgba(59, 130, 246, 0.15), transparent 30%),
    radial-gradient(circle at 99% 99%, rgba(239, 68, 68, 0.15), transparent 40%);
}
```

**Effect**: Subtle blue glow in top-left, red glow in bottom-right.

##### Dashboard Grid:

```css
#dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.5rem;
}
```

**Behavior**: Responsive grid, automatically wraps cards.

##### Status Card:

```css
.status-card {
  background: var(--card-bg);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 1.5rem 2rem;
  border: 1px solid var(--border-color);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  animation: fadeInUp 0.6s ease-out forwards;
}
```

**Effect**: Glass morphism with blur, smooth fade-in animation.

##### Count Typography:

```css
.status-count {
  font-size: 4.5rem;
  font-weight: 900;
  line-height: 1;
  text-shadow: 0 0 15px rgba(0, 0, 0, 0.3);
}
```

**Effect**: Massive, bold numbers with subtle glow.

##### Urgency Borders:

```css
.level-critical {
  border-left: 4px solid var(--level-critical-color);
}

.blinking-critical {
  animation: blinkBorderCritical 1.5s infinite;
}

@keyframes blinkBorderCritical {
  0%,
  100% {
    border-left-color: var(--level-critical-color);
  }
  50% {
    border-left-color: transparent;
  }
}
```

**Effect**: Pulsing colored border draws attention to urgent items.

##### Special "Unchanged" Card:

```css
.unchanged-card {
  grid-column: 1 / -1; /* Span full width */
  background: linear-gradient(
    135deg,
    rgba(239, 68, 68, 0.3),
    rgba(239, 68, 68, 0.1)
  );
}
```

**Effect**: Full-width red gradient card stands out dramatically.

##### Animations:

```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**Effect**: Cards slide up and fade in on load.

#### Typography:

- **Font**: Inter (Google Fonts)
- **Weights**: 300 (light), 400 (regular), 500 (medium), 700 (bold), 900 (black)
- **Count**: 4.5rem (72px), weight 900
- **Status Name**: 1rem (16px), uppercase, letter-spacing

---

## Data Flow

### Complete Request-Response Cycle:

#### 1. User Opens WhatsApp Chat

```
USER ACTION: Click chat in WhatsApp Web

┌─────────────────────────────────────────────────────────┐
│ WhatsApp Web Page                                       │
│                                                         │
│  content.js:                                            │
│  ↓ Click event captured                                │
│  ↓ runExtractionAndSearch('click')                     │
│  ↓ extractPhoneNumber()                                │
│  ↓   → Try 8 extraction methods in priority order      │
│  ↓   → Result: "8801712345678"                         │
│  ↓ Take last 6 digits: "345678"                        │
│  ↓ Check if same as last search (deduplication)        │
│  ↓                                                      │
│  ↓ chrome.runtime.sendMessage({                        │
│      action: 'searchLast6Digits',                      │
│      digits: '345678'                                   │
│    })                                                   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Runtime Message
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Service Worker (background.js)                          │
│                                                         │
│  ↓ Receive message: searchLast6Digits                  │
│  ↓ Check cache: Is phone column < 15s old?             │
│  ├─ YES: Use cached data                               │
│  └─ NO:  Fetch column M from Google Sheets API         │
│          Store in cache with timestamp                  │
│  ↓                                                      │
│  ↓ Search cached column for matches ending in "345678" │
│  ↓ Found: Row 5 and Row 12                            │
│  ↓                                                      │
│  ↓ Batch fetch full rows:                              │
│     GET /values:batchGet?ranges='Sheet'!A5:U5          │
│                         &ranges='Sheet'!A12:U12        │
│  ↓                                                      │
│  ↓ chrome.runtime.sendMessage({                        │
│      action: 'displayRowData',                         │
│      matches: [                                         │
│        { data: [...], rowIndex: 5 },                   │
│        { data: [...], rowIndex: 12 }                   │
│      ]                                                  │
│    })                                                   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Runtime Message
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Side Panel (panel.js in iframe)                        │
│                                                         │
│  ↓ Receive message: displayRowData                     │
│  ↓ Check matches.length                                │
│  ├─ 1 match:  Call displaySingleRow()                  │
│  │            → Reuse/create template                   │
│  │            → Update values only                      │
│  └─ >1 match: Call displayMultipleMatches()            │
│               → Generate status circles                 │
│               → Display all contacts with dividers      │
│  ↓                                                      │
│  ↓ User sees contact data in panel                     │
│  ↓ [2-5ms for single, ~15ms for multiple]             │
└─────────────────────────────────────────────────────────┘

Total Time: 50-500ms depending on cache status
```

---

#### 2. User Edits a Field

```
USER ACTION: Double-click field, edit, press Enter

┌─────────────────────────────────────────────────────────┐
│ Side Panel (panel.js)                                   │
│                                                         │
│  ↓ dblclick event on <p> element                       │
│  ↓ Set contentEditable = "true"                        │
│  ↓ Store originalValue                                  │
│  ↓ User types...                                        │
│  ↓ 'input' event: Show save button                     │
│  ↓ User presses Enter                                   │
│  ↓ 'keydown' event: triggerSave()                      │
│  ↓                                                      │
│  ↓ chrome.runtime.sendMessage({                        │
│      action: 'updateCellValue',                        │
│      rowIndex: 5,                                       │
│      columnIndex: 3,                                    │
│      newValue: 'New value'                             │
│    })                                                   │
│  ↓ Show "Saving..." feedback                           │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Runtime Message
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Service Worker (background.js)                          │
│                                                         │
│  ↓ Receive message: updateCellValue                    │
│  ↓ Convert columnIndex 3 → Column "D"                  │
│  ↓                                                      │
│  ↓ Primary Update:                                      │
│    PUT /values/'Sheet'!D5?valueInputOption=USER_ENTERED│
│    Body: { values: [['New value']] }                   │
│  ↓                                                      │
│  ├─ IF columnIndex === 0 (Status change):              │
│  │   Get current date: "20-01-2026"                    │
│  │   PUT /values/'Sheet'!P5?valueInputOption=...       │
│  │   Body: { values: [['20-01-2026']] }               │
│  │   (Updates timestamp in Column P)                   │
│  └─                                                     │
│  ↓ await Promise.all([...])                            │
│  ↓ All successful                                       │
│  ↓                                                      │
│  ↓ sendResponse({ success: true })                     │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Response
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Side Panel (panel.js)                                   │
│                                                         │
│  ↓ Receive response: { success: true }                 │
│  ↓ Update originalValue = newValue                     │
│  ↓ Show "Saved!" for 2 seconds                         │
│  ↓ Hide save button                                     │
│  ↓ Set contentEditable = "false"                       │
└─────────────────────────────────────────────────────────┘

Total Time: 200-800ms depending on API response
```

---

#### 3. Dashboard Data Flow

```
TRIGGER: Browser startup OR 10-second interval

┌─────────────────────────────────────────────────────────┐
│ Dashboard Popup (dashboard.js)                          │
│                                                         │
│  ↓ Timer triggers fetchAndDisplayStatusCounts()        │
│  ↓ Show loader, clear grid                             │
│  ↓                                                      │
│  ↓ chrome.runtime.sendMessage({                        │
│      action: 'getDashboardData'                        │
│    })                                                   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Runtime Message
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Service Worker (background.js)                          │
│                                                         │
│  ↓ Receive message: getDashboardData                   │
│  ↓ Authenticate & get token                            │
│  ↓                                                      │
│  ↓ Fetch all data:                                      │
│    GET /values/'Sheet'!A2:P                            │
│  ↓ Receive ~100 rows                                    │
│  ↓                                                      │
│  ↓ Process each row:                                    │
│    FOR each row:                                        │
│      status = row[0]                                    │
│      timestamp = row[15]                                │
│      statusCounts[status]++                            │
│                                                         │
│      IF status !== 'Closed' AND                        │
│         (no timestamp OR timestamp > 36h old):          │
│        unchangedCount++                                 │
│  ↓                                                      │
│  ↓ Add special metric:                                  │
│    statusCounts['Unchanged (36h+)'] = unchangedCount   │
│  ↓                                                      │
│  ↓ sendResponse({                                       │
│      success: true,                                     │
│      data: {                                            │
│        'Waiting for approval': 15,                     │
│        'Closed': 8,                                     │
│        'Unchanged (36h+)': 7,                          │
│        ...                                              │
│      }                                                  │
│    })                                                   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Response
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Dashboard Popup (dashboard.js)                          │
│                                                         │
│  ↓ Receive response: { success: true, data: {...} }   │
│  ↓ Hide loader                                          │
│  ↓ Call renderDashboard(data)                          │
│  ↓                                                      │
│  ↓ Sort statuses:                                       │
│    1. "Unchanged (36h+)" first                         │
│    2. "Waiting for approval" second                    │
│    3. Rest by count descending                          │
│  ↓                                                      │
│  ↓ Create cards:                                        │
│    FOR each status (except 'Closed'):                  │
│      Create <div class="status-card">                  │
│      Add urgency class (critical/warning/normal)       │
│      Add blinking animation                             │
│      Set count and name                                 │
│      Append to grid                                     │
│  ↓                                                      │
│  ↓ Cards animate in (fadeInUp)                         │
│  ↓ Update "Last updated" timestamp                     │
└─────────────────────────────────────────────────────────┘

Total Time: 500-1500ms
Repeats: Every 10 seconds
```

---

#### 4. Group View - Contact Selection

```
USER ACTION: Click phone number in group view

┌─────────────────────────────────────────────────────────┐
│ Side Panel (panel.js) - Group View                     │
│                                                         │
│  ↓ User clicks .grouped-contact-item                   │
│  ↓ Get clicked phone: "8801712345678"                  │
│  ↓ Get context key: "7-Waiting for approval"          │
│  ↓                                                      │
│  ↓ Update UI immediately:                              │
│    Remove 'selected-contact' from previous             │
│    Add 'selected-contact' to clicked item              │
│  ↓                                                      │
│  ↓ Load selection history from Chrome storage          │
│  ↓ Get history for this context                        │
│  ↓ Remove old instances of this phone                  │
│  ↓ Push phone to end of history array                  │
│  ↓ Trim to MAX_HISTORY_PER_CONTEXT (10)               │
│  ↓ Save back to storage                                │
│  ↓                                                      │
│  ↓ chrome.runtime.sendMessage({                        │
│      action: 'openWhatsAppChat',                       │
│      phone: '8801712345678'                            │
│    })                                                   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Runtime Message
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Service Worker (background.js)                          │
│                                                         │
│  ↓ Receive message: openWhatsAppChat                   │
│  ↓ Strip non-digits: "8801712345678"                   │
│  ↓ Find WhatsApp Web tab                               │
│  ↓                                                      │
│  ↓ Inject into MAIN world:                             │
│    chrome.scripting.executeScript({                    │
│      target: { tabId },                                 │
│      world: 'MAIN',                                     │
│      func: injectSearchAndOpen,                        │
│      args: ['8801712345678']                           │
│    })                                                   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Script Injection
                   ▼
┌─────────────────────────────────────────────────────────┐
│ WhatsApp Web Page (Injected Function)                  │
│                                                         │
│  ↓ Find search box (try multiple selectors)            │
│  ├─ If not found: Click "New Chat" button              │
│  ↓ Insert phone number into search box                 │
│  ↓ Dispatch input event                                 │
│  ↓ Wait 650ms for results to appear                    │
│  ↓ Click first result OR press Enter                   │
│  ↓                                                      │
│  ↓ WhatsApp opens the chat                             │
│  ↓ content.js detects chat open                        │
│  ↓ Triggers phone extraction...                        │
│  ↓ (Cycle repeats from Step 1)                         │
└─────────────────────────────────────────────────────────┘

Total Time: 800-1500ms
```

---

## Configuration

The extension uses a centralized configuration file for easy management of sensitive values.

### config.js

All configuration values are defined in `config.js`:

```javascript
const CONFIG = {
  CLIENT_ID:
    "851591119047-cb5o2v87ccqqepnmffbrobrb8ihmn0g6.apps.googleusercontent.com",
  SPREADSHEET_ID: "1uz2hWwPmOrDnGYt5UfzCm3_s4lCXsf_sfQDDQCX45Xw",
  SHEET_NAME: "🔵Team Blue🔵",

  // Auto-generated
  get PHONE_COLUMN_RANGE() {
    return `'${this.SHEET_NAME}'!M:M`;
  },
};
```

### Configuration Details:

1. **OAuth2 Client ID**: Used for Google Sheets API authentication
   - Also needs to be manually set in `manifest.json` under `oauth2.client_id`
   - Chrome extensions require OAuth client ID in both places

2. **Spreadsheet ID**: The unique identifier for your Google Sheet
   - Found in the sheet URL: `https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit`

3. **Sheet Name**: The specific tab/sheet within the spreadsheet
   - Must match exactly, including emojis and special characters
   - Currently set to `🔵Team Blue🔵`

4. **Phone Column Range**: Auto-generated from sheet name
   - Points to column M where phone numbers are stored

### To Change Configuration:

1. Edit values in `config.js`
2. If changing CLIENT_ID, also update it in `manifest.json`
3. Reload the extension in Chrome (`chrome://extensions`)

---

## Sheet Column Mapping

| Column | Index | Field             | Purpose                     |
| ------ | ----- | ----------------- | --------------------------- |
| A      | 0     | Status            | Workflow status (dropdown)  |
| B      | 1     | Date              | Contact date                |
| C      | 2     | Payment Status    | Payment workflow (dropdown) |
| D      | 3     | Custom field      | Project-specific            |
| E      | 4     | Custom field      | (off-white background)      |
| F      | 5     | Custom field      | Project-specific            |
| G      | 6     | Custom field      | (light purple background)   |
| H      | 7     | Custom field      | Project-specific            |
| I      | 8     | Custom field      | (light green background)    |
| J      | 9     | Custom field      | (light blue background)     |
| K      | 10    | Custom field      | (light red background)      |
| L      | 11    | Custom field      | Project-specific            |
| M      | 12    | **Phone Number**  | **Primary search key**      |
| N-O    | 13-14 | Custom fields     | Project-specific            |
| P      | 15    | **Last Modified** | **Auto-updated timestamp**  |
| Q-U    | 16-20 | Custom fields     | Project-specific            |

**Key Columns**:

- **Column M (Phone)**: Used for searching contacts
- **Column P (Timestamp)**: Auto-updated when Column A (Status) changes
- **Column A (Status)**: Primary workflow indicator

---

## Performance Characteristics

### Phone Extraction Speed:

| Scenario                        | Method                     | Time       |
| ------------------------------- | -------------------------- | ---------- |
| Regular chat, data-\* available | `_extractFromDataAttrs()`  | 10-50ms    |
| Unsaved number in header        | `_extractFromHeaderText()` | 50-200ms   |
| Business account (LID)          | `_extractFromInfoDrawer()` | 800-1500ms |
| Cached search                   | Use cached column          | < 10ms     |
| Fresh API call                  | Fetch + search column      | 200-500ms  |

### Caching Strategy:

**Phone Column Cache**:

- **TTL**: 15 seconds
- **Benefit**: Reduces API quota usage by ~90% during active use
- **Trade-off**: Maximum 15-second staleness (acceptable for phone lookups)

**Storage Usage**:

- Selection history: < 5KB per context (10 phones × multiple contexts)
- Filter preferences: < 1KB
- Total: Negligible impact

### API Quota Management:

**Read Operations**:

- Phone column fetch: 1 read unit (cached for 15s)
- Single row fetch: 1 read unit
- Batch row fetch (10 rows): 1 read unit
- All data fetch (group view): 1 read unit
- Dashboard data: 1 read unit

**Typical Usage** (per user per hour):

- Phone searches: ~20 searches = 2 read units (18 from cache)
- Data edits: ~5 writes = 5 write units
- Group view refreshes: ~30 fetches = 30 read units
- Dashboard refreshes: ~360 fetches = 360 read units

**Daily Quota** (Google Sheets API free tier):

- Reads: 500 per 100 seconds (300,000 per day)
- Writes: 100 per 100 seconds (60,000 per day)
- **Conclusion**: Extension usage well within limits for small teams

### Memory Footprint:

| Component                          | Memory        |
| ---------------------------------- | ------------- |
| Service Worker (idle)              | ~2-5 MB       |
| Service Worker (active with cache) | ~5-10 MB      |
| Panel iframe                       | ~10-15 MB     |
| Content script                     | ~2-5 MB       |
| Dashboard popup                    | ~5-8 MB       |
| **Total (all active)**             | **~25-45 MB** |

**Impact**: Minimal - typical Chrome tab uses 50-200 MB.

---

## Error Handling & Resilience

### Network Failures:

**API Timeout**:

```javascript
// 15-second timeout for all API requests
headerTimeout = setTimeout(() => {
  statusDiv.textContent = "Error: Request to background service timed out.";
}, 15000);
```

**Retry Strategy**: User must manually retry (click another chat or refresh)

### Authentication Failures:

**OAuth Token Expiry**:

- Chrome automatically refreshes tokens
- If refresh fails: User prompted to re-authenticate
- Error message displayed in panel

### Data Validation:

**Phone Number Validation**:

- Minimum length check: 8 digits
- Format-agnostic: Accepts any digit-containing string
- LID detection: Skips business account IDs

**Date Parsing**:

- Multiple format support prevents parse failures
- Fallback to Date constructor
- Returns `null` on complete parse failure (handles gracefully)

### DOM Extraction Resilience:

**Multiple Selectors**: Each extraction method tries 3-6 different selectors
**Timeout Protection**: Maximum 1.5 seconds for drawer operations
**Fallback Chain**: 8 different extraction methods ensure high success rate

---

## Security Considerations

### Data Privacy:

1. **Local Processing**: Phone extraction happens client-side
2. **No External Servers**: Direct communication with Google Sheets only
3. **OAuth Scope**: Limited to `spreadsheets` scope (no email, drive, etc.)
4. **Storage**: Chrome's secure local storage (not accessible to other extensions)

### Permissions Justification:

- **`identity`**: Required for OAuth2 (no way to avoid)
- **`storage`**: Preferences only, no sensitive data
- **`scripting`**: Only injected into WhatsApp Web (specific domain)
- **`tabs`**: Read-only queries for WhatsApp tabs
- **Host permissions**: Restricted to Google Sheets API and WhatsApp Web only

### Risks:

1. **Script Injection**: Content script has full access to WhatsApp Web DOM
   - **Mitigation**: No external code loading, all scripts bundled
2. **Data Exposure**: Customer data visible in panel
   - **Mitigation**: Inherent to CRM functionality, user must protect their screen
3. **API Quota Abuse**: Malicious user could spam API calls
   - **Mitigation**: Caching limits requests, Google's per-user quota protection

---

## Troubleshooting

### Phone Not Detected:

**Problem**: Panel shows "No matching contact found"

**Solutions**:

1. Check if phone number has minimum 8 digits
2. Try opening contact info drawer manually in WhatsApp
3. Check if last 6 digits match exactly in sheet (column M)
4. For business accounts: Wait 2-3 seconds after opening chat

### Data Not Updating:

**Problem**: Changes in panel don't reflect in sheet

**Solutions**:

1. Check network connection
2. Verify OAuth token is valid (re-authenticate if needed)
3. Check browser console for errors (F12 → Console)
4. Ensure spreadsheet ID and sheet name are correct in config.js

### Dashboard Not Showing:

**Problem**: Dashboard doesn't open on startup

**Solutions**:

1. Close any existing dashboard windows
2. Reload extension
3. Check if popup blocker is interfering
4. Try opening manually from extension icon

### Panel Not Appearing:

**Problem**: Side panel iframe not visible

**Solutions**:

1. Refresh WhatsApp Web page
2. Check if WhatsApp layout changed (test with different chat)
3. Verify extension is enabled in chrome://extensions
4. Check browser console for injection errors

---

## Development & Extension

### Adding New Status Options:

1. Edit `panel.js`:

```javascript
const dropdownOptions = {
  0: ["Existing statuses...", "New Status"], // Add here
  2: ["Payment statuses..."],
};
```

2. Add color mapping:

```javascript
const statusToClass = {
  "New Status": "status-new", // Add here
  // ...
};
```

3. Add CSS in `style.css`:

```css
.status-new {
  border-left-color: #yourcolor;
  background-color: rgba(yourcolor, 0.1);
}
```

### Changing Sheet Structure:

**If adding/removing columns**:

1. Update column indices in `dropdownOptions`
2. Update `generateSingleContactHTML()` color coding
3. Update any hardcoded column references (search for `row[0]`, `row[12]`, etc.)

**If changing phone column**:

1. Update `PHONE_COLUMN_RANGE` in config.js
2. Update column index references (currently 12 for M)

### Customizing Dashboard:

**Change urgency thresholds**:

```javascript
// In dashboard.js renderDashboard()
if (count >= 20) {
  // Change threshold here
  card.classList.add("level-critical");
}
```

**Change refresh interval**:

```javascript
// In dashboard.js
setInterval(fetchAndDisplayStatusCounts, 10000); // Change 10000 (10s)
```

---

## Requirements

- **Browser**: Google Chrome (version 88+)
- **Google Account**: With access to the configured spreadsheet
- **WhatsApp**: Active WhatsApp Web account
- **Permissions**: Spreadsheet must grant edit access to OAuth client

---

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the extension folder
5. Navigate to WhatsApp Web - the extension will initialize automatically
6. Grant OAuth permissions when prompted
7. Dashboard will open on browser startup

---

## Known Limitations

1. **WhatsApp DOM Changes**: WhatsApp Web frequently updates their DOM structure, may require selector updates
2. **Business Accounts**: Slower phone extraction (1-2 seconds) due to drawer navigation
3. **Duplicate Phone Numbers**: Shows all matches, user must identify correct contact
4. **Offline Mode**: Requires internet connection for API calls (no offline cache)
5. **Multi-Tab WhatsApp**: Only works with one WhatsApp Web tab at a time
6. **Large Datasets**: Group view with 1000+ contacts may be slow to render (~2-3 seconds)

---

## Browser Compatibility

| Feature            | Chrome  | Edge    | Firefox              | Safari            |
| ------------------ | ------- | ------- | -------------------- | ----------------- |
| Core Functionality | ✅ Full | ✅ Full | ❌ MV3 not supported | ❌ Not compatible |
| OAuth2             | ✅      | ✅      | ❌                   | ❌                |
| Script Injection   | ✅      | ✅      | ⚠️ Limited           | ❌                |
| Storage API        | ✅      | ✅      | ✅                   | ⚠️ Limited        |

**Recommendation**: Use Google Chrome for full compatibility.

---

## Credits & License

**Built for**: AdExpress Team  
**Purpose**: Customer relationship management within WhatsApp Web  
**Architecture**: Chrome Extension Manifest V3  
**API**: Google Sheets API v4

**Dependencies**:

- Google Fonts (Inter)
- Chrome Identity API
- Chrome Scripting API
- Chrome Storage API

---

_Last Updated: January 2026_

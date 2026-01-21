# GitHub Copilot Instructions for WhatsApp Sheet CRM

## Code Style Guidelines

### Semicolons

- Do not use semicolons if not required in statements
- JavaScript's automatic semicolon insertion (ASI) is acceptable
- Only use semicolons when explicitly necessary to avoid ambiguity

### Configuration Management

- Keep all sensitive values in `config.js` file
- Never hardcode OAuth client IDs, spreadsheet IDs, or sheet names in other files
- Always import from CONFIG object when needing these values:

  ```javascript
  // In background.js
  const { SPREADSHEET_ID, SHEET_NAME } = CONFIG;

  // In panel.js
  const SPREADSHEET_ID = CONFIG.SPREADSHEET_ID;
  const SHEET_NAME = CONFIG.SHEET_NAME;
  ```

## Project-Specific Context

### Architecture

- Chrome Extension Manifest V3
- Service Worker: `background.js` for Google Sheets API calls
- Content Script: `content.js` injected into WhatsApp Web
- Side Panel: `panel.html` + `panel.js` for CRM interface

### Configuration File Structure

All sensitive configuration is centralized in `config.js`:

- `CLIENT_ID`: OAuth2 client for Google Sheets API
- `SPREADSHEET_ID`: Target Google Spreadsheet ID
- `SHEET_NAME`: Specific sheet tab name
- `PHONE_COLUMN_RANGE`: Auto-generated range

### Best Practices

- Use `importScripts('config.js')` in background.js (Service Worker context)
- Load config.js via `<script>` tag in HTML files for page context
- Keep OAuth client_id synced between config.js and manifest.json
- Use const declarations for configuration values
- Prefer template literals for string interpolation

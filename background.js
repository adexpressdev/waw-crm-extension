// ---background.js ---

importScripts('config.js')

let dashboardWindowId = null

// --- CONFIGURATION ---
const { SPREADSHEET_ID, SHEET_NAME, PHONE_COLUMN_RANGE } = CONFIG

// --- AWAJ DIGITAL VOICE BROADCAST CONFIG ---
const AWAJ_API_BASE = 'https://api.awajdigital.com/api'
const AWAJ_STATUS_VOICE_MAP = {
  'Waiting for approval': CONFIG.AWAJ_DIGITAL_VOICE_FOR_WAITING_FOR_APPROVAL,
  'Code Pending...': CONFIG.AWAJ_DIGITAL_VOICE_FOR_CODE_PENDING,
}
// --- SIMPLE IN-MEMORY CACHE FOR PHONE COLUMN (M) ---
let cachedPhoneColumn = null; // { values: [...], fetchedAt: timestamp }
const PHONE_CACHE_TTL_MS = 15000; // reuse column for up to 15 seconds



// --- AUTHENTICATION HELPER ---
function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        const errorMessage = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Authentication failed.';
        reject(new Error(errorMessage));
      } else {
        resolve(token);
      }
    });
  });
}

// --- UTILITY TO CONVERT COLUMN INDEX TO LETTER ---
function columnToLetter(column) {
  return String.fromCharCode(65 + parseInt(column));
}

// --- AWAJ DIGITAL BROADCAST HELPER ---
/**
 * Sends a voice broadcast via AwajDigital API when status changes to a trigger status.
 * @param {string} phoneDigits - Full phone digits from sheet (e.g. "8801722626327")
 * @param {string} newStatus - The new status value (e.g. "Waiting for approval")
 */
async function triggerAwajBroadcast(phoneDigits, newStatus) {
  const voiceName = AWAJ_STATUS_VOICE_MAP[newStatus]
  if (!voiceName) {
    console.log(`[AWAJ] No voice mapped for status "${newStatus}", skipping broadcast`)
    return
  }

  // Convert 880XXXXXXXXXX to 0XXXXXXXXXX (BD local format required by API)
  let localPhone = phoneDigits.replace(/\D/g, '')
  if (localPhone.startsWith('880')) {
    localPhone = '0' + localPhone.slice(3)
  } else if (!localPhone.startsWith('0')) {
    localPhone = '0' + localPhone
  }

  // Validate BD phone format: 01XXXXXXXXX (11 digits)
  if (!/^01\d{9}$/.test(localPhone)) {
    console.error(`[AWAJ] Invalid BD phone number: ${localPhone} (from ${phoneDigits})`)
    return
  }

  const requestId = crypto.randomUUID()

  console.log(`[AWAJ] Sending broadcast to ${localPhone} with voice "${voiceName}" for status "${newStatus}"`)

  try {
    const response = await fetch(`${AWAJ_API_BASE}/broadcasts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.AWAJ_DIGITAL_API_KEY}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        request_id: requestId,
        voice: voiceName,
        sender: CONFIG.AWAJ_DIGITAL_SENDER,
        phone_numbers: [localPhone]
      })
    })

    const data = await response.json()

    if (data.success) {
      console.log(`[AWAJ] Broadcast created successfully:`, data.broadcast)
    } else {
      console.error(`[AWAJ] Broadcast failed:`, data.message || data)
    }
  } catch (err) {
    console.error(`[AWAJ] Network error sending broadcast:`, err)
  }
}


// --- DATE HELPERS (safe for "YYYY-MM-DD" and ISO) ---
function parseDateOnly(dstr) {
  if (!dstr) return null;
  // If it's already date-only: "YYYY-MM-DD" → local midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(dstr)) {
    const [y, m, d] = dstr.split('-').map(Number);
    return new Date(y, m - 1, d); // local midnight
  }
  // Fallback for old ISO strings still present in the sheet
  const dt = new Date(dstr);
  if (isNaN(dt)) return null;
  // Normalize any parsed date to local midnight
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

// Parses: "YYYY-MM-DDTHH:mm:ss.sssZ", "YYYY-MM-DD", "DD-MM-YYYY"
// For date-only, returns local-midnight of that day.
function parseSheetDateFlexible(dstr) {
  if (!dstr) return null;
  const s = String(dstr).trim();

  // ISO with time
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const dt = new Date(s);
    return isNaN(dt) ? null : dt; // keep time component
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d); // local midnight
  }

  // DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('-').map(Number);
    return new Date(yyyy, mm - 1, dd); // local midnight
  }

  // Fallback: let JS try, then normalize to local date
  const dt = new Date(s);
  if (isNaN(dt)) return null;
  return dt;
}

// Whole-calendar-day diff (today 00:00 - that date 00:00)
function daysBetweenTodayLocal(d) {
  if (!d) return Infinity;
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((startToday - startThat) / 86400000);
}



// --- MESSAGE LISTENER ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getHeadersRequest') {
    (async () => {
      try {
        const token = await getAuthToken();
        const range = `'${SHEET_NAME}'!A1:U1`;
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error.message || 'Could not fetch headers.');
        }
        const data = await response.json();
        sendResponse({ success: true, data: data.values ? data.values[0] : [] });
      } catch (error) {
        sendResponse({ success: false, message: error.message });
      }
    })();
    return true;
  }

  // --- UPDATED: 'searchLast6Digits' now correctly finds all matches ---
  else if (request.action === 'searchLast6Digits') {
    (async () => {
      try {
        const token = await getAuthToken();

        let phoneNumbersInSheet;
        const now = Date.now();

        // Fast path: reuse cached column if it's fresh
        if (cachedPhoneColumn && (now - cachedPhoneColumn.fetchedAt) < PHONE_CACHE_TTL_MS) {
          console.log('[BACKGROUND] Using cached phone column for searchLast6Digits');
          phoneNumbersInSheet = cachedPhoneColumn.values;
        } else {
          const columnResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${PHONE_COLUMN_RANGE}`,
            {
              headers: { 'Authorization': `Bearer ${token}` }
            }
          );
          if (!columnResponse.ok) throw new Error('API Error fetching column.');
          const columnData = await columnResponse.json();
          phoneNumbersInSheet = columnData.values || [];
          cachedPhoneColumn = {
            values: phoneNumbersInSheet,
            fetchedAt: now
          };
          console.log('[BACKGROUND] Phone column fetched fresh from API');
        }

        const matchingRowIndices = [];
        if (phoneNumbersInSheet) {
          for (let i = 0; i < phoneNumbersInSheet.length; i++) {
            if (phoneNumbersInSheet[i] && phoneNumbersInSheet[i][0]) {
              const sheetNumber = phoneNumbersInSheet[i][0].toString().replace(/\D/g, '');
              if (sheetNumber.endsWith(request.digits)) {
                matchingRowIndices.push(i + 1);
              }
            }
          }
        }

        console.log(`[BACKGROUND] Found ${matchingRowIndices.length} potential matches.`);

        if (matchingRowIndices.length > 0) {
          const ranges = matchingRowIndices.map(rowIndex => `'${SHEET_NAME}'!A${rowIndex}:U${rowIndex}`);
          const batchGetResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?ranges=${ranges.join('&ranges=')}`,
            {
              headers: { 'Authorization': `Bearer ${token}` }
            }
          );
          if (!batchGetResponse.ok) throw new Error('API Error fetching matched rows.');
          const batchData = await batchGetResponse.json();

          const allMatches = batchData.valueRanges.map((valueRange, index) => ({
            data: valueRange.values[0],
            rowIndex: matchingRowIndices[index]
          }));
          allMatches.reverse();
          chrome.runtime.sendMessage({ action: 'displayRowData', matches: allMatches });
        } else {
          chrome.runtime.sendMessage({ action: 'displayNoMatch' });
        }
      } catch (error) {
        console.error('[BACKGROUND] Search Error:', error);
        chrome.runtime.sendMessage({ action: 'displayError', message: error.message });
      }
    })();
    return true;
  }



  // --- NEW: 'fetchAllData' handler (from previous version) ---
  else if (request.action === 'fetchAllData') {
    (async () => {
      try {
        const token = await getAuthToken();
        const range = `'${SHEET_NAME}'!A2:U`;
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error.message || 'Could not fetch all data.');
        }
        const data = await response.json();
        sendResponse({ success: true, data: data.values || [] });
      } catch (error) {
        sendResponse({ success: false, message: error.message });
      }
    })();
    return true;
  }

  // --- CORRECTED: 'updateCellValue' using two separate, robust requests ---
  else if (request.action === 'updateCellValue') {
    (async () => {
      try {
        console.log(`[BACKGROUND] Received update for row ${request.rowIndex}, col ${request.columnIndex}`);
        const token = await getAuthToken();
        const updatePromises = [];

        // --- Promise 1: The primary cell update (for any column) ---
        const primaryColumnLetter = columnToLetter(request.columnIndex);
        const primaryRange = `'${SHEET_NAME}'!${primaryColumnLetter}${request.rowIndex}`;

        const primaryUpdatePromise = fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${primaryRange}?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [[request.newValue]]
          })
        });
        updatePromises.push(primaryUpdatePromise);

        // --- Promise 2 (Conditional): If status (Col A) was changed, also update timestamp in Column P ---
        if (parseInt(request.columnIndex) === 0) {
          const timestampColumnLetter = 'P'; // Explicitly target Column P
          const timestampRange = `'${SHEET_NAME}'!${timestampColumnLetter}${request.rowIndex}`;
          // Write local DATE only, e.g. "2025-09-29"
          const now = new Date();
          const yyyy = now.getFullYear();
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const dd = String(now.getDate()).padStart(2, '0');
          const timestampValue = `${dd}-${mm}-${yyyy}`;


          console.log(`[BACKGROUND] Status changed. Also updating timestamp in ${timestampRange}`);

          const timestampUpdatePromise = fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${timestampRange}?valueInputOption=USER_ENTERED`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              values: [[timestampValue]]
            })
          });
          updatePromises.push(timestampUpdatePromise);
        }

        // --- Execute all promises and wait for them to complete ---
        const responses = await Promise.all(updatePromises);

        // Check if any of the API calls failed
        for (const response of responses) {
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || `An API update failed with status ${response.status}`);
          }
        }

        console.log('[BACKGROUND] All updates were successful.');
        sendResponse({ success: true });

        // --- AWAJ DIGITAL BROADCAST: Fire voice call on specific status changes ---
        if (parseInt(request.columnIndex) === 0 && AWAJ_STATUS_VOICE_MAP[request.newValue]) {
          console.log(`[AWAJ] Status changed to "${request.newValue}", fetching phone for row ${request.rowIndex}`)
          try {
            // Read column M (phone) for this row
            const phoneRange = `'${SHEET_NAME}'!M${request.rowIndex}`
            const phoneResp = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(phoneRange)}`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            )
            const phoneData = await phoneResp.json()
            const phoneValue = phoneData.values?.[0]?.[0]
            if (phoneValue) {
              triggerAwajBroadcast(phoneValue, request.newValue)
            } else {
              console.warn(`[AWAJ] No phone number in column M for row ${request.rowIndex}`)
            }
          } catch (awajErr) {
            console.error('[AWAJ] Error reading phone for broadcast:', awajErr)
          }
        }

      } catch (error) {
        console.error('[BACKGROUND] A critical update error occurred:', error);
        sendResponse({ success: false, message: error.message });
      }
    })();
    return true;
  }

  // --- START: REPLACE THE ENTIRE 'openWhatsAppChat' BLOCK WITH THIS ---

  else if (request.action === 'openWhatsAppChat') {
    // Keep this block EXACTLY as-is
    (async (sendResponse) => {
      try {
        const raw = (request.phone || '').toString();
        const phone = raw.replace(/\D/g, '');
        if (!phone) {
          console.error('[BACKGROUND] No phone number provided to search.');
          sendResponse({ success: false, message: 'No phone number provided.' });
          return;
        }

        // Find an open WhatsApp Web tab
        const tabs = await chrome.tabs.query({
          url: ['https://web.whatsapp.com/*', 'http://web.whatsapp.com/*']
        });
        if (!tabs || !tabs.length) {
          console.error('[BACKGROUND] No WhatsApp Web tab found.');
          sendResponse({ success: false, message: 'WhatsApp Web tab not found.' });
          return;
        }
        const tabId = tabs[0].id;

        // Inject into the MAIN world so we can interact with WA's real DOM
        function injectSearchAndOpen(number) {
          (async () => {
            const sleep = (ms) => new Promise(r => setTimeout(r, ms));
            const $ = (s, r = document) => r.querySelector(s);

            function dispatchInput(el) {
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }

            function insertText(el, text) {
              el.focus();
              try { document.execCommand('selectAll', false, null); } catch (e) { }
              try { document.execCommand('delete', false, null); } catch (e) { }
              try { document.execCommand('insertText', false, text); } catch (e) {
                // fallback if execCommand is limited
                el.textContent = text;
              }
              dispatchInput(el);
            }

            async function findSearchBox() {
              // Try several modern selectors; WA changes DOM frequently
              const candidates = [
                'div[data-testid="chat-list-search"] div[contenteditable="true"]',
                '#side [contenteditable="true"][role="textbox"]',
                'div[contenteditable="true"][aria-label*="Search"]',
                'div[contenteditable="true"][title*="Search"]',
                '#side [contenteditable="true"][data-tab]' // very broad fallback
              ];

              for (let i = 0; i < 30; i++) {
                for (const sel of candidates) {
                  const el = $(sel);
                  if (el) return el;
                }
                // Try to reveal it if it’s collapsed
                const revealBtn =
                  $('button[aria-label="Search"]') ||
                  $('[data-testid="chat-list-search"]') ||
                  $('[data-icon="search"]');
                if (revealBtn) revealBtn.click();
                await sleep(120);
              }
              return null;
            }

            function clickFirstResult() {
              const selectors = [
                'div[role="listbox"] [role="option"]',
                '[data-testid="chatlist-list"] [data-testid="cell-frame-container"]',
                'div[aria-label*="Search results"] [role="listitem"]',
                '#pane-side [role="listitem"]'
              ];
              for (const sel of selectors) {
                const el = $(sel);
                if (el) { el.click(); return true; }
              }
              return false;
            }

            try {
              console.log('[CRM] Searching number →', number);
              let input = await findSearchBox();

              // As final fallback, open the New Chat panel (it exposes a search field)
              if (!input) {
                const newChatBtn =
                  $('span[data-icon="new-chat-outline"]')?.closest('button') ||
                  $('button[title="New chat"]') ||
                  $('[data-testid="new-chat-button"]');
                if (newChatBtn) {
                  newChatBtn.click();
                  await sleep(300);
                  input = await findSearchBox();
                }
              }

              if (!input) {
                console.warn('[CRM] Search box NOT found.');
                return;
              }

              // Type the number and a space to trigger results
              insertText(input, number + ' ');
              await sleep(650);

              if (!clickFirstResult()) {
                // Fallback: press Enter to open the top match
                ['keydown', 'keypress', 'keyup'].forEach(type =>
                  input.dispatchEvent(new KeyboardEvent(type, {
                    key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
                  }))
                );
              }
            } catch (err) {
              console.error('[CRM] Injection error:', err);
            }
          })();
        }

        await chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: injectSearchAndOpen,
          args: [phone]
        });

        sendResponse({ success: true, message: 'Search & open executed.' });
      } catch (error) {
        console.error('[BACKGROUND] openWhatsAppChat error:', error);
        sendResponse({ success: false, message: error?.message || String(error) });
      }
    })(sendResponse);
    return true; // keep this so sendResponse stays valid asynchronously
  }


  else if (request.action === 'getDashboardData') {
    (async () => {
      try {
        const token = await getAuthToken();
        // We fetch columns A through P to get status and the timestamp
        const range = `'${SHEET_NAME}'!A2:P`;

        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          throw new Error(`Google Sheets API responded with status: ${response.status}`);
        }

        const data = await response.json();
        const rows = data.values || [];

        const statusCounts = {};
        let unchangedCount = 0;
        const now = new Date();
        const thirtySixHoursAgo = now.getTime() - (36 * 60 * 60 * 1000);

        for (const row of rows) {
          if (Array.isArray(row) && row.length > 0) {
            // --- Task 1: Count every status from Column A ---
            const statusKey = (row[0] && row[0].trim()) || 'Uncategorized';
            statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;

            // --- Task 2: Separately check for the "Unchanged" condition ---
            const status = row[0] || '';
            const timestampString = row[15]; // Timestamp from Column P (index 15)

            // We only count if the status is NOT "Closed"
            if (status !== 'Closed') {
              if (!timestampString) {
                // If there's no timestamp, it's unchanged since creation.
                unchangedCount++;
              } else {
                const d = parseDateOnly(timestampString);
                const dt = parseSheetDateFlexible(timestampString);
                const timestamp = dt ? dt.getTime() : NaN;
                // If timestamp is invalid or older than 36 hours, count it.
                if (isNaN(timestamp) || timestamp < thirtySixHoursAgo) {
                  unchangedCount++;
                }

              }
            }
          }
        }

        // --- Task 3: Add our new "Unchanged" metric to the final data ---
        if (unchangedCount > 0) {
          statusCounts['Unchanged (36h+)'] = unchangedCount;
        }

        console.log("DASHBOARD DEBUG: Final counts being sent:", statusCounts);
        sendResponse({ success: true, data: statusCounts });

      } catch (error) {
        console.error("DASHBOARD DATA ERROR:", error);
        sendResponse({ success: false, message: error.message });
      }
    })();
    return true;
  }


});


// This function contains all the logic for safely opening the dashboard.
function openDashboard() {
  const windowOptions = {
    url: chrome.runtime.getURL('dashboard.html'),
    type: 'popup',
    width: 900,
    height: 720
  };

  // Check if we have an ID from a previously opened window.
  if (dashboardWindowId) {
    // If so, try to close it first to avoid duplicates.
    chrome.windows.remove(dashboardWindowId, () => {
      // Ignore any error if the window was already closed by the user.
      if (chrome.runtime.lastError) { }

      // After attempting to close, create the new window.
      chrome.windows.create(windowOptions, (newWindow) => {
        dashboardWindowId = newWindow.id;
      });
    });
  } else {
    // If no window was open, just create a new one.
    chrome.windows.create(windowOptions, (newWindow) => {
      dashboardWindowId = newWindow.id;
    });
  }
}


// Trigger 2: When the Chrome browser first starts up.
chrome.runtime.onStartup.addListener(openDashboard);


// This event fires whenever any browser window is closed.
chrome.windows.onRemoved.addListener((closedWindowId) => {
  // We check if the ID of the closed window matches the one we saved.
  if (closedWindowId === dashboardWindowId) {
    console.log("Dashboard window was closed manually. Forgetting its ID.");
    // If it matches, we reset our variable so we don't try to close it again later.
    dashboardWindowId = null;
  }
});


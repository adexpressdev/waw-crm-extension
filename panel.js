// ---panel.js ---

// --- CONFIGURATION & DOM ELEMENTS ---
const { SPREADSHEET_ID, SHEET_NAME } = CONFIG
const statusDiv = document.getElementById('status');
const dataContainer = document.getElementById('data-container');
const groupedDataContainer = document.getElementById('grouped-data-container');
const groupViewBtn = document.getElementById('group-view-btn');
const groupIconChart = document.getElementById('group-btn-icon-chart');
const groupIconBack = document.getElementById('group-btn-icon-back');
const monthFilter = document.getElementById('month-filter');
const statusFilter = document.getElementById('status-filter');
const headerTitle = document.querySelector('.header-container h3');

// --- DATA CACHE & STATE ---
let sheetHeaders = [];
let allSheetData = [];
let isGroupView = false;
let headerTimeout;
let refreshIntervalId = null;
let hasScrolledToInitialItem = false;
// --- SINGLE CONTACT TEMPLATE STATE ---
let singleTemplateInitialized = false;
let singleTemplateRoot = null;
let currentRowIndex = null;


// --- DROPDOWN OPTIONS & STATUS-COLOR MAPPING ---
const dropdownOptions = {
    0: ['Waiting for approval', 'Code Pending...', 'Farzana voice', 'Tinni voice', 'Famim voice', 'Jelane Voice', 'Anas Voice', 'Rose working', 'Mawa Voice', 'Script Written', 'Rashed Working', 'correction ', 'Sangeta Voice', 'Toha Voice', 'Raz Voice', 'DemoCode Given', 'Closed'],
    2: ['payment number sended', 'Approved', 'Dont like the audio', 'set first,wanna pay letter', 'call not picking', 'info not found', 'agree to pay, but not paying, Busy..', 'Cancel', 'tomorrow pay', ' Knocked No Response', 'Today pay']
};

const statusToClass = {
    "Waiting for approval": "status-waiting-for-approval",
    "Code Pending...": "status-code-pending",
    "Farzana voice": "status-tinni-voice",
    "Jelane Voice": "status-jelani-voice",
    "Anas Voice": "status-anas-voice",
    "Rashed Working": "status-anas-voice",
    "Rose working": "status-anas-voice",
    "Script Written": "status-script-written",
    "Tinni voice": "status-tinni-voice",
    "Famim voice": "status-tinni-voice",
    "Closed": "status-closed",
    "Bill due": "status-bill-due",
    "DemoCode Given": "status-bill-due",
    "correction ": "status-correction",
    "Mawa Voice": "status-tinni-voice",
    "Toha Voice": "status-jelani-voice",
    "Sangeta Voice": "status-tinni-voice",
    "Raz Voice": "status-jelani-voice",

};


// --- CORE FUNCTIONS ---
function getHeaders() {
    headerTimeout = setTimeout(() => {
        statusDiv.textContent = 'Error: Request to background service timed out.';
    }, 15000);
    chrome.runtime.sendMessage({ action: 'getHeadersRequest' }, (response) => {
        clearTimeout(headerTimeout);
        if (response && response.success && response.data) {
            sheetHeaders = response.data;
        } else {
            const errorMessage = response ? response.message : 'No response from background.';
            statusDiv.textContent = `Error loading headers: ${errorMessage}`;
        }
    });
}

// The corrected, simpler displaySingleRow function
function displaySingleRow(rowData, rowIndex) {



    document.getElementById('multi-status-indicator').innerHTML = '';
    statusDiv.style.display = 'none';

    // Reuse the same DOM layout; just inject new values
    updateSingleContactTemplate(rowData, rowIndex);
}



function displayMultipleMatches(matches) {

    // Any time we go to multi view, drop the single-template cache
    singleTemplateInitialized = false;
    singleTemplateRoot = null;
    currentRowIndex = null;

    // --- Setup for Status Circles (You did this part correctly!) ---
    const indicatorContainer = document.getElementById('multi-status-indicator');
    indicatorContainer.innerHTML = ''; // Clear any old circles

    // This part creates and adds the colored circles to the header.
    matches.forEach(match => {
        const status = match.data[0] || 'Uncategorized';
        // Use your existing statusToClass map to find the right CSS class
        const statusClass = statusToClass[status] || 'status-uncategorized';

        const circle = document.createElement('div');
        circle.classList.add('status-circle');
        circle.classList.add(statusClass);
        circle.title = status; // Adds a helpful tooltip on hover
        indicatorContainer.appendChild(circle);
    });
    // ▲▲▲ END OF MISSING PART ▲▲▲

    // --- The rest of your code was perfect ---
    statusDiv.style.display = 'none';
    let finalHTML = `<div class="multiple-matches-container">`;
    finalHTML += `<div class="match-item-header">Found ${matches.length} matching contacts:</div>`;

    // Loop to generate the main contact view
    matches.forEach((match, index) => {
        finalHTML += generateSingleContactHTML(match.data, match.rowIndex);
        if (index < matches.length - 1) {
            finalHTML += `<hr class="match-item-divider">`;
        }
    });

    finalHTML += '</div>';
    dataContainer.innerHTML = finalHTML;

    // Loop to attach listeners (This part correctly fixes the editing bug)
    matches.forEach(match => {
        const contextElement = dataContainer.querySelector(`[data-row-context="${match.rowIndex}"]`);
        if (contextElement) {
            addEditListeners(match.rowIndex, contextElement);
        }
    });
}

/**
 * **FIXED**: Attaches robust event listeners for saving and editing.
 * @param {number} rowIndex - The row number of the currently displayed contact.
 */
function addEditListeners(rowIndex, contextElement) {
    contextElement.querySelectorAll('.detail-item p').forEach(p => {
        const saveBtn = p.nextElementSibling;

        // This function handles the actual save logic
        const triggerSave = () => {
            if (!saveBtn.classList.contains('visible')) return; // Don't save if no changes
            p.contentEditable = "false";
            saveBtn.classList.remove('visible');
            const detailItem = saveBtn.closest('.detail-item');
            const columnIndex = detailItem.dataset.columnIndex;
            saveUpdate(rowIndex, columnIndex, p.textContent, p);
        };

        p.addEventListener('dblclick', (e) => {
            e.target.dataset.originalValue = e.target.textContent;
            e.target.contentEditable = "true";
            e.target.focus();
        });

        p.addEventListener('input', (e) => {
            if (e.target.textContent !== e.target.dataset.originalValue) {
                saveBtn.classList.add('visible');
            } else {
                saveBtn.classList.remove('visible');
            }
        });

        // If the user presses Enter, trigger the save.
        p.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevents adding a new line
                triggerSave();
            }
            // If the user presses Escape, revert changes and lose focus.
            if (e.key === 'Escape') {
                p.textContent = p.dataset.originalValue;
                p.contentEditable = "false";
                saveBtn.classList.remove('visible');
            }
        });

        // A direct click on the save button will also trigger the save.
        saveBtn.addEventListener('click', triggerSave);
    });

    // Dropdown logic remains correct and unchanged
    contextElement.querySelectorAll('.detail-item select').forEach(select => {
        select.addEventListener('change', (e) => {
            const columnIndex = e.target.dataset.columnIndex;
            const newValue = e.target.value;
            saveUpdate(rowIndex, columnIndex, newValue, select);
            if (parseInt(columnIndex) === 0) {
                const detailItem = e.target.closest('.detail-item');
                Object.values(statusToClass).forEach(className => detailItem.classList.remove(className));
                const newClass = statusToClass[newValue];
                if (newClass) { detailItem.classList.add(newClass); }
            }
        });
    });
}


// --- DATE HELPERS (safe for "YYYY-MM-DD" and ISO) ---
function parseDateOnly(dstr) {
    if (!dstr) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dstr)) {
        const [y, m, d] = dstr.split('-').map(Number);
        return new Date(y, m - 1, d); // local midnight
    }
    const dt = new Date(dstr);
    if (isNaN(dt)) return null;
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}


function attachSingleTemplateListeners() {
    if (!singleTemplateRoot) return;

    // Text fields (p + Save button)
    singleTemplateRoot.querySelectorAll('.detail-item p').forEach(p => {
        const saveBtn = p.nextElementSibling;

        const triggerSave = () => {
            if (!saveBtn.classList.contains('visible')) return; // Don't save if nothing changed
            p.contentEditable = "false";
            saveBtn.classList.remove('visible');
            const detailItem = saveBtn.closest('.detail-item');
            const columnIndex = detailItem.dataset.columnIndex;
            // Use GLOBAL currentRowIndex instead of captured rowIndex
            saveUpdate(currentRowIndex, columnIndex, p.textContent, p);
        };

        p.addEventListener('dblclick', (e) => {
            e.target.dataset.originalValue = e.target.textContent;
            e.target.contentEditable = "true";
            e.target.focus();
        });

        p.addEventListener('input', (e) => {
            if (e.target.textContent !== e.target.dataset.originalValue) {
                saveBtn.classList.add('visible');
            } else {
                saveBtn.classList.remove('visible');
            }
        });

        p.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                triggerSave();
            }
            if (e.key === 'Escape') {
                p.textContent = p.dataset.originalValue;
                p.contentEditable = "false";
                saveBtn.classList.remove('visible');
            }
        });

        saveBtn.addEventListener('click', triggerSave);
    });

    // Dropdowns
    singleTemplateRoot.querySelectorAll('.detail-item select').forEach(select => {
        select.addEventListener('change', (e) => {
            const columnIndex = e.target.dataset.columnIndex;
            const newValue = e.target.value;
            // Again, use global currentRowIndex
            saveUpdate(currentRowIndex, columnIndex, newValue, select);

            // Status color update for Column A
            if (parseInt(columnIndex) === 0) {
                const detailItem = e.target.closest('.detail-item');
                Object.values(statusToClass).forEach(className => detailItem.classList.remove(className));
                const newClass = statusToClass[newValue];
                if (newClass) { detailItem.classList.add(newClass); }
            }
        });
    });
}

function initSingleContactTemplate(rowData, rowIndex) {
    // Build full layout once (headers + boxes)
    const contactHTML = generateSingleContactHTML(rowData, rowIndex);
    dataContainer.innerHTML = contactHTML;

    singleTemplateRoot = dataContainer.querySelector('.details-view');
    if (!singleTemplateRoot) return;

    singleTemplateInitialized = true;
    currentRowIndex = rowIndex;

    // Wire up editing/save/select just once
    attachSingleTemplateListeners();
}

function updateSingleContactTemplate(rowData, rowIndex) {
    // If template is not built yet, build it now
    if (!singleTemplateInitialized || !singleTemplateRoot) {
        initSingleContactTemplate(rowData, rowIndex);
        return;
    }

    currentRowIndex = rowIndex;

    const detailItems = singleTemplateRoot.querySelectorAll('.detail-item');

    detailItems.forEach((item) => {
        const colIndex = parseInt(item.dataset.columnIndex, 10);
        const cellValue = rowData[colIndex] || '';

        if (dropdownOptions.hasOwnProperty(colIndex)) {
            // Dropdown column
            const selectEl = item.querySelector('select');
            if (selectEl) {
                selectEl.value = cellValue || '';

                // If it's Status (Column A), update class
                if (colIndex === 0) {
                    Object.values(statusToClass).forEach(className => item.classList.remove(className));
                    const newClass = statusToClass[cellValue];
                    if (newClass) item.classList.add(newClass);
                }
            }
        } else {
            // Text + Save button
            const p = item.querySelector('p');
            const saveBtn = item.querySelector('.save-btn');
            if (p && saveBtn) {
                p.textContent = cellValue;
                p.dataset.originalValue = cellValue;
                saveBtn.classList.remove('visible');
                saveBtn.textContent = 'Save';
            }
        }
    });
}




function saveUpdate(rowIndex, columnIndex, newValue, element) {
    let feedbackElement = element;
    if (element.tagName === 'P') {
        feedbackElement = element.nextElementSibling;
        feedbackElement.textContent = 'Saving...';
    }
    chrome.runtime.sendMessage({
        action: 'updateCellValue',
        rowIndex: rowIndex,
        columnIndex: columnIndex,
        newValue: newValue
    }, (response) => {
        if (response && response.success) {
            console.log('Save successful');
            if (element.tagName === 'P') {
                feedbackElement.textContent = 'Saved!';
                element.dataset.originalValue = newValue;
                setTimeout(() => { feedbackElement.textContent = 'Save'; }, 2000);
            }
        } else {
            console.error('Save failed:', response ? response.message : 'No response');
            if (element.tagName === 'P') {
                feedbackElement.textContent = 'Error!';
                element.textContent = element.dataset.originalValue;
            }
        }
    });
}

/**
 * **CORRECTED**: Renders the grouped view, now reading timestamps from Column P.
 */
/**
 * **UPGRADED**: Renders the grouped view with a persistent, context-aware selection history.
 */
async function renderGroupedView() { // The function must be async
    // --- 1. DEFINE THE CURRENT CONTEXT ---
    const month = monthFilter.value;
    const status = statusFilter.value;
    const contextKey = `${month}-${status}`; // e.g., "all-Script Written" or "7-Closed"
    const SELECTION_HISTORY_KEY = 'selectionHistory';
    const MAX_HISTORY_PER_CONTEXT = 10; // We'll remember the last 10 clicks per view

    // --- 2. GET DATA AND HISTORY ---
    // Get the entire history object from storage
    const storageResult = await new Promise(resolve => chrome.storage.local.get([SELECTION_HISTORY_KEY], resolve));
    const selectionHistory = storageResult[SELECTION_HISTORY_KEY] || {};
    // Get the specific history for our current filter context
    const contextHistory = selectionHistory[contextKey] || [];

    // This is your existing data filtering logic - no changes needed here
    let dataToRender = allSheetData;
    if (status === 'unchanged') {
        const now = new Date();
        const thirtySixHoursAgo = now.getTime() - (36 * 60 * 60 * 1000);
        dataToRender = allSheetData.filter(rowWithIndex => {
            const status = rowWithIndex.data[0] || '';
            const timestampString = rowWithIndex.data[15];
            if (status === 'Closed') { return false; }
            if (!timestampString) { return true; }
            const d = parseSheetDateFlexible(timestampString);
            const ts = d ? d.getTime() : NaN;
            return isNaN(ts) ? true : ts < thirtySixHoursAgo;

        });
    } else {
        if (month !== "all") {
            dataToRender = dataToRender.filter(rowWithIndex => {
                const dateString = rowWithIndex.data[1];
                if (!dateString) return false;
                const parts = dateString.split(' ')[0].split('/');
                if (parts.length !== 3) return false;
                const dateMonth = parseInt(parts[1], 10) - 1;
                return !isNaN(dateMonth) && dateMonth === parseInt(month, 10);
            });
        }
        if (status !== "all") {
            dataToRender = dataToRender.filter(rowWithIndex => {
                const itemStatus = rowWithIndex.data[0] || '';
                return (status === 'uncategorized') ? itemStatus === '' : itemStatus === status;
            });
        }
    }

    let phoneToHighlight = null;
    if (contextHistory.length > 0) {
        // Create a Set of all phone numbers currently visible for very fast lookups
        const visiblePhones = new Set(dataToRender.map(row => row.data[12] || ''));
        // Look backwards through our history for this context
        for (let i = contextHistory.length - 1; i >= 0; i--) {
            const historicPhone = contextHistory[i];
            // The first phone we find in our history that is also in the visible list is our target!
            if (visiblePhones.has(historicPhone)) {
                phoneToHighlight = historicPhone;
                break; // Found it, stop searching.
            }
        }
    }

    // --- 4. RENDER THE HTML ---
    // This part is mostly the same, but it uses our new `phoneToHighlight` variable
    const grouped = dataToRender.reduce((acc, rowWithIndex) => {
        const status = rowWithIndex.data[0] || 'Uncategorized';
        if (!acc[status]) { acc[status] = []; }
        acc[status].push(rowWithIndex);
        return acc;
    }, {});
    let groupHTML = '';
    const statusOrder = dropdownOptions[0].concat(['Uncategorized']);
    statusOrder.forEach(status => {
        if (grouped[status]) {
            groupHTML += `<div class="status-group"><div class="status-group-header">${status} (${grouped[status].length})</div>`;
            grouped[status].forEach(rowWithIndex => {
                const phone = rowWithIndex.data[12] || 'No Phone Number';
                const selectedClass = (phone === phoneToHighlight) ? ' selected-contact' : '';
                groupHTML += `<div class="grouped-contact-item${selectedClass}" data-phone="${phone}" title="Click to search for this number">${phone}</div>`;
            });
            groupHTML += `</div>`;
        }
    });
    if (groupHTML === '') { groupHTML = '<div id="status">No contacts found for the selected filters.</div>'; }
    groupedDataContainer.innerHTML = groupHTML;

    // --- 5. ATTACH EVENT LISTENERS WITH NEW HISTORY LOGIC ---
    document.querySelectorAll('.grouped-contact-item').forEach(item => {
        item.addEventListener('click', async () => {
            const clickedPhone = item.dataset.phone;

            // Update UI immediately
            const currentSelection = document.querySelector('.grouped-contact-item.selected-contact');
            if (currentSelection) { currentSelection.classList.remove('selected-contact'); }
            item.classList.add('selected-contact');

            // Get the latest full history object from storage
            const currentHistoryResult = await new Promise(resolve => chrome.storage.local.get([SELECTION_HISTORY_KEY], resolve));
            const currentSelectionHistory = currentHistoryResult[SELECTION_HISTORY_KEY] || {};

            // Get the history array for the current context
            let newContextHistory = currentSelectionHistory[contextKey] || [];

            // Remove any old instances of this number to move it to the top of the history
            newContextHistory = newContextHistory.filter(p => p !== clickedPhone);
            newContextHistory.push(clickedPhone);

            // Trim the history if it exceeds the max length
            if (newContextHistory.length > MAX_HISTORY_PER_CONTEXT) {
                newContextHistory.shift(); // Remove the oldest item from the front
            }

            // Save the updated context history back into the main object
            currentSelectionHistory[contextKey] = newContextHistory;
            await chrome.storage.local.set({ [SELECTION_HISTORY_KEY]: currentSelectionHistory });

            // Open the chat as before
            const phoneNumber = clickedPhone.replace(/\D/g, '');
            if (phoneNumber) {
                chrome.runtime.sendMessage({ action: 'openWhatsAppChat', phone: phoneNumber });
            }
        });
    });

    // Find the currently highlighted item in the list
    const selectedItem = document.querySelector('.grouped-contact-item.selected-contact');

    // Check if an item is selected AND if we haven't already performed the initial scroll
    if (selectedItem && !hasScrolledToInitialItem) {
        setTimeout(() => {
            selectedItem.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }, 100);

        // IMPORTANT: Set the flag to true so this doesn't run again
        // until the user leaves and re-enters the group view.
        hasScrolledToInitialItem = true;
    }
}


function parseSheetDateFlexible(dstr) {
    if (!dstr) return null;
    const s = String(dstr).trim();

    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
        const dt = new Date(s);
        return isNaN(dt) ? null : dt;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
        const [dd, mm, yyyy] = s.split('-').map(Number);
        return new Date(yyyy, mm - 1, dd);
    }
    const dt = new Date(s);
    return isNaN(dt) ? null : dt;
}

function daysBetweenTodayLocal(d) {
    if (!d) return Infinity;
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.floor((startToday - startThat) / 86400000);
}


function toggleGroupView() {
    isGroupView = !isGroupView;
    if (isGroupView) {
        hasScrolledToInitialItem = false; // <-- ADD THIS LINE to reset the scroll on each new view
        document.getElementById('multi-status-indicator').innerHTML = ''; // <-- ADD THIS LINE
        groupViewBtn.title = 'Back to Contact View';
        groupIconChart.style.display = 'none';
        groupIconBack.style.display = 'block';
        monthFilter.style.display = 'inline-block';
        statusFilter.style.display = 'inline-block'; // <-- ADD THIS LINE to show the filter
        dataContainer.style.display = 'none';
        statusDiv.style.display = 'none';
        groupedDataContainer.style.display = 'block';
        groupedDataContainer.innerHTML = 'Loading all contacts...';
        chrome.runtime.sendMessage({ action: 'fetchAllData' }, (response) => {
            if (response && response.success) {
                allSheetData = response.data.map((row, index) => ({ data: row, originalIndex: index }));
                renderGroupedView();
            } else {
                groupedDataContainer.innerHTML = 'Error loading data.';
            }
        });
        //  ADD THIS LINE TO START THE TIMER 
        refreshIntervalId = setInterval(refreshGroupViewData, 10000); // 10000ms = 10 seconds

    } else {
        //  ADD THIS LINE TO STOP THE TIMER 
        if (refreshIntervalId) clearInterval(refreshIntervalId);
        groupViewBtn.title = 'Group by Status';
        groupIconChart.style.display = 'block';
        groupIconBack.style.display = 'none';
        monthFilter.style.display = 'none';
        statusFilter.style.display = 'none'; // <-- ADD THIS LINE to hide the filter
        //monthFilter.value = 'all';
        // statusFilter.value = 'all'; // <-- OPTIONAL: Reset filter on exit
        groupedDataContainer.style.display = 'none';
        dataContainer.style.display = 'block';
        statusDiv.textContent = '';
        statusDiv.style.display = 'block';
    }
}

chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'displayRowData') {
        if (isGroupView) return;
        if (request.matches && request.matches.length > 1) {
            displayMultipleMatches(request.matches);
        } else if (request.matches && request.matches.length === 1) {
            displaySingleRow(request.matches[0].data, request.matches[0].rowIndex);
        }
    } else if (request.action === 'displayNoMatch') {
        if (isGroupView) return;
        // Reset single-template cache
        singleTemplateInitialized = false;
        singleTemplateRoot = null;
        currentRowIndex = null;

        document.getElementById('multi-status-indicator').innerHTML = '';
        dataContainer.innerHTML = '';
        statusDiv.textContent = 'No matching contact found in the sheet.';
        statusDiv.style.display = 'block';
    } else if (request.action === 'displayError') {
        if (isGroupView) return;
        // Reset single-template cache
        singleTemplateInitialized = false;
        singleTemplateRoot = null;
        currentRowIndex = null;

        document.getElementById('multi-status-indicator').innerHTML = '';
        dataContainer.innerHTML = '';
        statusDiv.textContent = `An error occurred: ${request.message}`;
        statusDiv.style.display = 'block';
    }

});


document.addEventListener('DOMContentLoaded', () => {
    getHeaders();
    populateStatusFilter(); // Populate the new dropdown on load
    loadAndApplyFilterPreferences(); // Load saved filters on load

    groupViewBtn.addEventListener('click', toggleGroupView);

    // When month filter changes, re-render the view AND save preferences
    monthFilter.addEventListener('change', () => {
        renderGroupedView();
        saveFilterPreferences();
    });

    // When status filter changes, re-render the view AND save preferences

    statusFilter.addEventListener('change', () => {
        renderGroupedView();
        saveFilterPreferences();
        updateFilterColor(); // <-- ADD THIS LINE to set color on change
    });

});


/**
 * Fetches the latest sheet data and re-renders the group view.
 * Only runs if the group view is currently active.
 */
function refreshGroupViewData() {
    // Stop if the user is not in group view. This is a safety check.
    if (!isGroupView) {
        clearInterval(refreshIntervalId); // Clear any lingering intervals
        return;
    }

    console.log('[Auto-Refresh] Fetching latest data...');

    chrome.runtime.sendMessage({ action: 'fetchAllData' }, (response) => {
        if (response && response.success) {
            // Update the local data cache with the new data from the sheet
            allSheetData = response.data.map((row, index) => ({ data: row, originalIndex: index }));

            // Re-render the view to display the new data
            renderGroupedView();
            console.log('[Auto-Refresh] View updated successfully.');
        } else {
            console.error('[Auto-Refresh] Failed to fetch data:', response ? response.message : 'No response');
        }
    });
}

/**
 * Populates the status filter dropdown from the hardcoded options.
 */
function populateStatusFilter() {
    const statuses = dropdownOptions[0] || []; // Use statuses from Column A options
    statuses.forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        statusFilter.appendChild(option);
    });
    // Create a new option element specifically for "Uncategorized"
    const uncategorizedOption = document.createElement('option');
    uncategorizedOption.value = 'uncategorized'; // Use a special, lowercase value for filtering
    uncategorizedOption.textContent = 'Uncategorized'; // This is the text the user will see
    statusFilter.appendChild(uncategorizedOption);
}

/**
 * Saves the current filter selections to local storage.
 */
function saveFilterPreferences() {
    const preferences = {
        month: monthFilter.value,
        status: statusFilter.value
    };
    chrome.storage.local.set({ filterPreferences: preferences });
    console.log('Filter preferences saved:', preferences);
}

/**
 * Loads filter preferences from storage and applies them to the UI.
 */
function loadAndApplyFilterPreferences() {
    chrome.storage.local.get(['filterPreferences'], (result) => {
        if (result.filterPreferences) {
            monthFilter.value = result.filterPreferences.month || 'all';
            statusFilter.value = result.filterPreferences.status || 'all';
            console.log('Filter preferences loaded:', result.filterPreferences);
            // If we are already in group view, re-render the list with the loaded filters
            if (isGroupView) {
                renderGroupedView();
            }
        }
        updateFilterColor(); // <--THIS LINE to set color on load
    });
}


/**
 * Changes the color of the status filter dropdown based on its selected value.
 */
function updateFilterColor() {
    const selectedStatus = statusFilter.value;

    // First, remove any existing status color classes to avoid conflicts
    Object.values(statusToClass).forEach(className => {
        statusFilter.classList.remove(className);
    });
    statusFilter.classList.remove('status-all'); // Also remove the default class

    // Find the new class to add. The 'statusToClass' map is perfect for this.
    // Note: You need to add mappings for your other statuses for this to be complete.

    const classToAdd = statusToClass[selectedStatus] || 'status-all';
    statusFilter.classList.add(classToAdd);
}

/**
 * Generates the complete HTML for a single contact's detail view.
 * @param {Array} rowData - The array of data for one row.
 * @param {number} rowIndex - The sheet row number for this contact.
 * @returns {string} The HTML string for the contact view.
 */
function generateSingleContactHTML(rowData, rowIndex) {
    let detailsHTML = `<div class="details-view" data-row-context="${rowIndex}">`;
    sheetHeaders.forEach((header, index) => {
        const cellValue = rowData[index] || '';
        if (header) {
            let itemClass = '';
            if (index === 0) {
                itemClass = statusToClass[cellValue] || '';
            } else {
                switch (index) {
                    case 4: itemClass = 'bg-off-white'; break;
                    case 6: itemClass = 'bg-light-purple'; break;
                    case 8: itemClass = 'bg-light-green'; break;
                    case 9: itemClass = 'bg-light-blue'; break;
                    case 10: itemClass = 'bg-light-red'; break;
                }
            }
            detailsHTML += `<div class="detail-item ${itemClass}" data-column-index="${index}"><strong>${header}</strong>`;
            if (dropdownOptions.hasOwnProperty(index)) {
                let selectHTML = `<select data-row-index="${rowIndex}" data-column-index="${index}">`;
                if (!dropdownOptions[index].includes(cellValue)) {
                    selectHTML += `<option value="" disabled ${cellValue === '' ? 'selected' : ''}>Select an option</option>`;
                }
                dropdownOptions[index].forEach(option => {
                    selectHTML += `<option value="${option}" ${option === cellValue ? 'selected' : ''}>${option}</option>`;
                });
                selectHTML += `</select>`;
                detailsHTML += selectHTML;
            } else {
                detailsHTML += `<p contenteditable="false">${cellValue}</p><button class="save-btn">Save</button>`;
            }
            detailsHTML += '</div>';
        }
    });
    detailsHTML += '</div>';
    return detailsHTML;
}
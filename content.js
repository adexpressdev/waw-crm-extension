// ---content.js---
// WhatsApp CRM Content Script - DOM Injection & Event Handling
// Phone extraction logic is in phoneExtractor.js (loaded first)

console.log("WhatsApp CRM: Content script with layout adjustment loaded.")


// --- LAYOUT ADJUSTMENT ---
// This function resizes the main WhatsApp view to make room for CRM panel
function adjustWhatsAppLayout() {
  const app = document.querySelector('#app')
  if (app) {
    // The iframe width is 350px. We'll set the app width to be the
    // full screen minus the iframe width, plus a little margin.
    app.style.width = 'calc(100% - 290px)'
    app.style.transition = 'width 0.3s ease-in-out'
  }
}

// --- IFRAME INJECTION ---
function injectIframe() {
  if (document.getElementById('sheet-viewer-iframe')) return
  const iframe = document.createElement('iframe')
  iframe.id = 'sheet-viewer-iframe'
  iframe.src = chrome.runtime.getURL('panel.html')
  document.body.appendChild(iframe)

  // Call the layout adjustment function as soon as the iframe is added
  adjustWhatsAppLayout()
}

// --- EXTRACTION RUNNER ---
// Unified runner so clicks + hashchange + mutations all behave the same
let _isExtractingNow = false
let _lastDigitsSent = null

async function runExtractionAndSearch(reason = 'unknown') {
  if (_isExtractingNow) {
    console.log('[CRM] Skipping runExtractionAndSearch, already running')
    return
  }
  _isExtractingNow = true
  try {
    console.log('[CRM] runExtractionAndSearch, reason =', reason)
    // extractPhoneNumber is defined in phoneExtractor.js
    const fullPhoneNumber = await extractPhoneNumber()
    if (!fullPhoneNumber) {
      console.log('[CRM] No phone extracted for reason =', reason)
      return
    }
    const last6Digits = fullPhoneNumber.slice(-6)
    if (last6Digits === _lastDigitsSent) {
      console.log('[CRM] Same last6Digits as previous, skipping send:', last6Digits)
      return
    }
    _lastDigitsSent = last6Digits
    console.log(`Step 1: Sending last 6 digits to search -> ${last6Digits}`)
    chrome.runtime.sendMessage({ action: 'searchLast6Digits', digits: last6Digits })
  } finally {
    _isExtractingNow = false
  }
}

// --- CHAT CLICK LISTENER ---
function initChatSearchListener() {
  // We wait for the main #app container to exist. This is a stable, high-level element.
  const appContainer = document.querySelector('#app')
  if (!appContainer) {
    setTimeout(initChatSearchListener, 500) // Try again if it's not loaded yet
    return
  }

  // SINGLE click listener on the app container:
  appContainer.addEventListener('click', (event) => {
    const chatTarget = event.target.closest(
      '[data-testid="cell-frame-container"], [role="listitem"], [role="row"], [data-id*="@c.us"], div[role="row"][aria-selected="true"]'
    )
    if (!chatTarget) return // Ignore non-chat clicks

    // Let WhatsApp update its UI first, then run extraction
    setTimeout(() => runExtractionAndSearch('click'), 130)
  })

  console.log("WhatsApp CRM: Universal chat click listener is now active.")
}

// --- DOM OBSERVERS ---
// Extra robustness: react to hash changes and header mutations too
function initDomObservers() {
  // Hashchange -> navigation between chats
  window.addEventListener('hashchange', () => {
    setTimeout(() => runExtractionAndSearch('hashchange'), 130)
  })


  // MutationObserver on #main to detect header/conversation swaps
  const attachObserver = () => {
    const mainEl = document.querySelector('#main')
    if (!mainEl) {
      setTimeout(attachObserver, 1000)
      return
    }
    const mo = new MutationObserver((mutations) => {
      let headerTouched = false
      for (const m of mutations) {
        const t = m.target
        if (!(t instanceof HTMLElement)) continue
        if (t.closest && t.closest('#main header, [data-testid="conversation-header"], [data-testid="conversation-info-header"]')) {
          headerTouched = true
          break
        }
      }
      if (headerTouched) {
        setTimeout(() => runExtractionAndSearch('mutation'), 150)
      }

    })
    mo.observe(mainEl, { childList: true, subtree: true })
    console.log('[CRM] MutationObserver attached to #main')
  }

  attachObserver()
}

// --- INITIALIZATION ---
injectIframe()
initChatSearchListener()
initDomObservers()

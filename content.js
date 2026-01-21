// ---Content.js---
console.log("WhatsApp CRM: Content script with layout adjustment loaded.");


// --- UNIVERSAL PHONE EXTRACTION (single source of truth) ---
const _sleep = (ms) => new Promise(r => setTimeout(r, ms));
const _onlyDigits = (s) => (s || '').replace(/[^\d]/g, '');
const _hasMinLen = (s, len = 8) => _onlyDigits(s).length >= len;
// element must be in the current layout and not hidden
const _isVisible = (el) => {
  if (!el) return false;
  const st = getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};
/**
 * 1) Attribute sweep: works across old/new DOMs and locales
 */
function _extractFromDataAttrs() {
  console.log('[CRM] Step: Trying _extractFromDataAttrs');
  const root = document.querySelector('#main');
  if (!root || !_isVisible(root)) {
    console.log('[CRM] Step: No visible #main root found');
    return null;
  }
  const selectors = [
    '[data-id]',
    '[data-jid]',
    '[data-chatid]',
    '[data-conversation-id]'
  ].join(',');
  const nodes = Array.from(root.querySelectorAll(selectors)).filter(_isVisible);
  for (const el of nodes) {
    for (const attr of ['data-id', 'data-jid', 'data-chatid', 'data-conversation-id']) {
      const raw = el.getAttribute?.(attr);
      if (!raw) continue;
      if (/@lid_/i.test(raw)) continue; // LID is not a phone
      const m = raw.match(/(?:^|_)(\d{6,})(?=@(?:c\.us|s\.whatsapp\.net)|$)/);
      if (m && _hasMinLen(m[1])) {
        console.log(`[CRM] Step: Found in ${attr}: ${m[1]}`);
        return m[1];
      }
    }
  }
  console.log('[CRM] Step: No phone found in data attrs');
  return null;
}
function _hasLidContext() {
  console.log('[CRM] Step: Checking for LID context');
  const hasLid = !!document.querySelector([
    '#main [data-id*="@lid_"]',
    '#main [data-jid*="@lid_"]',
    '[aria-selected="true"] [data-id*="@lid_"]',
    '[aria-selected="true"] [data-jid*="@lid_"]'
  ].join(','));
  console.log(`[CRM] Step: LID context: ${hasLid}`);
  return hasLid;
}
/**
 * 2) Direct tel: link in header (some layouts expose it)
 */
function _extractFromHeaderTel() {
  console.log('[CRM] Step: Trying _extractFromHeaderTel');
  const header = document.querySelector(
    '#main header, [data-testid="conversation-header"], [data-testid="conversation-info-header"], [role="banner"]'
  );
  if (!header) {
    console.log('[CRM] Step: No header found');
    return null;
  }
  const tel = header.querySelector('a[href^="tel:"]');
  if (tel) {
    const n = _onlyDigits(tel.getAttribute('href'));
    if (_hasMinLen(n)) {
      console.log(`[CRM] Step: Found in tel link: ${n}`);
      return n;
    }
  }
  console.log('[CRM] Step: No tel link or invalid number');
  return null;
}
/**
 * 3) Header text fallback (unsaved numbers often show as plain text)
 */
function _extractFromHeaderText() {
  console.log('[CRM] Step: Trying _extractFromHeaderText');
  const header =
    document.querySelector('#main header') ||
    document.querySelector('[data-testid="conversation-header"]') ||
    document.querySelector('[data-testid="conversation-info-header"]') ||
    document.querySelector('[role="banner"]');
  if (!header) {
    console.log('[CRM] Step: No header found');
    return null;
  }
  // Try to limit to the title/name area if possible
  const nameNode =
    header.querySelector('[data-testid="conversation-info-header"] [title]') ||
    header.querySelector('[data-testid="conversation-header"] [title]') ||
    header.querySelector('h2[title], h1[title], span[title]') ||
    header;
  const txt = (nameNode.innerText || nameNode.textContent || '').trim();
  const rx = /(\+?\d[\d\s\-().]{6,})/g;
  let best = null, m;
  while ((m = rx.exec(txt))) {
    const d = _onlyDigits(m[1]);
    if (_hasMinLen(d) && (!best || d.length > best.length)) best = d;
  }
  if (best) {
    console.log(`[CRM] Step: Found in header text: ${best}`);
  } else {
    console.log('[CRM] Step: No number found in header text');
  }
  return best;
}
// Some builds store the phone in an aria-label on the header button
function _extractFromHeaderAria() {
  console.log('[CRM] Step: Trying _extractFromHeaderAria');
  const targets = [
    '#main header [role="button"][aria-label]',
    '#main header [aria-label]',
    '[data-testid="conversation-header"] [aria-label]',
    '[data-testid="conversation-info-header"] [aria-label]'
  ];
  for (const sel of targets) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const label = el.getAttribute('aria-label') || '';
    const n = _onlyDigits(label);
    if (_hasMinLen(n)) {
      console.log(`[CRM] Step: Found in aria-label: ${n}`);
      return n;
    }
  }
  console.log('[CRM] Step: No number found in header aria');
  return null;
}
/**
 * 4) URL/hash fallback: wa.me, ?phone=, ?chat=, #/t/123..., etc.
 */
function _extractFromUrl() {
  console.log('[CRM] Step: Trying _extractFromUrl');
  try {
    const u = new URL(String(location.href));
    // Common query params
    for (const p of ['phone', 'chat', 'jid', 'id', 'number']) {
      const v = u.searchParams.get(p);
      if (v) {
        const mx = v.match(/(\d{6,})(?=@(?:c\.us|s\.whatsapp\.net)|$)/);
        const n = mx ? mx[1] : _onlyDigits(v);
        if (_hasMinLen(n)) {
          console.log(`[CRM] Step: Found in URL param ${p}: ${n}`);
          return n;
        }
      }
    }
    // Hash patterns: #/t/123..., #/c/123..., #...&chat=123...
    const h = u.hash || '';
    let hm =
      h.match(/(?:^|[/?&])(t|c|chat|jid)=?(\d{6,})/i) ||
      h.match(/\/(t|c)\/(\d{6,})/i);
    if (hm && _hasMinLen(hm[2])) {
      console.log(`[CRM] Step: Found in hash: ${hm[2]}`);
      return hm[2];
    }
    // Path digits: /1234567890 or /1234567890@s.whatsapp.net
    const pm = (u.pathname || '').match(/(\d{6,})(?=@|$)/);
    if (pm && _hasMinLen(pm[1])) {
      console.log(`[CRM] Step: Found in pathname: ${pm[1]}`);
      return pm[1];
    }
  } catch (e) {
    console.log('[CRM] Step: Error in URL extraction:', e);
  }
  console.log('[CRM] Step: No number found in URL');
  return null;
}
// Fallback: read from the selected row in the left chat list
function _extractFromLeftPaneSelected() {
  console.log('[CRM] Step: Trying _extractFromLeftPaneSelected');

  // Collect all visible chat rows in the left pane
  const allRows = Array.from(document.querySelectorAll(
    '[data-testid="cell-frame-container"], [role="row"], [role="listitem"]'
  )).filter(_isVisible);

  if (!allRows.length) {
    console.log('[CRM] Step: No visible chat rows found in left pane');
    return null;
  }

  // Prefer an explicitly "selected" row if we can detect one
  let selected = allRows.find(el =>
    el.getAttribute('aria-selected') === 'true' ||
    el.getAttribute('data-selected') === 'true'
  );

  // If nothing is explicitly selected, fall back to the row with the largest on-screen area
  if (!selected) {
    const best = allRows
      .map(el => {
        const r = el.getBoundingClientRect();
        const w = Math.max(0, Math.min(window.innerWidth, r.right) - Math.max(0, r.left));
        const h = Math.max(0, Math.min(window.innerHeight, r.bottom) - Math.max(0, r.top));
        return { el, area: w * h };
      })
      .sort((a, b) => b.area - a.area)[0];
    selected = best?.el || allRows[0];
  }

  if (!selected) {
    console.log('[CRM] Step: No suitable candidate row in left pane');
    return null;
  }

  // data-* first (skip LID)
  for (const attr of ['data-id', 'data-jid', 'data-chatid', 'data-conversation-id']) {
    const raw = selected.getAttribute?.(attr);
    if (!raw) continue;
    if (/@lid_/i.test(raw)) continue;
    const m = raw.match(/(?:^|_)(\d{6,})(?=@(?:c\.us|s\.whatsapp\.net)|$)/);
    if (m && _hasMinLen(m[1])) {
      console.log(`[CRM] Step: Found in left pane ${attr}: ${m[1]}`);
      return m[1];
    }
  }
  // then visible text/title
  const titleEl =
    selected.querySelector('[data-testid="cell-frame-title"] [title]') ||
    selected.querySelector('[title]') ||
    selected.querySelector('span[dir="auto"]');
  const txt = (titleEl?.getAttribute?.('title') || titleEl?.innerText || selected.innerText || '').trim();
  const rx = /(\+?\d[\d\s\-().]{6,})/g;
  let bestDigits = null, m;
  while ((m = rx.exec(txt))) {
    const d = _onlyDigits(m[1]);
    if (_hasMinLen(d) && (!bestDigits || d.length > bestDigits.length)) bestDigits = d;
  }
  if (bestDigits) {
    console.log(`[CRM] Step: Found in left pane text: ${bestDigits}`);
  } else {
    console.log('[CRM] Step: No number found in left pane text');
  }
  return bestDigits;
}


// Helper: find all BD-style mobile numbers (+8801XXXXXXXXX or 01XXXXXXXXX) inside a text block
function _findBdPhonesInText(text) {
  if (!text) return [];
  const digits = _onlyDigits(text);
  const out = [];
  const seen = new Set();

  for (let i = 0; i < digits.length; i++) {
    // +8801XXXXXXXXX (13 digits)
    if (digits.slice(i, i + 4) === '8801' && i + 13 <= digits.length) {
      const d = digits.slice(i, i + 13);
      if (!seen.has(d)) {
        out.push(d);
        seen.add(d);
      }
    }
    // 01XXXXXXXXX (11 digits, BD mobile 013–019)
    if (digits.slice(i, i + 2) === '01' &&
      i + 11 <= digits.length &&
      '3456789'.includes(digits[i + 2])) {
      const d = digits.slice(i, i + 11);
      if (!seen.has(d)) {
        out.push(d);
        seen.add(d);
      }
    }
  }

  return out;
}

// 5) Last resort: briefly open Contact Info drawer, read number, close



async function _extractFromInfoDrawer({ aggressive = false } = {}) {
  console.log(`[CRM] Step: Trying _extractFromInfoDrawer (aggressive: ${aggressive})`);
  let drawer =
    document.querySelector('[data-testid="conversation-info-drawer"]') ||
    document.querySelector('[data-testid="contact-info"]') ||
    document.querySelector('div[role="dialog"][data-animate-modal="true"]') ||
    document.querySelector('aside[aria-label], [role="region"][aria-label]');
  let openedHere = false;

  // 1) Open drawer if needed (faster wait)
  if (!drawer) {
    console.log('[CRM] Step: No drawer found, attempting to open');
    const headerClickable =
      document.querySelector('#main header [role="button"]') ||
      document.querySelector('#main header') ||
      document.querySelector('[data-testid="conversation-header"]');
    if (!headerClickable) {
      console.log('[CRM] Step: No header clickable to open drawer');
      return null;
    }
    headerClickable.click();
    openedHere = true;

    // Was 60 spins x 75ms (~4.5s). Now max ~1.5s.
    const spins = aggressive ? 25 : 12;
    for (let i = 0; i < spins; i++) {
      await _sleep(60);
      drawer =
        document.querySelector('[data-testid="conversation-info-drawer"]') ||
        document.querySelector('[data-testid="contact-info"]') ||
        document.querySelector('div[role="dialog"][data-animate-modal="true"]') ||
        document.querySelector('aside[aria-label], [role="region"][aria-label]');
      if (drawer) {
        const rect = drawer.getBoundingClientRect();
        const opacity = parseFloat(getComputedStyle(drawer).opacity || '1');
        console.log(
          `[CRM] Drawer rect (attempt ${i + 1}): width=${rect.width}, height=${rect.height}, opacity=${opacity}`
        );
        if (rect.width > 10 && rect.height > 10 && opacity > 0.3) {
          console.log('[CRM] Step: Drawer opened and visible');
          break;
        }
      }
    }
  }

  if (!drawer || drawer.getBoundingClientRect().width <= 10) {
    console.log('[CRM] Step: Drawer not visible after attempts');
    return null;
  }

  // 2) FAST PATH: "About and phone number" section with copyable text
  const aboutSection = drawer.querySelector(
    '.x13mwh8y.x1q3qbx4.x1wg5k15.x3psx0u.xat24cr.x1280gxy.x106a9eq.x1xnnf8n.x889kno.x18d9i69'
  );
  if (aboutSection) {
    console.log('[CRM] Step: Found "About and phone number" section');
    const phoneEl =
      aboutSection.querySelector('._ajxt .copyable-text') ||
      aboutSection.querySelector('.copyable-text.selectable-text');
    if (phoneEl) {
      const txt = (phoneEl.innerText || phoneEl.textContent || '').trim();
      const phones = _findBdPhonesInText(txt);
      if (phones.length) {
        const chosen = phones[phones.length - 1]; // keep same heuristic
        console.log('[CRM] Step: Phones in about section:', phones, 'chosen:', chosen);
        if (openedHere) {
          console.log('[CRM] Step: Closing drawer (opened here)');
          (
            document.querySelector('button[aria-label="Close"]') ||
            document.querySelector('[data-testid="x-view"]') ||
            document.querySelector('button[aria-label="Back"]')
          )?.click();
        }
        return chosen;
      }
    }
    console.log('[CRM] Step: No copyable-text phone in about section');
  } else {
    console.log('[CRM] Step: No "About and phone number" section found');
  }

  // 3) FALLBACK: text scan in narrowed scope using the same BD parser
  const anchor = Array.from(drawer.querySelectorAll('span, div, h2, h3, [title]'))
    .filter(_isVisible)
    .find(el => {
      const txt = (el.innerText || el.textContent || '').toLowerCase();
      return /about.*phone/i.test(txt) || /phone number/i.test(txt) || /whatsapp/i.test(txt);
    });

  const scope =
    (anchor && _isVisible(anchor) && anchor.closest('[tabindex], [role="region"], section, div')) ||
    drawer;
  console.log('[CRM] Step: Using fallback scope for text scan');

  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
  let node;
  const foundPhones = [];

  while ((node = walker.nextNode())) {
    if (!node.parentElement || !_isVisible(node.parentElement)) continue;
    const t = node.nodeValue?.trim();
    if (!t) continue;
    const phones = _findBdPhonesInText(t);
    if (phones.length) {
      console.log('[CRM] Step: drawer text node -> BD phones:', t, '=>', phones);
      foundPhones.push(...phones);
    }
  }

  if (openedHere) {
    console.log('[CRM] Step: Closing drawer (opened here)');
    (
      document.querySelector('button[aria-label="Close"]') ||
      document.querySelector('[data-testid="x-view"]') ||
      document.querySelector('button[aria-label="Back"]')
    )?.click();
  }

  if (foundPhones.length) {
    const chosen = foundPhones[foundPhones.length - 1];
    console.log('[CRM] Step: Found in drawer text scan, chosen:', chosen, 'all:', foundPhones);
    return chosen;
  }

  console.log('[CRM] Step: No number found in drawer text scan');
  return null;
}


// 5b) Direct scan of drawer rows where WhatsApp renders copyable phone text
function _extractFromDrawerCopyableSpan() {
  console.log('[CRM] Step: Trying _extractFromDrawerCopyableSpan');

  const roots = [
    document.querySelector('[data-testid="conversation-info-drawer"]'),
    document.querySelector('[data-testid="contact-info"]'),
    document.querySelector('div[role="dialog"][data-animate-modal="true"]'),
    document.querySelector('aside[aria-label], [role="region"][aria-label]')
  ].filter(Boolean);

  const drawer = roots.find(_isVisible) || document;

  const aboutSection = drawer.querySelector(
    '.x13mwh8y.x1q3qbx4.x1wg5k15.x3psx0u.xat24cr.x1280gxy.x106a9eq.x1xnnf8n.x889kno.x18d9i69'
  );
  let candidates = [];

  if (aboutSection) {
    console.log('[CRM] Step: Found "About and phone number" section for copyable scan');
    candidates = Array.from(
      aboutSection.querySelectorAll('._ajxu .copyable-text, ._ajxt .copyable-text, .copyable-text.selectable-text')
    ).filter(_isVisible);
  }

  if (!candidates.length) {
    console.log('[CRM] Step: Falling back to general copyable-text scan');
    candidates = Array.from(
      drawer.querySelectorAll('._ajxu .copyable-text, ._ajxt .copyable-text, .copyable-text.selectable-text')
    ).filter(_isVisible);
  }

  const allPhones = [];
  for (const el of candidates) {
    const t = (el.innerText || el.textContent || '').trim();
    if (!t) continue;
    const phones = _findBdPhonesInText(t);
    if (phones.length) {
      console.log('[CRM] Step: copyable span text -> BD phones:', t, '=>', phones);
      allPhones.push(...phones);
    }
  }

  if (allPhones.length) {
    // Heuristic: choose the last one (often the primary WhatsApp number in these blocks)
    const chosen = allPhones[allPhones.length - 1];
    console.log('[CRM] Step: Found in copyable spans, chosen:', chosen, 'all:', allPhones);
    return chosen;
  }

  console.log('[CRM] Step: No number found in copyable spans');
  return null;
}

const DBG = true; // set to true to log paths
/**
 * Aggregator with a short settle wait
 */
async function extractPhoneNumber() {
  console.log('[CRM] Starting phone extraction');
  // Prioritize left pane and non-drawer sources first
  let n =
    _extractFromDataAttrs() ||
    // _extractFromLeftPaneSelected() ||
    _extractFromHeaderTel() ||
    _extractFromHeaderAria() ||
    _extractFromHeaderText() ||
    _extractFromUrl();
  if (_hasMinLen(n)) {
    console.log(`[CRM] Extraction complete (non-drawer): ${n}`);
    return _onlyDigits(n);
  }
  // If no contact found in left pane or quick sources, fall back to drawer/sidebar
  console.log('[CRM] No quick/left pane number found, falling back to drawer');
  // If this is a LID (business) chat, don't trust data-* numbers — open the drawer early.
  if (_hasLidContext()) {
    // Quick wins first (sometimes header shows the phone)
    n =
      _extractFromHeaderTel() ||
      _extractFromHeaderAria() ||
      _extractFromHeaderText() ||
      _extractFromUrl();
    // _extractFromLeftPaneSelected();
    if (DBG) console.debug('[CRM] extracted via <PATH>', n);
    if (_hasMinLen(n)) {
      console.log(`[CRM] Extraction complete (LID quick): ${n}`);
      return _onlyDigits(n);
    }
    // Aggressive info-drawer scrape (longer waits for business profile)
    n = await _extractFromInfoDrawer({ aggressive: true });
    if (DBG) console.debug('[CRM] extracted via <PATH>', n);
    // Some builds only render the phone as plain text copyable row
    if (!_hasMinLen(n)) {
      n = _extractFromDrawerCopyableSpan();
    }
    if (_hasMinLen(n)) {
      console.log(`[CRM] Extraction complete (LID drawer): ${n}`);
      return _onlyDigits(n);
    }
    // As a last resort, try URL/left pane again
    // n = _extractFromUrl() || _extractFromLeftPaneSelected();
    n = _extractFromUrl();
    if (_hasMinLen(n)) {
      console.log(`[CRM] Extraction complete (LID last resort): ${n}`);
      return _onlyDigits(n);
    }
    console.log('[CRM] Extraction failed (LID)');
    return null;
  }
  // Non-LID path (regular personal accounts)
  n =
    _extractFromDataAttrs() ||
    _extractFromHeaderTel() ||
    _extractFromHeaderAria() ||
    _extractFromHeaderText() ||
    _extractFromUrl();
  // _extractFromLeftPaneSelected();
  if (_hasMinLen(n)) {
    console.log(`[CRM] Extraction complete (non-LID quick): ${n}`);
    return _onlyDigits(n);
  }
  // Let DOM settle a bit more
  // Let DOM settle a bit more (shorter & faster)
  const deadline = Date.now() + 600; // was 5000
  while (Date.now() < deadline) {
    n =
      _extractFromDataAttrs() ||
      _extractFromHeaderTel() ||
      _extractFromHeaderAria() ||
      _extractFromHeaderText() ||
      _extractFromUrl();
    // _extractFromLeftPaneSelected();
    if (_hasMinLen(n)) {
      console.log(`[CRM] Extraction complete (settle loop): ${n}`);
      return _onlyDigits(n);
    }
    await _sleep(80); // was 150
  }

  // Final fallback to drawer, avoiding header text to prevent conversation number pickup
  console.log('[CRM] Settle failed, using final drawer fallback');
  n = await _extractFromInfoDrawer();
  if (!_hasMinLen(n)) {
    n = _extractFromDrawerCopyableSpan();
  }
  if (_hasMinLen(n)) {
    console.log(`[CRM] Extraction complete (final drawer): ${n}`);
    return _onlyDigits(n);
  }
  console.log('[CRM] Extraction failed completely');
  return null;
}
// --- END UNIVERSAL PHONE EXTRACTION ---


// --- KEY CHANGE: This function resizes the main WhatsApp view ---
function adjustWhatsAppLayout() {
  const app = document.querySelector('#app');
  if (app) {
    // The iframe width is 350px. We'll set the app width to be the
    // full screen minus the iframe width, plus a little margin.
    app.style.width = 'calc(100% - 290px)';
    app.style.transition = 'width 0.3s ease-in-out';
  }
}

function injectIframe() {
  if (document.getElementById('sheet-viewer-iframe')) return;
  const iframe = document.createElement('iframe');
  iframe.id = 'sheet-viewer-iframe';
  iframe.src = chrome.runtime.getURL('panel.html');
  document.body.appendChild(iframe);

  // Call the layout adjustment function as soon as the iframe is added
  adjustWhatsAppLayout();
}

// Unified runner so clicks + hashchange + mutations all behave the same
let _isExtractingNow = false;
let _lastDigitsSent = null;

async function runExtractionAndSearch(reason = 'unknown') {
  if (_isExtractingNow) {
    console.log('[CRM] Skipping runExtractionAndSearch, already running');
    return;
  }
  _isExtractingNow = true;
  try {
    console.log('[CRM] runExtractionAndSearch, reason =', reason);
    const fullPhoneNumber = await extractPhoneNumber();
    if (!fullPhoneNumber) {
      console.log('[CRM] No phone extracted for reason =', reason);
      return;
    }
    const last6Digits = fullPhoneNumber.slice(-6);
    if (last6Digits === _lastDigitsSent) {
      console.log('[CRM] Same last6Digits as previous, skipping send:', last6Digits);
      return;
    }
    _lastDigitsSent = last6Digits;
    console.log(`Step 1: Sending last 6 digits to search -> ${last6Digits}`);
    chrome.runtime.sendMessage({ action: 'searchLast6Digits', digits: last6Digits });
  } finally {
    _isExtractingNow = false;
  }
}

function initChatSearchListener() {
  // We wait for the main #app container to exist. This is a stable, high-level element.
  const appContainer = document.querySelector('#app');
  if (!appContainer) {
    setTimeout(initChatSearchListener, 500); // Try again if it's not loaded yet
    return;
  }

  // SINGLE click listener on the app container:
  appContainer.addEventListener('click', (event) => {
    const chatTarget = event.target.closest(
      '[data-testid="cell-frame-container"], [role="listitem"], [role="row"], [data-id*="@c.us"], div[role="row"][aria-selected="true"]'
    );
    if (!chatTarget) return; // Ignore non-chat clicks

    // Let WhatsApp update its UI first, then run extraction
    setTimeout(() => runExtractionAndSearch('click'), 130);
  });

  console.log("WhatsApp CRM: Universal chat click listener is now active.");
}

// Extra robustness: react to hash changes and header mutations too
function initDomObservers() {
  // Hashchange -> navigation between chats
  window.addEventListener('hashchange', () => {
    setTimeout(() => runExtractionAndSearch('hashchange'), 130);
  });


  // MutationObserver on #main to detect header/conversation swaps
  const attachObserver = () => {
    const mainEl = document.querySelector('#main');
    if (!mainEl) {
      setTimeout(attachObserver, 1000);
      return;
    }
    const mo = new MutationObserver((mutations) => {
      let headerTouched = false;
      for (const m of mutations) {
        const t = m.target;
        if (!(t instanceof HTMLElement)) continue;
        if (t.closest && t.closest('#main header, [data-testid="conversation-header"], [data-testid="conversation-info-header"]')) {
          headerTouched = true;
          break;
        }
      }
      if (headerTouched) {
        setTimeout(() => runExtractionAndSearch('mutation'), 150);
      }

    });
    mo.observe(mainEl, { childList: true, subtree: true });
    console.log('[CRM] MutationObserver attached to #main');
  };

  attachObserver();
}

injectIframe();
initChatSearchListener();
initDomObservers();

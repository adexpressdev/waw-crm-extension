// ---phoneExtractor.js---
// Universal Phone Extraction Module for WhatsApp CRM
// Single source of truth for all phone number extraction logic

console.log('[CRM] Phone extractor module loaded')

// --- UTILITY FUNCTIONS ---
const _sleep = (ms) => new Promise(r => setTimeout(r, ms))
const _onlyDigits = (s) => (s || '').replace(/[^\d]/g, '')
const _hasMinLen = (s, len = 8) => _onlyDigits(s).length >= len

// Element must be in the current layout and not hidden
const _isVisible = (el) => {
    if (!el) return false
    const st = getComputedStyle(el)
    if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
}

// --- BD PHONE REGEX ---
// Helper: find all BD-style mobile numbers in WhatsApp format: +880 1722-626327
function _findBdPhonesInText(text) {
    if (!text) return []
    console.log(`[CRM] _findBdPhonesInText: input="${text}"`)
    const out = []
    const seen = new Set()

    // WhatsApp format: +880 1722-626327 (country code + space + 4 digits + dash + 6 digits)
    const bdPhoneRegex = /\+880\s\d{4}-\d{6}/g
    const matches = text.matchAll(bdPhoneRegex)

    for (const match of matches) {
        const phone = match[0]
        // Extract just the digits for deduplication and storage
        const digits = _onlyDigits(phone)

        if (!seen.has(digits)) {
            console.log(`[CRM] _findBdPhonesInText: Found BD phone: ${phone} (digits: ${digits})`)
            out.push(digits)
            seen.add(digits)
        }
    }

    console.log(`[CRM] _findBdPhonesInText: returning ${out.length} phone(s):`, out)
    return out
}

// --- DATA ATTRIBUTE EXTRACTION ---
/**
 * 1) Attribute sweep: works across old/new DOMs and locales
 */
function _extractFromDataAttrs() {
    console.log('[CRM] Step: Trying _extractFromDataAttrs')
    // Try multiple selectors for the main chat area
    const root = document.querySelector('#main') ||
        document.querySelector('[data-testid="conversation-panel"]') ||
        document.querySelector('div[tabindex="-1"][data-tab]')
    if (!root || !_isVisible(root)) {
        console.log('[CRM] Step: No visible main chat root found')
        return null
    }
    const selectors = [
        '[data-id]',
        '[data-jid]',
        '[data-chatid]',
        '[data-conversation-id]'
    ].join(',')
    const nodes = Array.from(root.querySelectorAll(selectors)).filter(_isVisible)
    for (const el of nodes) {
        for (const attr of ['data-id', 'data-jid', 'data-chatid', 'data-conversation-id']) {
            const raw = el.getAttribute?.(attr)
            if (!raw) continue
            if (/@lid_/i.test(raw)) continue // LID is not a phone
            const m = raw.match(/(?:^|_)(\d{6,})(?=@(?:c\.us|s\.whatsapp\.net)|$)/)
            if (m && _hasMinLen(m[1])) {
                console.log(`[CRM] Step: Found in ${attr}: ${m[1]}`)
                return m[1]
            }
        }
    }
    console.log('[CRM] Step: No phone found in data attrs')
    return null
}

// --- LID CONTEXT DETECTION ---
function _hasLidContext() {
    console.log('[CRM] Step: Checking for LID context')
    const hasLid = !!document.querySelector([
        '#main [data-id*="@lid_"]',
        '#main [data-jid*="@lid_"]',
        '[aria-selected="true"] [data-id*="@lid_"]',
        '[aria-selected="true"] [data-jid*="@lid_"]'
    ].join(','))
    console.log(`[CRM] Step: LID context: ${hasLid}`)
    return hasLid
}

// --- HEADER EXTRACTION METHODS ---
/**
 * 2) Direct tel: link in header (some layouts expose it)
 */
function _extractFromHeaderTel() {
    console.log('[CRM] Step: Trying _extractFromHeaderTel')
    const header = document.querySelector(
        '#main header, [data-testid="conversation-header"], [data-testid="conversation-info-header"], [role="banner"]'
    )
    if (!header) {
        console.log('[CRM] Step: No header found')
        return null
    }
    const tel = header.querySelector('a[href^="tel:"]')
    if (tel) {
        const n = _onlyDigits(tel.getAttribute('href'))
        if (_hasMinLen(n)) {
            console.log(`[CRM] Step: Found in tel link: ${n}`)
            return n
        }
    }
    console.log('[CRM] Step: No tel link or invalid number')
    return null
}

/**
 * 3) Header text fallback (unsaved numbers often show as plain text)
 */
function _extractFromHeaderText() {
    console.log('[CRM] Step: Trying _extractFromHeaderText')
    const header =
        document.querySelector('#main header') ||
        document.querySelector('[data-testid="conversation-header"]') ||
        document.querySelector('[data-testid="conversation-info-header"]') ||
        document.querySelector('[role="banner"]')
    if (!header) {
        console.log('[CRM] Step: No header found')
        return null
    }
    // Try to limit to the title/name area if possible
    const nameNode =
        header.querySelector('[data-testid="conversation-info-header"] [title]') ||
        header.querySelector('[data-testid="conversation-header"] [title]') ||
        header.querySelector('h2[title], h1[title], span[title]') ||
        header
    const txt = (nameNode.innerText || nameNode.textContent || '').trim()
    const rx = /(\+?\d[\d\s\-().]{6,})/g
    let best = null, m
    while ((m = rx.exec(txt))) {
        const d = _onlyDigits(m[1])
        if (_hasMinLen(d) && (!best || d.length > best.length)) best = d
    }
    if (best) {
        console.log(`[CRM] Step: Found in header text: ${best}`)
    } else {
        console.log('[CRM] Step: No number found in header text')
    }
    return best
}

// Some builds store the phone in an aria-label on the header button
function _extractFromHeaderAria() {
    console.log('[CRM] Step: Trying _extractFromHeaderAria')
    const targets = [
        '#main header [role="button"][aria-label]',
        '#main header [aria-label]',
        '[data-testid="conversation-header"] [aria-label]',
        '[data-testid="conversation-info-header"] [aria-label]'
    ]
    for (const sel of targets) {
        const el = document.querySelector(sel)
        if (!el) continue
        const label = el.getAttribute('aria-label') || ''
        const n = _onlyDigits(label)
        if (_hasMinLen(n)) {
            console.log(`[CRM] Step: Found in aria-label: ${n}`)
            return n
        }
    }
    console.log('[CRM] Step: No number found in header aria')
    return null
}

/**
 * Extracts phone from subtitle/secondary text below contact name
 * (When contact is saved, WhatsApp shows name on top and phone number below)
 * Uses optimized approach: target specific selectors + BD phone regex
 */
function _extractFromHeaderSubtitle() {
    console.log('[CRM] Step: Trying _extractFromHeaderSubtitle')

    // Try multiple container selectors - phone can be in header or section
    const containers = [
        document.querySelector('#main header'),
        document.querySelector('#main section'),
        document.querySelector('[data-testid="conversation-header"]'),
        document.querySelector('[data-testid="conversation-info-header"]'),
        document.querySelector('#main')  // Fallback to entire main area
    ].filter(Boolean)

    if (!containers.length) {
        console.log('[CRM] Step: No container found')
        return null
    }

    for (const container of containers) {
        if (!_isVisible(container)) continue

        console.log(`[CRM] Step: Checking container ${container.tagName || 'unknown'}`)

        // PRIORITY 1: Target selectable-text and copyable-text (WhatsApp's standard for phone numbers)
        const prioritySelectors = [
            '[data-testid="selectable-text"].copyable-text',
            'span.copyable-text[data-testid="selectable-text"]',
            '.copyable-text._ao3e._aupe',
            'span.copyable-text'
        ]

        for (const selector of prioritySelectors) {
            const elements = container.querySelectorAll(selector)
            console.log(`[CRM] Step: Found ${elements.length} elements for selector: ${selector}`)

            for (const el of elements) {
                if (!_isVisible(el)) continue

                const txt = (el.textContent || '').trim()
                if (!txt || txt.length < 8) continue

                console.log(`[CRM] Step: Checking copyable text: "${txt}"`)

                // Use the existing BD phone finder
                const phones = _findBdPhonesInText(txt)
                if (phones.length > 0) {
                    const chosen = phones[0] // Take first match
                    console.log(`[CRM] Step: Found BD phone in copyable text: ${chosen}`)
                    return chosen
                }
            }
        }

        // PRIORITY 2: Scan spans in divs with class x1evy7pa, x1anpbxc (subtitle area)
        const subtitleDivs = container.querySelectorAll('div.x1evy7pa.x1anpbxc, div.x1c4vz4f.xs83m0k')
        console.log(`[CRM] Step: Found ${subtitleDivs.length} subtitle divs`)

        for (const div of subtitleDivs) {
            if (!_isVisible(div)) continue

            const spans = div.querySelectorAll('span')
            for (const span of spans) {
                const txt = (span.textContent || '').trim()
                if (!txt || txt.length < 8) continue

                const phones = _findBdPhonesInText(txt)
                if (phones.length > 0) {
                    const chosen = phones[0]
                    console.log(`[CRM] Step: Found BD phone in subtitle div span: ${chosen}`)
                    return chosen
                }
            }
        }

        // PRIORITY 3: Generic scan with phone-like pattern
        const allSpans = Array.from(container.querySelectorAll('span')).filter(_isVisible)
        console.log(`[CRM] Step: Fallback scan of ${allSpans.length} spans`)

        for (const span of allSpans) {
            const txt = (span.textContent || '').trim()

            // Only check text that looks like it could be a phone number
            if (!txt || txt.length < 8) continue
            if (!txt.match(/[\d\+]/)) continue // Must contain digit or +

            const phones = _findBdPhonesInText(txt)
            if (phones.length > 0) {
                const chosen = phones[0]
                console.log(`[CRM] Step: Found BD phone in fallback scan: ${chosen} from "${txt}"`)
                return chosen
            }
        }
    }

    console.log('[CRM] Step: No phone found in header subtitle')
    return null
}

// --- URL EXTRACTION ---
/**
 * 4) URL/hash fallback: wa.me, ?phone=, ?chat=, #/t/123..., etc.
 */
function _extractFromUrl() {
    console.log('[CRM] Step: Trying _extractFromUrl')
    try {
        const u = new URL(String(location.href))
        // Common query params
        for (const p of ['phone', 'chat', 'jid', 'id', 'number']) {
            const v = u.searchParams.get(p)
            if (v) {
                const mx = v.match(/(\d{6,})(?=@(?:c\.us|s\.whatsapp\.net)|$)/)
                const n = mx ? mx[1] : _onlyDigits(v)
                if (_hasMinLen(n)) {
                    console.log(`[CRM] Step: Found in URL param ${p}: ${n}`)
                    return n
                }
            }
        }
        // Hash patterns: #/t/123..., #/c/123..., #...&chat=123...
        const h = u.hash || ''
        let hm =
            h.match(/(?:^|[/?&])(t|c|chat|jid)=?(\d{6,})/i) ||
            h.match(/\/(t|c)\/(\d{6,})/i)
        if (hm && _hasMinLen(hm[2])) {
            console.log(`[CRM] Step: Found in hash: ${hm[2]}`)
            return hm[2]
        }
        // Path digits: /1234567890 or /1234567890@s.whatsapp.net
        const pm = (u.pathname || '').match(/(\d{6,})(?=@|$)/)
        if (pm && _hasMinLen(pm[1])) {
            console.log(`[CRM] Step: Found in pathname: ${pm[1]}`)
            return pm[1]
        }
    } catch (e) {
        console.log('[CRM] Step: Error in URL extraction:', e)
    }
    console.log('[CRM] Step: No number found in URL')
    return null
}

// --- LEFT PANE EXTRACTION ---
// Fallback: read from the selected row in the left chat list
function _extractFromLeftPaneSelected() {
    console.log('[CRM] Step: Trying _extractFromLeftPaneSelected')

    // Collect all visible chat rows in the left pane
    const allRows = Array.from(document.querySelectorAll(
        '[data-testid="cell-frame-container"], [role="row"], [role="listitem"]'
    )).filter(_isVisible)

    if (!allRows.length) {
        console.log('[CRM] Step: No visible chat rows found in left pane')
        return null
    }

    // Prefer an explicitly "selected" row if we can detect one
    let selected = allRows.find(el =>
        el.getAttribute('aria-selected') === 'true' ||
        el.getAttribute('data-selected') === 'true'
    )

    // If nothing is explicitly selected, fall back to the row with the largest on-screen area
    if (!selected) {
        const best = allRows
            .map(el => {
                const r = el.getBoundingClientRect()
                const w = Math.max(0, Math.min(window.innerWidth, r.right) - Math.max(0, r.left))
                const h = Math.max(0, Math.min(window.innerHeight, r.bottom) - Math.max(0, r.top))
                return { el, area: w * h }
            })
            .sort((a, b) => b.area - a.area)[0]
        selected = best?.el || allRows[0]
    }

    if (!selected) {
        console.log('[CRM] Step: No suitable candidate row in left pane')
        return null
    }

    // data-* first (skip LID)
    for (const attr of ['data-id', 'data-jid', 'data-chatid', 'data-conversation-id']) {
        const raw = selected.getAttribute?.(attr)
        if (!raw) continue
        if (/@lid_/i.test(raw)) continue
        const m = raw.match(/(?:^|_)(\d{6,})(?=@(?:c\.us|s\.whatsapp\.net)|$)/)
        if (m && _hasMinLen(m[1])) {
            console.log(`[CRM] Step: Found in left pane ${attr}: ${m[1]}`)
            return m[1]
        }
    }
    // then visible text/title
    const titleEl =
        selected.querySelector('[data-testid="cell-frame-title"] [title]') ||
        selected.querySelector('[title]') ||
        selected.querySelector('span[dir="auto"]')
    const txt = (titleEl?.getAttribute?.('title') || titleEl?.innerText || selected.innerText || '').trim()
    const rx = /(\+?\d[\d\s\-().]{6,})/g
    let bestDigits = null, m
    while ((m = rx.exec(txt))) {
        const d = _onlyDigits(m[1])
        if (_hasMinLen(d) && (!bestDigits || d.length > bestDigits.length)) bestDigits = d
    }
    if (bestDigits) {
        console.log(`[CRM] Step: Found in left pane text: ${bestDigits}`)
    } else {
        console.log('[CRM] Step: No number found in left pane text')
    }
    return bestDigits
}

// --- DRAWER DETECTION ---
/**
 * Detects if the contact info drawer is currently open.
 * When open, the drawer container gains classes: x1c4vz4f x2lah0s
 * and contains a section with the contact details.
 */
function _isDrawerOpen() {
    console.log('[CRM] Step: Checking if drawer is open...')

    // Primary detection: section with these specific classes inside drawer area
    const section = document.querySelector('section.x1c4vz4f.x2lah0s')
    if (section) {
        console.log('[CRM] Step: Found section.x1c4vz4f.x2lah0s, checking visibility...')
        if (_isVisible(section)) {
            console.log('[CRM] Step: Drawer detected via section.x1c4vz4f.x2lah0s')
            return section
        }
    }

    // Check for drawer container that has expanded (gained x1c4vz4f x2lah0s classes)
    // The drawer container is div._aig-._as6h that gains these classes when open
    const expandedDrawer = document.querySelector('div._aig-._as6h.x1c4vz4f.x2lah0s')
    if (expandedDrawer && _isVisible(expandedDrawer)) {
        console.log('[CRM] Step: Drawer detected via div._aig-._as6h.x1c4vz4f.x2lah0s')
        // Return the section inside if it exists, otherwise the container
        const innerSection = expandedDrawer.querySelector('section')
        return innerSection || expandedDrawer
    }

    // Alternative: look for header with "Contact info" title
    const contactInfoHeader = document.querySelector('header h2')
    if (contactInfoHeader) {
        const headerText = contactInfoHeader.textContent || ''
        if (headerText.includes('Contact info') || headerText.includes('contact info')) {
            const section = contactInfoHeader.closest('section') ||
                contactInfoHeader.closest('div.copyable-area')?.querySelector('section')
            if (section && _isVisible(section)) {
                console.log('[CRM] Step: Drawer detected via "Contact info" header')
                return section
            }
        }
    }

    // Look for the copyable-area div that contains contact info
    const copyableAreas = document.querySelectorAll('div.copyable-area')
    for (const area of copyableAreas) {
        // Check if this area has contact info structure (profile image, name, phone subtitle)
        const hasSubtitle = area.querySelector('div.x1evy7pa.x1anpbxc')
        const hasCloseBtn = area.querySelector('button[aria-label="Close"]')
        if (hasSubtitle && hasCloseBtn && _isVisible(area)) {
            console.log('[CRM] Step: Drawer detected via copyable-area with subtitle and close button')
            return area
        }
    }

    // Legacy selectors for older WhatsApp versions
    const legacyDrawer =
        document.querySelector('[data-testid="conversation-info-drawer"]') ||
        document.querySelector('[data-testid="contact-info"]') ||
        document.querySelector('div[role="dialog"][data-animate-modal="true"]') ||
        document.querySelector('aside[aria-label], [role="region"][aria-label]')

    if (legacyDrawer && _isVisible(legacyDrawer)) {
        console.log('[CRM] Step: Drawer detected via legacy selector')
        return legacyDrawer
    }

    console.log('[CRM] Step: No drawer detected')
    return null
}

// --- DRAWER EXTRACTION ---
/**
 * Extracts phone number from the open drawer's contact info section.
 * Targets the specific DOM structure: div.x1evy7pa.x1anpbxc > span.copyable-text
 */
function _extractPhoneFromDrawerSection(drawer) {
    if (!drawer) return null

    // Scan the entire right-panel container, not just the sub-element returned by
    // _isDrawerOpen(), because the phone text may live anywhere inside the panel.
    // Walk up to find the widest enclosing panel (aside, div[role], etc.).
    const root = (() => {
        let el = drawer
        // Walk up until we hit a known panel boundary or document
        for (let i = 0; i < 8; i++) {
            const p = el.parentElement
            if (!p || p === document.body) break
            const tag = p.tagName?.toLowerCase()
            const role = p.getAttribute?.('role')
            if (tag === 'aside' || role === 'region' || role === 'dialog') { el = p; break }
            el = p
        }
        return el
    })()
    console.log(`[CRM] Step: Scanning drawer root: ${root.tagName}.${[...root.classList].join('.')}`)

    // PRIMARY: All copyable-text and selectable-text elements (WhatsApp's standard)
    const copyableSelectors = [
        'span.copyable-text[data-testid="selectable-text"]',
        '[data-testid="selectable-text"].copyable-text',
        'span.copyable-text',
        '.copyable-text'
    ]
    for (const sel of copyableSelectors) {
        const elements = root.querySelectorAll(sel)
        console.log(`[CRM] Step: Checking ${elements.length} elements for selector "${sel}"`)
        for (const el of elements) {
            if (!_isVisible(el)) continue
            const txt = (el.textContent || '').trim()
            if (!txt || txt.length < 8) continue
            const phones = _findBdPhonesInText(txt)
            if (phones.length > 0) {
                console.log(`[CRM] Step: Found phone in copyable element: ${phones[0]}`)
                return phones[0]
            }
        }
    }

    // SECONDARY: Text walker over every visible text node in the panel
    console.log('[CRM] Step: Running text walker over entire drawer root')
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
    let node
    while ((node = walker.nextNode())) {
        if (!node.parentElement || !_isVisible(node.parentElement)) continue
        const t = (node.nodeValue || '').trim()
        if (!t || t.length < 8 || !t.match(/[\d\+]/)) continue
        const phones = _findBdPhonesInText(t)
        if (phones.length) {
            console.log(`[CRM] Step: Found BD phone via text walker: "${t}" => ${phones[0]}`)
            return phones[0]
        }
    }

    console.log('[CRM] Step: No BD phone found anywhere in drawer')
    return null
}

async function _extractFromInfoDrawer({ aggressive = false } = {}) {
    console.log(`[CRM] Step: Trying _extractFromInfoDrawer (aggressive: ${aggressive})`)

    let drawer = _isDrawerOpen()
    let openedHere = false

    // 1) Open drawer if not already open
    if (!drawer) {
        console.log('[CRM] Step: Drawer not open, attempting to click header to open')

        // Click the contact name / avatar area to open "Contact info" drawer.
        // IMPORTANT: Do NOT target generic buttons — the first button in #main header
        // is the Search button which opens "Search messages" instead.
        const headerSelectors = [
            // Best: the dedicated info-header clickable region
            '[data-testid="conversation-info-header"]',
            '#main header [data-testid="conversation-info-header-chat-title"]',
            '#main header span[data-testid="conversation-info-header-chat-title"]',
            // Avatar / profile image
            '#main header [data-testid="default-user"]',
            '#main header img[draggable="false"]',
            // Role=button on the name/contact area (not the icon buttons on the right)
            '#main header [role="button"]:first-of-type',
            // Whole header as last resort (WhatsApp handles click → contact info)
            '#main header'
        ]

        let headerClickable = null
        for (const sel of headerSelectors) {
            headerClickable = document.querySelector(sel)
            if (headerClickable && _isVisible(headerClickable)) {
                console.log(`[CRM] Step: Found clickable header with: ${sel}`)
                break
            }
            headerClickable = null
        }

        if (!headerClickable) {
            console.log('[CRM] Step: No header clickable found to open drawer')
            // Debug: log what headers exist
            const anyHeader = document.querySelector('#main header')
            if (anyHeader) {
                console.log(`[CRM] Debug: #main header exists but no clickable found. HTML snippet: ${anyHeader.innerHTML?.slice(0, 200)}`)
            } else {
                console.log('[CRM] Debug: #main header does not exist')
            }
            return null
        }

        const dispatchTrustedLikeClick = (el) => {
            if (!el) return false
            // Dispatch directly on the found element — do NOT walk up to a parent button,
            // because walking up from the contact-name area could land on the Search/Menu button.
            try {
                el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
                el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
                el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
                el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
                el.click?.()
                return true
            } catch (e) {
                console.log('[CRM] Step: Click dispatch failed:', e)
                return false
            }
        }

        console.log(`[CRM] Step: Clicking header element: ${headerClickable.tagName}`)
        dispatchTrustedLikeClick(headerClickable)
        openedHere = true

        // Wait for drawer to appear and render (up to ~2s for aggressive, ~1s normal)
        const spins = aggressive ? 36 : 18
        for (let i = 0; i < spins; i++) {
            await _sleep(70)
            drawer = _isDrawerOpen()
            if (drawer) {
                console.log(`[CRM] Step: Drawer opened on attempt ${i + 1}`)
                // Give it a moment to fully render content
                await _sleep(150)
                break
            }

            // Retry click once midway if still closed (WhatsApp UI can be racey)
            if (i === Math.floor(spins / 2)) {
                console.log('[CRM] Step: Drawer still closed, retrying header click')
                dispatchTrustedLikeClick(headerClickable)
            }
        }
    }

    if (!drawer) {
        console.log('[CRM] Step: Drawer not visible after attempts')
        return null
    }

    // 2) Extract phone from drawer
    const phone = _extractPhoneFromDrawerSection(drawer)

    // Drawer is intentionally left open after extraction

    if (phone) {
        console.log(`[CRM] Step: Extracted from drawer: ${phone}`)
        return phone
    }

    console.log('[CRM] Step: No phone found in drawer')
    return null
}


// 5b) Direct scan of drawer rows where WhatsApp renders copyable phone text
function _extractFromDrawerCopyableSpan() {
    console.log('[CRM] Step: Trying _extractFromDrawerCopyableSpan')

    // Use the improved drawer detection
    const drawer = _isDrawerOpen()

    if (!drawer) {
        console.log('[CRM] Step: Drawer not open for copyable span extraction')
        return null
    }

    // Use the unified extraction function
    const phone = _extractPhoneFromDrawerSection(drawer)
    if (phone) {
        console.log(`[CRM] Step: Found in copyable spans: ${phone}`)
        return phone
    }

    console.log('[CRM] Step: No number found in copyable spans')
    return null
}

// --- MAIN AREA WAIT ---
/**
 * Wait for the main chat area to be visible
 */
async function _waitForMainArea(maxWait = 2000) {
    const start = Date.now()
    while (Date.now() - start < maxWait) {
        const main = document.querySelector('#main') || document.querySelector('[data-testid="conversation-panel"]')
        if (main && _isVisible(main)) {
            console.log('[CRM] Main area is ready.')
            return main
        }
        await _sleep(50)
    }
    console.log(`[CRM] Main area not ready after waiting ${maxWait}ms!`)
    return null
}

const DBG = true // set to true to log paths

// --- MAIN EXTRACTION ORCHESTRATOR ---
/**
 * Aggregator with a short settle wait
 */
async function extractPhoneNumber() {
    console.log('[CRM] Starting phone extraction...')

    await _waitForMainArea(1500)

    let n = null

    // Drawer-only extraction: open drawer, extract phone, leave drawer open
    console.log('[CRM] Opening drawer for extraction...')
    const isLid = _hasLidContext()
    n = await _extractFromInfoDrawer({ aggressive: isLid })
    if (!_hasMinLen(n)) {
        n = _extractFromDrawerCopyableSpan()
    }
    if (_hasMinLen(n)) {
        console.log(`[CRM] Extraction complete (drawer): ${n}`)
        return _onlyDigits(n)
    }

    console.log('[CRM] Extraction failed: no phone found in drawer')
    return null
}

// --- EXPORTS (for use by content.js) ---
// Note: Content scripts share the same global scope, so these are available globally

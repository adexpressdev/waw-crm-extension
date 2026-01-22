### Old `extractPhoneNumber` function

```javascript
async function extractPhoneNumber() {
  console.log("[CRM] Starting phone extraction");

  // Wait for main area to be ready first
  await _waitForMainArea(1500);

  // Prioritize left pane and non-drawer sources first.
  let n =
    _extractFromDataAttrs() ||
    _extractFromLeftPaneSelected() ||
    _extractFromHeaderTel() ||
    _extractFromHeaderAria() ||
    _extractFromHeaderSubtitle() ||
    _extractFromHeaderText() ||
    _extractFromUrl();

  if (_hasMinLen(n)) {
    console.log(`[CRM] Extraction complete (non-drawer): ${n}`);
    return _onlyDigits(n);
  }
  
  // If no contact found in left pane or quick sources, fall back to drawer/sidebar
  console.log("[CRM] No quick/left pane number found, falling back to drawer");
  // If this is a LID (business) chat, don't trust data-* numbers — open the drawer early.
  if (_hasLidContext()) {
    // Quick wins first (sometimes header shows the phone)
    n =
      // _extractFromHeaderTel() ||
      _extractFromHeaderSubtitle(); // NEW: Try subtitle for saved contacts
    // _extractFromHeaderAria()
    // _extractFromHeaderText()
    // _extractFromUrl()
    // _extractFromLeftPaneSelected()
    if (DBG) console.debug("[CRM] extracted via <PATH>", n);
    if (_hasMinLen(n)) {
      console.log(`[CRM] Extraction complete (LID quick): ${n}`);
      return _onlyDigits(n);
    }
    // Aggressive info-drawer scrape (longer waits for business profile)
    n = await _extractFromInfoDrawer({ aggressive: true });
    if (DBG) console.debug("[CRM] extracted via <PATH>", n);
    // Some builds only render the phone as plain text copyable row
    if (!_hasMinLen(n)) {
      n = _extractFromDrawerCopyableSpan();
    }
    if (_hasMinLen(n)) {
      console.log(`[CRM] Extraction complete (LID drawer): ${n}`);
      return _onlyDigits(n);
    }
    // As a last resort, try URL/left pane again
    // n = _extractFromUrl() || _extractFromLeftPaneSelected()
    n = _extractFromUrl();
    if (_hasMinLen(n)) {
      console.log(`[CRM] Extraction complete (LID last resort): ${n}`);
      return _onlyDigits(n);
    }
    console.log("[CRM] Extraction failed (LID)");
    return null;
  }
  // Non-LID path (regular personal accounts)
  n =
    _extractFromDataAttrs() ||
    // _extractFromHeaderTel() ||
    _extractFromHeaderSubtitle(); // NEW: Try subtitle for saved contacts
  // _extractFromHeaderAria()
  // _extractFromHeaderText() ||
  // _extractFromUrl()
  // _extractFromLeftPaneSelected()
  if (_hasMinLen(n)) {
    console.log(`[CRM] Extraction complete (non-LID quick): ${n}`);
    return _onlyDigits(n);
  }
  // Let DOM settle a bit more (shorter & faster)
  const deadline = Date.now() + 600; // was 5000
  while (Date.now() < deadline) {
    n = _extractFromDataAttrs() || _extractFromHeaderSubtitle(); // NEW: Try subtitle for saved contacts
    // _extractFromHeaderTel() ||
    // _extractFromHeaderAria() ||
    // _extractFromHeaderText()
    // _extractFromUrl()
    // _extractFromLeftPaneSelected()
    if (_hasMinLen(n)) {
      console.log(`[CRM] Extraction complete (settle loop): ${n}`);
      return _onlyDigits(n);
    }
    await _sleep(80); // was 150
  }

  // Final fallback to drawer, avoiding header text to prevent conversation number pickup
  console.log("[CRM] Settle failed, using final drawer fallback");
  n = await _extractFromInfoDrawer();
  if (!_hasMinLen(n)) {
    n = _extractFromDrawerCopyableSpan();
  }
  if (_hasMinLen(n)) {
    console.log(`[CRM] Extraction complete (final drawer): ${n}`);
    return _onlyDigits(n);
  }
  console.log("[CRM] Extraction failed completely");
  return null;
}
```

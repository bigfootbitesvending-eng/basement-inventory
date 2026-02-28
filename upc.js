// ============================================
// UPC UTILITIES
// Handles UPC-E to UPC-A expansion and normalization.
//
// UPC-E is a compressed 8-digit format (or 6-digit payload)
// used on small packages. Vending items like Hershey bars and
// Dr Pepper cans commonly use it. The scanner returns the raw
// UPC-E string; we must expand it to UPC-A (12 digits) before
// matching against database entries.
// ============================================

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.UpcUtils = factory();
  }
}(typeof window !== 'undefined' ? window : global, function () {

  /**
   * Calculate the UPC-A check digit for an 11-digit string.
   * Standard odd/even weighting: odd positions × 3, sum, mod 10.
   * @param {string} s11 - exactly 11 digits (no check digit yet)
   * @returns {string} single check digit character
   */
  function calcCheckDigit(s11) {
    var odd = 0, even = 0;
    for (var i = 0; i < 11; i++) {
      var d = parseInt(s11[i], 10);
      if (i % 2 === 0) { odd += d; } else { even += d; }
    }
    return String((10 - ((odd * 3 + even) % 10)) % 10);
  }

  /**
   * Expand a UPC-E barcode to its full UPC-A equivalent.
   *
   * Accepts:
   *   8 digits — number system + 6 payload + check digit (standard scanner output)
   *   7 digits — number system + 6 payload (no check)
   *   6 digits — bare 6-digit payload (number system assumed 0)
   *
   * Expansion rules based on last payload digit (e[5]):
   *   0,1,2 → manuf = e[0]e[1]e[2]e[5]0,  item = 000e[3]e[4]
   *   3     → manuf = e[0]e[1]e[2]e[3]0,   item = 0000e[4]
   *   4–9   → manuf = e[0]e[1]e[2]e[3]e[4], item = 0000e[5]
   *
   * @param {string} upce
   * @returns {string|null} 12-digit UPC-A, or null if input is invalid
   */
  function expandUpcE(upce) {
    var s = String(upce).trim().replace(/\D/g, '');

    var ns, e;

    if (s.length === 8) {
      ns = s[0];
      e  = s.slice(1, 7);
      // s[7] is the original check digit — we recalculate to be safe
    } else if (s.length === 7) {
      ns = s[0];
      e  = s.slice(1, 7);
    } else if (s.length === 6) {
      ns = '0';
      e  = s;
    } else {
      return null;
    }

    if (!/^[01]$/.test(ns)) { return null; } // UPC-E only valid for NS 0 or 1
    if (e.length !== 6 || /\D/.test(e)) { return null; }

    var manuf, item;

    switch (e[5]) {
      case '0':
      case '1':
      case '2':
        manuf = e[0] + e[1] + e[2] + e[5] + '0';
        item  = '000' + e[3] + e[4];
        break;
      case '3':
        manuf = e[0] + e[1] + e[2] + e[3] + '0';
        item  = '0000' + e[4];
        break;
      default: // 4–9
        manuf = e[0] + e[1] + e[2] + e[3] + e[4];
        item  = '0000' + e[5];
        break;
    }

    var s11   = ns + manuf + item; // 11 digits
    var check = calcCheckDigit(s11);
    return s11 + check;            // 12-digit UPC-A
  }

  /**
   * Returns true if a raw scanned string looks like UPC-E.
   * UPC-E scanner output is 6, 7, or 8 digits.
   * UPC-A is 12, EAN-13 is 13 — neither needs expansion.
   * @param {string} raw
   * @returns {boolean}
   */
  function isUpcE(raw) {
    var s = String(raw).trim();
    return /^\d{6,8}$/.test(s);
  }

  /**
   * Normalize a UPC for database comparison.
   * Strips leading apostrophes (Sheets artifact) and leading zeros.
   * If the input looks like UPC-E, expand it first.
   * @param {string} upc
   * @returns {string}
   */
  function normalizeUpc(upc) {
    if (!upc) return '';
    var s = String(upc).trim().replace(/^'+/, '');

    if (isUpcE(s)) {
      var expanded = expandUpcE(s);
      if (expanded) { s = expanded; }
    }

    return s.replace(/^0+/, '');
  }

  return {
    expandUpcE:    expandUpcE,
    isUpcE:        isUpcE,
    normalizeUpc:  normalizeUpc,
    _calcCheckDigit: calcCheckDigit // exposed for testing only
  };

}));

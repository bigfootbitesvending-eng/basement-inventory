// ============================================
// upc.test.js
// ============================================

const { expandUpcE, isUpcE, normalizeUpc, _calcCheckDigit } = require('./upc');

// ---- _calcCheckDigit -------------------------------------------

describe('_calcCheckDigit()', () => {
  // Verify against known UPC-A values
  test('Hershey Kiss 8-digit — check digit is correct', () => {
    // UPC-A 01234500006X — manufactured example
    // Known: 012000000097 → check on "01200000009" = 7
    expect(_calcCheckDigit('01200000009')).toBe('7');
  });

  test('all zeros → check digit 0', () => {
    expect(_calcCheckDigit('00000000000')).toBe('0');
  });

  test('standard known UPC-A 012345678905', () => {
    expect(_calcCheckDigit('01234567890')).toBe('5');
  });
});

// ---- expandUpcE ------------------------------------------------

describe('expandUpcE()', () => {

  describe('8-digit input (standard scanner output)', () => {
    // e[5]=0 scheme: manuf=e0e1e2e50, item=000e3e4
    test('e[5]=0: expands to correct UPC-A', () => {
      // UPC-E: 0 + 123400 + check
      // payload e = 1 2 3 4 0 0 → e[5]=0
      // manuf = 1 2 3 0 0, item = 0 0 0 4 0... wait e[3]=4,e[4]=0 → item=00040? 
      // Let's use a clean example: payload=123450
      // e[5]=0: manuf=1 2 3 5 0=12350, item=000 4... hmm
      // e = [1,2,3,4,5,0]: e[5]=0 → manuf=e0e1e2e5+'0'=1230+'0'=12300... 
      // Wait: manuf = e[0]+e[1]+e[2]+e[5]+'0' = '1'+'2'+'3'+'0'+'0' = '12300'
      // item = '000'+e[3]+e[4] = '000'+'4'+'5' = '00045'
      // s11 = '0' + '12300' + '00045' = '01230000045'
      // check = calcCheckDigit('01230000045')
      // odd(0-indexed even): 0,1,2,0,0,0,0,4,5 positions 0,2,4,6,8,10 → 0+2+0+0+0+5=7 → *3=21
      // even (0-indexed odd): 1,3,0,0,0,4 → 1+3+0+0+0+4=8
      // total=21+8=29 → (10-(29%10))%10=(10-9)%10=1
      // UPC-A = '012300000451'
      const result = expandUpcE('01234500');  // 8-digit
      expect(result).toHaveLength(12);
      // Recompute inline for reference: payload='123450' (middle 6 of 01234500, but check digit is pos 7)
      // Actually 01234500: ns='0', e='123450', e[5]='0'
      // manuf = '1'+'2'+'3'+'0'+'0'='12300', item='000'+'4'+'5'='00045'
      // s11='01230000045', check computed above =1
      expect(result).toBe('012300000451');
    });

    test('e[5]=1: expands correctly', () => {
      // payload = 123451, e[5]=1
      // manuf = 1+2+3+1+0 = '12310', item='000'+'4'+'5'='00045'... wait e[3]=4,e[4]=5
      // UPC-E 8-digit: ns=0, e=123451, check=?  → input '01234510' (with dummy check)
      // ns='0', e='123451', e[5]='1'
      // manuf = e[0]+e[1]+e[2]+e[5]+'0' = '1'+'2'+'3'+'1'+'0' = '12310'
      // item = '000'+e[3]+e[4] = '000'+'4'+'5' = '00045'
      // s11 = '0'+'12310'+'00045' = '01231000045'
      // check: odd(pos 0,2,4,6,8,10)=0+2+1+0+0+5=8→*3=24; even(pos 1,3,5,7,9)=1+3+0+0+4=8; total=32→(10-2)%10=8
      // UPC-A = '012310000458'
      const result = expandUpcE('01234510');
      expect(result).toHaveLength(12);
      expect(result).toBe('012310000458');
    });

    test('e[5]=2: expands correctly', () => {
      // ns='0', e='123452', e[5]='2'
      // manuf = '1'+'2'+'3'+'2'+'0' = '12320', item='000'+'4'+'5'='00045'
      // s11 = '01232000045'
      // odd(0,2,4,6,8,10)=0+2+2+0+0+5=9→*3=27; even(1,3,5,7,9)=1+3+0+0+4=8; total=35→(10-5)%10=5
      // UPC-A = '012320000455'
      const result = expandUpcE('01234520');
      expect(result).toHaveLength(12);
      expect(result).toBe('012320000455');
    });

    test('e[5]=3: expands correctly', () => {
      // ns='0', e='123453', e[5]='3'
      // manuf = e[0]+e[1]+e[2]+e[3]+'0' = '1'+'2'+'3'+'4'+'0' = '12340'
      // item = '0000'+e[4] = '0000'+'5' = '00005'
      // s11 = '01234000005'
      // odd(0,2,4,6,8,10)=0+2+4+0+0+5=11→*3=33; even(1,3,5,7,9)=1+3+0+0+0=4; total=37→(10-7)%10=3
      // UPC-A = '012340000053'
      const result = expandUpcE('01234530');
      expect(result).toHaveLength(12);
      expect(result).toBe('012340000053');
    });

    test('e[5]=4: expands correctly', () => {
      // ns='0', e='123454', e[5]='4'
      // manuf = '12345', item = '00004'
      // s11 = '01234500004'
      // odd(pos 0,2,4,6,8,10)=0+2+4+0+0+4=10→*3=30; even(pos 1,3,5,7,9)=1+3+5+0+0=9; total=39→(10-9)%10=1
      // UPC-A = '012345000041'
      const result = expandUpcE('01234540');
      expect(result).toHaveLength(12);
      expect(result).toBe('012345000041');
    });

    test('e[5]=9: expands correctly (default branch)', () => {
      // ns='0', e='123459', e[5]='9'
      // manuf = '12345', item = '00009'
      // s11 = '01234500009'
      // odd=0+2+4+0+0+9=15→*3=45; even=1+3+5+0+0=9; total=54→(10-4)%10=6
      // UPC-A = '012345000096'
      const result = expandUpcE('01234590');
      expect(result).toHaveLength(12);
      expect(result).toBe('012345000096');
    });
  });

  describe('6-digit input (payload only)', () => {
    test('expands 6-digit UPC-E with assumed NS=0', () => {
      const result = expandUpcE('123450');
      expect(result).toHaveLength(12);
      expect(result[0]).toBe('0'); // NS defaulted to 0
    });
  });

  describe('7-digit input', () => {
    test('expands 7-digit UPC-E (NS + payload, no check)', () => {
      const result = expandUpcE('0123450');
      expect(result).toHaveLength(12);
    });
  });

  describe('invalid inputs', () => {
    test('returns null for empty string', () => {
      expect(expandUpcE('')).toBeNull();
    });

    test('returns null for 12-digit UPC-A (not UPC-E)', () => {
      expect(expandUpcE('012345000046')).toBeNull();
    });

    test('returns null for non-numeric input', () => {
      expect(expandUpcE('abc')).toBeNull();
    });

    test('returns null for NS digit other than 0 or 1', () => {
      expect(expandUpcE('91234560')).toBeNull();
    });
  });
});

// ---- isUpcE ----------------------------------------------------

describe('isUpcE()', () => {
  test('6 digits → true', () => expect(isUpcE('123456')).toBe(true));
  test('7 digits → true', () => expect(isUpcE('1234567')).toBe(true));
  test('8 digits → true', () => expect(isUpcE('12345678')).toBe(true));
  test('12 digits (UPC-A) → false', () => expect(isUpcE('012345000046')).toBe(false));
  test('13 digits (EAN-13) → false', () => expect(isUpcE('0123456789012')).toBe(false));
  test('5 digits → false', () => expect(isUpcE('12345')).toBe(false));
  test('non-numeric → false', () => expect(isUpcE('12345X')).toBe(false));
});

// ---- normalizeUpc ----------------------------------------------

describe('normalizeUpc()', () => {
  test('standard UPC-A: strips leading zeros', () => {
    expect(normalizeUpc('012345000046')).toBe('12345000046');
  });

  test('strips leading apostrophe (Sheets artifact)', () => {
    expect(normalizeUpc("'012345000046")).toBe('12345000046');
  });

  test('UPC-E 8-digit: expands then normalizes', () => {
    const result = normalizeUpc('01234540');
    // expands to '012345000041', then strips leading 0 → '12345000041'
    expect(result).toBe('12345000041');
  });

  test('UPC-E 6-digit: expands then normalizes', () => {
    const eight = normalizeUpc('01234540');
    const six   = normalizeUpc('123454');   // same payload, no NS/check
    // Both should produce the same normalized result
    expect(six).toBe(eight);
  });

  test('returns empty string for null', () => {
    expect(normalizeUpc(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(normalizeUpc(undefined)).toBe('');
  });

  test('UPC-A with no leading zeros: unchanged', () => {
    expect(normalizeUpc('123456789012')).toBe('123456789012');
  });
});

// ============================================
// session.test.js
// ============================================

const SessionManager = require('./session');

beforeEach(() => {
  SessionManager._reset();
});

// ---- start() -------------------------------------------------------

describe('start()', () => {
  test('activates a session with the given location', () => {
    SessionManager.start('Livano');
    expect(SessionManager.isActive()).toBe(true);
    expect(SessionManager.getLocation()).toBe('Livano');
  });

  test('trims whitespace from location', () => {
    SessionManager.start('  ATD  ');
    expect(SessionManager.getLocation()).toBe('ATD');
  });

  test('throws when location is an empty string', () => {
    expect(() => SessionManager.start('')).toThrow('Location is required to start a session');
  });

  test('throws when location is null', () => {
    expect(() => SessionManager.start(null)).toThrow('Location is required to start a session');
  });

  test('throws when location is undefined', () => {
    expect(() => SessionManager.start(undefined)).toThrow('Location is required to start a session');
  });

  test('replaces an existing active session', () => {
    SessionManager.start('Livano');
    SessionManager.start('Endeavor Elementary');
    expect(SessionManager.getLocation()).toBe('Endeavor Elementary');
  });

  test('returns the new session object', () => {
    const session = SessionManager.start('Walden');
    expect(session.location).toBe('Walden');
    expect(session.startedAt).toBeInstanceOf(Date);
  });
});

// ---- end() ---------------------------------------------------------

describe('end()', () => {
  test('deactivates an active session', () => {
    SessionManager.start('Livano');
    SessionManager.end();
    expect(SessionManager.isActive()).toBe(false);
  });

  test('getLocation() returns null after ending session', () => {
    SessionManager.start('Livano');
    SessionManager.end();
    expect(SessionManager.getLocation()).toBeNull();
  });

  test('is safe to call when no session is active', () => {
    expect(() => SessionManager.end()).not.toThrow();
  });

  test('getActive() returns null after ending', () => {
    SessionManager.start('ATD');
    SessionManager.end();
    expect(SessionManager.getActive()).toBeNull();
  });
});

// ---- getActive() ---------------------------------------------------

describe('getActive()', () => {
  test('returns null when no session exists', () => {
    expect(SessionManager.getActive()).toBeNull();
  });

  test('returns object with correct location and startedAt', () => {
    SessionManager.start('Walden');
    const session = SessionManager.getActive();
    expect(session.location).toBe('Walden');
    expect(session.startedAt).toBeInstanceOf(Date);
  });

  test('returns a copy — mutations do not affect internal state', () => {
    SessionManager.start('Livano');
    const session = SessionManager.getActive();
    session.location = 'MUTATED';
    expect(SessionManager.getLocation()).toBe('Livano');
  });

  test('each call returns a distinct object', () => {
    SessionManager.start('ATD');
    expect(SessionManager.getActive()).not.toBe(SessionManager.getActive());
  });
});

// ---- isActive() ----------------------------------------------------

describe('isActive()', () => {
  test('returns false with no session', () => {
    expect(SessionManager.isActive()).toBe(false);
  });

  test('returns true with active session', () => {
    SessionManager.start('Endeavor Elementary');
    expect(SessionManager.isActive()).toBe(true);
  });

  test('returns false after ending a session', () => {
    SessionManager.start('Livano');
    SessionManager.end();
    expect(SessionManager.isActive()).toBe(false);
  });
});

// ---- getLocation() -------------------------------------------------

describe('getLocation()', () => {
  test('returns null when no session is active', () => {
    expect(SessionManager.getLocation()).toBeNull();
  });

  test('returns the session location string', () => {
    SessionManager.start('ATD');
    expect(SessionManager.getLocation()).toBe('ATD');
  });

  test('returns null after session ends', () => {
    SessionManager.start('Walden');
    SessionManager.end();
    expect(SessionManager.getLocation()).toBeNull();
  });
});

// ---- sequential workflow -------------------------------------------

describe('sequential session workflow', () => {
  test('Livano session → end → Endeavor session works correctly', () => {
    SessionManager.start('Livano');
    expect(SessionManager.getLocation()).toBe('Livano');

    SessionManager.end();
    expect(SessionManager.isActive()).toBe(false);

    SessionManager.start('Endeavor Elementary');
    expect(SessionManager.getLocation()).toBe('Endeavor Elementary');
    expect(SessionManager.isActive()).toBe(true);
  });
});

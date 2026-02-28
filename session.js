// ============================================
// SESSION MANAGER
// Manages a single active checkout session.
// One session at a time — one location per restocking run.
// ============================================

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SessionManager = factory();
  }
}(typeof window !== 'undefined' ? window : global, function () {

  var _session = null;

  return {

    /**
     * Start a checkout session for the given location.
     * Calling start() when a session is already active replaces it.
     * @param {string} location - must be non-empty
     */
    start: function (location) {
      if (!location || !String(location).trim()) {
        throw new Error('Location is required to start a session');
      }
      _session = {
        location: String(location).trim(),
        startedAt: new Date()
      };
      return this.getActive();
    },

    /**
     * End the current session. Safe to call when no session is active.
     */
    end: function () {
      _session = null;
    },

    /**
     * Returns a copy of the active session object, or null.
     * { location: string, startedAt: Date }
     */
    getActive: function () {
      if (!_session) return null;
      return {
        location: _session.location,
        startedAt: new Date(_session.startedAt.getTime())
      };
    },

    /** Returns true if a session is currently active. */
    isActive: function () {
      return _session !== null;
    },

    /** Returns the active session's location string, or null. */
    getLocation: function () {
      return _session ? _session.location : null;
    },

    /** For testing only — resets internal state between test cases. */
    _reset: function () {
      _session = null;
    }

  };

}));

/**
 * PhantomShield - Scriptlets
 */
window.PHANTOM_SCRIPTLETS = {
  "set-constant": function(source, property, value) {
    try {
      Object.defineProperty(window, property, {
        get: function() { return value; },
        set: function() {},
        configurable: true
      });
    } catch (e) {}
  },
  "abort-on-property-read": function(source, property) {
    try {
      Object.defineProperty(window, property, {
        get: function() { throw new ReferenceError(property + " is not defined"); },
        configurable: true
      });
    } catch (e) {}
  },
  "noop-func": function() {
    return function() {};
  }
};

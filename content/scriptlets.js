/**
 * PhantomShield V4.0 - Scriptlet Engine
 * Injects dynamic scriptlets (uBO syntax) to neuter specific variables and JSON responses.
 */
(function() {
  'use strict';

  const scriptletEngine = function() {
    console.log('[PhantomShield Scriptlets] Engine initializing...');

    window.PhantomScriptlets = {
      // 1. set-constant: Sets a global variable to a specific primitive value, preventing modification.
      setConstant: function(propPath, value) {
        const parts = propPath.split('.');
        let obj = window;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!obj[parts[i]]) obj[parts[i]] = {};
          obj = obj[parts[i]];
        }
        const prop = parts[parts.length - 1];
        try {
          Object.defineProperty(obj, prop, {
            value: value,
            writable: false,
            configurable: false
          });
        } catch (e) {}
      },

      // 2. abort-on-property-read: Throws an error to abort script execution when a specific property is read.
      abortOnPropertyRead: function(propPath) {
        const parts = propPath.split('.');
        let obj = window;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!obj[parts[i]]) obj[parts[i]] = {};
          obj = obj[parts[i]];
        }
        const prop = parts[parts.length - 1];
        try {
          Object.defineProperty(obj, prop, {
            get: function() {
              throw new ReferenceError(`PhantomShield: Aborted read of ${propPath}`);
            },
            set: function() {}
          });
        } catch (e) {}
      },

      // 3. json-prune: Traverses a JSON object and deletes specified keys.
      jsonPrune: function(obj, keysToPrune) {
        if (!obj || typeof obj !== 'object') return;
        const keys = Array.isArray(keysToPrune) ? keysToPrune : keysToPrune.split(' ');
        
        const prune = (target) => {
          if (!target || typeof target !== 'object') return;
          if (Array.isArray(target)) {
            target.forEach(prune);
          } else {\n            keys.forEach(key => {\n              if (target[key] !== undefined) delete target[key];\n            });\n            Object.values(target).forEach(prune);\n          }\n        };\n        prune(obj);\n        return obj;\n      }\n    };\n\n    // Apply known hardcoded scriptlets for specific sites (simulating uBO filter rules)\n    const hostname = location.hostname;\n\n    if (hostname.includes('youtube.com')) {\n       // Example of pre-emptive scriptlet application for YouTube\n       // Note: actual youtube defusing happens heavily in youtube-defuser.js for XHR interception\n       // but we could set constants here if needed.\n       window.PhantomScriptlets.setConstant('ytInitialPlayerResponse.adPlacements', undefined);\n    }\n  };\n\n  const scriptEl = document.createElement('script');\n  scriptEl.textContent = '(' + scriptletEngine.toString() + ')();';\n  (document.head || document.documentElement).appendChild(scriptEl);\n  scriptEl.remove();\n})();\n
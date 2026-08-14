/**
 * PhantomShield 8.1 - Isolated-world settings bridge.
 */
(function() {
  'use strict';

  const DEFAULT_SETTINGS = {
    adblockEnabled: true,
    bypassEnabled: false,
    paywallEnabled: false,
    privacyEnabled: false,
    cnameEnabled: false
  };

  let current = Object.assign({}, DEFAULT_SETTINGS);

  function setBooleanAttribute(root, name, value) {
    root.setAttribute(name, value ? 'true' : 'false');
  }

  function publishSettings() {
    const root = document.documentElement;
    if (!root) return;
    setBooleanAttribute(root, 'data-phantomshield-adblock', current.adblockEnabled);
    setBooleanAttribute(root, 'data-phantomshield-privacy', current.privacyEnabled);
    document.dispatchEvent(new CustomEvent('phantomshield:settings'));
  }

  // Publish conservative defaults synchronously, then replace them with saved values.
  publishSettings();

  browser.storage.local.get(DEFAULT_SETTINGS).then(function(result) {
    current = Object.assign({}, DEFAULT_SETTINGS, result);
    publishSettings();
  }).catch(function() {});

  browser.storage.onChanged.addListener(function(changes, areaName) {
    if (areaName !== 'local') return;
    let changed = false;
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (changes[key]) {
        current[key] = changes[key].newValue === undefined
          ? DEFAULT_SETTINGS[key]
          : Boolean(changes[key].newValue);
        changed = true;
      }
    }
    if (changed) publishSettings();
  });

  document.addEventListener('phantomshield:popup-blocked', function() {
    browser.runtime.sendMessage({ type: 'POPUP_BLOCKED' }).catch(function() {});
  });
})();

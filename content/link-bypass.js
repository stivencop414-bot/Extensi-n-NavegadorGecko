/**
 * PhantomShield 8.1 - Conservative short-link helper.
 * Runs only on known shortener domains and never replaces page timer APIs.
 */
(function() {
  'use strict';

  if (window.top !== window) return;

  const SHORTENER_DOMAINS = [
    'adf.ly', 'bc.vc', 'ouo.io', 'shorte.st', 'linkvertise.com'
  ];

  const hostname = location.hostname.toLowerCase();
  const supported = SHORTENER_DOMAINS.some(function(domain) {
    return hostname === domain || hostname.endsWith('.' + domain);
  });
  if (!supported) return;

  let enabled = false;
  let observer = null;
  let scanTimer = null;
  let navigationStarted = false;

  function safeTarget(value) {
    if (typeof value !== 'string' || value.length > 4096) return null;
    try {
      const url = new URL(value, location.href);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      if (url.username || url.password) return null;
      if (url.href === location.href || url.hostname === location.hostname) return null;
      return url.href;
    } catch (error) {
      return null;
    }
  }

  function navigate(value) {
    const target = safeTarget(value);
    if (!target || navigationStarted) return false;
    navigationStarted = true;
    stop();
    location.replace(target);
    return true;
  }

  function decodeYsmm(value) {
    if (typeof value !== 'string' || value.length > 8192) return null;
    try {
      let left = '';
      let right = '';
      for (let index = 0; index < value.length; index++) {
        if (index % 2 === 0) left += value.charAt(index);
        else right = value.charAt(index) + right;
      }
      return atob(left + right).slice(2);
    } catch (error) {
      return null;
    }
  }

  function scan() {
    if (!enabled || navigationStarted) return;

    const namedInputs = document.querySelectorAll(
      'input[type="hidden"][name*="url" i], ' +
      'input[type="hidden"][name*="target" i], ' +
      'input[type="hidden"][name*="destination" i]'
    );
    for (const input of namedInputs) {
      if (navigate(input.value)) return;
    }

    try {
      const pageWindow = window.wrappedJSObject || window;
      const decoded = decodeYsmm(pageWindow.ysmm);
      if (decoded && navigate(decoded)) return;
    } catch (error) {}

    const skip = document.querySelector(
      'a#skip_button[href], a.skip-ad[href], a#get-link[href], ' +
      'button#skip_button, button.skip-ad, button#get-link'
    );
    if (!skip) return;
    if (skip instanceof HTMLAnchorElement && navigate(skip.href)) return;
    if (skip instanceof HTMLButtonElement && !skip.disabled) skip.click();
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 150);
  }

  function start() {
    if (!enabled || observer || navigationStarted) return;
    const begin = function() {
      if (!enabled || observer || !document.body) return;
      observer = new MutationObserver(scheduleScan);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      scan();
    };
    if (document.body) begin();
    else document.addEventListener('DOMContentLoaded', begin, { once: true });
  }

  function stop() {
    if (observer) observer.disconnect();
    observer = null;
    clearTimeout(scanTimer);
    scanTimer = null;
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    if (enabled) start();
    else stop();
  }

  browser.storage.local.get({ bypassEnabled: false }).then(function(result) {
    setEnabled(result.bypassEnabled);
  }).catch(function() {});

  browser.storage.onChanged.addListener(function(changes, areaName) {
    if (areaName === 'local' && changes.bypassEnabled) {
      setEnabled(
        changes.bypassEnabled.newValue === undefined
          ? false
          : changes.bypassEnabled.newValue
      );
    }
  });
})();

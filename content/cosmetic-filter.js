/**
 * PhantomShield 8.1 - Reversible cosmetic filtering.
 */
(function() {
  'use strict';

  const rules = globalThis.PHANTOM_COSMETIC_RULES || {
    youtube: [],
    generic: [],
    procedural: []
  };
  const hostname = location.hostname.toLowerCase();
  const hiddenAttribute = 'data-phantomshield-hidden';
  let enabled = true;
  let styleElement = null;
  let observer = null;
  let debounceTimer = null;

  const standardSelectors = (rules.generic || []).slice();
  if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
    standardSelectors.push.apply(standardSelectors, rules.youtube || []);
  }

  function buildStyleText() {
    const selectors = standardSelectors.concat(['[' + hiddenAttribute + '="true"]']);
    if (selectors.length === 0) return '';
    return selectors.join(',\n') +
      ' {\n  display: none !important;\n  visibility: hidden !important;\n' +
      '  pointer-events: none !important;\n}\n';
  }

  function ensureStyle() {
    if (!enabled || styleElement) return;
    const css = buildStyleText();
    if (!css) return;
    styleElement = document.createElement('style');
    styleElement.id = 'phantomshield-cosmetic-style';
    styleElement.textContent = css;
    (document.head || document.documentElement).appendChild(styleElement);
  }

  function removeStyle() {
    if (styleElement) styleElement.remove();
    styleElement = null;
  }

  function hideElement(element) {
    if (element && element.nodeType === Node.ELEMENT_NODE) {
      element.setAttribute(hiddenAttribute, 'true');
    }
  }

  function evaluateProceduralFilters() {
    if (!enabled) return;
    for (const rule of rules.procedural || []) {
      if (!rule || typeof rule.selector !== 'string') continue;
      try {
        const elements = document.querySelectorAll(rule.selector);
        for (const element of elements) {
          if (rule.pseudo === 'has-text') {
            const expected = String(rule.args || '').trim().toLocaleLowerCase();
            const actual = (element.textContent || '').toLocaleLowerCase();
            if (expected && actual.includes(expected)) hideElement(element);
          }
        }
      } catch (error) {}
    }
  }

  function nodeLooksLikeAd(node) {
    if (!(node instanceof Element)) return false;
    const className = typeof node.className === 'string' ? node.className.toLowerCase() : '';
    const id = (node.id || '').toLowerCase();
    return /(^|[\s_-])ad(?:s|vert)?([\s_-]|$)/.test(className) ||
      /(^|[_-])ad(?:s|vert)?([_-]|$)/.test(id) ||
      className.includes('sponsored-post');
  }

  function scheduleProceduralScan() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(evaluateProceduralFilters, 200);
  }

  function startObserver() {
    if (!enabled || observer || !document.documentElement) return;
    observer = new MutationObserver(function(mutations) {
      let shouldScan = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          shouldScan = true;
          if (nodeLooksLikeAd(node)) hideElement(node);
        }
      }
      if (shouldScan) scheduleProceduralScan();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    scheduleProceduralScan();
  }

  function stopObserver() {
    if (observer) observer.disconnect();
    observer = null;
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  function applyEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    if (enabled) {
      ensureStyle();
      startObserver();
    } else {
      stopObserver();
      removeStyle();
    }
  }

  browser.storage.local.get({ adblockEnabled: true }).then(function(result) {
    applyEnabled(result.adblockEnabled);
  }).catch(function() {
    applyEnabled(true);
  });

  browser.storage.onChanged.addListener(function(changes, areaName) {
    if (areaName === 'local' && changes.adblockEnabled) {
      applyEnabled(
        changes.adblockEnabled.newValue === undefined
          ? true
          : changes.adblockEnabled.newValue
      );
    }
  });
})();

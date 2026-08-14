/**
 * PhantomShield V5.0 - Extreme Popup & Popunder Blocker
 * Defuses window.open, showModalDialog, synthetic clicks, and Micro-Transparency traps.
 */
(function() {
  'use strict';

  const mainWorldScript = function() {
    let lastUserInteractionTime = 0;
    const USER_GESTURE_MAX_AGE_MS = 1000;

    const recordUserGesture = function(e) {
      if (e.isTrusted) {
        lastUserInteractionTime = Date.now();
      }
    };

    window.addEventListener('click', recordUserGesture, true);
    window.addEventListener('touchend', recordUserGesture, true);
    window.addEventListener('mouseup', recordUserGesture, true);
    window.addEventListener('keydown', recordUserGesture, true);

    const isAuthorized = function() {
      return (Date.now() - lastUserInteractionTime) <= USER_GESTURE_MAX_AGE_MS;
    };

    const isKnownPopDomain = function(url) {
      if (!url) return false;
      const lowerUrl = url.toLowerCase();
      return lowerUrl.includes('popads') || lowerUrl.includes('exoclick') || 
             lowerUrl.includes('popcash') || lowerUrl.includes('propeller') || 
             lowerUrl.includes('juicyads') || lowerUrl.includes('hilltop') ||
             lowerUrl.includes('clickadu') || lowerUrl.includes('redirect');
    };

    const dummyWindow = {
      focus: function() {}, blur: function() {}, close: function() {}, closed: false,
      postMessage: function() {}, location: { href: '', assign: function(){}, replace: function(){} }
    };

    // 1. Override window.open
    const originalWindowOpen = window.open;
    window.open = function(url, target, features) {
      if (!isAuthorized() || isKnownPopDomain(url) || !url || url === 'about:blank') {
        console.warn('[PhantomShield Popup Blocker] Blocked unauthorized window.open:', url);
        return dummyWindow;
      }
      return originalWindowOpen.apply(this, arguments);
    };

    // 2. Block synthetic clicks (dispatchEvent) used by popunders
    const originalDispatchEvent = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function(event) {
      if (event && event.type === 'click' && !event.isTrusted) {
        if (this.tagName === 'A') {
          const target = this.getAttribute('target');
          const href = this.getAttribute('href');
          if (target === '_blank' || isKnownPopDomain(href)) {
             console.warn('[PhantomShield] Blocked synthetic click on link:', href);
             return false;
          }
        }
      }
      return originalDispatchEvent.apply(this, arguments);
    };

    // 3. Defuse full-screen invisible overlay click traps (Micro-Transparency protection V5)
    const removeOverlayTraps = function() {
      const elements = document.querySelectorAll('div, a, span, iframe');
      elements.forEach(function(el) {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'absolute') {
          const zIndex = parseInt(style.zIndex, 10);
          const opacity = parseFloat(style.opacity);
          
          // Detect Micro-Transparency (opacity < 0.05 instead of just < 0.1)
          if ((zIndex > 9999 || style.zIndex === '2147483647') && opacity < 0.05) {
            const width = el.offsetWidth;
            const height = el.offsetHeight;
            if (width >= window.innerWidth * 0.5 && height >= window.innerHeight * 0.5) {
              console.warn('[PhantomShield] Removing micro-transparency overlay trap element');
              el.remove();
            }
          }
        }
      });
    };

    // 4. Iframe sandbox enforcement for cross-origin ad frames
    const restrictIframes = function() {
      const iframes = document.querySelectorAll('iframe:not([sandbox])');
      iframes.forEach(function(iframe) {\n        if (iframe.id.includes('ad') || iframe.src.includes('ad')) {\n          iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');\n        }\n      });\n    }\n\n    // Use MutationObserver to dynamically catch reinjected micro-transparent traps\n    const observer = new MutationObserver(function() {\n      removeOverlayTraps();\n      restrictIframes();\n    });\n\n    if (document.readyState === 'loading') {\n      document.addEventListener('DOMContentLoaded', () => { \n        removeOverlayTraps(); restrictIframes(); \n        observer.observe(document.body, { childList: true, subtree: true });\n      });\n    } else {\n      removeOverlayTraps();\n      restrictIframes();\n      observer.observe(document.body, { childList: true, subtree: true });\n    }\n  };\n\n  const scriptEl = document.createElement('script');\n  scriptEl.textContent = '(' + mainWorldScript.toString() + ')();';\n  (document.head || document.documentElement).appendChild(scriptEl);\n  scriptEl.remove();\n\n})();\n
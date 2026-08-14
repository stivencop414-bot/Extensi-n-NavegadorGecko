/**
 * PhantomShield - Surrogate Redirect Manager
 * Prevents ERR_BLOCKED_BY_CLIENT by redirecting known tracker URLs to synthetic surrogate stubs.
 */
(function() {
  'use strict';

  const SURROGATE_MAP = [
    {
      pattern: "google-analytics.com/analytics.js",
      redirectUrl: browser.runtime.getURL("web-accessible/ga-surrogate.js")
    },
    {
      pattern: "googletagmanager.com/gtm.js",
      redirectUrl: browser.runtime.getURL("web-accessible/gtm-surrogate.js")
    },
    {
      pattern: "googletagservices.com/tag/js/gpt.js",
      redirectUrl: browser.runtime.getURL("web-accessible/noop.js")
    },
    {
      pattern: "connect.facebook.net/en_US/fbevents.js",
      redirectUrl: browser.runtime.getURL("web-accessible/noop.js")
    }
  ];

  class SurrogateRedirector {
    getSurrogateUrl(url) {
      if (!url) return null;
      for (let i = 0; i < SURROGATE_MAP.length; i++) {
        if (url.includes(SURROGATE_MAP[i].pattern)) {
          return SURROGATE_MAP[i].redirectUrl;
        }
      }
      return null;
    }
  }

  const redirector = new SurrogateRedirector();

  if (typeof window !== "undefined") {
    window.PhantomSurrogateRedirector = redirector;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.PhantomSurrogateRedirector = redirector;
  }
})();

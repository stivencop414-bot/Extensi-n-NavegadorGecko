/**
 * PhantomShield 8.1 - Background orchestrator.
 */
(function() {
  'use strict';

  const engine = globalThis.PhantomNetworkEngineInstance;
  const redirector = globalThis.PhantomSurrogateRedirector;
  const uncloaker = globalThis.PhantomCnameUncloakerInstance;
  const updater = globalThis.PhantomUpdaterInstance;
  const listManager = globalThis.PhantomFilterListManager;

  const DEFAULT_SETTINGS = Object.freeze({
    adblockEnabled: true,
    bypassEnabled: false,
    paywallEnabled: false,
    privacyEnabled: false,
    cnameEnabled: false
  });

  const settings = Object.assign({}, DEFAULT_SETTINGS);
  let countPersistTimer = null;

  const TRACKING_PARAMS = new Set([
    'gclid', 'dclid', 'fbclid', 'msclkid', 'mc_eid', 'yclid', '_hsenc',
    'gbraid', 'wbraid', 'utm_id', 'utm_source', 'utm_medium',
    'utm_campaign', 'utm_term', 'utm_content'
  ]);

  const PAYWALL_DOMAINS = new Set([
    'nytimes.com', 'bloomberg.com', 'wsj.com', 'forbes.com', 'ft.com'
  ]);

  const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
  const SOCIAL_REFERER = 'https://t.co/';

  function hostnameMatches(hostname, domain) {
    return hostname === domain || hostname.endsWith('.' + domain);
  }

  function stripTrackingParams(urlString) {
    try {
      const url = new URL(urlString);
      let changed = false;
      for (const parameter of Array.from(url.searchParams.keys())) {
        if (TRACKING_PARAMS.has(parameter.toLowerCase())) {
          url.searchParams.delete(parameter);
          changed = true;
        }
      }
      return changed ? url.toString() : null;
    } catch (error) {
      return null;
    }
  }

  function isExtensionUrl(url) {
    return url.startsWith('moz-extension://') || url.startsWith('chrome-extension://');
  }

  function scheduleCountPersist() {
    if (!engine || countPersistTimer !== null) return;
    countPersistTimer = setTimeout(function() {
      countPersistTimer = null;
      browser.storage.local.set({
        blockedCount: engine.getBlockedCount()
      }).catch(function() {});
    }, 2000);
  }

  async function initialize() {
    try {
      const stored = await browser.storage.local.get(
        Object.assign({ blockedCount: 0 }, DEFAULT_SETTINGS)
      );
      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        settings[key] = Boolean(stored[key]);
      }
      if (engine) {
        engine.setBlockedCount(Number(stored.blockedCount) + engine.getBlockedCount());
      }
    } catch (error) {
      console.warn('[PhantomShield] Could not load settings.', error);
    }

    if (engine) {
      engine.init(
        globalThis.PHANTOM_AD_DOMAINS,
        globalThis.PHANTOM_TRACKER_DOMAINS,
        globalThis.PHANTOM_POPUP_DOMAINS
      );
    }

    if (listManager) {
      try {
        await listManager.reloadFromStorage();
      } catch (error) {
        console.warn('[PhantomShield] Could not load cached filter lists.', error);
      }
    }

    if (updater) {
      try {
        await updater.start();
      } catch (error) {
        console.warn('[PhantomShield] Filter updater failed to start.', error);
      }
    }
  }

  browser.storage.onChanged.addListener(function(changes, areaName) {
    if (areaName !== 'local') return;
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (changes[key]) {
        settings[key] = changes[key].newValue === undefined
          ? DEFAULT_SETTINGS[key]
          : Boolean(changes[key].newValue);
      }
    }
  });

  browser.webRequest.onBeforeRequest.addListener(
    function(details) {
      if (!settings.adblockEnabled || !details.url || isExtensionUrl(details.url)) return {};

      const url = details.url;
      const documentUrl = details.documentUrl || details.originUrl || details.initiator || null;

      if (details.type === 'main_frame' || details.type === 'sub_frame') {
        const strippedUrl = stripTrackingParams(url);
        if (strippedUrl && strippedUrl !== url) return { redirectUrl: strippedUrl };
      }

      if (redirector) {
        const surrogateUrl = redirector.getSurrogateUrl(url);
        if (surrogateUrl) {
          if (engine) engine.recordBlocked();
          scheduleCountPersist();
          return { redirectUrl: surrogateUrl };
        }
      }

      if (url.includes('youtube.com/pagead/') || url.includes('youtube.com/api/stats/ads')) {
        if (engine) engine.recordBlocked();
        scheduleCountPersist();
        return { cancel: true };
      }

      if (engine && engine.shouldBlock(url, details.type, documentUrl)) {
        scheduleCountPersist();
        return { cancel: true };
      }

      if (settings.cnameEnabled && uncloaker && engine && documentUrl &&
          ['script', 'xmlhttprequest', 'sub_frame'].includes(details.type) &&
          engine.isThirdPartyRequest(url, documentUrl)) {
        try {
          const hostname = new URL(url).hostname;
          uncloaker.resolveCname(hostname).then(function(cnameTarget) {
            if (cnameTarget && engine.isDomainBlocked(cnameTarget)) {
              engine.addBlockedDomain(hostname);
            }
          }).catch(function() {});
        } catch (error) {}
      }
      return {};
    },
    { urls: ['<all_urls>'] },
    ['blocking']
  );

  browser.webRequest.onBeforeSendHeaders.addListener(
    function(details) {
      if (!settings.paywallEnabled || !Array.isArray(details.requestHeaders)) return {};

      let hostname;
      try {
        hostname = new URL(details.url).hostname.toLowerCase();
      } catch (error) {
        return {};
      }
      const matchesPaywall = Array.from(PAYWALL_DOMAINS).some(function(domain) {
        return hostnameMatches(hostname, domain);
      });
      if (!matchesPaywall) return {};

      let hasUserAgent = false;
      let hasReferer = false;
      for (const header of details.requestHeaders) {
        const name = header.name.toLowerCase();
        if (name === 'user-agent') {
          header.value = GOOGLEBOT_UA;
          hasUserAgent = true;
        } else if (name === 'referer') {
          header.value = SOCIAL_REFERER;
          hasReferer = true;
        }
      }
      if (!hasUserAgent) details.requestHeaders.push({ name: 'User-Agent', value: GOOGLEBOT_UA });
      if (!hasReferer) details.requestHeaders.push({ name: 'Referer', value: SOCIAL_REFERER });
      return { requestHeaders: details.requestHeaders };
    },
    { urls: ['<all_urls>'], types: ['main_frame', 'sub_frame'] },
    ['blocking', 'requestHeaders']
  );

  browser.runtime.onMessage.addListener(function(message) {
    if (!message || typeof message.type !== 'string') return undefined;

    if (message.type === 'GET_STATS') {
      return Promise.resolve({
        ok: true,
        blockedCount: engine ? engine.getBlockedCount() : 0,
        settings: Object.assign({}, settings)
      });
    }

    if (message.type === 'POPUP_BLOCKED') {
      if (engine) engine.recordBlocked();
      scheduleCountPersist();
      return Promise.resolve({ ok: true });
    }

    if (message.type === 'RESET_STATS') {
      if (engine) engine.resetBlockedCount();
      if (countPersistTimer !== null) {
        clearTimeout(countPersistTimer);
        countPersistTimer = null;
      }
      return browser.storage.local.set({ blockedCount: 0 }).then(function() {
        return { ok: true, blockedCount: 0 };
      });
    }

    if (message.type === 'FORCE_UPDATE') {
      if (!updater) return Promise.resolve({ ok: false, error: 'Actualizador no disponible' });
      return updater.updateAllLists().catch(function(error) {
        return {
          ok: false,
          error: error && error.message ? error.message : 'No se pudieron actualizar las listas'
        };
      });
    }
    return undefined;
  });

  initialize();
})();

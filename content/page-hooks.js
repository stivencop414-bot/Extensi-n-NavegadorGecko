/**
 * PhantomShield 8.1 - Main-world hooks.
 * This file intentionally contains no WebExtension APIs because it runs in MAIN.
 */
(function() {
  'use strict';

  if (window.__phantomShieldPageHooks) return;
  Object.defineProperty(window, '__phantomShieldPageHooks', {
    value: true,
    configurable: false,
    enumerable: false
  });

  const state = {
    adblockEnabled: false,
    privacyEnabled: false
  };

  function readBooleanAttribute(name, fallback) {
    const root = document.documentElement;
    if (!root) return fallback;
    const value = root.getAttribute(name);
    if (value === null) return fallback;
    return value === 'true';
  }

  function syncSettings() {
    state.adblockEnabled = readBooleanAttribute('data-phantomshield-adblock', false);
    state.privacyEnabled = readBooleanAttribute('data-phantomshield-privacy', false);
    updateBaitElement();
    if (!state.adblockEnabled) restoreYouTubeVideo();
  }

  document.addEventListener('phantomshield:settings', syncSettings, false);

  function reportBlockedPopup() {
    document.dispatchEvent(new CustomEvent('phantomshield:popup-blocked'));
  }

  function hostnameMatches(hostname, domain) {
    return hostname === domain || hostname.endsWith('.' + domain);
  }

  const POPUP_DOMAINS = [\n    'popads.net', 'popcash.net', 'exoclick.com', 'juicyads.com',\n    'propellerads.com', 'propellerclicks.com', 'hilltopads.com',\n    'adsterra.com', 'clickadu.com', 'trafficjunky.net', 'trafficjunky.com'\n  ];

  function isKnownPopupUrl(value) {
    if (!value) return false;
    try {
      const hostname = new URL(String(value), location.href).hostname.toLowerCase();
      return POPUP_DOMAINS.some(function(domain) {
        return hostnameMatches(hostname, domain);
      });
    } catch (error) {
      return false;
    }
  }

  function installPopupGuard() {
    const originalOpen = window.open;
    if (typeof originalOpen !== 'function') return;

    let lastTrustedGesture = 0;
    const recordGesture = function(event) {
      if (event.isTrusted) lastTrustedGesture = Date.now();
    };
    window.addEventListener('pointerup', recordGesture, true);
    window.addEventListener('touchend', recordGesture, true);
    window.addEventListener('keydown', recordGesture, true);

    window.open = function(url) {
      if (!state.adblockEnabled) return originalOpen.apply(this, arguments);

      const recentlyActivated = Date.now() - lastTrustedGesture <= 2500;
      const userActivated = Boolean(
        navigator.userActivation && navigator.userActivation.isActive
      );
      const blankWithoutGesture = (!url || url === 'about:blank') &&
        !recentlyActivated && !userActivated;

      if (isKnownPopupUrl(url) || blankWithoutGesture) {
        reportBlockedPopup();
        return null;
      }
      return originalOpen.apply(this, arguments);
    };

    document.addEventListener('click', function(event) {
      if (!state.adblockEnabled || event.isTrusted) return;
      const element = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (element && isKnownPopupUrl(element.href)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        reportBlockedPopup();
      }
    }, true);
  }

  let baitElement = null;

  function updateBaitElement() {
    if (!document.documentElement) return;
    if (!state.adblockEnabled) {
      if (baitElement) baitElement.remove();
      baitElement = null;
      return;
    }
    if (baitElement && baitElement.isConnected) return;

    const container = document.createElement('div');
    container.id = 'phantomshield-ad-bait';
    container.setAttribute('aria-hidden', 'true');
    container.style.cssText =
      'position:absolute!important;left:-10000px!important;top:-10000px!important;' +
      'width:1px!important;height:1px!important;overflow:hidden!important;' +
      'pointer-events:none!important;';

    for (const className of ['ad-banner', 'ad-container', 'adsbygoogle']) {
      const bait = document.createElement('div');
      bait.className = className;
      bait.textContent = '\u00a0';
      container.appendChild(bait);
    }
    document.documentElement.appendChild(container);
    baitElement = container;
  }

  function installCanvasPrivacy() {
    if (!window.HTMLCanvasElement || !window.CanvasRenderingContext2D) return;

    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    const originalPutImageData = CanvasRenderingContext2D.prototype.putImageData;
    let seed = Math.floor(Math.random() * 0xffffffff) >>> 0;
    try {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      seed = values[0];
    } catch (error) {}

    function randomIndex(length, salt) {
      let value = (seed ^ salt) >>> 0;
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      return length > 0 ? (value >>> 0) % length : 0;
    }

    CanvasRenderingContext2D.prototype.getImageData = function() {
      const imageData = originalGetImageData.apply(this, arguments);
      if (!state.privacyEnabled || !imageData || imageData.data.length < 4) return imageData;
      const pixelCount = Math.floor(imageData.data.length / 4);
      const offset = randomIndex(pixelCount, 0x13579bdf) * 4;
      imageData.data[offset] = (imageData.data[offset] + 1) % 256;
      return imageData;
    };

    HTMLCanvasElement.prototype.toDataURL = function() {
      if (!state.privacyEnabled || this.width === 0 || this.height === 0) {
        return originalToDataURL.apply(this, arguments);
      }
      try {
        const copy = document.createElement('canvas');
        copy.width = this.width;
        copy.height = this.height;
        const context = copy.getContext('2d');
        context.drawImage(this, 0, 0);
        const imageData = originalGetImageData.call(context, 0, 0, copy.width, copy.height);
        const pixelCount = Math.floor(imageData.data.length / 4);
        const offset = randomIndex(pixelCount, 0x2468ace0) * 4;
        imageData.data[offset] = (imageData.data[offset] + 1) % 256;
        originalPutImageData.call(context, imageData, 0, 0);
        return originalToDataURL.apply(copy, arguments);
      } catch (error) {
        return originalToDataURL.apply(this, arguments);
      }
    };
  }

  const YOUTUBE_PRUNE_KEYS = new Set([
    'adPlacements', 'playerAds', 'adSlots', 'adBreaks',
    'promotedItem', 'masthead', 'ad_interruptions',
    'enforcementMessageViewModel'
  ]);

  function sanitizeYouTubeData(value) {
    const seen = new WeakSet();
    const visit = function(target) {
      if (!target || typeof target !== 'object' || seen.has(target)) return;
      seen.add(target);
      if (Array.isArray(target)) {
        target.forEach(visit);
        return;
      }
      for (const key of Object.keys(target)) {
        if (YOUTUBE_PRUNE_KEYS.has(key)) delete target[key];
        else visit(target[key]);
      }
    };
    visit(value);
    return value;
  }

  function isYouTubeApiUrl(value) {
    try {
      const url = new URL(
        typeof value === 'string' ? value : value && value.url ? value.url : '',
        location.href
      );
      return hostnameMatches(url.hostname, 'youtube.com') &&
        (url.pathname.includes('/youtubei/v1/player') || url.pathname.includes('/youtubei/v1/next'));
    } catch (error) {
      return false;
    }
  }

  function installYouTubeFetchGuard() {
    if (!hostnameMatches(location.hostname, 'youtube.com') || typeof window.fetch !== 'function') return;
    const originalFetch = window.fetch;

    window.fetch = new Proxy(originalFetch, {
      apply: function(target, thisArg, argumentsList) {
        const request = argumentsList[0];
        return Reflect.apply(target, thisArg, argumentsList).then(function(response) {
          if (!state.adblockEnabled || !isYouTubeApiUrl(request)) return response;

          return new Proxy(response, {\n            get: function(targetResponse, property) {\n              if (property === 'json') {\n                return async function() {\n                  const data = await targetResponse.clone().json();\n                  return sanitizeYouTubeData(data);\n                };\n              }\n              if (property === 'text') {\n                return async function() {\n                  const text = await targetResponse.clone().text();\n                  try {\n                    return JSON.stringify(sanitizeYouTubeData(JSON.parse(text)));\n                  } catch (error) {\n                    return text;\n                  }\n                };\n              }\n              const result = Reflect.get(targetResponse, property, targetResponse);\n              return typeof result === 'function' ? result.bind(targetResponse) : result;\n            }\n          });\n        });\n      }\n    });\n  }\n\n  let youtubeVideo = null;\n  let youtubeVideoState = null;\n\n  function restoreYouTubeVideo() {\n    if (youtubeVideo && youtubeVideoState) {\n      try {\n        youtubeVideo.muted = youtubeVideoState.muted;\n        youtubeVideo.playbackRate = youtubeVideoState.playbackRate;\n      } catch (error) {}\n    }\n    youtubeVideo = null;\n    youtubeVideoState = null;\n  }\n\n  function handleYouTubePlayer() {\n    if (!hostnameMatches(location.hostname, 'youtube.com')) return;\n    const video = document.querySelector('video.html5-main-video');\n    const player = document.getElementById('movie_player');\n    const skipButton = document.querySelector(\n      '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button'\n    );\n    const isAd = Boolean(\n      (player && (player.classList.contains('ad-showing') ||\n        player.classList.contains('ad-interrupting'))) ||\n      document.querySelector('.ytp-ad-preview-text, .ytp-ad-player-overlay')\n    );\n\n    if (!state.adblockEnabled || !video || !isAd) {\n      restoreYouTubeVideo();\n      return;\n    }\n\n    if (youtubeVideo !== video) {\n      restoreYouTubeVideo();\n      youtubeVideo = video;\n      youtubeVideoState = { muted: video.muted, playbackRate: video.playbackRate };\n    }\n\n    video.muted = true;\n    if (skipButton) {\n      skipButton.click();\n    } else {\n      video.playbackRate = Math.min(8, video.playbackRate < 1 ? 1 : video.playbackRate * 2);\n    }\n  }\n\n  function installYouTubePlayerGuard() {\n    if (!hostnameMatches(location.hostname, 'youtube.com')) return;\n    let scheduled = false;\n    const schedule = function() {\n      if (scheduled) return;\n      scheduled = true;\n      requestAnimationFrame(function() {\n        scheduled = false;\n        handleYouTubePlayer();\n      });\n    };\n    const start = function() {\n      const observer = new MutationObserver(schedule);\n      observer.observe(document.documentElement, {\n        childList: true,\n        subtree: true,\n        attributes: true,\n        attributeFilter: ['class']\n      });\n      document.addEventListener('timeupdate', schedule, true);\n      schedule();\n    };\n    if (document.readyState === 'loading') {\n      document.addEventListener('DOMContentLoaded', start, { once: true });\n    } else {\n      start();\n    }\n  }\n\n  installPopupGuard();\n  installCanvasPrivacy();\n  installYouTubeFetchGuard();\n  installYouTubePlayerGuard();\n  syncSettings();\n})();\n
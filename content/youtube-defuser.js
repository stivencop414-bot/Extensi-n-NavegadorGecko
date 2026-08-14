/**
 * PhantomShield V4.0 (Ghost Level) - YouTube SSAI & Telemetry Defuser
 * Deep JSON pruning via Proxied Fetch/XHR to remove adPlacements,
 * combined with a resilient SSAI fast-forward engine.
 */
(function() {
  'use strict';

  if (!location.hostname.includes('youtube.com')) return;

  console.log('[PhantomShield Ghost] Initializing YouTube Defuser...');

  const youtubeGhostScript = function() {
    // Advanced JSON Pruning (matching uBO json-prune)
    const sanitizeYouTubeData = function(data) {
      if (!data || typeof data !== 'object') return data;
      
      const pruneKeys = ['adPlacements', 'playerAds', 'adSlots', 'adBreaks', 'promotedItem', 'masthead', 'ad_interruptions'];
      
      if (window.PhantomScriptlets && window.PhantomScriptlets.jsonPrune) {
        window.PhantomScriptlets.jsonPrune(data, pruneKeys);
      } else {
        // Fallback recursive prune if scriptlets engine failed to load
        const prune = (target) => {
          if (!target || typeof target !== 'object') return;
          if (Array.isArray(target)) target.forEach(prune);
          else {
            pruneKeys.forEach(k => delete target[k]);
            Object.values(target).forEach(prune);
          }
        };
        prune(data);
      }

      // Defuse Anti-Adblock Enforcement payload (Avoid the "Ad blockers violate TOS" popup)
      if (data.auxiliaryUi && data.auxiliaryUi.messageRenderers) {
        delete data.auxiliaryUi.messageRenderers.enforcementMessageViewModel;
      }
      if (data.playabilityStatus && data.playabilityStatus.errorScreen) {
        delete data.playabilityStatus.errorScreen.playerErrorMessageRenderer;
      }
      
      return data;
    };

    // Proxy window.fetch for silent JSON interception
    const originalFetch = window.fetch;
    window.fetch = new Proxy(originalFetch, {
      async apply(target, thisArg, argumentsList) {
        const url = typeof argumentsList[0] === 'string' ? argumentsList[0] : (argumentsList[0] && argumentsList[0].url ? argumentsList[0].url : '');
        
        // Block telemetry aggressively
        if (url.includes('/generate_204') && (url.includes('adformat=') || url.includes('ad_type='))) {
           return new Response('', {status: 204});
        }

        const response = await target.apply(thisArg, argumentsList);
        
        if (url.includes('/youtubei/v1/player') || url.includes('/youtubei/v1/next')) {
          try {
            const clone = response.clone();
            const data = await clone.json();
            const sanitized = sanitizeYouTubeData(data);
            return new Response(JSON.stringify(sanitized), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            });
          } catch (e) {
            return response;
          }
        }
        return response;
      }
    });

    // Proxy XMLHttpRequest for silent JSON interception
    const OriginalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = new Proxy(OriginalXHR, {
      construct(target, args) {
        const xhr = new target(...args);
        
        const origOpen = xhr.open;
        xhr.open = function(method, url) {
          this._phantomUrl = url;
          return origOpen.apply(this, arguments);
        };

        const origSend = xhr.send;
        xhr.send = function() {
          // Block XHR telemetry
          if (this._phantomUrl && this._phantomUrl.includes('/generate_204') && this._phantomUrl.includes('adformat=')) {
             // Abort or mock
             return; 
          }

          if (this._phantomUrl && (this._phantomUrl.includes('/youtubei/v1/player') || this._phantomUrl.includes('/youtubei/v1/next'))) {
            this.addEventListener('readystatechange', function() {
              if (this.readyState === 4 && this.responseText) {
                try {
                  const data = JSON.parse(this.responseText);
                  const sanitized = sanitizeYouTubeData(data);
                  Object.defineProperty(this, 'responseText', { value: JSON.stringify(sanitized), writable: false });
                  Object.defineProperty(this, 'response', { value: JSON.stringify(sanitized), writable: false });
                } catch (e) {}
              }
            }, true);
          }
          return origSend.apply(this, arguments);
        };
        return xhr;
      }
    });

    // SSAI (Server-Side Ad Insertion) Reactive Skipping Engine
    // Even if the ad is stitched in the server stream, we manipulate the video player to skip it.
    const handleSSAI = function() {
      const video = document.querySelector('video.html5-main-video');
      const player = document.getElementById('movie_player');
      
      if (!video) return;

      // Detect ad showing via player class or overlay presence
      const isAd = (player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'))) ||
                   document.querySelector('.ytp-ad-preview-text, .ytp-ad-player-overlay, .ytp-ad-skip-button-slot');

      if (isAd) {
        // 1. Mute ad immediately
        video.muted = true;
        
        // 2. Click skip button if available
        const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
        if (skipBtn) {
          skipBtn.click();
        } else {
          // 3. Fast-forward stitched segment
          if (isFinite(video.duration) && video.currentTime < video.duration) {
            video.currentTime = video.duration - 0.1;
          }
          video.playbackRate = 16.0;
        }
      }
    };

    // Continuous observation for dynamic ad injections
    const observer = new MutationObserver(handleSSAI);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      });
    } else {
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
  };

  const script = document.createElement('script');
  script.textContent = '(' + youtubeGhostScript.toString() + ')();';
  (document.head || document.documentElement).appendChild(script);
  script.remove();

})();

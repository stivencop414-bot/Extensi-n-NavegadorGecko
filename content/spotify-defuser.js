/**
 * PhantomShield V6.0 (Singularity) - Spotify Web Audio Defuser
 * Hooks HTMLMediaElement to mute and fast-forward through Streaming Ad Insertion (SAI).
 */
(function() {
  'use strict';

  if (!location.hostname.includes('spotify.com')) return;

  console.log('[PhantomShield Singularity] Initializing Spotify Web Audio Defuser...');

  const spotifyDefuserScript = function() {
    let isAdPlaying = false;
    let audioElements = new Set();

    // 1. Hook HTMLMediaElement (Audio/Video) to intercept play state and inject fast-forward
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function() {
      audioElements.add(this);
      if (isAdPlaying) {
         this.volume = 0; // Mute immediately
         this.playbackRate = 16.0; // Try to speed it up if allowed
      }
      return originalPlay.apply(this, arguments);
    };

    const originalSetVolume = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume').set;
    Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
       set: function(val) {
          if (isAdPlaying) {
             originalSetVolume.call(this, 0); // Force mute
          } else {
             originalSetVolume.call(this, val);
          }
       },
       get: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume').get
    });

    // Force ad to skip if possible by pretending we listened to it
    const fastForwardAds = function() {
       audioElements.forEach(audio => {
          if (isAdPlaying && isFinite(audio.duration) && audio.currentTime < audio.duration - 1) {
             audio.currentTime = audio.duration - 0.5;
          }
       });
    };

    // 2. Intercept Spotify Telemetry to detect ad state
    // Spotify often flags ad state in WebSocket frames or specific endpoints
    const OriginalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = new Proxy(OriginalXHR, {
      construct(target, args) {
        const xhr = new target(...args);
        xhr.addEventListener('readystatechange', function() {
          if (xhr.readyState === 4 && xhr.responseURL) {
            // Heuristic ad detection in Spotify API
            if (xhr.responseURL.includes('/track-playback/') || xhr.responseURL.includes('/ad-logic/')) {
               try {
                 const res = JSON.parse(xhr.responseText);
                 // Check if the payload indicates an ad track
                 if (res && res.isAd === true || res.type === 'ad') {\n                    isAdPlaying = true;\n                    fastForwardAds();\n                 } else {\n                    isAdPlaying = false;\n                 }\n               } catch (e) {}\n            }\n          }\n        });\n        return xhr;\n      }\n    });\n\n    // Monitor for DOM indicators (e.g., 'Advertisement' labels in the player)\n    const observer = new MutationObserver(() => {\n       const adLabel = document.querySelector('[data-testid=\"ad-indicator\"], .ad-indicator, [aria-label=\"Advertisement\"]');\n       if (adLabel && !isAdPlaying) {\n          isAdPlaying = true;\n          fastForwardAds();\n       } else if (!adLabel && isAdPlaying) {\n          isAdPlaying = false;\n          // Restore volume if needed, though usually the next track triggers a new play event\n       }\n    });\n\n    if (document.readyState === 'loading') {\n       document.addEventListener('DOMContentLoaded', () => {\n          observer.observe(document.body, { childList: true, subtree: true, attributes: true });\n       });\n    } else {\n       observer.observe(document.body, { childList: true, subtree: true, attributes: true });\n    }\n  };\n\n  const script = document.createElement('script');\n  script.textContent = '(' + spotifyDefuserScript.toString() + ')();';\n  (document.head || document.documentElement).appendChild(script);\n  script.remove();\n\n})();\n
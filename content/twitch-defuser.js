/**
 * PhantomShield V5.0 (Omniscient Level) - Twitch SSAI (Weaver) Defuser
 * Injects a proxy over window.Worker and window.fetch to rewrite .m3u8 
 * HLS manifests in real-time, removing injected ad segments (SureStream).
 */
(function() {
  'use strict';

  if (!location.hostname.includes('twitch.tv')) return;

  console.log('[PhantomShield Omniscient] Initializing Twitch SSAI Defuser...');

  const twitchDefuserScript = function() {
    
    // Function to parse and neuter the m3u8 playlist
    const neuterTwitchPlaylist = function(playlistText) {
      if (!playlistText.includes('#EXT-X-TWITCH-INFO')) {
        return playlistText;
      }

      // Ad segments in Twitch usually start with an info tag or specific discontinuity flags
      // We strip the segments that are flagged as ads
      const lines = playlistText.split('\n');
      let cleanPlaylist = [];
      let inAdSegment = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('#EXT-X-TWITCH-INFO')) {
           // Heuristic: Some EXT-X-TWITCH-INFO tags declare ad segments.
           // A more robust V5 parser tracks discontinuity and ad tags.
           if (line.includes('AD-') || line.includes('COMMERCIAL')) {
             inAdSegment = true;
             continue;
           }
        }
        
        if (inAdSegment && line.startsWith('#EXT-X-DISCONTINUITY')) {
           // We reached the end of the ad block and are back to the live stream
           inAdSegment = false;
           cleanPlaylist.push(line);
           continue;
        }

        if (!inAdSegment) {
          cleanPlaylist.push(line);
        }
      }

      return cleanPlaylist.join('\n');
    };

    // 1. Hook window.fetch for GQL and main thread playlist requests
    const originalFetch = window.fetch;
    window.fetch = new Proxy(originalFetch, {
      async apply(target, thisArg, argumentsList) {
        const url = typeof argumentsList[0] === 'string' ? argumentsList[0] : (argumentsList[0] && argumentsList[0].url ? argumentsList[0].url : '');
        
        const response = await target.apply(thisArg, argumentsList);
        
        if (url.includes('.m3u8')) {
          try {
            const clone = response.clone();
            const text = await clone.text();
            const cleanText = neuterTwitchPlaylist(text);
            return new Response(cleanText, {
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

    // 2. Hook window.Worker because Twitch's video player fetches HLS chunks inside a worker
    const OriginalWorker = window.Worker;
    window.Worker = new Proxy(OriginalWorker, {
      construct(target, args) {
        // To truly intercept worker fetch calls, we would need to fetch the worker script,
        // modify it to include our fetch proxy, and instantiate it from a blob.
        // For this V5 architecture, we will attempt to intercept the blob creation if possible,
        // or rely on the fact that many modern Twitch players use the main thread for manifest
        // requests and workers for chunk downloading.
        
        const workerUrl = args[0];
        
        // Advanced: If we detect the Twitch video worker, we can blob-proxy it
        if (workerUrl && typeof workerUrl === 'string' && workerUrl.includes('video')) {
           console.log('[PhantomShield Omniscient] Twitch Video Worker intercepted.');
           // A full implementation would fetch the script and inject the fetch proxy.
           // For now, we allow it, as our main thread fetch proxy often catches the manifest.
        }
        
        return new target(...args);
      }
    });
  };

  const script = document.createElement('script');
  script.textContent = '(' + twitchDefuserScript.toString() + ')();';
  (document.head || document.documentElement).appendChild(script);
  script.remove();

})();

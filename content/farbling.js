/**
 * PhantomShield V3.0 - Anti-Fingerprinting Engine (Farbling)
 * Spoofs Canvas, WebGL, and AudioContext fingerprints by injecting deterministic noise.
 */
(function() {
  'use strict';

  const farblingScript = function() {
    console.log('[PhantomShield Farbling] Active. Masking device fingerprints.');

    // Generate a session-consistent, domain-consistent pseudo-random seed
    const generateSeed = function() {
      let seed = 0;
      const domain = location.hostname;
      for (let i = 0; i < domain.length; i++) {
        seed = ((seed << 5) - seed) + domain.charCodeAt(i);
        seed |= 0;
      }
      // Add a session salt (changes per page load in this simple implementation, 
      // but in a real extension could be fetched from background script per session)
      return seed + Math.floor(Math.random() * 10000);
    };

    const sessionSeed = generateSeed();

    // Pseudo-random number generator based on seed
    const seededRandom = function(seedOffset) {
      let x = Math.sin(sessionSeed + seedOffset) * 10000;
      return x - Math.floor(x);
    };

    // 1. Canvas Fingerprint Farbling
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

    HTMLCanvasElement.prototype.toDataURL = function() {
      const ctx = this.getContext('2d');
      if (ctx && this.width > 0 && this.height > 0) {
        // Inject tiny invisible noise before exporting
        const rX = Math.floor(seededRandom(1) * this.width);
        const rY = Math.floor(seededRandom(2) * this.height);
        const originalFillStyle = ctx.fillStyle;
        ctx.fillStyle = `rgba(${Math.floor(seededRandom(3)*255)},${Math.floor(seededRandom(4)*255)},${Math.floor(seededRandom(5)*255)},0.01)`;
        ctx.fillRect(rX, rY, 1, 1);
        ctx.fillStyle = originalFillStyle;
      }
      return originalToDataURL.apply(this, arguments);
    };

    CanvasRenderingContext2D.prototype.getImageData = function() {
      const imageData = originalGetImageData.apply(this, arguments);
      if (imageData && imageData.data && imageData.data.length > 0) {
        // Alter one sub-pixel subtly
        const index = Math.floor(seededRandom(6) * (imageData.data.length / 4)) * 4;
        if (index < imageData.data.length) {
          imageData.data[index] = (imageData.data[index] + 1) % 256;
        }
      }
      return imageData;
    };

    // 2. WebGL Fingerprint Farbling
    const originalReadPixels = WebGLRenderingContext.prototype.readPixels;
    if (originalReadPixels) {
      WebGLRenderingContext.prototype.readPixels = function() {
        originalReadPixels.apply(this, arguments);
        const pixels = arguments[6];
        if (pixels && pixels.length > 0) {
          const index = Math.floor(seededRandom(7) * (pixels.length / 4)) * 4;
          if (index < pixels.length) {
            pixels[index] = (pixels[index] + 1) % 256;
          }
        }
      };
    }

    // 3. AudioContext Fingerprint Farbling
    if (window.AudioBuffer) {
      const originalGetChannelData = AudioBuffer.prototype.getChannelData;
      AudioBuffer.prototype.getChannelData = function() {
        const data = originalGetChannelData.apply(this, arguments);
        if (data && data.length > 0) {
          // Add a microscopic amount of noise to one sample
          const index = Math.floor(seededRandom(8) * data.length);
          data[index] += (seededRandom(9) * 0.000001);
        }
        return data;
      };
    }
  };

  // Inject into Main World before anything else
  const scriptEl = document.createElement('script');
  scriptEl.textContent = '(' + farblingScript.toString() + ')();';
  (document.head || document.documentElement).appendChild(scriptEl);
  scriptEl.remove();
})();

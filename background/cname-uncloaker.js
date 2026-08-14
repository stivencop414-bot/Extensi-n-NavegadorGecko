/**
 * PhantomShield 8.1 - Optional CNAME uncloaking.
 * Disabled by default because a remote DoH lookup exposes queried hostnames.
 */
(function() {
  'use strict';

  const DOH_ENDPOINT = 'https://cloudflare-dns.com/dns-query';

  class CnameUncloaker {
    constructor() {
      this.dnsCache = new Map();
      this.pendingLookups = new Map();
      this.cacheTtlMs = 60 * 60 * 1000;
      this.requestTimeoutMs = 5000;
      this.maxCacheEntries = 2048;
    }

    _normalizeHostname(hostname) {
      const normalized = String(hostname || '').toLowerCase().replace(/\.$/, '');
      if (!normalized || normalized.length > 253 ||
          normalized === 'localhost' || normalized.includes(':') ||
          /^\d+(?:\.\d+){3}$/.test(normalized)) {
        return null;
      }
      const valid = normalized.split('.').every(function(label) {
        return label.length > 0 && label.length <= 63 &&
          /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label);
      });
      return valid ? normalized : null;
    }

    async resolveCname(hostname) {
      const normalized = this._normalizeHostname(hostname);
      if (!normalized) return null;

      const cached = this.dnsCache.get(normalized);
      if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) return cached.target;
      if (cached) this.dnsCache.delete(normalized);
      if (this.pendingLookups.has(normalized)) return this.pendingLookups.get(normalized);

      const lookup = this._fetchDoH(normalized).finally(() => {
        this.pendingLookups.delete(normalized);
      });
      this.pendingLookups.set(normalized, lookup);

      const target = await lookup;
      if (this.dnsCache.size >= this.maxCacheEntries) {
        this.dnsCache.delete(this.dnsCache.keys().next().value);
      }
      this.dnsCache.set(normalized, { target: target, timestamp: Date.now() });
      return target;
    }

    async _fetchDoH(hostname) {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeoutId = controller
        ? setTimeout(() => controller.abort(), this.requestTimeoutMs)
        : null;
      try {
        const response = await fetch(
          DOH_ENDPOINT + '?name=' + encodeURIComponent(hostname) + '&type=CNAME',
          {
            headers: { Accept: 'application/dns-json' },
            credentials: 'omit',
            cache: 'no-store',
            signal: controller ? controller.signal : undefined
          }
        );
        if (!response.ok) return null;
        const data = await response.json();
        if (!data || !Array.isArray(data.Answer)) return null;
        for (const answer of data.Answer) {
          if (answer && answer.type === 5 && typeof answer.data === 'string') {
            return this._normalizeHostname(answer.data);
          }
        }
      } catch (error) {
        return null;
      } finally {
        if (timeoutId !== null) clearTimeout(timeoutId);
      }
      return null;
    }
  }

  globalThis.PhantomCnameUncloakerInstance = new CnameUncloaker();
})();

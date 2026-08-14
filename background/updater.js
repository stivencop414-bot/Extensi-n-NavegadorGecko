/**
 * PhantomShield 8.1 - Filter-list updater.
 * Downloads declarative text only, applies size/time limits, and reports real results.
 */
(function() {
  'use strict';

  const LISTS = [
    { id: 'easylist', url: 'https://easylist.to/easylist/easylist.txt' },
    { id: 'easyprivacy', url: 'https://easylist.to/easylist/easyprivacy.txt' },
    { id: 'ubo-filters', url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt' }
  ];

  class PhantomUpdater {
    constructor() {
      this.cacheKeyPrefix = 'phantom_list_';
      this.lastUpdateKey = 'phantom_last_update';
      this.updateIntervalHours = 24;
      this.maxListBytes = 15 * 1024 * 1024;
      this.requestTimeoutMs = 20000;
    }

    async start() {
      browser.alarms.create('phantom-filter-update', {
        periodInMinutes: this.updateIntervalHours * 60
      });

      browser.alarms.onAlarm.addListener((alarm) => {
        if (alarm && alarm.name === 'phantom-filter-update') {
          this.updateAllLists().catch((error) => {
            console.warn('[PhantomShield] Periodic update failed.', error);
          });
        }
      });

      const stored = await browser.storage.local.get(this.lastUpdateKey);
      const lastUpdate = Number(stored[this.lastUpdateKey]) || 0;
      if (Date.now() - lastUpdate >= this.updateIntervalHours * 60 * 60 * 1000) {
        this.updateAllLists().catch((error) => {
          console.warn('[PhantomShield] Initial update failed.', error);
        });
      }
    }

    async updateAllLists() {
      const results = [];
      for (const list of LISTS) {
        try {
          const updated = await this.updateList(list);
          results.push({ id: list.id, ok: true, updated: updated });
        } catch (error) {
          results.push({ id: list.id, ok: false, error: error ? error.message : 'Error desconocido' });
        }
      }
      await browser.storage.local.set({ [this.lastUpdateKey]: Date.now() });

      if (globalThis.PhantomFilterListManager) {
        await globalThis.PhantomFilterListManager.reloadFromStorage();
      }
      return results;
    }

    async updateList(list) {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeoutId = controller
        ? setTimeout(() => controller.abort(), this.requestTimeoutMs)
        : null;

      try {
        const response = await fetch(list.url, {
          cache: 'no-store',
          credentials: 'omit',
          signal: controller ? controller.signal : undefined
        });

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const text = await response.text();
        if (!text || text.length > this.maxListBytes) {
          throw new Error('Lista inválida o excede el límite de tamaño');
        }

        await browser.storage.local.set({
          [this.cacheKeyPrefix + list.id]: text
        });
        return true;
      } finally {
        if (timeoutId !== null) clearTimeout(timeoutId);
      }
    }
  }

  globalThis.PhantomUpdaterInstance = new PhantomUpdater();
})();

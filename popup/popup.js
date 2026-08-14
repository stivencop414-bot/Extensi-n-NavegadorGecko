/**
 * PhantomShield - Popup Script
 */
document.addEventListener('DOMContentLoaded', async () => {
  const siteToggle = document.getElementById('site-toggle');
  const privacyToggle = document.getElementById('privacy-toggle');
  const domainEl = document.getElementById('current-domain');
  const siteBlocksEl = document.getElementById('site-blocks');
  const totalBlocksEl = document.getElementById('total-blocks');
  const statusBadge = document.getElementById('shield-status');

  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    let domain = "Global";

    if (currentTab && currentTab.url) {
      try {
        const url = new URL(currentTab.url);
        domain = url.hostname;
      } catch (e) {}
    }

    domainEl.textContent = domain;

    const data = await browser.storage.local.get([
      'disabled_domains',
      'total_blocked_count',
      `domain_blocked_${domain}`,
      'anti_fingerprint_enabled'
    ]);

    const disabledDomains = data.disabled_domains || [];
    const isSiteDisabled = disabledDomains.includes(domain);

    siteToggle.checked = !isSiteDisabled;
    privacyToggle.checked = data.anti_fingerprint_enabled !== false;
    siteBlocksEl.textContent = data[`domain_blocked_${domain}`] || 0;
    totalBlocksEl.textContent = data.total_blocked_count || 0;

    updateBadge(!isSiteDisabled);

    siteToggle.addEventListener('change', async () => {
      const enabled = siteToggle.checked;
      let list = (await browser.storage.local.get('disabled_domains')).disabled_domains || [];
      if (enabled) {
        list = list.filter(d => d !== domain);
      } else {
        if (!list.includes(domain)) list.push(domain);
      }
      await browser.storage.local.set({ disabled_domains: list });
      updateBadge(enabled);
      browser.tabs.reload(currentTab.id);
    });

    privacyToggle.addEventListener('change', async () => {
      await browser.storage.local.set({ anti_fingerprint_enabled: privacyToggle.checked });
    });

  } catch (err) {
    console.error("Error loading popup state:", err);
  }

  function updateBadge(active) {
    if (active) {
      statusBadge.textContent = "Activo";
      statusBadge.className = "status-badge active";
    } else {
      statusBadge.textContent = "Pausado";
      statusBadge.className = "status-badge";
    }
  }
});

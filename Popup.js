const DEFAULTS = { enabled: true, threshold: 4, mode: 'hide', showBadge: true };

const els = {
  enabled: document.getElementById('enabled'),
  threshold: document.getElementById('threshold'),
  thresholdValue: document.getElementById('thresholdValue'),
  showBadge: document.getElementById('showBadge'),
  scanned: document.getElementById('scanned'),
  flagged: document.getElementById('flagged'),
};

chrome.storage.sync.get(DEFAULTS, (s) => {
  els.enabled.checked = s.enabled;
  els.threshold.value = s.threshold;
  els.thresholdValue.textContent = s.threshold;
  els.showBadge.checked = s.showBadge;
  const modeInput = document.querySelector(`input[name="mode"][value="${s.mode}"]`);
  if (modeInput) modeInput.checked = true;
});

els.enabled.addEventListener('change', () =>
  chrome.storage.sync.set({ enabled: els.enabled.checked }));

els.threshold.addEventListener('input', () => {
  els.thresholdValue.textContent = els.threshold.value;
  chrome.storage.sync.set({ threshold: parseFloat(els.threshold.value) });
});

els.showBadge.addEventListener('change', () =>
  chrome.storage.sync.set({ showBadge: els.showBadge.checked }));

document.querySelectorAll('input[name="mode"]').forEach(r =>
  r.addEventListener('change', e =>
    chrome.storage.sync.set({ mode: e.target.value })));

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (!tab || !tab.url || !tab.url.includes('linkedin.com')) return;
  chrome.tabs.sendMessage(tab.id, { type: 'getStats' }, (stats) => {
    if (chrome.runtime.lastError || !stats) return;
    els.scanned.textContent = stats.scanned;
    els.flagged.textContent = stats.flagged;
  });
});

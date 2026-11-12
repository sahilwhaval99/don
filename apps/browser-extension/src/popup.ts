document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('relay-status');
  const openBtn = document.getElementById('open-dashboard');
  const reconnectBtn = document.getElementById('reconnect-relay');

  const updateBadge = (status: string) => {
    if (!statusEl) return;
    statusEl.textContent = status;
    if (status === 'CONNECTED') {
      statusEl.classList.remove('disconnected');
    } else {
      statusEl.classList.add('disconnected');
    }
  };

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(['relayStatus'], (res) => {
      updateBadge((res.relayStatus as string) || 'DISCONNECTED');
    });
  }

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'http://localhost:3000' });
    });
  }

  if (reconnectBtn) {
    reconnectBtn.addEventListener('click', () => {
      updateBadge('CONNECTING');
      chrome.runtime.sendMessage({ type: 'RECONNECT_RELAY' }, () => {
        setTimeout(() => {
          chrome.storage?.local?.get(['relayStatus'], (res) => {
            updateBadge((res.relayStatus as string) || 'DISCONNECTED');
          });
        }, 400);
      });
    });
  }
});

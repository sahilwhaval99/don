document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('open-dashboard');
  if (btn) {
    btn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'http://localhost:3000' });
    });
  }
});

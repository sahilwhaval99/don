// Minimal content script for controlled media playback on allowed pages (e.g. YouTube)
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.command === 'TOGGLE_PLAYBACK') {
      const video = document.querySelector('video') as HTMLVideoElement | null;
      if (video) {
        if (video.paused) {
          video.play();
          sendResponse({ state: 'PLAYING' });
        } else {
          video.pause();
          sendResponse({ state: 'PAUSED' });
        }
      } else {
        sendResponse({ error: 'No HTML5 video element found on page.' });
      }
    }
  });
}

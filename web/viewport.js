// Browser presentation only. WebEngine owns the canvas backing size and projection.
(() => {
  const root = document.documentElement;
  const preview = new URLSearchParams(location.search).get('previewDevice') === 'iphone16' && window.self !== window.top;
  const ua = navigator.userAgent || '';
  const touch = navigator.maxTouchPoints > 0;
  const ipad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const mobile = preview || !!navigator.userAgentData?.mobile || /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || ipad;
  // Device category is a browser hint, not a hardware guarantee. Touch laptops stay desktop.
  const tablet = ipad || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const type = preview ? 'phone' : mobile ? (tablet ? 'tablet' : 'phone') : 'desktop';
  root.dataset.device = type;
  const playable = document.body.classList.contains('playable');
  if (!mobile && playable) {
    const panel = document.getElementById('developer-panel');
    if (panel) {
      const paragraph = document.createElement('p');
      const link = document.createElement('a');
      const url = new URL('preview.html', location.href);
      url.search = location.search;
      link.href = url.href;
      link.textContent = 'Preview iPhone 16 landscape';
      paragraph.append(link);
      panel.append(paragraph);
    }
  }
  let dismissed = false;
  let requesting = false;
  let prompt;
  if (mobile && playable && !preview) {
    prompt = document.createElement('section');
    prompt.id = 'landscape-prompt';
    prompt.setAttribute('aria-label', 'Screen orientation');
    prompt.innerHTML = '<div><h2>Turn your device sideways</h2><p id="landscape-message" role="status">The café fits best in landscape. Tap below to try automatic rotation, or rotate your device.</p><button id="landscape-enter">Use landscape</button><button id="landscape-dismiss">Continue in portrait</button></div>';
    document.body.append(prompt);
    document.getElementById('landscape-enter').addEventListener('click', () => requestLandscape(true));
    document.getElementById('landscape-dismiss').addEventListener('click', () => {
      dismissed = true;
      update();
    });
  }

  function update() {
    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width || window.innerWidth);
    const height = Math.round(viewport?.height || window.innerHeight);
    root.style.setProperty('--game-width', `${width}px`);
    root.style.setProperty('--game-height', `${height}px`);
    const landscape = width >= height;
    root.dataset.orientation = landscape ? 'landscape' : 'portrait';
    window.cafeDevice = {
      type, mobile, touch,
      preview: preview ? 'iphone16' : null,
      screen: {width: screen.width, height: screen.height},
      viewport: {width, height},
      pixelRatio: window.devicePixelRatio || 1,
      orientation: landscape ? 'landscape' : 'portrait'
    };
    if (prompt) prompt.hidden = landscape || dismissed;
  }

  async function requestLandscape(fullscreen) {
    if (!mobile || !playable || preview || requesting) return;
    requesting = true;
    try {
      // Many browsers require fullscreen, entered directly from a user gesture.
      if (fullscreen && !document.fullscreenElement && root.requestFullscreen) {
        try { await root.requestFullscreen(); } catch { /* Rotation may still be supported. */ }
      }
      if (screen.orientation?.lock) await screen.orientation.lock('landscape');
    } catch {
      // iOS and browsers that deny locking retain a usable responsive portrait view.
    } finally {
      requesting = false;
      update();
      if (prompt && !prompt.hidden) {
        document.getElementById('landscape-message').textContent =
          'If automatic rotation is unavailable, turn your device sideways and check that rotation lock is off. You can also continue in portrait.';
      }
    }
  }

  update();
  window.addEventListener('resize', update);
  window.visualViewport?.addEventListener('resize', update);
  screen.orientation?.addEventListener('change', update);
  document.addEventListener('fullscreenchange', update);
  if (mobile && playable && !preview) {
    // Try at startup where permitted, then retry with the first activation.
    requestLandscape(false);
    const activate = event => {
      if (!event.isTrusted) return;
      document.removeEventListener('click', activate, true);
      if (dismissed || event.target.closest('#landscape-dismiss')) return;
      requestLandscape(true);
    };
    document.addEventListener('click', activate, true);
  }
})();

(() => {
  const frame = document.getElementById('preview-game');
  const stage = document.getElementById('preview-stage');
  const space = document.getElementById('preview-space');
  const zoom = document.getElementById('preview-zoom');
  const safe = document.getElementById('preview-safe');
  const game = new URL('./', location.href);
  game.search = location.search;
  game.searchParams.delete('tools');
  game.searchParams.delete('preview');
  game.searchParams.delete('previewDevice');
  document.getElementById('preview-exit').href = game.href;
  game.searchParams.set('previewDevice', 'iphone16');
  frame.src = game.href;

  function applySafeArea() {
    const root = frame.contentDocument?.documentElement;
    if (!root) return;
    root.style.setProperty('--game-safe-top', '0px');
    root.style.setProperty('--game-safe-right', safe.checked ? '59px' : '0px');
    root.style.setProperty('--game-safe-bottom', safe.checked ? '21px' : '0px');
    root.style.setProperty('--game-safe-left', safe.checked ? '59px' : '0px');
  }
  function resize() {
    const scale = zoom.value === 'fit'
      ? Math.max(.1, Math.min(1, (stage.clientWidth - 48) / 852, (stage.clientHeight - 48) / 393))
      : Number(zoom.value);
    space.style.width = `${852 * scale}px`;
    space.style.height = `${393 * scale}px`;
    frame.style.transform = `scale(${scale})`;
  }
  frame.addEventListener('load', applySafeArea);
  safe.addEventListener('change', applySafeArea);
  zoom.addEventListener('change', resize);
  document.getElementById('preview-reload').addEventListener('click', () => frame.contentWindow.location.reload());
  new ResizeObserver(resize).observe(stage);
  resize();
})();

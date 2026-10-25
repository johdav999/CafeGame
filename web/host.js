const buttons = [...document.querySelectorAll('[data-command]')];
window.engineStatus = (text, error) => {
  document.getElementById('status').textContent = text;
  if (error) { window.cafeHostError = text; buttons.forEach(button => button.disabled = true); }
};
window.engineStats = () => {};
window.enginePerformance = () => {};
var Module = {
  canvas: document.getElementById('viewport'),
  onAbort: reason => window.engineStatus(String(reason), true)
};
buttons.forEach(button => button.addEventListener('click', () => Module._cafe_command(Number(button.dataset.command))));
window.cafeUpdate = state => {
  window.cafeState = state;
  document.getElementById('served').textContent = state.served;
  document.getElementById('coins').textContent = state.coins;
  document.getElementById('order').textContent = state.paused ? 'Shift paused.' : state.ready ? 'Coffee is ready. Serve your guest!' : state.brewing > 0 ? `Brewing… ${Math.ceil(state.brewing)}s` : 'Brew a coffee, then serve your guest.';
  buttons[0].disabled = !!window.cafeHostError || state.paused || state.ready || state.brewing > 0;
  buttons[1].disabled = !!window.cafeHostError || state.paused || !state.ready;
  buttons[2].disabled = !!window.cafeHostError;
  buttons[2].textContent = state.paused ? 'Resume' : 'Pause';
};
document.addEventListener('visibilitychange', () => Module._cafe_suspend?.(document.hidden ? 1 : 0));
window.addEventListener('pagehide', () => Module._cafe_shutdown?.());
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });

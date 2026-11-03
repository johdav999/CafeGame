// Menu presentation only. Relocate existing nodes to retain host bindings and state.
(() => {
  const $ = id => document.getElementById(id);
  const menu = $('menu-view');
  if (!menu || document.body.classList.contains('workbench')) return;
  const icon = name => window.cafeArtIcon(name);
  const heading = menu.querySelector(':scope > h2');
  const header = document.createElement('header');
  header.className = 'menu-welcome';
  header.innerHTML = '<img class="menu-banner" src="assets/ui/menu-cafe.webp" width="768" height="512" alt="" fetchpriority="low"><div class="menu-welcome-copy"><span class="eyebrow">THE CAFÉ NOTEBOOK</span><h2>Your café</h2><p>A little care. A place to call your own.</p></div>';
  heading.replaceWith(header);

  const save = document.createElement('section');
  save.className = 'menu-save';
  save.setAttribute('aria-label', 'Save and restore');
  const actions = document.createElement('div');
  actions.className = 'actions menu-save-actions';
  for (const command of [3, 4]) {
    const button = menu.querySelector(`[data-command="${command}"]`);
    button.prepend(icon(command === 3 ? 'check' : 'clock'));
    actions.append(button);
  }
  save.append(actions, $('save-status'));
  header.after(save);
  const pauseNote = document.createElement('p');
  pauseNote.className = 'menu-pause-note';
  pauseNote.textContent = 'Service continues while you browse. Use Pause above to take your time.';
  save.after(pauseNote);

  const nav = document.createElement('nav');
  nav.className = 'menu-jumps';
  nav.setAttribute('aria-label', 'Menu sections');
  pauseNote.after(nav);
  const content = $('management-slot');
  function section(id, title, description, art) {
    const node = document.createElement('section');
    node.id = `menu-${id}`;
    node.className = 'menu-section';
    node.setAttribute('aria-labelledby', `${node.id}-title`);
    const top = document.createElement('div');
    top.className = 'menu-section-heading';
    const copy = document.createElement('div');
    const h = document.createElement('h3');
    h.id = `${node.id}-title`;
    h.textContent = title;
    h.tabIndex = -1;
    const p = document.createElement('p');
    p.textContent = description;
    copy.append(h, p); top.append(icon(art), copy); node.append(top);
    content.append(node);
    const link = document.createElement('a');
    link.href = `#${node.id}`;
    link.textContent = title;
    link.addEventListener('click', event => {
      event.preventDefault();
      h.focus({preventScroll: true});
      node.scrollIntoView({block: 'start', behavior: 'instant'});
    });
    nav.append(link);
    return node;
  }
  const campaign = menu.querySelector('.campaign-panel');
  const day = section('day', 'Your day', 'Open, grow and celebrate your café.', 'sun');
  day.append(campaign);
  const garden = section('garden', 'Garden Café', 'An attached courtyard for your neighborhood café.', 'sun');
  const gardenStatus = document.createElement('p');
  gardenStatus.id = 'garden-status';
  gardenStatus.setAttribute('role', 'status');
  gardenStatus.textContent = 'Checking Garden Café availability…';
  garden.append(gardenStatus);
  const gardenActions = document.createElement('div');gardenActions.className='actions';
  for(const [id,label,command] of [['garden-select','Select Garden Café',40],['garden-open','Open courtyard',41],['garden-workshop','Garden workshop',42]]) {
    const button=document.createElement('button');button.id=id;button.textContent=label;button.disabled=true;
    button.onclick=()=>Module._cafe_command(command);gardenActions.append(button);
  }
  garden.append(gardenActions);
  window.cafeGardenUpdate=(state,editable)=>{
    $('garden-select').disabled=!editable||!state.installed||!state.owned||state.selected;
    $('garden-open').disabled=!editable||!state.installed||!state.owned||!state.selected||state.open;
    $('garden-workshop').disabled=!state.installed||!state.owned;
    gardenActions.hidden=!state.installed||!state.owned;
    for(const id of [101,102]) {
      let option=$('layout-id').querySelector(`option[value="${id}"]`);
      if(state.open&&!option){option=document.createElement('option');option.value=String(id);option.textContent=`Outdoor table ${id-100}`;$('layout-id').append(option);}
      if(!state.open&&option){if($('layout-id').value===String(id))$('layout-id').value='1';option.remove();}
    }
    for(const card of document.querySelectorAll('[data-build-id="101"],[data-build-id="102"]'))card.hidden=!state.open;
  };
  const team = section('team', 'Your team', 'A happy team keeps the coffee flowing.', 'person');
  team.append($('staff-panel'));
  const money = section('money', 'Finances', 'Know what comes in and what goes out.', 'coin');
  money.append($('finance-panel'));
  const preferences = section('preferences', 'Preferences', 'Make yourself comfortable.', 'menu');
  preferences.append($('settings-panel'));
  const advanced = section('advanced', 'Advanced', 'Practice scenarios and technical information.', 'work');
  advanced.append($('developer-panel'));
  // The remaining original action is a staff shortcut, kept beside staffing.
  const breakButton = menu.querySelector('[data-command="7"]');
  if (breakButton) $('staff-panel').append(breakButton);
  for (const row of [...content.querySelectorAll(':scope > .actions')]) {
    if (!row.children.length) row.remove();
  }
  const campaignActions = campaign.querySelector(':scope > .actions');
  const restart = document.createElement('details');
  restart.className = 'menu-restart';
  restart.innerHTML = '<summary>Start fresh or restart</summary><p>A new campaign replaces this café. Restart day restores its opening checkpoint. Save your current shift first if you want to keep it.</p>';
  for (const command of [0, 4]) restart.append(campaign.querySelector(`[data-campaign="${command}"]`));
  campaign.append(restart);
  campaignActions.classList.add('menu-day-actions');
  const labels = {
    'staff-panel': ['person', 'Staff & priorities'],
    'finance-panel': ['coin', 'Cash flow & transactions'],
    'settings-panel': ['menu', 'Sound & accessibility'],
    'developer-panel': ['work', 'Tools & scenarios'],
    'cafe-journal': ['goal', null],
    'campaign-details': ['clock', 'Goals & day results']
  };
  for (const [id, [art, label]] of Object.entries(labels)) {
    const summary = $(id).querySelector(':scope > summary');
    if (label) summary.textContent = label;
    summary.prepend(icon(art));
  }
  // Compact explanatory copy remains available, while routine controls lead.
  for (const id of ['staff-panel', 'finance-panel']) {
    const panel = $(id);
    const help = document.createElement('details');
    help.className = 'menu-help';
    help.innerHTML = `<summary>${id === 'staff-panel' ? 'Hiring, wages & role guide' : 'Prices, costs & profit guide'}</summary>`;
    const paragraphs = [...panel.querySelectorAll(':scope > p:not([id]), :scope > small')];
    help.append(...paragraphs);
    panel.append(help);
  }
  const settings = $('settings-panel');
  function fieldset(title, ids) {
    const field = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = title;
    field.append(legend);
    for (const id of ids) field.append($(id).closest('label') || $(id));
    settings.append(field);
  }
  fieldset('Café sounds', ['audio-muted', 'effects-volume', 'ambience-volume', 'sound-test', 'audio-status']);
  fieldset('Reading & motion', ['ui-size', 'reduced-motion', 'guide-show']);
  for (const note of [...settings.querySelectorAll(':scope > p:not([id])')]) settings.append(note);
  settings.append($('camera-help'));
  // State updates come through the existing host event; never poll or advance gameplay.
  const priorInspector = window.cafeInspector;
  let previousCampaign;
  window.cafeInspector = json => {
    priorInspector(json);
    const state = window.cafeCampaignState;
    if (!state) return;
    const phase = state.enabled ? ['Preparation', 'Service', 'Closing', 'Day complete'][state.phase] : 'Practice café';
    header.querySelector('h2').textContent = state.enabled ? `Your café · Day ${state.day}` : 'Your café';
    header.querySelector('.eyebrow').textContent = phase || 'THE CAFÉ NOTEBOOK';
    for (const [command, visible] of [[1, state.enabled && state.phase === 0], [2, state.enabled && state.phase === 1], [3, state.enabled && state.phase === 3]]) {
      campaign.querySelector(`[data-campaign="${command}"]`).hidden = !visible;
    }
    if (previousCampaign !== state.enabled) {
      restart.open = !state.enabled;
      restart.querySelector('summary').textContent = state.enabled ? 'Start fresh or restart' : 'Start a campaign';
      previousCampaign = state.enabled;
    }
  };
})();

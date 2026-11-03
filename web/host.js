const buttons = [...document.querySelectorAll('[data-command]')].sort((a,b)=>Number(a.dataset.command)-Number(b.dataset.command));
window.engineStatus = (text, error) => {
  document.getElementById('status').textContent = text;
  window.cafeHostError = error ? text : null;
  if (error) buttons.forEach(button => button.disabled = true);
};
window.engineStats = () => {};
window.enginePerformance = () => {};
var Module = {
  canvas: document.getElementById('viewport'),
  onAbort: reason => window.engineStatus(String(reason), true)
};
buttons.forEach(button => button.addEventListener('click', () => {
  let command=Number(button.dataset.command);
  if(command===6){const profile=Number(document.getElementById('guest-profile').value),first=Number(document.getElementById('guest-first').value),second=Number(document.getElementById('guest-second').value);{Module._cafe_guest_seating(profile,first,second,Number(document.getElementById('guest-seating').value));return;}command=profile===1?18:profile===2?19:6;}
  Module._cafe_command(command);
}));
window.cafeOccupancy = (waiting, seated, counter, guests, dining, waitingSeats) => {
  window.cafeOccupancyState = {waiting, seated, counter, guests, dining, waitingSeats};
  document.getElementById('occupancy').textContent = `${waiting} guests waiting · ${seated} of ${window.cafeLayoutState?.tables.filter(p=>p.id<=4||p.id===101||p.id===102).length ?? 2} seats reserved${waitingSeats ? ` · ${waitingSeats} waiting for a seat` : ''}`;
};
window.cafeWorkflow = (key, state, onShift, handoverReady, dirty) => {
  onShift = !!onShift;
  handoverReady = !!handoverReady;
  window.cafeWorkflowState = {key, state, onShift, handoverReady, dirty};
  const labels = {'cafe:collect':'Collecting supplies', 'cafe:prepare':'Preparing the ticket', 'cafe:assist':'Preparing alongside a colleague', 'cafe:handover':'Handing over the ticket', 'cafe:clean':'Cleaning a table', 'cafe:machine-clean':'Cleaning the espresso machine', 'cafe:machine-repair':'Repairing the espresso machine'};
  const taskLabel=labels[key] || (key.startsWith('cafe:restock-')?'Restocking supplies':'Working');
  document.getElementById('workflow').textContent = !onShift ? 'Lead staff member is on a break. Other staff can continue working.' : key ? `${taskLabel}${state === 1 ? ' · walking' : ''}${dirty ? ` · ${dirty} table(s) awaiting cleaning` : ''}` : 'Lead staff member is available.';
};
window.cafeSupply = (stored, incoming, remaining, automatic, pending) => {
  window.cafeSupplyState = {stored, incoming, remaining, automatic:!!automatic, pending:!!pending};
};
const money = value => (value / 100).toFixed(2);
window.cafeQuality = (integrity, cleanliness, score, remaining, wasted, maintenance, taskState, workRemaining, usable, message) => {
  window.cafeQualityState = {integrity, cleanliness, score, remaining, wasted, maintenance, taskState, workRemaining, usable:!!usable};
  const care = maintenance ? ` · ${maintenance === 1 ? 'Cleaning' : 'Repair'} ${taskState < 0 ? 'queued after current ticket' : taskState === 0 ? 'queued' : taskState === 1 ? 'walking' : `${(workRemaining / 1000).toFixed(1)}s`}` : '';
  const cup = remaining ? ` · Ticket quality ${Math.floor(score / 10)}% · Fresh for ${Math.ceil(remaining / 1000)}s` : '';
  const blocked = !maintenance && !usable ? ' · Machine needs cleaning or repair before brewing.' : '';
  document.getElementById('quality').textContent = `Machine ${integrity / 10}% · Cleanliness ${cleanliness / 10}%${cup}${care} · Discarded items ${wasted}${blocked}${message ? ` · ${message}` : ''}`;
};
let lastJournal;
window.cafeEconomy = (cash, sales, supplies, wages, profit, due, available, staffed, message, journal, maintenance = 0, furniture = 0) => {
  const previousCash=window.cafeEconomyState?.cash;
  const hiring=window.cafeStaffState?.hiringMinor ?? 0;
  const c=window.cafeCampaignState,overhead=c?.enabled?(c.day-1+(c.phase===3?1:0))*500-c.overheadDue:0,rewards=c?.enabled?[0,1,2,3].filter(n=>c.goals&(1<<n)).length*500:0;
  const upgrades=window.cafeEquipmentState?.netCost ?? 0,journalRewards=c?.enabled?(c.journal?.totalRewards ?? 0):0;
  window.cafeEconomyState = {cash, sales, supplies, wages, profit, due, available, staffed, maintenance, furniture, hiring, overhead, rewards, journalRewards, upgrades};
  document.getElementById('economy').textContent = `Sales ${money(sales)} · Net supplies ${money(supplies)} · Wages paid ${money(wages)} · Hiring ${money(hiring)} · Net repairs ${money(maintenance)} · Net furniture ${money(furniture)} · Net equipment/decor ${money(upgrades)} · Overhead paid ${money(overhead)} · Objective rewards ${money(rewards)} · Journal rewards ${money(journalRewards)} · Lifetime net cash flow ${money(profit)} · Wages owed ${money(due)}`;
  document.getElementById('economy-status').textContent = message || (due ? 'Wages are owed. Ticket income will pay them before new supplies.' : available < 1200 ? `A 12-bean order costs 12.00; available cash ${money(available)}.` : 'Cash covers the next supply order.');
  if (cash !== previousCash) drawLayout();
  if (journal === lastJournal) return;
  lastJournal = journal;
  const fragment = document.createDocumentFragment();
  const labels = {'cafe:sales':'Ticket sale', 'cafe:purchases':'Ingredient purchase', 'cafe:refunds':'Supplier refund', 'cafe:wages':'Staff wages', 'cafe:maintenance':'Machine repair', 'cafe:repair-refunds':'Repair refund', 'cafe:hires':'Staff hiring', 'cafe:furniture-buys':'Table purchase', 'cafe:furniture-sales':'Table sale', 'cafe:overhead':'Daily rent and utilities', 'cafe:goals':'Campaign objective reward','cafe:upgrades':'Equipment or decor purchase','cafe:resale':'Equipment or decor resale','cafe:daily':'Daily journal goal','cafe:achievements':'Lifetime achievement','garden:chapters':'Garden chapter reward'};
  for (const entry of JSON.parse(journal).reverse()) {
    const li = document.createElement('li');
    li.textContent = `${Math.floor(entry.time / 1000)}s · ${labels[entry.stream]} · ${entry.amount > 0 ? '+' : ''}${money(entry.amount)}`;
    fragment.append(li);
  }
  document.getElementById('ledger').replaceChildren(fragment);
};
window.cafeUpdate = state => {
  window.cafeState = state;
  document.getElementById('served').textContent = state.served;
  document.getElementById('coins').textContent = money(window.cafeEconomyState?.cash ?? state.coins * 100);
  document.getElementById('order').textContent = state.paused ? 'Shift paused.' : state.ready ? 'Coffee is ready. Serve your guest!' : state.brewing > 0 ? `Brewing… ${Math.ceil(state.brewing)}s` : 'Brew a coffee, then serve your guest.';
  buttons[0].disabled = !!window.cafeHostError || state.paused || state.ready || state.brewing > 0;
  buttons[1].disabled = !!window.cafeHostError || state.paused || !state.ready || !window.cafeWorkflowState?.handoverReady;
  buttons[2].disabled = !!window.cafeHostError;
  // Keep the button's contents stable between pointer-down and pointer-up.
  // Replacing them every frame can cancel clicks on its generated icon.
  const pauseLabel = state.paused ? 'Resume' : 'Pause';
  if (buttons[2].textContent !== pauseLabel) buttons[2].textContent = pauseLabel;
  buttons[7].disabled = !!window.cafeHostError || state.paused;
  buttons[7].textContent = window.cafeStaffState?.staff[0]?.breakPending ? 'Cancel scheduled break' : window.cafeWorkflowState?.onShift ? 'Take staff break' : 'Resume staff shift';
  buttons[3].disabled = buttons[4].disabled = !!window.cafeHostError;
  const supply = window.cafeSupplyState;
  const unavailable = !!window.cafeHostError || state.paused || !supply;
  buttons[8].disabled = unavailable || supply.pending || supply.stored + supply.incoming > 12 || (window.cafeEconomyState?.available ?? 0) < 1200;
  buttons[9].disabled = unavailable || supply.stored === 0 || (window.cafeDiagnosticState?.stock ?? 0) + (window.cafeDiagnosticState?.inputHeld ?? 0) >= 100;
  buttons[10].disabled = unavailable;
  buttons[10].textContent = supply?.automatic ? 'Disable auto supply' : 'Enable auto supply';
  buttons[10].setAttribute('aria-pressed', String(!!supply?.automatic));
  buttons[11].disabled = unavailable || !supply.pending;
  if (supply) document.getElementById('supply').textContent = `Machine: ${window.cafeDiagnosticState?.stock ?? 4} beans · Storeroom: ${supply.stored}/24 · ${supply.pending ? `Delivery: ${Math.ceil(supply.remaining / 1000)}s (${supply.incoming} space reserved)` : 'No delivery scheduled'} · Auto supply ${supply.automatic ? 'on' : 'off'}. Restock moves up to 4 beans. Beans cost 1.00 each; orders are prepaid and cancelled deliveries are refunded.`;
  const quality = window.cafeQualityState;
  const busy = !!window.cafeHostError || state.paused || !quality;
  buttons[0].disabled ||= !quality?.usable || !!window.cafeLayoutState?.closed;
  buttons[12].disabled = busy || !!quality.maintenance || quality.cleanliness === 1000;
  buttons[13].disabled = busy || !!quality.maintenance || quality.integrity === 1000 || (window.cafeEconomyState?.available ?? 0) < (window.cafeEquipmentState?.fast?750:500);
  buttons[14].disabled = !!window.cafeHostError || state.paused || !quality?.maintenance;
  const occupancy = window.cafeOccupancyState;
  buttons[6].disabled = !!window.cafeHostError || state.paused || !occupancy || occupancy.waiting >= 3 || occupancy.guests >= 8 || !!window.cafeLayoutState?.closed;
  buttons[15].disabled = !!window.cafeHostError || state.paused || (window.cafeClockState?.stage ?? 0)!==0;
  buttons[15].title=(window.cafeClockState?.stage ?? 0)!==0?'Finish this period, then use the clock button to start the next period.':'Close the cafe for furnishing changes, or reopen it when ready.';
  buttons[15].textContent = window.cafeLayoutState?.closed ? 'Reopen cafe' : 'Close for layout';
  const traffic=document.querySelector('[data-command="17"]');
  traffic.disabled=!!window.cafeHostError || state.paused;
  traffic.textContent=window.cafeDemandState?.automatic ? 'Pause foot traffic' : 'Resume foot traffic';
  traffic.setAttribute('aria-pressed',String(!!window.cafeDemandState?.automatic));
};
window.cafeDiagnostics = diagnostic => {
  window.cafeDiagnosticState = diagnostic;
  if (diagnostic.job === 1 && !window.cafeState.paused) document.getElementById('order').textContent = 'Barista is walking to the espresso machine…';
  const orders = ['Accepted', 'Preparing', 'Ready', 'Delivered', 'Abandoned', 'Failed'];
  const jobs = ['Queued', 'Assigned', 'Running', 'Completed', 'Cancelled', 'Failed'];
  document.getElementById('diagnostics').textContent = `Order: ${orders[diagnostic.order] || 'None'} · Job: ${jobs[diagnostic.job] || 'None'} · Beans: ${diagnostic.stock} · Input reserved: ${diagnostic.inputHeld} · Output reserved: ${diagnostic.outputHeld} · Patience: ${diagnostic.patience}s`;
  buttons[0].disabled ||= diagnostic.order >= 0 && diagnostic.order <= 2 || diagnostic.stock === 0;
  if (!window.cafeState.paused && diagnostic.stock === 0 && (diagnostic.order > 2 || diagnostic.order < 0)) document.getElementById('order').textContent = 'Out of beans. Order supplies, then restock the machine.';
  buttons[5].disabled = !!window.cafeHostError || window.cafeState.paused || diagnostic.order < 0 || diagnostic.order > 2;
};
window.cafeStoreSave = (pointer, length) => {
  try {
    let raw = '';
    const bytes = HEAPU8.subarray(pointer, pointer + length);
    for (let i = 0; i < bytes.length; i += 4096) raw += String.fromCharCode(...bytes.subarray(i, i + 4096));
    localStorage.setItem('cafegame.shift.v1', btoa(raw));
    return 1;
  } catch { return 0; }
};
window.cafeReadSave = () => {
  window.cafePendingSave = null;
  try {
    const stored = localStorage.getItem('cafegame.shift.v1');
    if (!stored || stored.length > 12 * 1024 * 1024) return 0;
    window.cafePendingSave = Uint8Array.from(atob(stored), character => character.charCodeAt(0));
    return window.cafePendingSave.length;
  } catch { return 0; }
};
document.addEventListener('visibilitychange', () => Module._cafe_suspend?.(document.hidden ? 1 : 0));
window.addEventListener('pagehide', () => Module._cafe_shutdown?.());
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });

// Accessible form plus a top-down preview; C++ owns snapping and validation.
const layoutFields = ['id', 'x', 'z', 'rotation'].map(name => document.getElementById(`layout-${name}`));
let lastLayout;
window.cafeLayout = (closed, editable, tables, message) => {
  const signature = JSON.stringify([closed, editable, tables, message, window.cafeHostError]);
  window.cafeLayoutState = {closed:!!closed, editable:!!editable, tables:JSON.parse(tables), message};
  if (lastLayout === signature) return;
  lastLayout = signature;
  document.getElementById('layout-status').textContent = message || (editable ? 'Cafe empty. Ready to edit.' : closed ? 'Waiting for guests, service and cleanup to finish.' : 'Cafe open. Close for layout to edit furniture.');
  drawLayout();
};
function drawLayout() {
  const state = window.cafeLayoutState;
  if (!state || !Module._cafe_layout_preview) return;
  const [id, x, z, rotation] = layoutFields.map(field => Number(field.value));
  const finite = layoutFields.every(field => field.value !== '' && field.validity.valid) && [id,x,z,rotation].every(Number.isFinite);
  const error = finite ? Module._cafe_layout_preview(id,x,z,rotation) : 1;
  const item=window.cafeEquipmentState?.catalog.find(item=>item.id===id),price=item?.price ?? 600,refund=item?.refund ?? 300;
  const gate=item?.gate || (id>=3 && id<=4?window.cafeEquipmentState?.extraTablesReason:'');
  const reasons = ['Valid placement. Routes stay open.', 'Enter valid coordinates and rotation.', 'Table already exists.', 'Table is not placed.', 'Keep the footprint and access space inside the room.', 'Overlaps another object.', 'Leave clear furniture and interaction space.', 'A required route is blocked.', 'Furniture limit reached.'];
  document.getElementById('layout-preview').textContent = `${reasons[error] || 'Invalid placement.'} Footprint ${((item?.width ?? 4)*.5).toFixed(1)} × ${((item?.depth ?? 8)*.5).toFixed(1)} m · Buy ${money(price)} · Resale ${money(refund)}.${gate?` ${gate}`:''}`;
  document.getElementById('layout-apply').disabled = !!window.cafeHostError || !state.editable || error !== 0;
  const exists = state.tables.some(p => p.id === id);
  document.getElementById('layout-apply').textContent = exists ? 'Apply placement' : `Buy ${item?item.name.toLowerCase():'table'} · ${money(price)}`;
  document.getElementById('layout-apply').disabled ||= !exists && ((window.cafeEconomyState?.available ?? 0) < price || !!gate);
  document.getElementById('layout-sell').disabled = !!window.cafeHostError || !state.editable || !exists;
  document.getElementById('layout-sell').textContent=item?`Sell ${item.name.toLowerCase()} · ${money(refund)}`:'Sell table';
  if(item?.sellReason)document.getElementById('layout-sell').disabled=true;
  const canvas = document.getElementById('layout-map'),ctx = canvas.getContext('2d'),cell = 20,cols=window.cafeGardenState?.open?36:24;canvas.width=cols*cell;
  ctx.fillStyle = '#f3e9d2';ctx.fillRect(0,0,cols*cell,400);
  ctx.strokeStyle = '#d4c9b4';ctx.lineWidth = 1;
  for(let gx=0;gx<=cols;gx++){ctx.beginPath();ctx.moveTo(gx*cell,0);ctx.lineTo(gx*cell,400);ctx.stroke();}
  for(let gz=0;gz<=20;gz++){ctx.beginPath();ctx.moveTo(0,gz*cell);ctx.lineTo(cols*cell,gz*cell);ctx.stroke();}
  ctx.fillStyle='#302b25';
  for(const [gx,gz,w,d] of [[5,4,14,4],[19,0,4,3],[2,1,2,3]])ctx.fillRect(gx*cell,gz*cell,w*cell,d*cell);
  ctx.font='15px system-ui';ctx.fillStyle='#f3e9d2';ctx.fillText('Counter',145,125);
  function footprint(p,preview=false) {
    const width=p.width ?? item?.width ?? 4,depth=p.depth ?? item?.depth ?? 8;
    const w=p.rotation%2?depth:width,d=p.rotation%2?width:depth;
    ctx.fillStyle=preview?(error?'#c5765688':'#8fa58b99'):'#243c32';
    ctx.fillRect(p.x*cell+2,p.z*cell+2,w*cell-4,d*cell-4);
    const name=(p.id===101||p.id===102)?`Outdoor ${p.id-100}`:p.id<=4?`Table ${p.id}`:window.cafeEquipmentState?.catalog.find(i=>i.id===p.id)?.name || 'Item';
    ctx.fillStyle=preview?'#302b25':'#f3e9d2';if(w>=3)ctx.fillText(preview?'Preview':name,p.x*cell+7,p.z*cell+22);
    const access = [[p.x+Math.floor(width/2),p.z+depth],[p.x-1,p.z+Math.floor(width/2)],[p.x+Math.floor((width-1)/2),p.z-1],[p.x+depth,p.z+Math.floor((width-1)/2)]][p.rotation];
    if(access){ctx.fillStyle='#d7ac5b';ctx.fillRect(access[0]*cell+4,access[1]*cell+4,12,12);}
  }
  for(const p of state.tables)footprint(p);
  const candidate={id,x:Math.round((x+6)*2),z:Math.round((z+5)*2),rotation};
  const current=state.tables.find(p=>p.id===id);
  if(finite && (!current || current.x!==candidate.x || current.z!==candidate.z || current.rotation!==rotation))footprint(candidate,true);
  ctx.fillStyle='#302b25';ctx.fillText('Entrance →',380,175);
}
layoutFields.forEach(field => field.addEventListener('input', drawLayout));
layoutFields[0].addEventListener('change', () => {
  const p=window.cafeLayoutState?.tables.find(p=>p.id===Number(layoutFields[0].value));
  if(p){layoutFields[1].value=String(p.x*.5-6);layoutFields[2].value=String(p.z*.5-5);layoutFields[3].value=String(p.rotation);}
  else if(Number(layoutFields[0].value)>=101){layoutFields[1].value='7';layoutFields[2].value=Number(layoutFields[0].value)===101?'-4.5':'0.5';layoutFields[3].value='0';} else {const item=window.cafeEquipmentState?.catalog.find(i=>i.id===Number(layoutFields[0].value));if(item){layoutFields[1].value=String(item.x*.5-6);layoutFields[2].value=String(item.z*.5-5);layoutFields[3].value='0';}}
  drawLayout();
});
document.getElementById('layout-map').addEventListener('pointerdown', event => {
  const r=event.currentTarget.getBoundingClientRect();
  layoutFields[1].value=String(Math.round((event.clientX-r.left)/r.width*(window.cafeGardenState?.open?36:24))*.5-6);
  layoutFields[2].value=String(Math.round((event.clientY-r.top)/r.height*20)*.5-5);drawLayout();
});
for(const [button,action] of [['layout-apply',0],['layout-sell',1]])document.getElementById(button).addEventListener('click', () => {
  const [id,x,z,rotation]=layoutFields.map(field=>Number(field.value));
  const exists=window.cafeLayoutState.tables.some(p=>p.id===id);
  if(id<=4||id===101||id===102)Module._cafe_layout(action===0&&!exists?2:action,id,x,z,rotation);
  else {const item=window.cafeEquipmentState.catalog.find(item=>item.id===id);Module._cafe_equipment(action===1?2:exists?1:0,item.key,x,z,rotation);}
});

const guestProfiles = [
  {name:'House regular',preference:'balanced service · prefers a seat'},
  {name:'Commuter',preference:'quick service · takeaway'},
  {name:'Espresso enthusiast',preference:'fresh espresso · prefers a seat'}
];
let lastDemandRender;
window.cafeDemand = json => {
  const state=JSON.parse(json);state.automatic=!!state.automatic;window.cafeDemandState=state;
  const display={...state,remaining:Math.ceil(state.remaining/1000),guests:state.guests.map(g=>({...g,remaining:Math.ceil(g.remaining/1000)}))};
  const signature=JSON.stringify([display,window.cafeLayoutState?.closed]);if(signature===lastDemandRender)return;lastDemandRender=signature;
  const closed=window.cafeLayoutState?.closed;
  const clock=closed?'Cafe closed · arrivals held':state.automatic?`Next visit in ${Math.ceil(state.remaining/1000)}s`:'Foot traffic paused';
  document.getElementById('demand-summary').textContent=`${clock} · Reputation ${state.average/10}% · ${state.reviews} reviews · ${state.admitted} guests admitted · ${state.missed} visits missed at capacity`;
  const profile=guestProfiles[state.lastProfile];
  document.getElementById('demand-review').textContent=state.lastOutcome===1?`Latest: ${profile.name} · ${state.lastScore/10}% · Wait ${state.inputs[0]/10}% · Coffee ${state.inputs[1]/10}% · Cleanliness ${state.inputs[2]/10}% · Preference ${state.inputs[3]/10}%`:
    state.lastOutcome===2?`Latest: ${profile.name} left without an order · 0%. Serve before patience or coffee freshness expires.`:'No reviews yet. Base reputation starts at 75%; installed plants and lamps add small bonuses.';
  const fragment=document.createDocumentFragment();
  for(const g of display.guests) {
    const item=document.createElement('li');
    item.textContent=`Guest ${g.id} · ${guestProfiles[g.profile].name} · ${guestProfiles[g.profile].preference} · ${g.rating===1?`Review ${g.score/10}%`:g.rating===2?'Left without an order':g.rating===3?'Leaving':`${g.remaining}s patience`}`;
    if(g.rating===0){const progress=document.createElement('progress');progress.max=g.budget/1000;progress.value=g.remaining;progress.setAttribute('aria-label',`Guest ${g.id} patience remaining`);item.append(' ',progress);}
    fragment.append(item);
  }
  document.getElementById('guest-tickets').replaceChildren(fragment);
};

// Authoring tools inspect detached values. No query advances time or consumes RNG.
let authoredContent, lastInspectorRender=0;
window.cafeContent = json => {
  authoredContent=JSON.parse(json);
  authoredContent.profiles.forEach((p,i)=>{
    guestProfiles[i]={name:p.name,preference:p.takeaway?'quick service · takeaway':'prefers fresh coffee and a seat'};
    document.querySelector(`#guest-profile option[value="${i}"]`).textContent=p.name+(p.takeaway?' · takeaway':'');
  });
  const select=document.getElementById('scenario-select');
  select.replaceChildren(...authoredContent.scenarios.map((s,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=s.name;return option;}));
  select.disabled=false;document.getElementById('scenario-start').disabled=false;
  document.getElementById('content-definitions').textContent=authoredContent.processes.map(p=>`${p.key}: ${p.durationMs} ms, capability ${p.capability}`).join(' · ')+' · '+authoredContent.profiles.map(p=>`${p.name}: ${p.patienceMs/1000}s patience${p.takeaway?', takeaway':''}`).join(' · ');
  describeScenario();
};
function describeScenario() {
  const selected=authoredContent?.scenarios[Number(document.getElementById('scenario-select').value)];
  document.getElementById('scenario-description').textContent=selected?.description ?? '';
}
document.getElementById('scenario-select').addEventListener('change',describeScenario);
document.getElementById('scenario-start').addEventListener('click',()=>Module._cafe_scenario(Number(document.getElementById('scenario-select').value)));
window.cafeInspector = json => {
  const state=JSON.parse(json);window.cafeInspectorState=state;
  document.getElementById('report-export').disabled=!!window.cafeHostError;
  document.getElementById('scenario-start').disabled=!!window.cafeHostError || !Module._cafe_scenario;
  for(const action of state.actions) {
    const button=document.querySelector(`[data-command="${action.command}"]`);
    if(!button)continue;
    const reason=window.cafeHostError || (window.cafeState?.paused?'Resume the shift':action.reason);
    button.disabled=!!reason;button.title=reason || action.name;
  }
  if(!document.getElementById('inspector-panel').open || performance.now()-lastInspectorRender<200)return;
  lastInspectorRender=performance.now();
  const r=state.report;
  document.getElementById('inspector-summary').textContent=`Save format ${r.saveSchema} · Content ${r.contentVersion} / rules ${r.ruleRevision} · Fingerprint ${r.contentFingerprint} · Records: ${state.runtime.jobs}/${state.runtime.jobLimit} jobs, ${state.runtime.customers}/${state.runtime.customerLimit} guests, ${state.runtime.reservations} reservations, ${state.runtime.events} events · Clock ${Math.floor(r.timeMs/1000)}s · Seed state ${r.randomState} · RNG draws ${r.randomDraws} · ${r.served} served · ${r.wasted} discarded · Wages owed ${money(r.wagesDueMinor)}`;
  function list(id,lines) {
    document.getElementById(id).replaceChildren(...(lines.length?lines:['None']).map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  }
  list('action-reasons',state.actions.filter(a=>!a.enabled || window.cafeState?.paused).map(a=>`${a.name}: ${window.cafeState?.paused?'Resume the shift':a.reason}`));
  document.getElementById('inspector-stocks').replaceChildren(...state.stocks.map(s=>{
    const tr=document.createElement('tr');
    for(const value of [`${s.inventory} / ${s.resource}`,s.total,s.available,s.held,s.incoming,s.capacity]){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}return tr;
  }));
  list('inspector-jobs',state.jobs.map(j=>`Job ${j.id} · ${j.process} · Order ${j.order} · Worker ${j.worker || 'none'} · Station ${j.station || 'none'} · ${j.remainingMs} ms · ${j.reason}`));
  const states=['Queued','Assigned / walking','Running','Completed','Cancelled'];
  list('inspector-tasks',state.tasks.map(t=>`Task ${t.id} · ${t.key} · ${states[t.state]} · Role ${t.role} · Priority ${t.priority} · Worker ${t.worker || 'none'} · ${t.remainingMs} ms · Dependencies ${t.dependencies.join(', ') || 'none'}`));
  list('inspector-claims',state.claims.map(c=>`${['Queue','Counter','Seating'][c.pool]} · Guest ${c.guest} · ${c.point===null?'Waiting for a point':`Point ${c.point}`} · ${c.occupied?'Occupied':'Reserved'}`));
};

let lastMenuRender;
window.cafeMenu = json => {window.cafeMenuState=JSON.parse(json);};
function renderMenu() {
  const state=window.cafeMenuState;if(!state)return;
  const paused=!!window.cafeState?.paused,failed=!!window.cafeHostError;
  const summer=!!state.summer;
  let summerInfo=document.getElementById('summer-menu-info');
  if(!summerInfo){summerInfo=document.createElement('p');summerInfo.id='summer-menu-info';document.getElementById('menu-status').after(summerInfo);}
  summerInfo.hidden=!summer;
  summerInfo.textContent='Summer menu: iced coffee 7.50 (espresso shot, then 1.5s cold assembly; fresh 60s), lemonade 6.50 (1.2s cold assembly; fresh 90s), berry cake 5.50 (0.5s plating; fresh 120s). Cold station 40.00 / resale 20.00. Ice 0.50, lemon base 1.00 and cake stock 2.00 per portion. Open the courtyard and complete first paid service and a mixed order in campaign; install the cold station for drinks.';
  for(const id of ['guest-first','guest-second','supply-ingredient']) {
    const select=document.getElementById(id),products=id!=='supply-ingredient',entries=products?state.products:state.ingredients;
    for(let n=5;n<8;n++) {
      let option=select.querySelector(`option[value="${n}"]`);
      if(summer && !option){option=document.createElement('option');option.value=String(n);select.append(option);}
      if(option){option.textContent=entries[n]?.name || '';option.hidden=!summer;option.disabled=!summer;if(!summer && select.value===String(n))select.value='0';}
    }
  }
  for(let p=5;p<8;p++) {
    let button=document.querySelector(`[data-product="${p}"]`);
    if(summer && !button){button=document.createElement('button');button.type='button';button.dataset.product=String(p);button.addEventListener('click',()=>Module._cafe_prepare(p));document.querySelector('.menu-actions').append(button);}
    if(button){const reason=failed?'Game unavailable':paused?'Resume the shift':state.products[p].reason;button.hidden=!summer;button.textContent=state.products[p].name;button.disabled=!!reason;button.title=reason || `Prepare ticket beginning with ${state.products[p].name}`;}
  }
  for(let p=0;p<5;p++) {
    const button=document.querySelector(`[data-command="${p===0?0:20+p}"]`),reason=failed?'Game unavailable':paused?'Resume the shift':state.products[p].reason;
    button.disabled=!!reason;button.title=reason || `Prepare ticket beginning with ${state.products[p].name}`;
  }
  const next=state.tickets.find(t=>t.phase===0),active=state.tickets.find(t=>t.phase===1);
  document.getElementById('order').textContent=paused?'Shift paused.':active?`Guest ${active.guest} · ${money(active.price)} · ${window.cafeState.ready?'Complete ticket ready to serve.':'Barista is preparing your order.'}`:next?`Next: ${next.items.map(i=>state.products[i.product].name).join(' + ')} · ${money(next.price)}`:'Welcome a guest to begin service.';
  document.getElementById('menu-status').textContent=state.message || (next?state.products[next.items[0].product].reason:'');
  const first=Number(document.getElementById('guest-first').value),second=Number(document.getElementById('guest-second').value);
  if(first>=0 && first===second) {
    const welcome=document.querySelector('[data-command="6"]');welcome.disabled=true;welcome.title='Choose two different menu items.';
    document.getElementById('menu-status').textContent='Manual ticket: choose two different menu items.';
  }
  const index=Number(document.getElementById('supply-ingredient').value),ingredient=state.ingredients[index];
  const cash=window.cafeEconomyState?.available ?? 0,pending=window.cafeSupplyState?.pending;
  document.getElementById('ingredient-order').disabled=failed || paused || pending || ingredient.space<12 || cash<ingredient.price*12;
  document.getElementById('ingredient-restock').disabled=failed || paused || ingredient.stored===0 || ingredient.workSpace===0 || !!ingredient.restocking;
  document.getElementById('ingredient-order').textContent=`Order 12 · ${money(ingredient.price*12)}`;
  document.getElementById('ingredient-status').textContent=state.ingredients.map(i=>`${i.name}: ${i.stock} ready / ${i.stored} stored${i.incoming?` / ${i.incoming} incoming`:''}${i.restocking?' / restocking':''}`).join(' · ')+'. Deliveries take 8 seconds and reserve space; cancellation refunds the purchase. Staff restock up to 4 portions in 1.5 seconds plus travel.';
  if(window.cafeRenderTickets){window.cafeRenderTickets(state);return;}
  const signature=JSON.stringify(state.tickets.map(t=>({...t,items:t.items.map(i=>({...i,freshMs:Math.ceil(i.freshMs/1000),quality:Math.floor(i.quality/10)}))})));
  if(signature===lastMenuRender)return;lastMenuRender=signature;
  document.getElementById('order-tickets').replaceChildren(...state.tickets.map(ticket=>{
    const li=document.createElement('li'),heading=document.createElement('strong');
    heading.textContent=`${ticket.name || `Guest ${ticket.guest}`} · ${money(ticket.price)} · ${['Queued','At counter','To seat','Dining','Leaving'][ticket.phase]}`;li.append(heading);
    const list=document.createElement('ul');
    for(const item of ticket.items){const row=document.createElement('li');row.textContent=`${state.products[item.product].name} · ${item.status}${item.freshMs?` · ${Math.ceil(item.freshMs/1000)}s fresh · ${Math.floor(item.quality/10)}% quality`:''}`;list.append(row);}li.append(list);return li;
  }));
}
const publishInspector=window.cafeInspector;
window.cafeInspector=json=>{publishInspector(json);renderMenu();renderStaff();renderEquipment();renderCampaign();};
window.cafeEquipment=json=>{window.cafeEquipmentState=JSON.parse(json);};
let lastEquipmentRender;
function renderEquipment() {
  const state=window.cafeEquipmentState;if(!state)return;
  const signature=JSON.stringify([state,window.cafeHostError,window.cafeEconomyState?.available]);if(signature===lastEquipmentRender)return;lastEquipmentRender=signature;
  const fast=state.catalog[0];
  document.getElementById('machine-upgrade').disabled=!!window.cafeHostError || !!fast.buyReason;
  document.getElementById('machine-upgrade').title=fast.buyReason || fast.effect;
  document.getElementById('machine-resell').disabled=!!window.cafeHostError || !!fast.sellReason;
  document.getElementById('machine-resell').title=fast.sellReason || 'Return to standard 3-second shots; condition is retained.';
  document.getElementById('finish-select').disabled=!!window.cafeHostError || !state.editable;document.getElementById('finish-select').value=String(state.finish);
  document.getElementById('equipment-message').textContent=state.message || `${state.fast?'Speed kit installed · 1.8s shots':'Standard machine · 3.0s shots'} · ${state.station?'Two preparation slots':'One barista preparation workflow'} · Storage ${state.extraStorage?48:24} portions per ingredient · Net equipment/decor cost ${money(state.netCost)}.`;
  document.getElementById('equipment-catalog').replaceChildren(...state.catalog.map(item=>{const li=document.createElement('li');li.textContent=`${item.name} · ${item.owned?'Installed':'Available to place'} · Buy ${money(item.price)} · Resale ${money(item.refund)}${item.width?` · ${item.width*.5} × ${item.depth*.5} m footprint + clear access`:''}. ${item.effect}${item.gate?` ${item.gate}`:''}`;return li;}));
  drawLayout();
}
document.getElementById('machine-upgrade').addEventListener('click',()=>Module._cafe_equipment(0,0,0,0,0));
document.getElementById('machine-resell').addEventListener('click',()=>Module._cafe_equipment(2,0,0,0,0));
document.getElementById('finish-select').addEventListener('change',event=>Module._cafe_equipment(3,Number(event.target.value),0,0,0));
window.cafeCampaign=json=>{window.cafeCampaignState=JSON.parse(json);};
document.querySelectorAll('[data-campaign]').forEach(button=>button.addEventListener('click',()=>Module._cafe_campaign(Number(button.dataset.campaign))));
let lastCampaignRender,lastCampaignPhase;
function renderCampaign() {
  const c=window.cafeCampaignState;if(!c)return;
  window.cafeRenderJournal?.(c);
  window.cafeRenderGardenStory?.(c.garden);
  const paused=!!window.cafeState?.paused,failed=!!window.cafeHostError,results=c.enabled && c.phase===3;
  const actions=[true,c.canOpen,c.enabled && c.phase===1,c.canNext,c.restart];
  document.querySelectorAll('[data-campaign]').forEach(b=>{const n=Number(b.dataset.campaign);b.disabled=failed || !actions[n] || (paused && n!==0 && n!==4);});
  document.getElementById('campaign-phase').textContent=c.enabled?`Day ${c.day} · ${['Preparation','Open service','Closing','Day summary'][c.phase]} · ${[0,1,2,3].filter(n=>c.goals&(1<<n)).length}/4 goals`:'Sandbox cafe';
  const phaseKey=`${c.enabled}:${c.day}:${c.phase}`;
  if(phaseKey!==lastCampaignPhase){document.getElementById('campaign-details').open=results;lastCampaignPhase=phaseKey;}
  document.getElementById('campaign-clock').textContent=c.enabled && c.phase===1?`${Math.floor(Math.ceil(c.remainingMs/1000)/60)}:${String(Math.ceil(c.remainingMs/1000)%60).padStart(2,'0')} remaining`:'';
  document.getElementById('campaign-guidance').textContent=!c.enabled?'Start a campaign for daily shifts, recipe unlocks and returning regulars. Save first to keep your current cafe.':[
    'Stock the cafe, set staff priorities and edit the layout. Finish preparation tasks and deliveries before opening.',
    'Prepare and serve the visible tickets. Complete objectives to unlock new recipes.',
    'Arrivals have stopped. Finish queued orders and let guests, deliveries and cleanup drain. Machine cleaning is queued automatically; resume staff and enable their roles if work is waiting.',
    'Review the day, then prepare the next one. Stock, staff, cash, objectives and regulars carry forward.'
  ][c.phase];
  document.getElementById('campaign-message').textContent=c.message;
  document.getElementById('campaign-summary').hidden=!results;
  document.getElementById('campaign-objectives').hidden=!c.enabled;
  document.getElementById('regulars-panel').hidden=!c.enabled;
  if(results) {
    document.getElementById('layout-status').textContent='Day complete. Prepare the next day to edit the cafe layout.';
    const [sales,supplies,wages,repairs,furniture,hiring,waste,reviews,scores,failedVisits,served,upgrades]=c.totals;
    document.getElementById('campaign-finances').textContent=`Sales ${money(sales)} · Net supplies ${money(supplies)} · Wages earned ${money(wages)} · Net repairs ${money(repairs)} · Net furniture ${money(furniture)} · Hiring ${money(hiring)} · Net equipment/decor ${money(upgrades || 0)} · Rent 3.00 · Utilities 2.00 · Operating profit ${money(c.profit)}. Objective rewards are excluded from operating profit.`;
    document.getElementById('campaign-results').textContent=`${served} tickets served · ${failedVisits} disappointed visits · ${waste} discarded items · ${reviews?`${Math.floor(scores/reviews/10)}% average satisfaction`:'No reviews'} · Wages owed ${money(c.wagesDue)} · Overhead owed ${money(c.overheadDue)}.`;
    document.getElementById('campaign-loss').textContent=c.wagesDue || c.overheadDue?'Outstanding day costs block the next day. Restart day to recover the complete opening checkpoint, or start a new campaign.':c.day>=365?'This campaign has reached its 365-day limit. You can restart this day or begin a new campaign.':c.profit<0?'Costs exceeded sales. Watch idle staff wages, match supplies to demand and keep drinks fresh. You can continue, restart this day or start a new campaign.':'The cafe can continue to the next day.';
  }
  const signature=JSON.stringify([c.enabled,c.goals,c.regulars]);
  if(signature!==lastCampaignRender) {
    lastCampaignRender=signature;
    document.getElementById('campaign-objectives').replaceChildren(...c.objectives.map((name,n)=>{const li=document.createElement('li');li.textContent=`${c.goals&(1<<n)?'Complete':'Pending'} · ${name} · +5.00 once${n===0?' · unlock americano':n===1?' · unlock latte and tea':n===2?' · bonus only; no unlocks':''}`;return li;}));
    document.getElementById('campaign-regulars').replaceChildren(...c.regulars.map(r=>{const li=document.createElement('li');li.textContent=`${r.name} · prefers ${r.preference} · ${r.visits} visits · ${r.reviews?`${Math.floor(r.average/10)}% satisfaction, last visit ${Math.floor(r.lastScore/10)}%`:'No reviews yet'}`;return li;}));
  }
  for(const select of [document.getElementById('guest-first'),document.getElementById('guest-second')])for(const option of select.options){const p=Number(option.value);option.disabled=p>=0 && !(c.unlocked&(1<<p));}
  const first=Number(document.getElementById('guest-first').value),second=Number(document.getElementById('guest-second').value);
  if(c.enabled && ((first>=0 && !(c.unlocked&(1<<first))) || (second>=0 && !(c.unlocked&(1<<second))))) {
    document.querySelector('[data-command="6"]').disabled=true;document.getElementById('menu-status').textContent='Choose unlocked items for this campaign ticket.';
  }
  if(c.enabled) {
    const close=document.querySelector('[data-command="15"]');close.textContent='Close campaign day early';close.disabled=failed || paused || c.phase!==1 || (window.cafeClockState?.stage ?? 0)!==0;
    if(c.phase===0 || c.phase===3)document.getElementById('order').textContent=c.phase===0?'Prepare the cafe, then open the day.':'Day complete. Review results and prepare tomorrow.';
  }
  if(results) {
    buttons.forEach(b=>{if(![2,3,4].includes(Number(b.dataset.command)))b.disabled=true;});
    for(const id of ['staff-hire','ingredient-order','ingredient-restock','layout-apply','layout-sell'])document.getElementById(id).disabled=true;
    document.querySelectorAll('#staff-cards button,#staff-cards select').forEach(e=>e.disabled=true);
  }
}
document.getElementById('ingredient-order').addEventListener('click',()=>Module._cafe_supply(0,Number(document.getElementById('supply-ingredient').value)));
document.getElementById('ingredient-restock').addEventListener('click',()=>Module._cafe_supply(1,Number(document.getElementById('supply-ingredient').value)));
document.getElementById('supply-ingredient').addEventListener('change',renderMenu);
document.getElementById('guest-first').addEventListener('change',renderMenu);
document.getElementById('guest-second').addEventListener('change',renderMenu);

let lastStaffRender;
window.cafeStaff=json=>{window.cafeStaffState=JSON.parse(json);};
function renderStaff() {
  const state=window.cafeStaffState;if(!state)return;
  const paused=!!window.cafeState?.paused,blocked=paused || !!window.cafeHostError || (window.cafeCampaignState?.enabled && window.cafeCampaignState.phase===3);
  document.getElementById('staff-hire').disabled=blocked || !state.canHire;
  document.getElementById('staff-hire').title=state.staff.length>=3?'The cafe supports three staff.':!state.canHire?'Need 15.00 available cash after wages.':'Hire another staff member';
  document.getElementById('staff-message').textContent=state.message || `${state.staff.length}/3 staff · Hiring costs ${money(state.hiringMinor)} total · Wages paid and owed shown per person.`;
  const signature=JSON.stringify([blocked,state.staff.map(w=>({...w,workedMs:Math.floor(w.workedMs/1000),remainingMs:Math.ceil(w.remainingMs/1000)}))]);
  if(signature===lastStaffRender)return;
  // Keep a keyboard user's selected control alive until it loses focus.
  if(document.activeElement?.tagName==='SELECT' && document.getElementById('staff-cards').contains(document.activeElement))return;
  lastStaffRender=signature;
  document.getElementById('staff-cards').replaceChildren(...state.staff.map(w=>{
    const card=document.createElement('article');card.dataset.staffId=String(w.id);
    const title=document.createElement('h3');title.textContent=w.name;card.append(title);
    const taskNames={'cafe:collect':'Collecting ingredients','cafe:prepare':'Preparing the ticket','cafe:assist':'Preparing alongside a colleague','cafe:handover':'Serving the ticket','cafe:clean':'Cleaning a table','cafe:machine-clean':'Cleaning the machine','cafe:machine-repair':'Repairing the machine'};
    const taskName=taskNames[w.task] || (w.task.startsWith('cafe:restock-')?'Restocking supplies':'No task');
    const status=document.createElement('p');status.textContent=`${taskName} · ${w.reason} · Paid ${money(w.paid)} · Owed ${money(w.due)} · ${Math.floor(w.workedMs/1000)}s on shift`;card.append(status);
    const actions=document.createElement('div');actions.className='actions';
    for(const [action,label,disabled] of [[2,w.breakPending?`Cancel break ${w.name}`:w.onShift?`Take break ${w.name}`:`Resume ${w.name}`,blocked],[1,`Dismiss ${w.name}`,blocked || !w.canDismiss]]) {
      const button=document.createElement('button');button.textContent=label;button.disabled=disabled;button.addEventListener('click',()=>Module._cafe_staff(action,w.id,0,0));actions.append(button);
    }card.append(actions);
    const priorities=document.createElement('div');priorities.className='staff-priorities';
    ['Preparation','Serving','Restocking','Cleaning'].forEach((role,n)=>{
      const label=document.createElement('label');label.textContent=role+' ';const select=document.createElement('select');select.setAttribute('aria-label',`${w.name} ${role} priority`);select.disabled=blocked;
      ['Off','Low','Normal','High'].forEach((text,p)=>{const option=document.createElement('option');option.value=String(p);option.textContent=text;select.append(option);});select.value=String(w.priorities[n]);
      select.addEventListener('change',()=>Module._cafe_staff(3,w.id,n,Number(select.value)));select.addEventListener('blur',()=>setTimeout(()=>{lastStaffRender=undefined;renderStaff();},0));label.append(select);priorities.append(label);
    });card.append(priorities);return card;
  }));
}
document.getElementById('staff-hire').addEventListener('click',()=>Module._cafe_staff(0,0,0,0));
document.getElementById('report-export').addEventListener('click',()=>{
  if(!window.cafeInspectorState)return;
  const blob=new Blob([JSON.stringify(window.cafeInspectorState,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='cafe-shift-report.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});

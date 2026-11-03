// Read-only service presentation. Orders, deadlines and payments remain in C++.
(() => {
if(!document.body.classList.contains('playable'))return;
const $=id=>document.getElementById(id),command=n=>document.querySelector(`[data-command="${n}"]`);
const productIcons=['espresso','americano','latte','tea','croissant','menu','menu','menu'];
function icon(name){return window.cafeArtIcon(name)||window.cafeArtIcon('person');}
function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
function setText(n,text){if(n.textContent!==text)n.textContent=text;}
const heading=$('serve-view').querySelector('h2');heading.textContent='Orders';
const orderCount=el('span','order-count','0');heading.append(orderCount);
const overview=el('p','service-overview');heading.after(overview);
const guideWrap=el('details','service-guide');guideWrap.id='service-guide';guideWrap.open=true;
guideWrap.append(el('summary','', 'First-shift guide'));$('guide').before(guideWrap);guideWrap.append($('guide'));
const flow=el('ol','service-flow');flow.setAttribute('aria-label','Service steps');
for(const [name,label] of [['clock','1 · Order'],['work','2 · Prepare'],['check','3 · Serve']]){const li=el('li');li.append(icon(name),el('span','',label));flow.append(li);}
guideWrap.after(flow);
const selection=el('p','selection-note');selection.id='customer-selection';selection.hidden=true;
const list=$('order-tickets');list.before(selection);
const activeHeading=el('h3','ticket-heading service-sr-only','Waiting orders');list.before(activeHeading);
const visits=el('details','served-visits');visits.id='served-visits';visits.append(el('summary','','Seated & departing customers'),el('div','visit-list'));list.after(visits);
const alert=el('button','service-alert');alert.id='service-alert';alert.hidden=true;alert.type='button';$('brew-progress').after(alert);
const actionPanel=el('div','service-action-panel');flow.after(actionPanel);actionPanel.append($('next-action'),$('next-reason'),$('brew-progress'),alert);
const preparationChoices=el('div','preparation-choices');preparationChoices.setAttribute('role','group');preparationChoices.setAttribute('aria-label','Choose an order to prepare');actionPanel.after(preparationChoices);
const preparationButtons=new Map();
const servingChoices=el('div','serving-choices');servingChoices.setAttribute('role','group');servingChoices.setAttribute('aria-label','Choose a customer to serve');preparationChoices.before(servingChoices);
const servingButtons=new Map();
const secondary=el('div','service-shortcuts');
for(const [name,label,target,mode] of [['stock','Supplies','supplies-drawer','Serve'],['clean','Machine care','supplies-drawer','Serve'],['person','Staff','staff-panel','Menu']]){const b=el('button');b.type='button';b.append(icon(name),el('span','',label));b.onclick=()=>openPanel(target,mode);secondary.append(b);}
visits.after(secondary);
// Keep explanatory text available in drawers; the live service rail stays brief.
$('order').classList.add('service-sr-only');$('menu-status').classList.add('service-sr-only');
const workflow=$('workflow'),occupancy=$('occupancy');workflow.classList.add('service-sr-only');occupancy.classList.add('service-sr-only');
const cancel=command(5);$('recipe-actions').append(cancel);
const scene=document.querySelector('.game'),overlay=el('div','customer-overlay');overlay.id='customer-overlay';overlay.setAttribute('role','group');overlay.setAttribute('aria-label','Customers in the cafe');
const leaders=document.createElementNS('http://www.w3.org/2000/svg','svg');leaders.classList.add('customer-leaders');leaders.setAttribute('aria-hidden','true');overlay.append(leaders);scene.append(overlay);
let selected=null,primaryAction,guideRequested=false,lastServed=0,lastTime=0,lastWidth=0,lastHeight=0,pins=[],seenCampaignTicket=false;
const cards=new Map(),badges=new Map();
function openPanel(id,mode='Serve'){document.querySelector(`[role="tab"][data-mode="${mode.toLowerCase()}"]`).click();const panel=$(id);panel.open=true;panel.querySelector('summary')?.focus();}
function productCommand(p){return p<5?command(p===0?0:20+p):document.querySelector(`[data-product="${p}"]`);}
function machineReady(ticket){return !ticket?.items.some(i=>[0,1,2,5].includes(i.product)) || !!window.cafeQualityState?.usable;}
function selectGuest(id,fromWorld=false){selected=id;renderService();if(fromWorld){document.querySelector('[data-mode="serve"]').click();if(cards.has(id))cards.get(id).button.scrollIntoView({block:'nearest',behavior:'instant'});else{visits.open=true;visits.scrollIntoView({block:'nearest',behavior:'instant'});}}else layoutPins();}
function activateGuest(id){
 const tickets=window.cafeMenuState?.tickets,t=tickets?.find(t=>t.guest===id);
 if(!t || window.cafeState?.paused || window.cafeHostError)return;
 if(t.table){
  if(t.service==='Waiting to order')Module._cafe_service(0,id);
  else if(t.service==='Ready to serve')Module._cafe_service(2,id);
 }else if(!t.paid && t.phase!==4){
  if(t.service==='Ready to serve')command(1).click();
  else if(t.service==='Waiting'){
   // Counter preparation follows the simulation's FIFO queue, after collected
   // table orders. Inspecting a later badge must not prepare another guest.
   if(tickets.some(t=>t.table && t.service==='Waiting for serving') ||
      tickets.find(t=>!t.table && t.service==='Waiting')?.guest!==id)return;
   productCommand(t.items[0].product).click();
  }
 }
}
function patience(ticket){const g=window.cafeDemandState?.guests.find(g=>g.id===ticket.guest);return {seconds:Math.max(0,Math.ceil((g?.remaining||0)/1000)),ratio:g?.budget?Math.max(0,Math.min(1,g.remaining/g.budget)):0};}
function status(ticket){
 if(ticket.service){const name=ticket.service;return {name,icon:name==='Waiting to order'?'menu':name==='Ready to serve'?'check':name==='Preparing'?'work':name==='Leaving'?'door':ticket.paid?'seat':'clock',key:ticket.paid?'served':name==='Ready to serve'?'ready':name==='Preparing'?'preparing':'waiting'};}
 if(ticket.phase>=2)return {name:['','','Finding a seat','Enjoying visit','Leaving'][ticket.phase],icon:ticket.phase===4?'door':'seat',key:'served'};
 if(ticket.phase===1 && window.cafeState?.ready)return {name:window.cafeWorkflowState?.handoverReady?'Ready to serve':'Ready · staff approaching',icon:'check',key:'ready'};
 if(ticket.phase===1)return {name:'Preparing',icon:'work',key:'preparing'};
 return {name:'Waiting',icon:'clock',key:'waiting'};
}
function makeCard(ticket){
 const li=el('li','visual-ticket'),button=el('button','ticket-select'),title=el('strong','ticket-name'),price=el('span','ticket-price'),identity=el('div','ticket-identity');button.type='button';button.onclick=()=>selectGuest(ticket.guest);
 const avatar=el('span','ticket-avatar');avatar.setAttribute('aria-hidden','true');avatar.append(icon(ticket.takeaway?'takeaway':'person'));identity.append(avatar,title,price);button.append(identity);
 const destination=el('span','ticket-destination');button.append(destination);
 const state=el('span','ticket-state'),items=el('ul','ticket-products'),footer=el('div','ticket-footer'),time=el('span','patience'),bar=el('progress','patience-bar');bar.max=1;footer.append(time,bar);button.append(items,state,footer);li.append(button);list.append(li);
 return {li,button,title,price,state,items,time,bar,avatar,destination,signature:''};
}
window.cafeRenderTickets=()=>{};
function renderTickets(){
 const m=window.cafeMenuState;if(!m)return;
 const active=m.tickets.filter(t=>!t.paid && t.phase!==4),paid=m.tickets.filter(t=>t.paid || t.phase===4),live=new Set(active.map(t=>t.guest));
 setText(orderCount,String(active.length));
 for(const [id,card] of cards)if(!live.has(id)){card.li.remove();cards.delete(id);}
 for(const ticket of active){let card=cards.get(ticket.guest);if(!card){card=makeCard(ticket);cards.set(ticket.guest,card);}const state=status(ticket),p=patience(ticket),urgent=p.ratio<=.25;
  setText(card.title,ticket.name?`${ticket.name} · #${ticket.guest}`:`Guest #${ticket.guest}`);setText(card.price,(ticket.price/100).toFixed(2));
  card.li.dataset.state=state.key;card.li.dataset.urgency=urgent?'urgent':'calm';card.li.classList.toggle('selected',selected===ticket.guest);
  card.button.setAttribute('aria-pressed',String(selected===ticket.guest));card.button.setAttribute('aria-label',`View ${ticket.name||`Guest ${ticket.guest}`} ${ticket.takeaway?'takeaway ':''}order · ${state.name} · ${p.seconds} seconds patience`);
  setText(card.destination,ticket.table?`Prefers ${ticket.seatingPreference.toLowerCase()} · ${ticket.destination}`:'Counter service');
  const signature=JSON.stringify([state,ticket.takeaway,ticket.items.map(i=>[i.product,i.status,Math.ceil(i.freshMs/1000)])]);
  if(signature!==card.signature){card.signature=signature;card.avatar.replaceChildren(icon(ticket.takeaway?'takeaway':'person'));card.state.replaceChildren(icon(state.icon),el('span','',`${ticket.takeaway?'Takeaway · ':''}${state.name}`));card.items.replaceChildren(...ticket.items.map(item=>{const row=el('li'),name=m.products[item.product]?.name||'Item';row.classList.toggle('unstarted',item.status==='Waiting');row.append(icon(productIcons[item.product]),el('span','product-name',name),el('small','item-stage',item.status==='Waiting'?'':item.status==='Ready for handover'?'Ready':item.status));return row;}));}
  setText(card.time,`${urgent?'Low patience · ':''}${p.seconds}s left`);card.bar.value=p.ratio;card.bar.setAttribute('aria-label',`${ticket.name||`Guest ${ticket.guest}`} patience remaining`);
 }
 activeHeading.hidden=!active.length;visits.hidden=!paid.length;
 const paidSignature=JSON.stringify(paid.map(t=>[t.guest,t.name,t.phase,selected===t.guest]));
 if(visits.dataset.signature!==paidSignature){visits.dataset.signature=paidSignature;visits.querySelector('.visit-list').replaceChildren(...paid.map(ticket=>{const b=el('button','visit-chip');b.type='button';b.append(icon(status(ticket).icon),el('span','',`${ticket.name||`Guest #${ticket.guest}`} · ${status(ticket).name}`));b.onclick=()=>selectGuest(ticket.guest);return b;}));}
}
function makeBadge(id){const button=el('button','customer-badge');button.type='button';button.dataset.guest=String(id);const name=el('strong'),row=el('span','badge-order'),bar=el('span','badge-patience'),fill=el('span');bar.append(fill);button.append(name,row,bar);button.onclick=e=>{e.stopPropagation();selectGuest(id,true);activateGuest(id);};overlay.append(button);const line=document.createElementNS(leaders.namespaceURI,'line');leaders.append(line);return {button,name,row,bar,fill,line,signature:''};}
window.cafeWorldPins=json=>{pins=JSON.parse(json);layoutPins();};
function layoutPins(){
 const tickets=window.cafeMenuState?.tickets;if(!tickets)return;
 const width=scene.clientWidth,height=scene.clientHeight;leaders.setAttribute('viewBox',`0 0 ${width} ${height}`);
 const enabled=document.getElementById('serve-tab').getAttribute('aria-selected')==='true',live=new Set(tickets.map(t=>t.guest));overlay.hidden=!enabled;
 for(const [id,b] of badges)if(!live.has(id)){b.button.remove();b.line.remove();badges.delete(id);}
 const placed=[];
 const mobile=['phone','tablet'].includes(document.documentElement.dataset.device);
 const overlaps=(r,o,gap=6)=>r.x<o.x+o.w+gap && r.x+r.w+gap>o.x && r.y<o.y+o.h+gap && r.y+r.h+gap>o.y;
 // Protect all customers, including those whose badge cannot currently fit.
 const characters=mobile?pins.filter(p=>p.length>=8?p[6]>0 && p[4]<width && p[7]>0 && p[5]<height:p[3]).map(p=>p.length>=8
  ?{x:p[4],y:p[5],w:p[6]-p[4],h:p[7]-p[5]}
  :{x:p[1]-24,y:p[2]-8,w:48,h:96}):[];
 if(mobile){
  const world=scene.getBoundingClientRect();
  for(const node of document.querySelectorAll('.shift-capsule,.mode-nav')){
   const r=node.getBoundingClientRect();placed.push({x:r.left-world.left,y:r.top-world.top,w:r.width,h:r.height});
  }
 }
 const badgeShelf=$('achievement-shelf');
 if(badgeShelf && !badgeShelf.hidden){const r=badgeShelf.getBoundingClientRect(),world=scene.getBoundingClientRect();placed.push({x:r.left-world.left,y:r.top-world.top,w:r.width,h:r.height});}
 const priority=id=>id===selected?0:tickets.find(t=>t.guest===id)?.phase===1?1:tickets.find(t=>t.guest===id)?.phase===0?2:3;
 const sorted=pins.filter(p=>p[3] && live.has(p[0])).sort((a,b)=>priority(a[0])-priority(b[0])||a[0]-b[0]);
 const visible=new Set(sorted.map(p=>p[0]));for(const [id,b] of badges){b.button.hidden=!visible.has(id);if(b.button.hidden)b.line.setAttribute('visibility','hidden');}
 for(const [id,x,y] of sorted){const ticket=tickets.find(t=>t.guest===id),state=status(ticket),p=patience(ticket);let b=badges.get(id);if(!b){b=makeBadge(id);badges.set(id,b);}b.button.hidden=false;
  const waiting=state.key==='waiting' && !ticket.paid;
  const waitingIcon=ticket.service==='Waiting for serving'?'service-waiting':ticket.takeaway?'takeaway':ticket.service==='Waiting to order'?'menu':state.icon;
  const signature=JSON.stringify([ticket.items.map(i=>i.product),state.key,ticket.phase,waiting,waitingIcon,ticket.takeaway]);
  if(signature!==b.signature){b.signature=signature;b.row.replaceChildren(...(waiting?[icon(waitingIcon)]:ticket.takeaway?[icon('takeaway'),icon(state.icon)]:[icon(state.icon),...ticket.items.slice(0,2).map(i=>icon(productIcons[i.product]))]));}
  b.button.dataset.service=ticket.takeaway?'takeaway':'dine-in';
  b.button.classList.toggle('waiting-service',waiting);
  setText(b.name,waiting?`${p.seconds}s`:`#${id} · ${state.key==='ready'?`Ready · ${p.seconds}s`:!ticket.paid?`${p.seconds}s`:ticket.phase===4?'Exit':'Visit'}`);b.button.dataset.state=state.key;b.button.dataset.urgency=!ticket.paid && p.ratio<=.25?'urgent':'calm';b.button.classList.toggle('selected',selected===id);b.button.setAttribute('aria-pressed',String(selected===id));
  const label=`${ticket.name||`Guest ${id}`} · ${ticket.takeaway?'Takeaway · ':''}${ticket.items.map(i=>window.cafeMenuState.products[i.product].name).join(' and ')} · ${state.name}${!ticket.paid?` · ${p.seconds} seconds patience`:''}`;b.button.setAttribute('aria-label',label);b.button.title=label;
  b.bar.hidden=waiting || !!ticket.paid;b.fill.style.transform=`scaleX(${p.ratio})`;
  if(mobile && state.key==='ready')setText(b.name,'Ready');
  const w=b.button.offsetWidth,h=b.button.offsetHeight,clamp=(v,min,max)=>Math.max(min,Math.min(max,v));let chosen;
  const narrow=matchMedia('(max-width:650px)').matches,top=mobile?6:narrow?65:110,bottom=mobile?6:narrow?34:120;
  const offsets=mobile?[[0,0],[-w-8,0],[w+8,0],[0,-h-8],[-w-8,-h-8],[w+8,-h-8],[0,-2*(h+8)],[-2*(w+8),0],[2*(w+8),0],[0,h+8],[-w-8,h+8],[w+8,h+8]]:[[0,0],[-98,0],[98,0],[0,-64],[-98,-64],[98,-64],[0,-128],[-98,-128],[98,-128],[0,64],[-98,64],[98,64]];
  if(mobile){
   const fallback=[];
   for(let gy=top;gy+h<=height-bottom;gy+=h+8)for(let gx=6;gx+w<=width-6;gx+=w+8)
    fallback.push([gx-(x-w/2),gy-(y-h-12)]);
   fallback.sort((a,b)=>Math.hypot(...a)-Math.hypot(...b));offsets.push(...fallback);
  }
  for(const [dx,dy] of offsets){
   const r={x:clamp(x-w/2+dx,6,width-w-6),y:clamp(y-h-12+dy,top,Math.max(top,height-h-bottom)),w,h};
   if(r.x+r.w<=width-6 && r.y+r.h<=height-bottom && !placed.some(o=>overlaps(r,o)) && !characters.some(o=>overlaps(r,o,8))){chosen=r;break;}
  }
  if(!chosen){b.button.hidden=true;b.line.setAttribute('visibility','hidden');continue;}
  placed.push(chosen);b.button.style.transform=`translate(${Math.round(chosen.x)}px,${Math.round(chosen.y)}px)`;
  for(const [k,v] of Object.entries({x1:chosen.x+w/2,y1:chosen.y+h,x2:x,y2:y}))b.line.setAttribute(k,String(v));b.line.setAttribute('visibility','visible');b.line.classList.toggle('selected',selected===id);
 }
}
function renderService(){
 const m=window.cafeMenuState,s=window.cafeState,c=window.cafeCampaignState;if(!m || !s)return;
 const rect=$('viewport').getBoundingClientRect(),w=Math.round(rect.width),h=Math.round(rect.height);
 if(Module._cafe_viewport && (w!==lastWidth || h!==lastHeight)){Module._cafe_viewport(w,h);lastWidth=w;lastHeight=h;}
 const now=window.cafeInspectorState?.report.timeMs||0;if(now<lastTime){selected=null;guideRequested=false;seenCampaignTicket=false;}lastTime=now;
 if(selected && !m.tickets.some(t=>t.guest===selected))selected=null;
 const active=m.tickets.find(t=>t.service==='Preparing'),queued=m.tickets.filter(t=>!t.paid && t.phase!==4 && t.service!=='Preparing'),ticket=m.tickets.find(t=>t.guest===selected && !t.paid && t.phase!==4)||queued.find(t=>t.service==='Ready to serve')||active||queued[0],paid=m.tickets.filter(t=>t.paid && t.phase<4);
 window.cafeServiceTicketId=ticket?.guest??null;
 setText(overview,`${queued.length} waiting · ${active?1:0} preparing${s.ready?' / ready':''} · ${paid.length} enjoying a visit`);
 const selectedTicket=m.tickets.find(t=>t.guest===selected);selection.hidden=!selectedTicket;if(selectedTicket)setText(selection,`Selected: ${selectedTicket.name||`Guest #${selected}`} · ${status(selectedTicket).name}`);
 guideWrap.hidden=$('guide').hidden || (!c?.enabled && s.served>0 && !guideRequested);
 if(c?.enabled && ticket && !seenCampaignTicket){seenCampaignTicket=true;if(!guideRequested)guideWrap.open=false;}
 if(s.served>lastServed && !guideRequested)guideWrap.open=false;lastServed=s.served;
 const next=$('next-action');let label='Waiting for a guest',reason='Seated guests need their order taken. Click their badge to send the barista.',source;
 primaryAction=undefined;
 if(c?.enabled && c.phase===0){label=`Open day ${c.day}`;reason=c.canOpen?'Your cafe is ready. Open the doors to start service.':'Finish preparation tasks and deliveries before opening.';if(c.canOpen)primaryAction=()=>document.querySelector('[data-campaign="1"]').click();}
 else if(c?.enabled && c.phase===3){label='Review day results';reason='See your costs and prepare the next day.';primaryAction=()=>{document.querySelector('[data-mode="menu"]').click();$('campaign-details').open=true;};}
 else if(ticket?.table){
  const state=ticket.service;label=state;reason='Select a guest to take their order or deliver a prepared ticket.';
  if(state==='Waiting to order'){label=`Take #${ticket.guest} order`;reason='Barista walks to the table. You can collect several orders before preparing.';primaryAction=()=>Module._cafe_service(0,ticket.guest);}
  else if(state==='Ready to serve'){label=`Serve #${ticket.guest} · ${(ticket.price/100).toFixed(2)}`;reason='Deliver this prepared order to their table.';primaryAction=()=>Module._cafe_service(2,ticket.guest);}
  else if(state==='Waiting for serving'){label=`Prepare #${ticket.guest} order`;const shortages=ticket.shortages||[];reason=shortages.length?`Restock ${shortages.map(n=>m.ingredients[n].name).join(' and ')} for this ticket.`:active?'Finish the ticket being prepared, or collect more orders.':'Order collected · prepare at the counter.';if(!shortages.length && !active && !s.ready && machineReady(ticket))primaryAction=()=>Module._cafe_service(1,ticket.guest);}
  else if(state==='Waiting for a table')reason='Guest has up to 180 seconds to reach a table, then receives a fresh service waiting allowance.';
  else if(state==='Preparing')reason='Staff prepare every item at the counter. Collect more orders while this ticket is in progress.';
  else reason='Barista is walking to the table.';
 }else if(ticket){
  source=s.ready?command(1):productCommand(ticket.items[0].product);
  label=s.ready?`Serve #${ticket.guest} · ${(ticket.price/100).toFixed(2)}`:active?`Preparing #${ticket.guest}…`:`Prepare #${ticket.guest} order`;
  reason=active && !s.ready?'Staff handle every item. Serve the whole order when ready.':source.disabled?(source.title||'Waiting for staff and guest at the counter.'):`${ticket.items.map(i=>m.products[i.product].name).join(' + ')}${s.ready?' · Ready for handover.':''}`;
  if(!source.disabled)primaryAction=()=>source.click();
 }else if(c?.enabled && c.phase===2){label='Finishing the shift';reason='Guests and staff finish their visits and cleanup before results.';}
 if(ticket?.table)reason+=` ${ticket.destination}. ${ticket.serviceReason||''}`;
 if(s.paused){reason='Shift paused. Resume at the top.';primaryAction=undefined;}if(window.cafeHostError)primaryAction=undefined;
 next.disabled=!primaryAction;setText(next,label);setText($('next-reason'),reason);
 const readyOrders=m.tickets.filter(t=>!t.paid && t.service==='Ready to serve');
 const readyIds=new Set(readyOrders.map(t=>t.guest));
 for(const [id,b] of servingButtons)if(!readyIds.has(id)){b.remove();servingButtons.delete(id);}
 servingChoices.hidden=!readyOrders.length;
 next.hidden=ticket?.service==='Ready to serve' && readyIds.has(ticket.guest) && !(c?.enabled && (c.phase===0 || c.phase===3));
 for(const order of readyOrders){
  let b=servingButtons.get(order.guest);
  if(!b){b=el('button','serve-order');b.type='button';b.dataset.guest=String(order.guest);b.onclick=()=>{selectGuest(order.guest);if(order.table)Module._cafe_service(2,order.guest);else command(1).click();};servingButtons.set(order.guest,b);servingChoices.append(b);}
  const source=order.table?null:command(1);
  const blocked=window.cafeHostError?'Game unavailable':s.paused?'Shift paused':source?.disabled?(source.title||'Waiting for staff and guest at the counter.'):'';
  setText(b,`Serve ${order.name?`${order.name} · #${order.guest}`:`#${order.guest}`} · ${order.items.map(i=>m.products[i.product].name).join(' + ')} · ${(order.price/100).toFixed(2)}`);
  b.disabled=!!blocked;b.title=blocked||`Deliver ${order.name||`Guest #${order.guest}`} order`;
 }
 const collected=m.tickets.filter(t=>t.table && !t.paid && t.service==='Waiting for serving');
 const collectedIds=new Set(collected.map(t=>t.guest));
 for(const [id,b] of preparationButtons)if(!collectedIds.has(id)){b.remove();preparationButtons.delete(id);}
 preparationChoices.hidden=!collected.length;
 for(const order of collected){
  let b=preparationButtons.get(order.guest);
  if(!b){b=el('button','prepare-order');b.type='button';b.dataset.guest=String(order.guest);b.onclick=()=>{selectGuest(order.guest);Module._cafe_service(1,order.guest);};preparationButtons.set(order.guest,b);preparationChoices.append(b);}
  const shortages=order.shortages||[];
  const blocked=window.cafeHostError?'Game unavailable':s.paused?'Shift paused':active||s.ready?'Finish the current preparation first':!machineReady(order)?'Machine needs care':shortages.length?`Restock ${shortages.map(n=>m.ingredients[n].name).join(' and ')}`:'';
  setText(b,`Prepare #${order.guest} · ${order.items.map(i=>m.products[i.product].name).join(' + ')}${blocked?` · ${blocked}`:''}`);
  b.disabled=!!blocked;b.title=blocked||`Prepare ${order.name||`Guest #${order.guest}`} order`;
 }
 const step=ticket?.service==='Ready to serve'||s.ready?2:active?1:0;[...flow.children].forEach((li,i)=>{li.classList.toggle('current',i===step);li.classList.toggle('complete',i<step);if(i===step)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
 alert.hidden=true;
 if(!s.paused && !window.cafeHostError){
  if(window.cafeQualityState && !window.cafeQualityState.usable){alert.hidden=false;setText(alert,'Machine needs care · open cleaning & repairs');alert.onclick=()=>openPanel('supplies-drawer');}
  else if(ticket && !active && source?.disabled){alert.hidden=false;setText(alert,'Order blocked · check supplies & staff');alert.onclick=()=>openPanel('supplies-drawer');}
 }
 renderTickets();layoutPins();
}
$('next-action').onclick=()=>primaryAction?.();
$('guide-show').addEventListener('click',()=>{guideRequested=true;guideWrap.hidden=false;guideWrap.open=true;});
document.querySelector('.mode-nav').addEventListener('click',()=>layoutPins());
const previous=window.cafeInspector;window.cafeInspector=json=>{previous(json);renderService();};
})();

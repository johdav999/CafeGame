// Ingredient warnings project the simulation's published stock and action reasons.
(() => {
if(!document.body.classList.contains('playable'))return;
const $=id=>document.getElementById(id),names=['beans','water','milk','tea-leaves','pastry-stock','stock','stock','stock'],labels=['Beans','Water','Milk','Tea','Pastry','Ice','Lemon base','Cake stock'];
const capsule=document.querySelector('.shift-capsule'),left=document.createElement('div');left.className='header-left';capsule.before(left);left.append(capsule);
const alerts=document.createElement('div');alerts.id='stock-alerts';alerts.setAttribute('role','group');alerts.setAttribute('aria-label','Cafe service and ingredient alerts');alerts.hidden=true;left.append(alerts);
const announcement=document.createElement('span');announcement.className='service-sr-only';announcement.setAttribute('role','status');left.append(announcement);
function openSupplies(index){document.querySelector('[data-mode="serve"]').click();$('supplies-drawer').open=true;$('supply-ingredient').value=String(index);$('supply-ingredient').dispatchEvent(new Event('change'));$('supplies-drawer').scrollIntoView({block:'nearest',behavior:'instant'});}
const buttons=names.map((name,index)=>{const b=document.createElement('button');b.type='button';b.className='stock-alert';b.dataset.ingredient=String(index);b.hidden=true;b.append(window.cafeArtIcon(name));const badge=document.createElement('em');badge.textContent='!';badge.setAttribute('aria-hidden','true');const label=document.createElement('span');label.textContent=labels[index];b.append(badge,label);b.onclick=()=>openSupplies(index);alerts.append(b);return b;});
const next=$('next-action'),row=document.createElement('div');row.className='service-actions';next.before(row);row.append(next);
const refill=document.createElement('button');refill.id='refill-action';refill.type='button';refill.hidden=true;
const extras=document.createElement('div');extras.className='service-context-actions';row.append(extras);extras.append(refill);
const careButtons=[12,13,14].map((command,index)=>{const b=document.createElement('button');b.id=['service-clean','service-repair','service-cancel-care'][index];b.type='button';b.hidden=true;b.onclick=()=>{if(!b.disabled)Module._cafe_command(command);};extras.append(b);return b;});
const careStatus=document.createElement('p');careStatus.id='service-care-status';careStatus.setAttribute('role','status');careStatus.hidden=true;row.after(careStatus);
// Keep one independent action per shortage; an incoming bean delivery must not
// hide the option to order milk or pastry for the selected table ticket.
const supplyButtons=[refill,...Array.from({length:7},(_,index)=>{
 const b=document.createElement('button');b.id=`refill-action-${index+1}`;b.type='button';b.hidden=true;extras.insertBefore(b,careButtons[0]);return b;
})];
for(const b of supplyButtons){b.className='service-supply-action';b.onclick=()=>{if(!b.disabled && b.dataset.ingredient!==undefined)Module._cafe_supply(Number(b.dataset.action),Number(b.dataset.ingredient));};}
function renderCare(){
 const q=window.cafeQualityState,s=window.cafeState;if(!q||!s)return;
 const active=!!q.maintenance,cost=window.cafeEquipmentState?.fast?750:500;
 for(let index=0;index<3;index++){
  const b=careButtons[index],command=12+index,source=document.querySelector(`[data-command="${command}"]`),action=window.cafeInspectorState?.actions.find(a=>a.command===command);
  b.hidden=index===2?!active:active||(index===0?q.cleanliness:q.integrity)>=200;
  const orderActive=window.cafeDiagnosticState?.order>=0&&window.cafeDiagnosticState.order<=2;
  b.textContent=index===0?`${orderActive?'Queue clean':'Clean'} · ${Math.floor(q.cleanliness/10)}%`:index===1?`${orderActive?'Queue repair':'Repair'} · ${(cost/100).toFixed(2)}`:`Cancel ${q.maintenance===1?'cleaning':'repair'}`;
  b.disabled=!!window.cafeHostError||!!s.paused||!action?.enabled||!!(window.cafeCampaignState?.enabled&&window.cafeCampaignState.phase===3);
  const help=index===0?`Clean machine: ${Math.floor(q.cleanliness/10)}% cleanliness. Free; takes 2 seconds plus staff travel.`:index===1?`Repair machine: ${Math.floor(q.integrity/10)}% condition. Costs ${(cost/100).toFixed(2)}; takes 4 seconds plus staff travel.`:'Cancel this machine-care task. Any repair charge is refunded.';
  const reason=window.cafeHostError?'The game is unavailable.':s.paused?'Resume the shift first.':action?.reason||source.title||'Finish the current task or check staff availability.';
  b.title=b.disabled?reason:help+(orderActive?' Queued after the current ticket; repair payment is taken only when maintenance starts.':'');b.setAttribute('aria-label',b.textContent);
 }
 careStatus.hidden=!active;
 if(active)careStatus.textContent=q.taskState<0?`${q.maintenance===1?'Cleaning':'Repair'} queued after the current ticket. Cancel to remove the request.`:`${q.maintenance===1?'Cleaning':'Repairing'} machine · ${q.taskState===2?`${Math.ceil(q.workRemaining/1000)}s remaining`:'waiting for staff to reach the machine'}.`;
}

const neededAlerts=['clean','repair','refill'].map((kind,index)=>{
 const b=document.createElement('button');b.id=`alert-${kind}`;b.type='button';b.className='stock-alert service-needed-alert';b.hidden=true;
 b.append(window.cafeArtIcon(`service-${kind}-alert`));const badge=document.createElement('em');badge.textContent='!';badge.setAttribute('aria-hidden','true');const label=document.createElement('span');label.textContent=['Clean','Repair','Refill'][index];b.append(badge,label);alerts.append(b);
 b.onclick=()=>{document.querySelector('[role="tab"][data-mode="serve"]').click();const target=index<2?careButtons[index]:refill;target.scrollIntoView({block:'nearest',behavior:'instant'});if(!target.disabled)target.focus({preventScroll:true});};return b;
});
function renderNeededAlerts(){
 const q=window.cafeQualityState,m=window.cafeMenuState;
 for(let n=0;n<2;n++){
  const b=neededAlerts[n],action=careButtons[n];b.hidden=!q||action.hidden;
  const condition=n===0?`Cleanliness ${Math.floor((q?.cleanliness??1000)/10)}%.`:`Condition ${Math.floor((q?.integrity??1000)/10)}%.`;
  const help=`${n===0?'Clean':'Repair'} machine needed. ${condition} ${action.title||''} Select to show the ${n===0?'Clean':'Repair'} action.`;
  b.dataset.tooltip=help;b.setAttribute('aria-label',help);
 }
 const ingredient=m?.ingredients[refillIndex],b=neededAlerts[2];
 b.hidden=refill.hidden||!ingredient||!!ingredient.restocking||(ingredient.stored===0&&ingredient.incoming>0);
 const label=ingredient?.stored>0?'Refill':'Order';b.querySelector('span').textContent=label;
 const help=ingredient?`${label} ${ingredient.name} needed. ${refill.title||''} Select to show the supply action.`:'';b.dataset.tooltip=help;b.setAttribute('aria-label',help);
 const visible=[...alerts.children].filter(el=>!el.hidden);alerts.hidden=visible.length===0;
 const signature=visible.map(el=>el.id||el.dataset.ingredient).join(',');
 if(signature!==lastSignature){lastSignature=signature;announcement.textContent=visible.length?`Attention needed: ${visible.map(el=>el.querySelector('span')?.textContent).join(', ')}.`:'All service and supply alerts resolved.';}
}
let refillIndex=-1,refillMode=0,lastSignature='';
function render(){
 const m=window.cafeMenuState,s=window.cafeState;if(!m?.ingredients||!s)return;
 renderCare();
 const empty=[];
 buttons.forEach((button,index)=>{if(index>=m.ingredients.length)button.hidden=true;});
 m.ingredients.forEach((i,index)=>{
  const b=buttons[index];b.hidden=i.stock>0||i.needed===false;if(b.hidden)return;empty.push(index);
  const state=i.restocking?'Staff are refilling it.':i.stored>0?'Refill from storage.':i.incoming>0?'Delivery is on the way.':'Order supplies, then refill.';
  const help=`${i.name} out of stock at the work area. ${i.stored} stored, ${i.incoming} incoming. ${state} Open Supplies.`;
  b.setAttribute('aria-label',help);b.dataset.tooltip=help;
 });
 // Table guests stay in the dining phase while awaiting service. Use the same
 // selected ticket as Prepare and C++ recipe deficits, including multi-item needs.
 const ticket=m.tickets.find(t=>t.guest===window.cafeServiceTicketId)||m.tickets.find(t=>!t.paid && !['Preparing','Ready to serve','Leaving'].includes(t.service)),reason=ticket?m.products[ticket.items[0].product]?.reason:'';
 const required=m.ingredients.findIndex(i=>reason===`Restock ${i.name} for this ticket.`);
 const missing=[...new Set([...(ticket?.shortages??(required>=0?[required]:[])),...empty])];
 refillIndex=missing[0]??-1;
 for(let slot=0;slot<supplyButtons.length;slot++){
 const button=supplyButtons[slot],index=missing[slot];button.hidden=index===undefined;if(button.hidden)continue;
 const i=m.ingredients[index],cost=i.price*12,mode=i.stored>0?1:0;
 if(slot===0)refillMode=mode;
 let text,why='';
 if(i.restocking){text=`Refilling ${i.name}`;why='Staff are already refilling this ingredient.';}
 else if(i.stored>0){text=`Refill ${i.name}`;if(i.workSpace<=0)why='There is no room at the work area.';}
 else if(i.incoming>0){text=`${i.name} on order`;why='Wait for delivery, then refill from storage.';}
 else {text=`Order ${i.name} · ${(cost/100).toFixed(2)}`;if(window.cafeSupplyState?.pending)why='Wait for the current delivery.';else if(i.space<12)why='Not enough storage space for a delivery.';else if((window.cafeEconomyState?.available??0)<cost)why='Not enough cash to order this ingredient.';}
 if(window.cafeHostError)why='The game is unavailable.';else if(s.paused)why='Resume the shift to replenish supplies.';else if(window.cafeCampaignState?.enabled&&window.cafeCampaignState.phase===3)why='Prepare the next day before replenishing supplies.';
 button.dataset.ingredient=String(index);button.dataset.action=String(mode);
 button.textContent=text;button.disabled=!!why;button.setAttribute('aria-label',text);button.title=why||(mode===1?`Move up to 4 ${i.name} from storage to the work area.`:`Order 12 ${i.name}. Refill from storage after the delivery arrives.`);
 }
 row.classList.remove('has-refill');const any=[...extras.children].some(b=>!b.hidden);extras.hidden=!any;row.classList.toggle('has-service-actions',any);
 renderNeededAlerts();
}
const inspector=window.cafeInspector;window.cafeInspector=json=>{inspector(json);render();};render();
})();

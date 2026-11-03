// Draft placement uses the existing simulation preview and atomic purchase commands.
(() => {
 const $=id=>document.getElementById(id),canvas=$('viewport');
 const fields=['id','x','z','rotation'].map(name=>$(`layout-${name}`));
 const iconFor=id=>(id<=4||id===101||id===102)?'build-table':({10:'build-station',30:'build-station',11:'build-shelf',20:'build-sage-plant',21:'build-terracotta-plant',22:'build-brass-lamp',23:'build-forest-lamp'})[id];
 const controls=document.createElement('section');controls.id='build-palette';controls.setAttribute('aria-label','Build catalog');
 controls.innerHTML='<h3>Furniture & equipment</h3><p class="build-instructions">Drag an icon onto the cafe floor to buy or move it. Tap an icon, then tap the floor, or use the coordinate editor. Q rotates; Escape cancels.</p><div id="scene-items" class="build-catalog"></div><div class="actions build-placement-actions"><button id="scene-place">Place selected item</button><button id="scene-cancel" hidden>Cancel placement</button></div><p id="scene-placement-status" role="status"></p>';
 const arrange=document.createElement('button');arrange.id='arrange-tables';arrange.type='button';arrange.textContent='Make room for 4 tables · Free';arrange.title='Rearrange owned table sets to fit four, with chairs and clear walking routes. Keeps decorations and purchases nothing.';
 const arrangeHelp=document.createElement('p');arrangeHelp.className='build-instructions';arrangeHelp.textContent='Need another table? Make room for four, then drag a missing table onto a green position. Existing tables move free; new tables cost 6.00 each.';
 controls.querySelector('.build-instructions').before(arrange,arrangeHelp);
 let arranging=false;arrange.onclick=()=>{cancel();arranging=true;Module._cafe_layout(3,0,0,0,0);};
 $('equipment-panel').before(controls);
 const stateNotice=document.createElement('div');stateNotice.id='build-state-notice';stateNotice.innerHTML='<span></span><button type="button" id="build-state-action" hidden></button>';controls.querySelector('h3').after(stateNotice);
 $('build-state-action').onclick=()=>Module._cafe_command(window.cafeState?.paused?2:15);$('equipment-catalog').hidden=true;
 $('equipment-panel').open=false;$('equipment-panel').querySelector('summary').textContent='Equipment details & finishes';
 const editor=document.querySelector('.layout-editor'),advanced=document.createElement('details');advanced.id='build-coordinate-editor';advanced.innerHTML='<summary>Floor plan & coordinates</summary>';editor.before(advanced);advanced.append(editor);
 const badge=document.createElement('div');badge.id='placement-label';badge.hidden=true;
 badge.innerHTML='<img alt="" aria-hidden="true"><strong></strong><span></span>';document.body.append(badge);
 let draft=null,signature;
 const mobile=()=>document.body.classList.contains('mobile-build-ui');
 const editable=()=>window.cafeLayoutState?.editable&&!window.cafeState?.paused&&!window.cafeHostError;
 function cancel(){
  if(draft){fields.forEach((field,n)=>field.value=draft.original[n]);$('scene-placement-status').textContent='Placement cancelled. Cash and furniture are unchanged.';}
  draft=null;window.cafePlacementGuide?.hide();badge.hidden=true;$('scene-cancel').hidden=true;canvas.style.cursor='';fields[1].dispatchEvent(new Event('input'));
  document.querySelectorAll('[data-place-item]').forEach(b=>b.setAttribute('aria-pressed','false'));
 }
 function begin(id,pointerId=null){
  if(pending)return;
  cancel();if(!editable())return;
  const button=$('scene-items').querySelector(`[data-place-item="${id}"]`);if(button?.disabled)return;
  const original=fields.map(f=>f.value);fields[0].value=String(id);fields[0].dispatchEvent(new Event('change'));
  draft={id,original,pointerId,mobile:mobile(),onFloor:false,valid:false};window.cafePlacementGuide?.show(id,Number(fields[3].value));$('scene-cancel').hidden=false;canvas.style.cursor='crosshair';
  if(button)button.setAttribute('aria-pressed','true');
  badge.querySelector('img').src=`assets/ui/${iconFor(id)}.webp`;
  badge.querySelector('strong').textContent=fields[0].selectedOptions[0].textContent;
  $('scene-placement-status').textContent=draft.mobile?'Tap the floor to position. Rotate, then confirm to place.':'Choose a clear floor position. Q rotates; Escape cancels. Pay only on a valid drop.';
 }
 function update(e){
  if(!draft||!editable())return false;
  const r=canvas.getBoundingClientRect(),hit=document.elementFromPoint(e.clientX,e.clientY)===canvas;
  const cell=hit?Module._cafe_floor_pick?.((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height,r.width/r.height):-1;
  const onFloor=Number.isInteger(cell)&&cell>=0;
  draft.onFloor=onFloor;
  if(onFloor){
   const item=window.cafeEquipmentState?.catalog.find(i=>i.id===draft.id),rotated=Number(fields[3].value)%2;
   const w=item?.width||4,d=item?.depth||8;
   fields[1].value=String(((cell<480?cell%24:24+(cell-480)%12)-Math.floor((rotated?d:w)/2))*.5-6);
   fields[2].value=String(((cell<480?Math.floor(cell/24):Math.floor((cell-480)/12))-Math.floor((rotated?w:d)/2))*.5-5);fields[1].dispatchEvent(new Event('input'));
  }
  const valid=validate();
  if(!draft.mobile){
   badge.hidden=false;badge.style.left=`${Math.max(8,Math.min(e.clientX+18,innerWidth-210))}px`;badge.style.top=`${Math.max(8,Math.min(e.clientY-120,innerHeight-170))}px`;
   badge.querySelector('span').textContent=valid?'Release to place':draft.reason;badge.dataset.valid=String(valid);
  }
  return valid;
 }
 function validate(){
  if(!draft)return false;
  const onFloor=draft.onFloor,id=draft.id,item=window.cafeEquipmentState?.catalog.find(i=>i.id===id),owned=window.cafeLayoutState?.tables.some(p=>p.id===id);
  const [x,z,rotation]=fields.slice(1).map(f=>Number(f.value));
  const error=onFloor?Module._cafe_layout_preview(id,x,z,rotation):-1;
  const reasons=['','Invalid footprint or rotation.','Object already exists.','Object is not placed.','Keep the whole object and access space inside the room.','This overlaps another object.','Leave a clear cell around furniture and access points.','This blocks a required route from the entrance.','Furniture limit reached.'];
  const gate=item?.gate||(id>=3&&id<=4?window.cafeEquipmentState?.extraTablesReason:'');
  const price=item?.price??600;
  const policy=!editable()?'Close the cafe, finish outstanding work and resume before placing.':!owned&&gate?gate:!owned&&(window.cafeEconomyState?.available??0)<price?'Not enough available cash for this object.':'';
  const reason=policy||(!onFloor?'Move onto the cafe floor.':reasons[error]||'Cannot place this object here.');
  const valid=onFloor&&error===0&&!policy;
  draft.reason=valid?'':reason;draft.valid=valid;
  const guideKey=onFloor?`${x},${z},${rotation},${valid}`:'';
  if(guideKey!==draft.guideKey){
   if(onFloor)window.cafePlacementGuide?.move(Math.round((x+6)*2),Math.round((z+5)*2),rotation,valid);
   else if(draft.guideKey)window.cafePlacementGuide?.show(id,rotation);
   draft.guideKey=guideKey;
  }
  $('scene-placement-status').textContent=valid?(draft.mobile?'Clear walking route. Ready to place.':'Valid placement. Release to place; keep the gold access cell clear.'):reason;
  return valid;
 }
 function finish(e){
  if(!draft)return;
  if(e?update(e):validate()){
   const id=draft.id,[x,z,rotation]=fields.slice(1).map(f=>Number(f.value));
   const exists=window.cafeLayoutState.tables.some(p=>p.id===id);
   // Validate and dispatch the drop directly; hidden editor button state is not an authority.
   const old=window.cafeLayoutState?.tables.find(p=>p.id===id),expected=[x,z,rotation];
   if(id<=4||id===101||id===102)Module._cafe_layout(exists?0:2,id,x,z,rotation);
   else Module._cafe_equipment(exists?1:0,window.cafeEquipmentState.catalog.find(i=>i.id===id).key,x,z,rotation);
   draft=null;cancel();$('scene-placement-status').textContent='Placement submitted. Waiting for confirmation.';
   // The next published snapshot confirms the authoritative purchase or move.
   pending={id,expected,old,sent:performance.now()};
  }else{const reason=draft.reason;cancel();$('scene-placement-status').textContent=`Not placed: ${reason||'Choose a green floor position.'}`;}
 }
 let pending=null;
 function rotate(){
  if(!draft||!editable())return;
  fields[3].value=String((Number(fields[3].value)+1)%4);fields[3].dispatchEvent(new Event('input'));
  window.cafePlacementGuide?.show(draft.id,Number(fields[3].value));draft.guideKey=undefined;validate();
 }
 window.cafeBuildPlacement={begin,cancel,rotate,confirm(){if(draft?.mobile&&!pending&&validate())finish();},get state(){
  const id=draft?.id,item=window.cafeEquipmentState?.catalog.find(i=>i.id===id),owned=window.cafeLayoutState?.tables.some(p=>p.id===id);
  return {id,active:!!draft,pending:!!pending,valid:!!draft?.valid,positioned:!!draft?.onFloor,owned:!!owned,canSell:!!draft&&editable()&&!!owned&&!$('layout-sell').disabled&&!pending,refund:item?.refund??300,name:id?fields[0].selectedOptions[0]?.textContent:'',price:item?.price??600,rotation:Number(fields[3].value),message:$('scene-placement-status').textContent};
 },sell(){
  if(!draft||!editable()||pending)return;
  fields[1].dispatchEvent(new Event('input'));
  if($('layout-sell').disabled)return;
  const id=draft.id;
  $('layout-sell').click();cancel();pending={id,selling:true,sent:performance.now()};
  $('scene-placement-status').textContent='Sale submitted. Waiting for confirmation.';
 }};
 $('scene-place').onclick=()=>begin(Number(fields[0].value));$('scene-cancel').onclick=cancel;
 document.addEventListener('pointerdown',e=>{
  if(!e.isPrimary||e.button!==0)return;
  const button=e.target.closest('[data-place-item]');
  if(button&&e.isPrimary&&e.button===0&&!button.disabled){
   if(mobile())return; // Native clicks allow the catalogue to scroll on touch.
   e.preventDefault();begin(Number(button.dataset.placeItem),e.pointerId);
   if(draft){draft.startX=e.clientX;draft.startY=e.clientY;try{button.setPointerCapture(e.pointerId);}catch{}}
  }else if(draft&&e.target===canvas){
   if(e.pointerType==='touch')draft.beforeTouch={values:fields.slice(1).map(f=>f.value),onFloor:draft.onFloor};
   e.preventDefault();e.stopImmediatePropagation();draft.pointerId=e.pointerId;canvas.setPointerCapture(e.pointerId);update(e);
  }
 },true);
 canvas.addEventListener('cafe-pinch-start',()=>{
  if(!draft)return;
  draft.pointerId=null;
  if(draft.beforeTouch){
   fields.slice(1).forEach((field,i)=>field.value=draft.beforeTouch.values[i]);draft.onFloor=draft.beforeTouch.onFloor;delete draft.beforeTouch;
   fields[1].dispatchEvent(new Event('input'));window.cafePlacementGuide?.show(draft.id,Number(fields[3].value));draft.guideKey=undefined;validate();
  }
 });
 document.addEventListener('pointermove',e=>{
  if(!draft||(draft.mobile?draft.pointerId!==e.pointerId:(draft.pointerId!==null&&draft.pointerId!==e.pointerId)))return;
  if(draft.startX!==undefined&&Math.hypot(e.clientX-draft.startX,e.clientY-draft.startY)>6)draft.moved=true;
  if(e.cancelable)e.preventDefault();update(e);
 },{passive:false});
 document.addEventListener('pointerup',e=>{
  if(draft?.pointerId!==e.pointerId)return;
  if(draft.mobile){draft.pointerId=null;delete draft.beforeTouch;return;}
  if(draft.startX!==undefined&&!draft.moved){draft.pointerId=null;return;}finish(e);
 });
 document.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
 window.addEventListener('cafe-session-replaced',()=>{cancel();pending=null;arranging=false;});
 document.addEventListener('keydown',e=>{
  if(e.target.closest('dialog[open]'))return;
  if(!draft)return;if(e.key==='Escape'){e.preventDefault();cancel();}
  if(e.key.toLowerCase()==='q'&&!e.target.matches('input,select,textarea')){e.preventDefault();rotate();}
 });
 document.querySelectorAll('[role="tab"][data-mode]').forEach(b=>b.addEventListener('click',cancel));
 function renderCard(item){
  let b=$('scene-items').querySelector(`[data-build-id="${item.id}"]`);
  if(!b){b=document.createElement('button');b.type='button';b.className='build-card';b.dataset.buildId=String(item.id);b.innerHTML='<img alt="" aria-hidden="true"><strong></strong><span class="build-card-price"></span><small class="build-card-state"></small>';
   b.querySelector('img').src=`assets/ui/${item.icon}.webp`;b.querySelector('img').draggable=false;
   if(item.id===0)b.onclick=()=>$('machine-upgrade').click();
   else {b.dataset.placeItem=String(item.id);b.setAttribute('aria-pressed','false');b.onclick=e=>{if(mobile()||e.detail===0)begin(item.id);};b.style.touchAction='none';}
   $('scene-items').append(b);
  }
  b.querySelector('strong').textContent=item.name;
  b.querySelector('.build-card-price').textContent=mobile()&&item.id!==0?(item.owned?'Owned':item.priceText.replace(/^Buy · /,'')):item.priceText;
  b.querySelector('.build-card-state').textContent=mobile()&&item.reason&&(item.state==='Locked'||item.id===0)?item.reason:mobile()?item.state.replace('Drag to move','Tap to move').replace('Drag to build','Tap to place'):item.state;
  b.disabled=!!item.reason||!!pending;b.title=item.reason||item.help;b.dataset.tooltip=b.title;b.setAttribute('aria-label',`${item.name}. ${item.priceText}. ${item.reason||item.help}`);b.dataset.owned=String(item.owned);
  b.dataset.category=(item.id>=1&&item.id<=4)||item.id>=101?'tables':item.id>=20&&item.id<=23?'decor':'equipment';
 }
 function refresh(){
  const enabled=!!editable();$('scene-place').disabled=!enabled;arrange.disabled=!enabled;
  if(arranging && window.cafeLayoutState?.message){
   const message=window.cafeLayoutState.message;
   if(message.startsWith('Tables arranged free.')){
    arranging=false;const missing=[1,2,3,4].find(id=>!window.cafeLayoutState.tables.some(p=>p.id===id));
    if(missing && !window.cafeEquipmentState?.extraTablesReason && (window.cafeEconomyState?.available??0)>=600)begin(missing);
    else $('scene-placement-status').textContent=message;
   }else if(message.includes('Nothing was moved or charged.')){arranging=false;$('scene-placement-status').textContent=message;}
  }
  const notice=stateNotice.querySelector('span'),action=$('build-state-action');
  notice.textContent=window.cafeState?.paused?'Placement is paused. Resume to build.':!window.cafeLayoutState?.closed?'Close the cafe before moving or buying objects.':!window.cafeLayoutState?.editable?'Waiting for guests, staff tasks or deliveries to finish.':'Select an icon to reveal green valid floor positions.';
  action.hidden=enabled||(!window.cafeState?.paused&&!!window.cafeLayoutState?.closed);action.textContent=window.cafeState?.paused?'Resume':'Close cafe';stateNotice.dataset.ready=String(enabled);
  if(draft&&(!enabled||$('build-view')?.hidden))cancel();
  if(draft?.mobile)validate();
  if(pending){const p=window.cafeLayoutState?.tables.find(p=>p.id===pending.id),[x,z,r]=pending.expected||[];
   if(pending.selling&&!p){$('scene-placement-status').textContent='Furniture sold. Refund added to cash.';pending=null;}
   else if(!pending.selling&&p&&p.x===Math.round((x+6)*2)&&p.z===Math.round((z+5)*2)&&p.rotation===r){$('scene-placement-status').textContent=pending.old?'Furniture moved. Routes remain open.':'Purchased and placed. Routes remain open.';pending=null;}
   else if(performance.now()-pending.sent>5000){$('scene-placement-status').textContent=window.cafeEquipmentState?.message||$('layout-status').textContent||'Placement was not accepted. Try a green position.';pending=null;}
   else if(window.cafeEquipmentState?.message?.includes('rejected')){$('scene-placement-status').textContent=window.cafeEquipmentState.message;pending=null;}
  }
  const items=[...fields[0].options].map(o=>{
   const id=Number(o.value),item=window.cafeEquipmentState?.catalog.find(i=>i.id===id),owned=!!window.cafeLayoutState?.tables.some(p=>p.id===id),price=item?.price??600;
   const gate=item?.gate||(id>=3&&id<=4?window.cafeEquipmentState?.extraTablesReason:'');
   const reason=!enabled?(window.cafeState?.paused?'Resume the shift to build.':'Close the cafe and finish visits, tasks and deliveries before building.'):!owned&&gate?gate:!owned&&(window.cafeEconomyState?.available??0)<price?'Not enough available cash.':'';
   return{id,name:o.textContent,icon:iconFor(id),owned,priceText:owned?'Owned · move free':`Buy · ${(price/100).toFixed(2)}`,state:reason?(!enabled?(window.cafeState?.paused?'Resume to build':'Cafe must be closed'):gate?'Locked':'Insufficient cash'):owned?'Drag to move':'Drag to build',reason,help:`${owned?'Move':'Buy and place'} ${o.textContent}. Footprint ${((item?.width??4)*.5).toFixed(1)} × ${((item?.depth??8)*.5).toFixed(1)} m. ${item?.effect||(id===101||id===102?'Outdoor table and chairs. Shares the cafe staff and equipment.':'Table and two chairs; adds seating.')}`};
  });
  const speed=window.cafeEquipmentState?.catalog.find(i=>i.id===0);
  if(speed)items.push({id:0,name:speed.name,icon:'build-speed-kit',owned:!!speed.owned,priceText:speed.owned?'Installed':`Install · ${(speed.price/100).toFixed(2)}`,state:'Fits existing counter',reason:!enabled?'Close the cafe and resume the shift to install.':speed.buyReason,help:speed.effect});
  const next=JSON.stringify([items,!!pending,mobile()]);if(next!==signature&&!draft){signature=next;items.forEach(renderCard);}
  requestAnimationFrame(refresh);
 }
 refresh();
})();

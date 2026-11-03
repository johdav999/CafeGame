// Mobile presentation reuses the catalogue, placement draft and authoritative commands.
(() => {
 const $=id=>document.getElementById(id),shell=$('play-shell');
 if(!shell)return;
 const narrow=matchMedia('(max-width:650px)'),palette=$('build-palette');
 const header=document.createElement('header');header.id='mobile-build-header';
 header.innerHTML='<div class="mobile-build-mode"><strong>Build mode</strong><span id="mobile-build-phase"></span></div><div class="mobile-build-budget"><span id="mobile-build-cash" aria-label="Available cash"></span><button id="mobile-build-done" type="button" class="mobile-build-primary">Done</button></div>';
 const tools=document.createElement('div');tools.id='mobile-build-tools';
 tools.innerHTML='<button type="button" id="mobile-build-reset">Reset view</button><button type="button" id="mobile-build-owned" aria-pressed="false">Move furniture</button>';
 const placement=document.createElement('section');placement.id='mobile-build-placement';placement.hidden=true;placement.setAttribute('aria-label','Furniture placement');
 placement.innerHTML='<div class="mobile-build-context"><button type="button" id="mobile-build-back">Furniture</button><button type="button" id="mobile-build-sell" hidden>Sell…</button></div><div class="mobile-build-placement-bar"><div class="mobile-build-selection"><img alt="" aria-hidden="true"><div><strong id="mobile-build-item"></strong><p id="mobile-build-feedback" role="status" aria-live="polite"></p></div></div><div class="mobile-build-placement-buttons"><button type="button" id="mobile-build-cancel">Cancel</button><button type="button" id="mobile-build-rotate">Rotate 90°</button><button type="button" id="mobile-build-confirm" class="mobile-build-primary" disabled>Place</button></div></div>';
 const result=document.createElement('p');result.id='mobile-build-result';result.setAttribute('role','status');result.setAttribute('aria-live','polite');result.hidden=true;
 shell.append(header,tools,placement,result);
 header.querySelector('.mobile-build-budget').prepend(window.cafeArtIcon('coin'));
 const categories=document.createElement('div');categories.id='mobile-build-categories';categories.setAttribute('role','tablist');categories.setAttribute('aria-label','Furniture categories');
 for(const [id,label] of [['tables','Tables'],['decor','Decor'],['equipment','Equipment']]){
  const b=document.createElement('button');b.id=`mobile-build-category-${id}`;b.type='button';b.role='tab';b.dataset.category=id;b.textContent=label;b.setAttribute('aria-controls','scene-items');categories.append(b);
 }
 const summary=document.createElement('p');summary.id='mobile-build-summary';
 $('scene-items').before(categories);$('scene-items').after(summary);
 const sale=document.createElement('dialog');sale.id='mobile-build-sale';sale.setAttribute('aria-labelledby','mobile-build-sale-title');
 sale.innerHTML='<h2 id="mobile-build-sale-title">Sell furniture?</h2><p id="mobile-build-sale-copy"></p><div><button type="button" id="mobile-build-sale-cancel">Keep furniture</button><button type="button" id="mobile-build-sale-confirm">Confirm sale</button></div>';
 shell.append(sale);
 let enabled=false,category='tables',ownedOnly=false,last='',activeId=null,wasActive=false,wasPending=false;
 function filter(){
  palette.dataset.category=category;palette.dataset.ownedOnly=String(ownedOnly);
  for(const b of categories.children){const selected=b.dataset.category===category;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;}
  if(enabled){$('scene-items').setAttribute('role','tabpanel');$('scene-items').setAttribute('aria-labelledby',`mobile-build-category-${category}`);}
  else{$('scene-items').removeAttribute('role');$('scene-items').removeAttribute('aria-labelledby');}
  $('mobile-build-owned').setAttribute('aria-pressed',String(ownedOnly));$('mobile-build-owned').textContent=ownedOnly?'Browse all':'Move furniture';
 }
 categories.addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b){category=b.dataset.category;filter();$('play-drawer').scrollTop=0;}});
 categories.addEventListener('keydown',e=>{
  const tabs=[...categories.children],i=tabs.indexOf(e.target);if(i<0)return;
  const j=e.key==='Home'?0:e.key==='End'?tabs.length-1:e.key==='ArrowRight'?(i+1)%tabs.length:e.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:-1;
  if(j>=0){e.preventDefault();tabs[j].click();tabs[j].focus();}
 });
 function restoreFocus(){if(activeId!==null)$('scene-items').querySelector(`[data-place-item="${activeId}"]`)?.focus({preventScroll:true});}
 function cancel(){window.cafeBuildPlacement.cancel();restoreFocus();}
 $('mobile-build-cancel').onclick=cancel;$('mobile-build-back').onclick=cancel;
 $('mobile-build-rotate').onclick=()=>window.cafeBuildPlacement.rotate();
 $('mobile-build-confirm').onclick=()=>window.cafeBuildPlacement.confirm();
 $('mobile-build-done').onclick=()=>{cancel();$('serve-tab').click();$('serve-tab').focus();};
 $('mobile-build-reset').onclick=()=>Module._cafe_camera?.(0,0,0);
 $('mobile-build-owned').onclick=()=>{ownedOnly=!ownedOnly;filter();};
 $('mobile-build-sell').onclick=()=>{
  const s=window.cafeBuildPlacement.state;if(!s.canSell)return;
  $('mobile-build-sale-copy').textContent=`Sell ${s.name} for ${(s.refund/100).toFixed(2)}? This removes it from the café.`;
  sale.showModal();$('mobile-build-sale-cancel').focus();
 };
 $('mobile-build-sale-cancel').onclick=()=>sale.close();
 $('mobile-build-sale-confirm').onclick=()=>{sale.close();window.cafeBuildPlacement.sell();};
 function configure(){
  const next=['phone','tablet'].includes(document.documentElement.dataset.device)||narrow.matches;
  if(next===enabled)return;
  window.cafeBuildPlacement.cancel();enabled=next;document.body.classList.toggle('mobile-build-ui',enabled);
  if(enabled)$('layout-panel').open=true;
  if(sale.open)sale.close();filter();last='';
 }
 narrow.addEventListener('change',configure);
 new MutationObserver(configure).observe(document.documentElement,{attributes:true,attributeFilter:['data-device']});
 // Mode changes include arrow-key tab navigation and programmatic reveals.
 new MutationObserver(()=>{if(shell.dataset.mode!=='build'){window.cafeBuildPlacement.cancel();if(sale.open)sale.close();}}).observe(shell,{attributes:true,attributeFilter:['data-mode']});
 configure();filter();
 function refresh(){
  if(enabled&&shell.dataset.mode==='build'){
   const s=window.cafeBuildPlacement.state,layout=window.cafeLayoutState,state=window.cafeState;
   const next=JSON.stringify([s,layout?.closed,layout?.editable,layout?.tables,state?.paused,window.cafeEconomyState?.available,category,ownedOnly]);
   if(last!==next){last=next;
    shell.dataset.buildPlacing=String(s.active);placement.hidden=!s.active;
    $('mobile-build-phase').textContent=state?.paused?'Paused':layout?.closed?'Café closed':'Café open';
    $('mobile-build-cash').textContent=((window.cafeEconomyState?.available??0)/100).toFixed(2);
    $('mobile-build-cash').setAttribute('aria-label',`Available cash ${$('mobile-build-cash').textContent}`);
    palette.querySelector('h3').textContent='Furniture';
    const placed=layout?.tables.filter(p=>p.id>=1&&p.id<=4).length??0;
    const cards=[...$('scene-items').children].filter(b=>b.dataset.category===category&&(!ownedOnly||b.dataset.owned==='true'));
    summary.textContent=ownedOnly&&!cards.length?'No owned items in this category.':category==='tables'?`${placed} of 4 indoor tables placed`:'Choose an item to place';
    if(s.active){
     activeId=s.id;
     placement.querySelector('img').src=$('scene-items').querySelector(`[data-place-item="${s.id}"] img`)?.src||'';
     $('mobile-build-item').textContent=`${s.name} · ${s.owned?'Move free':(s.price/100).toFixed(2)}`;
     $('mobile-build-feedback').textContent=!s.positioned?'Tap floor to position':s.message;
     $('mobile-build-feedback').dataset.valid=String(s.valid);
     $('mobile-build-rotate').setAttribute('aria-label',`Rotate 90 degrees. Current rotation ${s.rotation*90} degrees`);
     $('mobile-build-confirm').textContent=s.owned?'Move · Free':`Place · ${(s.price/100).toFixed(2)}`;
     $('mobile-build-confirm').disabled=!s.valid||s.pending;
     $('mobile-build-sell').hidden=!s.owned;$('mobile-build-sell').disabled=!s.canSell;
     if(!wasActive)$('mobile-build-rotate').focus({preventScroll:true});
    }
    if((wasActive&&!s.active)||(wasPending&&!s.pending))restoreFocus();wasActive=s.active;wasPending=s.pending;
    result.textContent=s.message;result.hidden=s.active||!s.message;
    if(sale.open){$('mobile-build-sale-confirm').disabled=!s.canSell;if(!s.active)sale.close();}
   }
  }else if(!enabled){palette.querySelector('h3').textContent='Furniture & equipment';}
  requestAnimationFrame(refresh);
 }
 refresh();
})();

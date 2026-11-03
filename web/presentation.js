// Presentation owns preferences and view state; C++ remains the owner of game rules.
(() => {
const $=id=>document.getElementById(id),query=s=>document.querySelector(s);
let alive=true;
addEventListener('pagehide',()=>{alive=false;});
window.cafeAssetState={models:0,audio:0,failures:[],bytes:0};
window.cafeLoadAssets=async()=>{
 const state=window.cafeAssetState;
 try{
  const manifest=await (await fetch('assets/manifest.json')).json();
  await Promise.all([...manifest.models.map(a=>({...a,type:'model'})),...manifest.audio.map(a=>({...a,type:'audio'}))].map(async asset=>{
   let ptr=0;
   try{
    if(!/^(models\/[A-Za-z-]+\.glb|audio\/[a-z-]+\.wav)$/.test(asset.path))throw Error('Nonlocal asset');
    const response=await fetch(`assets/${asset.path}`);if(!response.ok)throw Error('Missing file');
    const bytes=await response.arrayBuffer();if(!alive)return;
    const budget=(asset.type==='model'?(asset.id===4 || asset.id===1 || (asset.id>=12 && asset.id<=14)?8:asset.id===10 || asset.id===11 || asset.id===24?2:1):1)*1024*1024;
    if(bytes.byteLength>budget)throw Error('Asset exceeds budget');
    let ok;
    if(asset.type==='model'){ptr=Module._malloc(bytes.byteLength);if(!ptr)throw Error('Allocation failed');HEAPU8.set(new Uint8Array(bytes),ptr);ok=Module._cafe_model(asset.id,ptr,bytes.byteLength);}
    else{
     const view=new DataView(bytes);if(view.getUint32(0,true)!==0x46464952 || view.getUint32(36,true)!==0x61746164 || view.getUint16(20,true)!==1 || view.getUint16(22,true)!==1 || view.getUint16(34,true)!==16 || view.getUint32(24,true)!==16000 || view.getUint32(40,true)!==bytes.byteLength-44)throw Error('Unsupported WAV');
     const count=(bytes.byteLength-44)/2;ptr=Module._malloc(count*4);if(!ptr)throw Error('Allocation failed');for(let i=0;i<count;i++)HEAPF32[ptr/4+i]=view.getInt16(44+i*2,true)/32768;ok=Module._cafe_sound(asset.id,ptr,count,16000);
    }
    if(!ok)throw Error('Engine rejected asset');state[asset.type==='model'?'models':'audio']++;state.bytes+=bytes.byteLength;
   }catch(error){state.failures.push(`${asset.path}: ${error.message}`);}finally{if(ptr)Module._free(ptr);}
  }));
 }catch(error){state.failures.push(error.message);}
 if(alive)window.cafeAssetsReady=true;
};
window.cafeRenderMeasurements={started:performance.now(),frames:0,intervals:[],engine:null};
window.enginePerformance=snapshot=>{window.cafeRenderMeasurements.engine=snapshot;};
let lastFrame;
function measure(now){const m=window.cafeRenderMeasurements;if(!document.hidden && window.cafeState && !window.cafeHostError){m.firstFrameMs??=now-m.started;if(lastFrame && m.intervals.length<3600)m.intervals.push(now-lastFrame);m.frames++;}lastFrame=now;if(alive)requestAnimationFrame(measure);}
requestAnimationFrame(measure);
// Existing regression tools can explicitly open the full developer workbench.
if(new URLSearchParams(location.search).get('tools')==='1'){document.body.classList.add('workbench');return;}
document.body.classList.add('playable');
const oldMain=query('main'),game=query('.game'),aside=query('aside'),tools=query('.session-tools');
const shell=document.createElement('div');shell.id='play-shell';
shell.innerHTML=`<header class="play-heading"><div class="shift-capsule"><span id="shift-icon"></span><div><h1 id="shift-title">A good morning.</h1><p id="day-label">Opening the cafeâ€¦</p></div><div id="hud-pause"></div></div><div id="hud-stats"></div></header>
<div class="play-world"><div id="world-slot"></div><section id="play-drawer" aria-label="Cafe controls">
<section id="serve-view" role="tabpanel" aria-labelledby="serve-tab"><h2>On the counter</h2><div id="guide"><p id="guide-copy"></p><div class="actions"><button id="guide-action">Begin guided shift</button><button id="guide-hide" aria-label="Hide guidance">Hide guide</button></div></div><button id="next-action" disabled>Waiting for the cafeâ€¦</button><p id="next-reason" role="status"></p><progress id="brew-progress" max="1" value="0" aria-label="Ticket preparation progress"></progress><div id="service-slot"></div><details id="supplies-drawer"><summary>Supplies & machine care</summary></details><details id="visits-drawer"><summary>Guests & practice tickets</summary></details></section>
<section id="build-view" role="tabpanel" aria-labelledby="build-tab" hidden><h2>Make it yours</h2><div id="build-slot"></div></section>
<section id="menu-view" role="tabpanel" aria-labelledby="menu-tab" hidden><h2>Your cafe</h2><div id="management-slot"></div><details id="settings-panel"><summary>Sound & accessibility</summary><p>Sounds begin after a click or key. Orders and status are always written. Pause and hidden tabs suspend audio.</p><label><input type="checkbox" id="audio-muted"> Mute all sound</label><label>Effects <input id="effects-volume" type="range" min="0" max="100" value="55"></label><label>Ambience <input id="ambience-volume" type="range" min="0" max="100" value="30"></label><p>No music track is installed.</p><label>UI size <select id="ui-size"><option value="1">Standard</option><option value="1.15">Large</option><option value="1.3">Extra large</option></select></label><label><input type="checkbox" id="reduced-motion"> Reduce motion</label><button id="guide-show">Show first-shift guide</button><p id="audio-status" role="status">Sound awaits a gesture.</p></details><details id="developer-panel"><summary>Developer tools</summary><p>Presets replace the current session. Save first. <a href="?tools=1">Full developer workbench</a> Â· <a href="?backend=webgl2">WebGL 2</a></p></details></section>
</section></div><nav class="mode-nav" role="tablist" aria-label="Cafe mode"><button id="serve-tab" role="tab" aria-controls="serve-view" aria-selected="true" data-mode="serve">Serve <span id="ticket-count">0</span></button><button id="build-tab" role="tab" aria-controls="build-view" aria-selected="false" data-mode="build" tabindex="-1">Build</button><button id="menu-tab" role="tab" aria-controls="menu-view" aria-selected="false" data-mode="menu" tabindex="-1">Menu</button></nav>`;
document.body.prepend(shell);
$('world-slot').append(game);$('hud-stats').append(query('.stats'));$('hud-pause').append(query('[data-command="2"]'));
const morning=document.createElement('div');morning.id='morning-summary';morning.setAttribute('aria-label','Shift progress');
morning.append(window.cafeArtIcon('goal'));const morningCopy=document.createElement('div');morningCopy.innerHTML='<strong id="morning-title">Morning rhythm</strong><p id="morning-copy">Your neighborhood cafe</p><p id="shift-goal-copy" hidden></p>';
morning.append(morningCopy);shell.append(morning);morningCopy.append($('served').parentElement);
$('shift-icon').append(window.cafeArtIcon('sun'));
const cash=$('coins').parentElement;cash.setAttribute('aria-label','Available cash');cash.prepend(window.cafeArtIcon('coin'));
const appeal=document.createElement('details');appeal.id='attractiveness';
appeal.innerHTML='<summary aria-label="Cafe attractiveness"><strong id="attractiveness-value">ï¿½</strong><small>/100</small></summary><div class="attractiveness-breakdown"><strong>Cafe attractiveness</strong><p id="attractiveness-menu"></p><p id="attractiveness-experience"></p><p id="attractiveness-furnishings"></p><p id="attractiveness-capacity"></p><small>Varied recipes, happy guests, shorter waits and a furnished cafe improve your score.</small></div>';
appeal.querySelector('summary').prepend(window.cafeArtIcon('attractiveness'));$('hud-stats').append(appeal);
const appealFx=window.createCafeAppealFx(appeal.querySelector('summary'),$('attractiveness-value'));
for(const name of ['serve','build','menu'])$(`${name}-tab`).prepend(window.cafeArtIcon(name));
$('service-slot').append(aside);
// Relocate the existing controls, preserving their handlers, IDs and validation.
const supplies=$('supplies-drawer'),visits=$('visits-drawer'),management=$('management-slot'),dev=$('developer-panel');
management.append(query('.campaign-panel'));
management.append($('staff-panel'),$('finance-panel'));
$('build-slot').append($('layout-panel'));$('layout-panel').open=true;
visits.append($('demand-panel'));$('demand-panel').open=true;
dev.append($('authoring-panel'),$('inspector-panel'));$('staff-panel').open=false;$('finance-panel').open=false;
const sessionActions=tools.querySelector('.actions');management.append(sessionActions);
visits.append(query('[data-command="6"]'));
const cancel=query('[data-command="5"]');aside.append(cancel);
// Supplies and care were originally siblings in the workbench.
for(const child of [...tools.children]){
 if(child.id==='save-status'){management.append(child);continue;}
 if(child.id==='workflow' || child.id==='occupancy'){$('service-slot').append(child);continue;}
 if(child.matches('.actions') || ['ingredient-status','supply','quality'].includes(child.id) || child.tagName==='P')supplies.append(child);
}
oldMain.remove();
// Keep advanced recipe buttons discoverable without filling the ordinary HUD.
const recipes=document.createElement('details');recipes.id='recipe-actions';recipes.innerHTML='<summary>Recipe actions</summary>';
recipes.append(aside.querySelector('.actions'),aside.querySelector('.menu-actions'));aside.append(recipes);
aside.querySelector('.eyebrow').textContent='ORDER TICKETS';aside.querySelector('h2').hidden=true;
aside.querySelector('small').hidden=true;
const canvas=$('viewport');canvas.tabIndex=0;
const cameraHelp=document.createElement('p');cameraHelp.id='camera-help';
cameraHelp.textContent='Camera: drag the scene to orbit. On touchscreens, spread two fingers on the scene to zoom in, or pinch them together to zoom out. Shift-drag pans. Click or Tab to focus the scene, then use the wheel to zoom, arrow keys to orbit, WASD to pan, +/− to zoom, and R to reset the view.';
$('settings-panel').append(cameraHelp);canvas.setAttribute('aria-describedby','camera-help');
cameraHelp.textContent+=' In Serve, click the counter or coffee machine to prepare the next waiting order. Table orders must be collected first.';
cameraHelp.textContent+=' Click a barista to select them, then click an open floor position to walk there. Assigned work takes priority. Escape clears selection.';
let selectedStaff=0;
const staffControl=document.createElement('div');staffControl.id='staff-move-control';staffControl.hidden=true;
const staffMessage=document.createElement('span');staffMessage.id='staff-move-message';staffMessage.setAttribute('role','status');
const staffClear=document.createElement('button');staffClear.type='button';staffClear.textContent='Deselect';
staffControl.append(staffMessage,staffClear);canvas.parentElement.append(staffControl);
function clearStaff(){Module._cafe_staff_deselect?.();selectedStaff=0;staffControl.hidden=true;}
staffClear.addEventListener('click',clearStaff);
query('.mode-nav').addEventListener('click',clearStaff);
query('.mode-nav').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key))clearStaff();});
window.cafeStaffSelection=id=>{
 if(id!==selectedStaff){selectedStaff=id;staffMessage.textContent='Barista selected. Click an open floor position to move.';}
 const member=window.cafeStaffState?.staff.find(w=>w.id===id);
 staffClear.textContent=member?`Deselect ${member.name}`:'Deselect';
 staffControl.hidden=!id || shell.dataset.mode!=='serve';
};
window.cafeStaffMoveResult=result=>{
 staffMessage.textContent=result===2?'Walking to the selected position. Click another floor position to redirect.':result===3?'This barista is busy. Try again when their task is finished.':'Choose an open, reachable floor position.';
};
canvas.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();clearStaff();}});
function cameraMove(action,x=0,z=0){Module._cafe_camera?.(action,x,z);}
const cameraActions={left:[1,-.12,0],right:[1,.12,0],up:[1,0,.08],down:[1,0,-.08],in:[3,-1],out:[3,1],'pan-left':[2,-.4,0],'pan-right':[2,.4,0],'pan-up':[2,0,-.4],'pan-down':[2,0,.4],reset:[0]};
canvas.addEventListener('keydown',e=>{const map={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'pan-left',d:'pan-right',w:'pan-up',s:'pan-down','+':'in','=':'in','-':'out',r:'reset'},action=map[e.key];if(action){e.preventDefault();cameraMove(...cameraActions[action]);}});
let pointer;
let hoverPointer=null;
// Own multi-touch before placement and single-pointer handlers receive it.
// Both fingers must begin on the scene; UI touches keep their normal behavior.
const cameraTouches=new Map();
let pinching=false,pinchDistance=0;
function touchDistance(){const [a,b]=cameraTouches.values();return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;}
function consumePinch(e){if(e.cancelable)e.preventDefault();e.stopImmediatePropagation();pointer=null;}
function resetTouches(){
 const ids=[...cameraTouches.keys()];cameraTouches.clear();pinching=false;pinchDistance=0;pointer=null;
 for(const id of ids)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
}
document.addEventListener('pointerdown',e=>{
 if(e.pointerType!=='touch'||e.target!==canvas)return;
 cameraTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(cameraTouches.size<2)return;
 if(!pinching){pinching=true;hoverPointer=null;canvas.dispatchEvent(new Event('cafe-pinch-start'));}
 pinchDistance=touchDistance();
 canvas.setPointerCapture(e.pointerId);consumePinch(e);
},{capture:true,passive:false});
document.addEventListener('pointermove',e=>{
 if(!cameraTouches.has(e.pointerId))return;
 cameraTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(!pinching)return;
 const distance=touchDistance();
 if(distance>=8&&pinchDistance>=8){
  const zoom=Math.max(-1.5,Math.min(1.5,8*Math.log(pinchDistance/distance)));
  if(zoom)cameraMove(3,zoom);
 }
 pinchDistance=distance;consumePinch(e);
},{capture:true,passive:false});
function endTouch(e){
 if(!cameraTouches.has(e.pointerId))return;
 const consumed=pinching;cameraTouches.delete(e.pointerId);pinchDistance=touchDistance();
 // Keep the remaining finger suppressed until the entire gesture ends.
 if(!cameraTouches.size)pinching=false;
 if(consumed)consumePinch(e);
}
for(const event of ['pointerup','pointercancel'])document.addEventListener(event,endTouch,{capture:true,passive:false});
canvas.addEventListener('lostpointercapture',endTouch);
window.addEventListener('blur',resetTouches);
window.addEventListener('pagehide',resetTouches);
window.addEventListener('cafe-session-replaced',resetTouches);
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetTouches();});
// Reuse click picking so the hand follows the counter and machine as the camera moves.
function updateServiceCursor(){
 let hand=false;
 if(hoverPointer && !pointer && shell.dataset.mode==='serve' && !window.cafeState?.paused && !window.cafeHostError){
  const r=canvas.getBoundingClientRect(),{x,y}=hoverPointer;
  if(r.width>0 && r.height>0 && document.elementFromPoint(x,y)===canvas)
   hand=!!(Module._cafe_staff_pick?.((x-r.left)/r.width,(y-r.top)/r.height,r.width/r.height,0) || Module._cafe_service_pick?.((x-r.left)/r.width,(y-r.top)/r.height,r.width/r.height));
 }
 canvas.classList.toggle('service-hover',hand);
 canvas.classList.toggle('staff-destination',!!selectedStaff && !hand && shell.dataset.mode==='serve' && !window.cafeState?.paused);
 if(alive)requestAnimationFrame(updateServiceCursor);
}
canvas.addEventListener('pointermove',e=>{if(e.pointerType!=='touch')hoverPointer={x:e.clientX,y:e.clientY};});
canvas.addEventListener('pointerleave',()=>{hoverPointer=null;canvas.classList.remove('service-hover');});
window.addEventListener('blur',()=>{hoverPointer=null;canvas.classList.remove('service-hover');});
requestAnimationFrame(updateServiceCursor);
canvas.addEventListener('pointerdown',e=>{if(e.isPrimary && e.button===0){pointer={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,dragged:false,shift:e.shiftKey};canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});}});
canvas.addEventListener('pointermove',e=>{
 if(pointer?.id!==e.pointerId)return;
 pointer.shift ||= e.shiftKey;
 if(!pointer.dragged && Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)<=6)return;
 pointer.dragged=true;
 const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;cameraMove(e.shiftKey?2:1,dx*(e.shiftKey?.015:.005),dy*(e.shiftKey?.015:.004));pointer.x=e.clientX;pointer.y=e.clientY;
});
canvas.addEventListener('pointerup',e=>{
 const press=pointer;pointer=null;
 if(press?.id!==e.pointerId || press.dragged || press.shift || e.shiftKey || Math.hypot(e.clientX-press.startX,e.clientY-press.startY)>6 || shell.dataset.mode!=='serve' || window.cafeState?.paused || window.cafeHostError)return;
 const rect=canvas.getBoundingClientRect();
 const x=(e.clientX-rect.left)/rect.width,y=(e.clientY-rect.top)/rect.height,aspect=rect.width/rect.height;
 const staff=Module._cafe_staff_pick?.(x,y,aspect,1);
 if(staff){window.cafeStaffSelection(staff);staffMessage.textContent='Barista selected. Click an open floor position to move.';return;}
 if(Module._cafe_service_pick?.(x,y,aspect)){Module._cafe_command(33);return;}
 if(selectedStaff)Module._cafe_staff_move?.(Module._cafe_floor_pick?.(x,y,aspect)??-1);
});
for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>pointer=null);
canvas.addEventListener('wheel',e=>{if(document.activeElement===canvas){e.preventDefault();cameraMove(3,Math.sign(e.deltaY)*.7);}}, {passive:false});
function showMode(mode,focus=false){if(shell.dataset.mode!==mode)resetTouches();if(shell.dataset.mode && shell.dataset.mode!==mode)Module._cafe_audio?.(4,0);for(const name of ['serve','build','menu']){const chosen=name===mode;$(`${name}-view`).hidden=!chosen;$(`${name}-tab`).setAttribute('aria-selected',String(chosen));$(`${name}-tab`).tabIndex=chosen?0:-1;}shell.dataset.mode=mode;$('play-drawer').scrollTop=0;if(focus)$(`${mode}-tab`).focus();}
query('.mode-nav').addEventListener('click',e=>{const button=e.target.closest('[data-mode]');if(button)showMode(button.dataset.mode);});
query('.mode-nav').addEventListener('keydown',e=>{const modes=['serve','build','menu'],index=modes.indexOf(e.target.dataset.mode);if(index<0)return;let next;if(e.key==='ArrowRight')next=(index+1)%3;if(e.key==='ArrowLeft')next=(index+2)%3;if(e.key==='Home')next=0;if(e.key==='End')next=2;if(next!==undefined){e.preventDefault();showMode(modes[next],true);}});
function reveal(id,mode='serve'){showMode(mode);$(id).open=true;$(id).querySelector('summary')?.focus();}
const journalButton=document.createElement('button');journalButton.id='journal-button';journalButton.textContent='Café journal';
journalButton.addEventListener('click',()=>reveal('cafe-journal','menu'));$('guide').after(journalButton);
let prefs={muted:false,effects:55,ambience:30,scale:'1',motion:matchMedia('(prefers-reduced-motion: reduce)').matches,guide:true};
try{const p=JSON.parse(localStorage.getItem('cafegame.presentation.v1'));if(p){for(const key of ['muted','motion','guide'])if(typeof p[key]==='boolean')prefs[key]=p[key];for(const key of ['effects','ambience'])if(Number.isFinite(p[key]))prefs[key]=Math.max(0,Math.min(100,p[key]));if(['1','1.15','1.3'].includes(p.scale))prefs.scale=p.scale;}}catch{}
function applyPreferences(){document.documentElement.style.setProperty('--ui-scale',prefs.scale);document.body.classList.toggle('reduce-motion',prefs.motion);$('audio-muted').checked=prefs.muted;$('effects-volume').value=prefs.effects;$('ambience-volume').value=prefs.ambience;$('ui-size').value=prefs.scale;$('reduced-motion').checked=prefs.motion;$('guide').hidden=!prefs.guide;Module._cafe_motion?.(+prefs.motion);Module._cafe_audio?.(1,+prefs.muted);Module._cafe_audio?.(2,prefs.effects/100);Module._cafe_audio?.(3,prefs.ambience/100);try{localStorage.setItem('cafegame.presentation.v1',JSON.stringify(prefs));}catch{}}
for(const [id,key,type] of [['audio-muted','muted','checked'],['effects-volume','effects','value'],['ambience-volume','ambience','value'],['ui-size','scale','value'],['reduced-motion','motion','checked']])$(id).addEventListener('input',()=>{prefs[key]=type==='checked'?$(id).checked:key==='scale'?$(id).value:Number($(id).value);applyPreferences();});
$('guide-hide').onclick=()=>{prefs.guide=false;applyPreferences();};$('guide-show').onclick=()=>{prefs.guide=true;applyPreferences();showMode('serve');};
// Mouse pointerdown precedes the browser's activation-triggering mousedown.
// Resume on click (also emitted for touch/keyboard controls), inside the gesture.
for(const event of ['click','keydown'])document.addEventListener(event,()=>{Module._cafe_audio?.(0,0);},{capture:true});
const soundButton=document.createElement('button');soundButton.id='sound-enable';soundButton.type='button';
soundButton.textContent='Enable sound';soundButton.title='Enable cafe sounds and play a test sound. Volume controls are in Menu > Sound & accessibility.';
$('hud-pause').after(soundButton);
const testSound=document.createElement('button');testSound.id='sound-test';testSound.type='button';testSound.textContent='Test sound';
$('audio-status').before(testSound);
let soundTestTimer;
function enableSound(){
 prefs.muted=false;if(prefs.effects===0)prefs.effects=55;applyPreferences();Module._cafe_audio?.(0,0);
 clearTimeout(soundTestTimer);
 let attempts=0;
 const test=()=>{if(!alive)return;if(window.cafeAudioState?.active){Module._cafe_audio?.(4,0);return;}if(++attempts<20)soundTestTimer=setTimeout(test,50);};
 soundTestTimer=setTimeout(test,50);
}
soundButton.onclick=enableSound;testSound.onclick=enableSound;
let nextCommand,guideAction,maxWork=0,lastReady=false,lastServed,preferencesReady=false;
$('next-action').onclick=()=>{if(nextCommand!==undefined)query(`[data-command="${nextCommand}"]`)?.click();};
$('guide-action').onclick=()=>guideAction?.();
const text=(id,value)=>{if($(id).textContent!==value)$(id).textContent=value;};
const periodControls=document.createElement('div');periodControls.id='period-controls';periodControls.hidden=true;
const periodContinue=document.createElement('button');periodContinue.id='period-continue';periodContinue.type='button';
const periodBuild=document.createElement('button');periodBuild.id='period-build';periodBuild.type='button';periodBuild.textContent='Build & shop';periodBuild.title='Buy and arrange furniture during this break. The business clock and wages stay stopped.';periodBuild.onclick=()=>showMode('build',true);
periodControls.append(periodContinue,periodBuild);$('day-label').parentElement.append(periodControls);
$('day-label').parentElement.classList.add('clock-copy');$('day-label').setAttribute('role','status');
$('shift-title').title='Opening hours 08:00–18:00. Morning 08:00–12:00, Lunch 12:00–14:00, Afternoon 14:00–18:00. One cafe hour is one minute of active play. The clock stops at every period boundary.';
let periodAction;
periodContinue.onclick=()=>{periodAction?.();if(!(window.cafeCampaignState?.enabled&&window.cafeCampaignState.phase===3))showMode('serve',true);};
const timeOfDay=minutes=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
function renderClock(s,c){
 const clock=window.cafeClockState;if(!clock)return;
 const range=`${timeOfDay(clock.start)}–${timeOfDay(clock.end)}`;
 text('shift-title',`Day ${clock.day} · ${timeOfDay(clock.minutes)}`);
 const preparing=c?.enabled&&c.phase===0,summary=c?.enabled&&c.phase===3;
 const label=s.paused?`${clock.name} · paused`:preparing?`${clock.name} · preparation`:summary?'Day complete':clock.stage===1?`${clock.name} ended · finishing service`:clock.stage===2?`${clock.name} complete · build & shopping break`:`${clock.name} · ${range}${clock.running?'':' · closed'}`;
 text('day-label',label);
 periodControls.hidden=!(clock.stage===2 || preparing || summary);
 periodBuild.hidden=!(preparing || (clock.stage===2 && !summary));
 periodBuild.disabled=!!s.paused || !!window.cafeHostError;
 periodContinue.disabled=!!s.paused || !!window.cafeHostError;
 if(preparing){text('period-continue','Open day');periodContinue.disabled||=!c.canOpen;periodAction=()=>Module._cafe_campaign?.(1);}
 else if(summary){text('period-continue',clock.day>=365?'Campaign complete':`Prepare day ${clock.day+1}`);periodContinue.disabled||=!c.canNext;periodAction=()=>Module._cafe_campaign?.(3);}
 else{periodContinue.disabled||=!clock.canContinue;text('period-continue',clock.period===2?`Start day ${clock.day+1}`:`Start ${['Morning','Lunch','Afternoon'][clock.period+1]}`);periodAction=()=>Module._cafe_clock?.(0);}
 periodContinue.title=preparing?'Open the cafe at 08:00 when preparation is complete.':summary?'Review results, then prepare tomorrow. Outstanding wages and day costs must be settled.':`Business time is held at ${timeOfDay(clock.minutes)}. Buy and arrange furniture, hire staff or restock. Deliveries and preparation can finish without advancing the cafe clock or wages. Select to begin the next period.`;
}
let journalSummaryDay;
let mobileCameraSize='';
function renderPresentation(){
 if(!preferencesReady && Module._cafe_motion){preferencesReady=true;applyPreferences();}
 const c=window.cafeCampaignState,s=window.cafeState,m=window.cafeMenuState;if(!s || !m)return;
 if(window.cafeDevice?.mobile && Module._cafe_camera){
  const width=canvas.clientWidth,height=canvas.clientHeight,action=getComputedStyle(query('.play-heading')).position==='absolute'?4:5,key=`${width}:${height}:${action}`;
  if(width>0 && height>0 && key!==mobileCameraSize){cameraMove(action,width,height);mobileCameraSize=key;}
 }
 const summaryKey=c?.enabled && c.phase===3?`${c.day}:${c.journal?.totalRewards}`:undefined;
 if(summaryKey && summaryKey!==journalSummaryDay){showMode('menu');$('campaign-details').open=true;}
 journalSummaryDay=summaryKey;
 const a=window.cafeInspectorState?.report;
 if(a && Number.isFinite(a.attractiveness)){
  appealFx.update(a.attractiveness);
  appeal.querySelector('summary').setAttribute('aria-label',`Cafe attractiveness: ${a.attractiveness} out of 100. Show breakdown`);
  text('attractiveness-menu',`Menu variety: ${a.attractivenessMenu}/25`);
  text('attractiveness-experience',`Customer experience: ${a.attractivenessExperience}/50`);
  text('attractiveness-furnishings',`Furnishings: ${a.attractivenessFurnishings}/25`);
  text('attractiveness-capacity',`Visitor capacity: ${a.visitorLimit} guests (${a.visitingGuests} visiting)`);
 }
 const pause=query('[data-command="2"]');pause.dataset.paused=String(s.paused);pause.setAttribute('aria-label',s.paused?'Resume shift':'Pause shift');pause.title=s.paused?'Resume shift':'Pause shift';
 if(!window.cafeClockState){text('shift-title',c?.enabled?`Day ${String(c.day).padStart(2,'0')}`:'A good morning.');
 text('day-label',s.paused?'Shift paused':c?.enabled?`${['Preparation','Morning service','Closing','Day complete'][c.phase]}${c.phase===1?' Â· '+$('campaign-clock').textContent:''}`:'Practice cafe');}
 renderClock(s,c);
 const minutes=window.cafeClockState?.minutes ?? 480;
 const [rhythm,greeting]=c?.enabled && c.phase===3 || minutes>=1080
  ?['A day well served','See you for coffee tomorrow.']
  :minutes>=840?['Afternoon comforts','A warm cup, a slower afternoon.']
  :minutes>=720?['Lunchtime bustle','Good food, a midday pause.']
  :['Morning rhythm','A little coffee, a good morning.'];
 text('morning-title',rhythm);text('morning-copy',greeting);
 $('shift-goal-copy').hidden=!(c?.enabled && c.journal);
 if(c?.enabled && c.journal)text('shift-goal-copy',`${c.journal.daily.filter(g=>g.complete || (c.phase!==3 && c.journal.eligible && g.progress>=g.target)).length}/3 daily goals ${c.phase===3?'completed':'ready'} · ${c.journal.earned} achievements`);
 journalButton.hidden=!c?.enabled;
 const queued=m.tickets.filter(t=>t.phase<=1),ticket=queued.find(t=>t.phase===1)||queued[0];text('ticket-count',String(queued.length));
 if(!window.cafeRenderTickets)[...$('order-tickets').children].forEach((li,index)=>{const t=m.tickets[index],g=window.cafeDemandState?.guests.find(g=>g.id===t?.guest);if(!g || t.phase>1)return;let note=li.querySelector('.patience');if(!note){note=document.createElement('p');note.className='patience';li.append(note);}const seconds=Math.max(0,Math.ceil(g.remaining/1000)),label=`${seconds<20?'Time is short Â· ':''}${seconds}s patience remaining`;if(note.textContent!==label)note.textContent=label;});
 nextCommand=s.ready?1:ticket?(ticket.items[0].product===0?0:20+ticket.items[0].product):undefined;
 const source=nextCommand===undefined?null:query(`[data-command="${nextCommand}"]`),next=$('next-action');next.disabled=!source || source.disabled;text('next-action',source?source.textContent:'Waiting for a guest');
 const reason=s.paused?'Shift paused. Resume at the top.':s.ready?'Whole ticket ready. Staff and guest must reach the handover.':ticket?.phase===1?'Staff are preparing this ticket. Keep an eye on freshness.':source?.disabled?(source.title || 'Check supplies and machine care.'):'Choose Prepare to start the whole ticket.';text('next-reason',reason);
 const job=window.cafeInspectorState?.jobs.find(j=>j.state===2),remaining=job?.remainingMs ?? 0;maxWork=Math.max(maxWork,remaining);$('brew-progress').value=remaining && maxWork?1-remaining/maxWork:s.ready?1:0;if(!remaining)maxWork=0;$('brew-progress').hidden=!remaining && !s.ready;
 let copy,label;guideAction=undefined;
 if(!c?.enabled){copy='Start a guided campaign with 100.00, supplies and Alex. This replaces practice; save from Menu first to keep it.';label='Begin guided shift';guideAction=()=>query('[data-campaign="0"]').click();}
 else if(c.phase===0){copy=c.day===1?'1 Â· Open your first day. Read the ticket, then choose Prepare. Staff handle its equipment steps; you hand over the finished order.':'A fresh start. Restock in Serve; hire help in Menu; spend ticket earnings in Build. Finish deliveries and preparation before opening.';label=c.canOpen?'Open day':'Check supplies';guideAction=()=>c.canOpen?query('[data-campaign="1"]').click():reveal('supplies-drawer');}
 else if(c.phase===3){copy='Day complete. Menu shows profit, wages, rent and goals. Prepare tomorrow to carry your cafe forward, or restart the day if costs block you.';label='View day results';guideAction=()=>{showMode('menu');$('campaign-details').open=true;};}
 else if(c.phase===2){copy='Closing Â· finish the remaining tickets. Guests leave and staff clean the machine before results. Keep staff roles enabled and resume anyone on break.';label='View staff';guideAction=()=>reveal('staff-panel','menu');}
 else if(window.cafeQualityState && !window.cafeQualityState.usable){copy='Machine care Â· brewing needs a clean, working machine. Clean for free; repair if its condition is too low. Staff need to finish the care task before the next ticket can start.';label='Care for the machine';guideAction=()=>reveal('supplies-drawer');}
 else if(m.ingredients.some(i=>i.stock===0)){const ingredient=m.ingredients.find(i=>i.stock===0);copy=`Shortage Â· ${ingredient.name} is empty at the counter. Restock from storage. If storage is empty, order 12, wait for delivery, then restock. Costs and ready/stored counts are shown below.`;label='Resolve shortage';guideAction=()=>{reveal('supplies-drawer');$('supply-ingredient').value=String(m.ingredients.indexOf(ingredient));$('supply-ingredient').dispatchEvent(new Event('change'));};}
 else if(s.served===0){copy='2 Â· Prepare the first queued ticket. The barista walks to the equipment. When the whole ticket is ready and your guest arrives, choose Serve ticket to receive payment.';label='Show supplies';guideAction=()=>reveal('supplies-drawer');}
 else if((window.cafeStaffState?.staff.length??1)<2){copy='3 Â· First sale! Americano is now unlocked. Hire help for 15.00 in Menu; every on-shift worker earns 1.00 per minute. Breaks stop wages. Finish or close the shift when ready.';label='Hire & manage staff';guideAction=()=>reveal('staff-panel','menu');}
 else {copy='4 Â· Keep serving and watch costs. Close the day in Menu, review results, then prepare day two. In preparation, Build shows upgrade costs, earnings gates, resale and safe placement.';label='Day & upgrades';guideAction=()=>showMode('menu');}
 text('guide-copy',copy);text('guide-action',label);$('guide-action').disabled=!!window.cafeHostError || s.paused;
 if(lastReady!==s.ready || lastServed!==s.served){if(s.ready)text('next-reason','Ticket ready Â· serve when guest and staff reach the counter.');if(lastServed!==undefined && s.served>lastServed){$('coins').classList.remove('reward');void $('coins').offsetWidth;$('coins').classList.add('reward');}lastReady=s.ready;lastServed=s.served;}
 soundButton.hidden=!!window.cafeAudioState?.active && !prefs.muted && prefs.effects>0;
 soundButton.disabled=!!window.cafeState?.paused;
 testSound.disabled=!!window.cafeState?.paused;
 text('audio-status',window.cafeState?.paused?'Sound paused with the shift.':prefs.muted?'Sound muted.':prefs.effects===0?'Effects volume is zero.':window.cafeAudioState?.active?'Cafe sound active. Use Test sound to check your output; if silent, check the browser tab and system volume.':'Sound is blocked or suspended. Select Enable sound to retry.');
}
const oldInspector=window.cafeInspector;window.cafeInspector=json=>{oldInspector(json);renderPresentation();};
applyPreferences();showMode('serve');
})();

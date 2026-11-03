// Presentation only: the journal's completed flags and rewards are banked by C++.
(() => {
if(!document.body.classList.contains('playable'))return;
const $=id=>document.getElementById(id),make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const money=n=>(n/100).toFixed(2),storageKey='cafegame.achievement-notices.v1';
let seen=new Set();try{seen=new Set(JSON.parse(localStorage.getItem(storageKey)||'[]').filter(v=>typeof v==='string').slice(-128));}catch{}
const remember=token=>{if(!token)return;seen.add(token);try{localStorage.setItem(storageKey,JSON.stringify([...seen].slice(-128)));}catch{}};
function badge(goal){const img=make('img','achievement-badge');img.src=`assets/ui/achievements/badge-${goal.id}.webp`;img.alt='';img.setAttribute('aria-hidden','true');img.width=192;img.height=192;img.draggable=false;return img;}
const shelf=make('section','achievement-shelf');shelf.id='achievement-shelf';shelf.hidden=true;shelf.setAttribute('aria-label','Earned achievement badges');
const shelfButton=make('button','achievement-shelf-heading'),shelfCount=make('span'),shelfPreview=make('span','achievement-shelf-preview');shelfButton.type='button';shelfButton.append(shelfCount,shelfPreview);
const shelfGrid=make('div','achievement-shelf-grid');shelf.append(shelfButton,shelfGrid);document.querySelector('.game').append(shelf);
for(const event of ['pointerdown','click','wheel'])shelf.addEventListener(event,e=>e.stopPropagation());
const dialog=make('dialog','achievement-dialog');dialog.id='achievement-dialog';dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','achievement-title');dialog.setAttribute('aria-describedby','achievement-description');
const top=make('div','achievement-dialog-top'),eyebrow=make('p','achievement-eyebrow'),close=make('button','achievement-close','Close');close.type='button';close.setAttribute('aria-label','Close achievement pop-up');top.append(eyebrow,close);
const title=make('h2','','Your badges');title.id='achievement-title';
const description=make('p','achievement-description');description.id='achievement-description';
const body=make('div','achievement-body'),footer=make('div','achievement-footer'),collection=make('button','','All badges'),next=make('button','achievement-primary','Continue');collection.type=next.type='button';footer.append(collection,next);dialog.append(top,title,description,body,footer);document.body.append(dialog);
const announce=make('span','service-sr-only');announce.setAttribute('role','status');dialog.append(announce);
let campaign=null,goals=[],queue=[],active=null,mode='collection',lastShelf='',lastSummary='',fresh=false,ownedPause=false,pauseObserved=false,returnFocus=null;
function snapshotKey(c){return JSON.stringify([c.day,c.journal.totalRewards,c.journal.earned,c.totals,c.journal.achievements.filter(g=>g.new).map(g=>g.id)]);}
function open(){
 if(dialog.open)return;
 returnFocus=document.activeElement;
 ownedPause=!window.cafeState?.paused && campaign?.phase!==3 && !window.cafeHostError;pauseObserved=false;
 if(ownedPause)Module._cafe_command(2);
 dialog.showModal();
}
function releasePause(){if(ownedPause && (window.cafeState?.paused || !pauseObserved))Module._cafe_command(2);ownedPause=false;pauseObserved=false;}
function acknowledgeAll(){if(active?.token)remember(active.token);for(const item of queue)remember(item.token);active=null;queue=[];}
function dismiss(){acknowledgeAll();if(dialog.open)dialog.close();}
dialog.addEventListener('close',()=>{releasePause();const usable=returnFocus?.isConnected && !returnFocus.disabled && returnFocus.getClientRects().length;const focus=usable?returnFocus:$('journal-button');if(focus && !focus.hidden)focus.focus({preventScroll:true});returnFocus=null;});
dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss();});
dialog.addEventListener('keydown',e=>{
 e.stopPropagation();if(e.key!=='Tab')return;
 const controls=[...dialog.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')].filter(n=>!n.disabled && n.tabIndex>=0 && n.getClientRects().length);
 const first=controls[0],last=controls.at(-1);if(!first){e.preventDefault();dialog.focus();return;}
 if(e.shiftKey && (document.activeElement===first || !dialog.contains(document.activeElement))){e.preventDefault();last.focus();}
 else if(!e.shiftKey && (document.activeElement===last || !dialog.contains(document.activeElement))){e.preventDefault();first.focus();}
});
dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom)dismiss();});
close.onclick=dismiss;
function reward(goal){const block=make('div','achievement-reward'),art=window.cafeArtIcon('coin');if(art)block.append(art);const copy=make('div');copy.append(make('strong','',`+${money(goal.reward)}`),make('span','',goal.complete?'Already added to your café funds':'Awarded once at closing'));block.append(copy);return block;}
function detail(goal,celebration=false){
 mode=celebration?'celebration':'detail';dialog.dataset.view=mode;
 eyebrow.textContent=celebration?'Achievement unlocked':goal.complete?'Earned badge':'A goal to work toward';
 title.textContent=goal.name;description.textContent=goal.description;
 const art=make('div','achievement-hero');art.append(badge(goal));
 const progress=make('p','achievement-progress',goal.complete?'Goal completed':`${goal.progress} of ${goal.target} · In progress`);
 body.replaceChildren(art,progress,reward(goal));dialog.scrollTop=0;
 collection.hidden=false;next.textContent=celebration && queue.length?`Next badge · ${queue.length} more`:'Continue';
 next.onclick=()=>{
  if(active?.token)remember(active.token);active=null;
  if(mode==='celebration' && queue.length)showNext();else dialog.close();
 };
 open();dialog.scrollTop=0;(dialog.scrollHeight>dialog.clientHeight+2?close:next).focus({preventScroll:true});
}
function showCollection(){
 acknowledgeAll();mode='collection';dialog.dataset.view=mode;eyebrow.textContent='Your café story';title.textContent='Badge collection';
 const earned=goals.filter(g=>g.complete).length;description.textContent=`${earned} of ${goals.length} earned. Select a badge to see its goal and reward.`;
 const grid=make('div','achievement-collection');
 for(const goal of goals){const b=make('button','achievement-collection-card');b.type='button';b.dataset.earned=String(!!goal.complete);b.dataset.achievement=String(goal.id);b.setAttribute('aria-label',`${goal.name} · ${goal.complete?'Earned':`${goal.progress} of ${goal.target}`} · ${money(goal.reward)} reward`);b.append(badge(goal),make('strong','',goal.name),make('small','',goal.complete?`Earned · ${money(goal.reward)} banked`:`${goal.progress}/${goal.target} · +${money(goal.reward)}`));b.onclick=()=>detail(goal);grid.append(b);}
 body.replaceChildren(grid);collection.hidden=true;next.textContent='Back to the café';next.onclick=()=>dialog.close();open();dialog.scrollTop=0;close.focus({preventScroll:true});
}
collection.onclick=showCollection;shelfButton.onclick=showCollection;
function showNext(){active=queue.shift();if(!active)return;announce.textContent=`Achievement unlocked: ${active.goal.name}. ${money(active.goal.reward)} added to your café funds.`;detail(active.goal,true);}
function update(c){
 campaign=c;goals=c.journal?.achievements||[];if(ownedPause && window.cafeState?.paused)pauseObserved=true;
 if(!c.enabled){shelf.hidden=true;if(dialog.open)dismiss();lastShelf='';lastSummary='';return;}
 const isFresh=c.day===1 && c.phase===0 && c.journal.earned===0;
 if(isFresh && !fresh){acknowledgeAll();seen.clear();try{localStorage.removeItem(storageKey);}catch{}if(dialog.open)dialog.close();lastSummary='';}fresh=isFresh;
 if(active && !goals.some(g=>g.id===active.goal.id && g.complete)){active=null;queue=[];if(dialog.open)dialog.close();}
 const earned=goals.filter(g=>g.complete);shelf.hidden=!earned.length;
 const key=JSON.stringify(earned.map(g=>[g.id,g.name,g.reward]));
 if(key!==lastShelf){
  lastShelf=key;shelfCount.textContent=`Badges · ${earned.length}`;shelfButton.setAttribute('aria-label',`Open badge collection · ${earned.length} earned`);
  shelfPreview.replaceChildren(...earned.slice(-1).map(badge));
  shelfGrid.replaceChildren(...earned.map(goal=>{const b=make('button','achievement-shelf-badge');b.type='button';b.dataset.achievement=String(goal.id);b.setAttribute('aria-label',`${goal.name} · ${goal.description} · ${money(goal.reward)} reward banked. View badge.`);b.title=b.getAttribute('aria-label');b.append(badge(goal));b.onclick=()=>detail(goal);return b;}));
 }
 if(c.phase!==3){lastSummary='';return;}
 const summary=snapshotKey(c);if(summary===lastSummary)return;lastSummary=summary;
 for(const goal of goals.filter(g=>g.complete && g.new)){
  const token=`${summary}:${goal.id}`;if(!seen.has(token) && active?.token!==token && !queue.some(item=>item.token===token))queue.push({goal,token});
 }
 if(queue.length && !dialog.open)showNext();
}
const render=window.cafeRenderJournal;window.cafeRenderJournal=c=>{render?.(c);update(c);};
if(window.cafeCampaignState)update(window.cafeCampaignState);
})();

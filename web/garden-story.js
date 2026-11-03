// Saved restoration progress projects from C++; controls use normal game commands.
(() => {
 const parent=document.getElementById('menu-garden');if(!parent)return;
 const panel=document.createElement('section');panel.id='garden-restoration';panel.setAttribute('aria-label','Garden restoration');parent.append(panel);
 const title=document.createElement('h3');title.textContent='Garden restoration';panel.append(title);
 const status=document.createElement('p');status.id='garden-story-status';status.setAttribute('role','status');panel.append(status);
 const start=document.createElement('button');start.id='garden-story-start';start.textContent='Start Garden restoration';start.onclick=()=>Module._cafe_garden_story(0,0);panel.append(start);
 const chapters=document.createElement('ol');chapters.id='garden-chapters';panel.append(chapters);
 const reward=document.createElement('p');reward.id='garden-rewards';panel.append(reward);
 const regulars=document.createElement('div');regulars.id='garden-regulars';panel.append(regulars);
 const party=document.createElement('section');party.id='garden-party';panel.append(party);
 party.innerHTML='<h3>Neighborhood garden party</h3><p>Preparation: one outdoor table (6.00), cold station (40.00), two available staff (hire 15.00), all roles enabled, machine condition and cleanliness at least 60%. Working stock: 6 beans, 6 water, 6 ice, 3 lemon base, 3 cake stock.</p><p>Finish the full day, serve at least 6 paid tickets and average 65% satisfaction on delivered visits. A flawless shift is optional. If you miss the target, prepare another party tomorrow.</p>';
 const outcome=document.createElement('p');outcome.id='garden-party-status';outcome.setAttribute('role','status');party.append(outcome);
 const prepare=document.createElement('button');prepare.id='garden-party-prepare';prepare.textContent='Prepare garden party';prepare.onclick=()=>Module._cafe_garden_story(1,0);party.append(prepare);
 const cancel=document.createElement('button');cancel.id='garden-party-cancel';cancel.textContent='Cancel party preparation';cancel.onclick=()=>Module._cafe_garden_story(2,0);party.append(cancel);
 const names=['Open the courtyard','A table in the sunshine','Summer on the menu','Meet the neighbors','The neighborhood garden party'];
 let signature;
 window.cafeRenderGardenStory=s=>{
  if(!s)return;const paused=!!window.cafeState?.paused,failed=!!window.cafeHostError;
  const next=JSON.stringify([s,paused,failed]);if(next===signature)return;signature=next;
  start.hidden=!!s.started;start.disabled=failed||paused||!!s.startReason;start.title=s.startReason||'Keep your campaign, cash and base regular history; start restoring the courtyard.';
  status.textContent=!s.started?s.startReason:s.chapters===31?'Garden restoration complete. Your courtyard, summer menu, regulars and earned finish remain available for ongoing play.':'Restore the courtyard one chapter at a time. Each completed chapter pays 10.00 once.';
  chapters.hidden=reward.hidden=regulars.hidden=party.hidden=!s.started;
  const detail=[`Open the courtyard in preparation. Outdoor tables cost 6.00 each.`,`${s.outdoorServed}/1 outdoor tickets delivered.`,`${[0,1,2].filter(n=>s.summerMask&(1<<n)).length}/3 summer recipes served. Cold station 40.00; base mixed-order and sales requirements still apply. Garden sage finish unlocks here.`,`${[0,1,2].filter(n=>s.metMask&(1<<n)).length}/3 neighbors served. Invite each regular during open service.`,`Full party day, 6 paid tickets and 65% average satisfaction.`];
  chapters.replaceChildren(...names.map((name,n)=>{const li=document.createElement('li');li.dataset.chapter=String(n);li.textContent=`${s.chapters&(1<<n)?'Complete':'Pending'} · ${name} · +10.00 · ${detail[n]}`;return li;}));
  reward.textContent=`Garden chapter rewards: ${(s.rewards/100).toFixed(2)}. ${s.chapters&4?'Earned: Garden sage finish. Apply it free in Build → Equipment details & finishes.':'Serve all three summer recipes to earn the Garden sage finish.'}`;
  regulars.replaceChildren(...s.regulars.map((r,n)=>{const card=document.createElement('article');card.className='staff-card';const heading=document.createElement('h4');heading.textContent=`${r.name} · ${r.role}`;const story=document.createElement('p');story.textContent=r.story;const history=document.createElement('p');history.textContent=`Prefers ${r.preference} · ${r.visits} visits · ${r.reviews} reviews · ${Math.floor(r.average/10)}% average satisfaction.`;const button=document.createElement('button');button.dataset.gardenRegular=String(n);button.textContent=`Invite ${r.name}`;button.disabled=failed||paused||!!r.reason;button.title=r.reason||`Invite ${r.name} to an outdoor table, with indoor fallback.`;button.onclick=()=>Module._cafe_garden_story(3,n);card.append(heading,story,history,button);return card;}));
  const phase=['No party prepared','Party prepared: open the day when ready','Party in progress','Party target missed: try again in a later preparation day','Party complete: the neighborhood is celebrating'][s.party];
  outcome.textContent=`${phase}. Attempt ${s.attempts} · ${s.served}/6 paid tickets · ${Math.floor(s.average/10)}% / 65% satisfaction. ${s.party===3&&!s.full?'The full service day must be completed. ':''}${s.partyReason}`;
  prepare.disabled=failed||paused||!!s.partyReason;prepare.title=s.partyReason||'Mark the next ordinary service day as the garden party. No entry fee.';
  cancel.hidden=s.party!==1;cancel.disabled=failed||paused;
  const finish=document.getElementById('finish-select');let option=finish.querySelector('option[value="3"]');
  if((s.chapters&4)&&!option){option=document.createElement('option');option.value='3';option.textContent='Garden sage · earned';finish.append(option);}
  if(!(s.chapters&4)&&option)option.remove();
  if(window.cafeEquipmentState)finish.value=String(cafeEquipmentState.finish);
 };
})();

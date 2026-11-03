// Read-only projection: C++ owns all progress, closing checks and payments.
(() => {
  const $=id=>document.getElementById(id);
  let signature;
  const text=(id,value)=>{if($(id).textContent!==value)$(id).textContent=value;};
  function card(goal,results,eligible=true) {
    const li=document.createElement('li');
    li.dataset.complete=String(!!goal.complete);
    const heading=document.createElement('strong');heading.textContent=goal.name;
    const description=document.createElement('p');description.textContent=goal.description;
    const state=document.createElement('p');
    state.textContent=goal.complete?`${goal.new?'New achievement! · ':''}Complete · +${money(goal.reward)} banked`:
      !eligible?'Available from the next day':results?`${goal.progress}/${goal.target} · Try another day`:
      `${goal.progress}/${goal.target} · ${goal.progress>=goal.target?'Ready for closing':'In progress'} · +${money(goal.reward)} at closing`;
    const progress=document.createElement('progress');progress.max=goal.target;progress.value=goal.progress;
    progress.setAttribute('aria-label',`${goal.name}: ${goal.progress} of ${goal.target}`);
    li.append(heading,description,progress,state);return li;
  }
  window.cafeRenderJournal=c=>{
    const j=c.journal;if(!j)return;
    $('cafe-journal').hidden=!c.enabled;
    const results=c.enabled && c.phase===3;
    text('journal-count',`· ${j.earned}/${j.achievements.length} achievements`);
    text('journal-note',j.eligible?'Goals rotate each day. Each pays 2.00 at closing. Achievements pay 5.00 once. Full-shift care goals are checked after cleanup.':
      'This save predates the journal. Daily goals and full-shift milestones begin next day; new service counts toward lifetime achievements now.');
    const key=JSON.stringify([c.enabled,c.phase,j]);if(key===signature)return;signature=key;
    $('journal-daily').replaceChildren(...j.daily.map(goal=>card(goal,results,!!j.eligible)));
    $('journal-achievements').replaceChildren(...j.achievements.map(goal=>card(goal,false)));
    if(results) {
      const rewards=j.dailyRewards+j.achievementRewards;
      text('journal-rewards',rewards?`Well done today. +${money(rewards)} banked: daily goals ${money(j.dailyRewards)} · achievements ${money(j.achievementRewards)}. Rewards are separate from operating profit.`:
        'Another day in your café journal. No journal rewards today; your lifetime progress carries forward.');
      const completed=[...j.daily.filter(goal=>goal.complete),...j.achievements.filter(goal=>goal.new)];
      $('journal-new').replaceChildren(...completed.map(goal=>{const li=document.createElement('li');li.textContent=`${goal.name} · +${money(goal.reward)}`;return li;}));
    }
  };
})();

const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {readFile,mkdir}=require('node:fs/promises');
(async()=>{
  await mkdir('build/evidence/journal',{recursive:true});
  const summary=(await readFile('build/evidence/campaign-summary.save')).toString('base64');
  const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,args:['--no-proxy-server',...(process.env.CAFE_SOFTWARE_RENDERING==='1'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[])]});
  try {
    for(const backend of ['webgl2','automatic'])for(const mobile of [false,true]) {
      const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:1000}}),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      const wait=fn=>page.waitForFunction(fn,null,{timeout:90000});
      const saveAndRestore=async()=>{
        await page.evaluate(()=>{document.getElementById('save-status').textContent='Saving journal test';Module._cafe_command(3);});
        await wait(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
        await page.evaluate(()=>{document.getElementById('save-status').textContent='Restoring journal test';Module._cafe_command(4);});
        await wait(()=>document.getElementById('save-status').textContent==='Saved shift restored.');
      };
      try {
        console.log(`${backend} ${mobile?'mobile viewport':'desktop'}: opening journal GUI`);
        await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4178'}/?backend=${backend}`);
        await page.waitForFunction(()=>window.cafeCampaignState?.journal && !window.cafeHostError,null,{timeout:90000});
        await page.evaluate(()=>Module._cafe_campaign(0));
        await page.waitForFunction(()=>window.cafeCampaignState.enabled && !document.getElementById('journal-button').hidden);
        await page.getByRole('button',{name:'Café journal',exact:true}).click();
        assert.equal(await page.locator('#cafe-journal').getAttribute('open'),'');
        assert.equal(await page.locator('#journal-daily li').count(),3);
        assert.equal(await page.locator('#journal-achievements li').count(),18);
        await page.locator('#journal-lifetime > summary').click();
        await page.screenshot({path:`build/evidence/journal/preparation-${backend}-${mobile?'mobile':'desktop'}.png`,fullPage:true});
        if(!mobile) {
          // Exercise the actual seated workflow through public player actions,
          // then check that the visible journal changes only after delivery.
          await page.evaluate(()=>Module._cafe_staff(0,0,0,0));
          await wait(()=>window.cafeStaffState.staff.length===2);
          await page.evaluate(()=>Module._cafe_campaign(1));await wait(()=>window.cafeCampaignState.phase===1);
          await page.evaluate(()=>Module._cafe_command(17));await wait(()=>!window.cafeDemandState.automatic);
          assert.equal(await page.evaluate(()=>window.cafeMenuState.tickets.length),0);
          await page.evaluate(()=>Module._cafe_guest(0,0,-1));
          await wait(()=>window.cafeMenuState.tickets.length===1 && window.cafeMenuState.tickets[0].service==='Waiting to order');
          const id=await page.evaluate(()=>window.cafeMenuState.tickets[0].guest);
          await page.getByRole('tab',{name:/^Serve/}).click();
          await page.locator(`.customer-badge[data-guest="${id}"]`).click();
          await wait(()=>window.cafeMenuState.tickets[0].taken);
          await page.evaluate(id=>Module._cafe_service(1,id),id);
          await wait(()=>window.cafeMenuState.tickets[0].service==='Ready to serve');
          assert.equal(await page.evaluate(()=>window.cafeCampaignState.journal.daily[0].progress),0);
          await page.locator(`.customer-badge[data-guest="${id}"]`).click();
          await wait(()=>window.cafeState.served===1 && window.cafeCampaignState.journal.daily[0].progress===1);
          await page.getByRole('button',{name:'Café journal',exact:true}).click();
          assert.match(await page.locator('#journal-daily li').first().textContent(),/1\/3/);
          assert.equal(await page.evaluate(()=>window.cafeCampaignState.journal.achievements[3].progress),1);
          assert.equal(await page.evaluate(()=>window.cafeCampaignState.journal.totalRewards),0);
          await saveAndRestore();
          assert.equal(await page.evaluate(()=>window.cafeCampaignState.journal.daily[0].progress),1);
          await page.evaluate(()=>Module._cafe_campaign(2));await wait(()=>window.cafeCampaignState.phase===3);
          const earned=await page.evaluate(()=>window.cafeCampaignState.journal);
          assert.equal(earned.achievementRewards,500);assert.equal(earned.dailyRewards,0);
          assert.equal(earned.achievements[14].complete,1);assert.equal(earned.achievements[14].new,1);
          assert.match(await page.locator('#journal-new').textContent(),/A helping hand/);
          await page.locator('#journal-celebration').scrollIntoViewIfNeeded();
          await page.screenshot({path:`build/evidence/journal/table-rewards-${backend}.png`,fullPage:true});
          await saveAndRestore();assert.deepEqual(await page.evaluate(()=>window.cafeCampaignState.journal),earned);
          console.log(`${backend}: actual table delivery updates GUI progress and banks one achievement at closing`);
        }
        await page.evaluate(data=>{localStorage.setItem('cafegame.shift.v1',data);Module._cafe_command(4);},summary);
        await page.waitForFunction(()=>window.cafeCampaignState.phase===3 && document.getElementById('play-shell').dataset.mode==='menu');
        const state=await page.evaluate(()=>window.cafeCampaignState);
        assert.ok(state.journal.dailyRewards>0 && state.journal.achievementRewards>0);
        assert.equal(await page.locator('#campaign-summary').isVisible(),true);
        assert.match(await page.locator('#journal-rewards').textContent(),/banked/);
        assert.equal(await page.locator('#journal-new li').count(),state.journal.daily.filter(g=>g.complete).length+state.journal.achievements.filter(g=>g.new).length);
        await page.locator('#journal-celebration').scrollIntoViewIfNeeded();
        await page.screenshot({path:`build/evidence/journal/summary-${backend}-${mobile?'mobile':'desktop'}.png`,fullPage:true});
        const cash=await page.evaluate(()=>window.cafeEconomyState.cash);
        await saveAndRestore();
        assert.equal(await page.evaluate(()=>window.cafeEconomyState.cash),cash);
        assert.deepEqual(await page.evaluate(()=>window.cafeCampaignState.journal),state.journal);
        await page.evaluate(()=>Module._cafe_campaign(3));
        await page.waitForFunction(()=>window.cafeCampaignState.phase===0 && window.cafeCampaignState.day===2);
        const tomorrow=await page.evaluate(()=>window.cafeCampaignState.journal);
        assert.equal(tomorrow.earned,state.journal.earned);assert.equal(tomorrow.dailyRewards,0);assert.equal(tomorrow.achievementRewards,0);
        assert.ok(tomorrow.daily.every(g=>g.progress===0));assert.notDeepEqual(tomorrow.daily.map(g=>g.id),state.journal.daily.map(g=>g.id));
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
        assert.equal(overflow,false);assert.deepEqual(errors,[]);
        console.log(`${backend} ${mobile?'mobile viewport':'desktop'}: journal access, daily/lifetime progress, closing rewards, save/load and next day passed`);
      } catch(error) {
        console.error(error);
        console.error(await page.evaluate(()=>({status:document.getElementById('status')?.textContent,hostError:window.cafeHostError,hasCampaign:!!window.cafeCampaignState,hasJournal:!!window.cafeCampaignState?.journal,phase:window.cafeCampaignState?.phase,day:window.cafeCampaignState?.day,paused:window.cafeState?.paused,tickets:window.cafeMenuState?.tickets,save:document.getElementById('save-status')?.textContent})).catch(()=>({page:'unavailable'})),errors);
        await page.screenshot({path:`build/evidence/journal/failure-${backend}-${mobile?'mobile':'desktop'}.png`,fullPage:true}).catch(()=>{});
        throw error;
      } finally {await page.close();}
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

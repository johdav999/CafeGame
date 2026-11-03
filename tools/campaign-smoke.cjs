const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {readFile,mkdir}=require('node:fs/promises');
(async()=>{
  await mkdir('build/evidence',{recursive:true});
  const fixtures={};for(const phase of ['service','closing','summary'])fixtures[phase]=(await readFile(`build/evidence/campaign-${phase}.save`)).toString('base64');
  const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,args:['--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader',...(process.env.CAFE_DISABLE_WEBGPU==='1'?['--disable-blink-features=WebGPU']:[])]});
  try {
    for(const backend of ['webgl2','automatic']) {
      const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
      if(process.env.CAFE_DISABLE_WEBGPU==='1')await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
      try {
        const button=name=>page.getByRole('button',{name,exact:true});
        await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}&tools=1`);
        await page.waitForFunction(()=>window.cafeCampaignState && !document.querySelector('[data-campaign="0"]').disabled,null,{timeout:60000});
        await button('New campaign').click();await page.waitForFunction(()=>window.cafeCampaignState.enabled && window.cafeCampaignState.phase===0);
        const initial=await page.evaluate(()=>({cash:window.cafeEconomyState.cash,worked:window.cafeStaffState.staff[0].workedMs}));
        await page.waitForTimeout(1200);assert.deepEqual(await page.evaluate(()=>({cash:window.cafeEconomyState.cash,worked:window.cafeStaffState.staff[0].workedMs})),initial);
        assert.equal(initial.cash,10000);assert.equal(await button('Prepare latte').isDisabled(),true);
        await button('Open day').click();await page.waitForFunction(()=>window.cafeCampaignState.phase===1);
        await button('Pause foot traffic').click();await page.waitForFunction(()=>!window.cafeDemandState.automatic);
        await page.locator('#guest-first').selectOption('0');await button('Welcome guest').click();await page.waitForFunction(()=>window.cafeOccupancyState.waiting===1);
        await button('Brew espresso').click();await page.waitForFunction(()=>window.cafeState.brewing>0,null,{timeout:60000});
        await button('Pause').click();await page.waitForFunction(()=>window.cafeState.paused);
        await button('Save shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
        const saved=await page.evaluate(()=>({campaign:window.cafeCampaignState,crew:window.cafeStaffState.staff}));
        await button('Load shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent==='Saved shift restored.');
        assert.equal(await page.evaluate(()=>window.cafeCampaignState.remainingMs),saved.campaign.remainingMs);
        assert.deepEqual(await page.evaluate(()=>window.cafeStaffState.staff),saved.crew);
        await button('Resume').click();await page.waitForFunction(()=>!document.querySelector('[data-command="1"]').disabled,null,{timeout:60000});
        await button('Serve ticket').click();await page.waitForFunction(()=>window.cafeCampaignState.goals===1);
        assert.equal(await page.evaluate(()=>window.cafeCampaignState.unlocked),19);
        await button('Restart day').click();await page.waitForFunction(()=>window.cafeCampaignState.phase===0 && window.cafeState.served===0);
        assert.equal(await page.evaluate(()=>window.cafeCampaignState.goals),0);assert.equal(await page.evaluate(()=>window.cafeEconomyState.cash),10000);
        await button('Open day').click();await page.waitForFunction(()=>window.cafeCampaignState.phase===1);
        await button('Close day early').click();await page.waitForFunction(()=>window.cafeCampaignState.phase===3,null,{timeout:60000});
        assert.equal(await page.evaluate(()=>window.cafeInspectorState.report.overheadMinor),500);
        assert.equal(await button('Close campaign day early').isDisabled(),true);
        await button('Prepare next day').click();await page.waitForFunction(()=>window.cafeCampaignState.day===2 && window.cafeCampaignState.phase===0);
        // Native-authored campaign fixtures resume through the rendered host.
        await button('Pause').click();await page.waitForFunction(()=>window.cafeState.paused);
        const load=async data=>{await page.evaluate(data=>{localStorage.setItem('cafegame.shift.v1',data);document.getElementById('save-status').textContent='Loading test snapshot';},data);await button('Load shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent==='Saved shift restored.');};
        await load(fixtures.service);assert.equal(await page.evaluate(()=>window.cafeCampaignState.phase),1);
        assert.equal(await page.evaluate(()=>window.cafeCampaignState.goals),3);
        await load(fixtures.closing);assert.equal(await page.evaluate(()=>window.cafeCampaignState.phase),2);
        await button('Resume').click();await page.waitForFunction(()=>window.cafeCampaignState.phase===3,null,{timeout:60000});
        assert.equal(await page.evaluate(()=>window.cafeCampaignState.goals),15);
        await button('Pause').click();await load(fixtures.summary);
        const summary=await page.evaluate(()=>window.cafeInspectorState);
        await page.waitForTimeout(500);assert.deepEqual(await page.evaluate(()=>window.cafeInspectorState),summary);
        assert.equal(summary.report.overheadMinor,500);assert.equal(summary.report.goalRewardsMinor,2000);
        assert.ok(summary.campaign.regulars.some(r=>r.visits>0 && r.reviews>0));
        await button('Save shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
        await button('Load shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent==='Saved shift restored.');
        assert.deepEqual(await page.evaluate(()=>window.cafeInspectorState),summary);
        await button('Resume').click();await page.waitForTimeout(600);assert.deepEqual(await page.evaluate(()=>window.cafeInspectorState),summary);
        await page.screenshot({path:`build/evidence/campaign-${backend}.png`,fullPage:true});
        await button('Prepare next day').click();await page.waitForFunction(()=>window.cafeCampaignState.day===2);
        await page.evaluate(()=>Module._cafe_campaign(3));await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.cafeCampaignState.day),2);
        // Old staffed saves remain sandbox saves, and their device slot is untouched.
        await button('Pause').click();const hex=(await readFile('tests/fixtures/schema11.hpp','utf8')).match(/"([0-9a-f]+)"/g).map(s=>s.slice(1,-1)).join('');const old=Buffer.from(hex,'hex').toString('base64');
        await page.evaluate(data=>localStorage.setItem('cafegame.shift.v1',data),old);await button('Load shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent.includes('upgraded'));
        assert.equal(await page.evaluate(()=>window.cafeCampaignState.enabled),0);assert.equal(await page.evaluate(()=>window.cafeStaffState.staff.length),2);
        assert.equal(await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1')),old);assert.deepEqual(errors,[]);
        console.log(`${backend}: campaign preparation, physical service, partial save/load, reward/unlock, restart, closing, summary, once-only costs, next day and real schema-11 migration passed`);
      } finally {await page.close();}
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

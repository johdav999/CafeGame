// Optional rendered stage-14 acceptance; use the same Playwright/env setup as browser-smoke.cjs.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {mkdir}=require('node:fs/promises');
(async()=>{
  await mkdir('build/evidence',{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,
    args:['--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader',...(process.env.CAFE_DISABLE_WEBGPU==='1'?['--disable-blink-features=WebGPU']:[])]});
  try {
    for(const backend of ['webgl2','automatic']) {
      const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      if(process.env.CAFE_DISABLE_WEBGPU==='1')await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
      try {
      await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}&tools=1`);
      await page.waitForFunction(()=>window.cafeDemandState && !document.querySelector('[data-command="15"]').disabled,null,{timeout:60000});
      const button=name=>page.getByRole('button',{name,exact:true});
      const save=async()=>{await button('Save shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent.includes('saved'));};
      const load=async()=>{await button('Load shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent.includes('restored'));};
      await button('Close for layout').click();
      await page.waitForFunction(()=>window.cafeLayoutState.editable,null,{timeout:60000});
      assert.equal(await page.evaluate(()=>window.cafeDemandState.reviews),0);
      const held=await page.evaluate(()=>[window.cafeDemandState.remaining,window.cafeDemandState.random,window.cafeDemandState.draws]);
      await page.waitForTimeout(400);
      assert.deepEqual(await page.evaluate(()=>[window.cafeDemandState.remaining,window.cafeDemandState.random,window.cafeDemandState.draws]),held);
      await button('Reopen cafe').click();await button('Pause').click();
      await page.waitForFunction(()=>window.cafeState.paused);
      const paused=await page.evaluate(()=>window.cafeDemandState);
      await save();await page.waitForTimeout(350);await load();
      assert.deepEqual(await page.evaluate(()=>window.cafeDemandState),paused);
      await button('Resume').click();
      await page.waitForFunction(()=>window.cafeDemandState.admitted===4,null,{timeout:90000});
      let expectedRandom=held[1];expectedRandom^=expectedRandom<<13;expectedRandom^=expectedRandom>>>17;expectedRandom^=expectedRandom<<5;
      const expectedProfile=((expectedRandom>>>0)-1)%3;
      assert.equal(await page.evaluate(()=>window.cafeDemandState.guests[0].profile),expectedProfile);
      console.log(`${backend}: held clocks and first seeded arrival passed`);
      await button('Pause foot traffic').click();await page.waitForFunction(()=>!window.cafeDemandState.automatic);
      const requested=await page.evaluate(()=>window.cafeMenuState.next);
      const firstPrice=await page.evaluate(()=>window.cafeMenuState.tickets.find(t=>t.phase===0).price);
      await page.locator(`[data-command="${requested===0?0:20+requested}"]`).click();await page.waitForFunction(()=>window.cafeState.ready,null,{timeout:60000});
      await button('Serve ticket').click();await page.waitForFunction(()=>window.cafeDemandState.delivered===1);
      assert.ok(await page.evaluate(()=>window.cafeDemandState.lastScore>0 && window.cafeDemandState.inputs[1]>0));
      await page.waitForFunction(()=>window.cafeOccupancyState.guests===0 && window.cafeWorkflowState.dirty===0,null,{timeout:90000});
      await page.locator('#guest-first').selectOption('0');
      await page.locator('#guest-profile').selectOption('1');await button('Welcome guest').click();
      await page.waitForFunction(()=>window.cafeDemandState.guests.some(g=>g.profile===1));
      await button('Brew espresso').click();await page.waitForFunction(()=>window.cafeState.ready,null,{timeout:60000});
      await button('Serve ticket').click();await page.waitForFunction(()=>window.cafeDemandState.delivered===2);
      assert.equal(await page.evaluate(()=>window.cafeOccupancyState.seated),0);
      assert.equal(await page.evaluate(()=>window.cafeDemandState.lastProfile),1);
      await page.waitForFunction(()=>window.cafeOccupancyState.guests===0,null,{timeout:30000});
      await page.locator('#guest-profile').selectOption('0');await button('Welcome guest').click();
      await button('Brew espresso').click();await page.waitForFunction(()=>window.cafeDiagnosticState.order>=0 && window.cafeDiagnosticState.order<=2);
      await button('Cancel order').click();await page.waitForFunction(()=>window.cafeDemandState.failed===1);
      assert.equal(await page.evaluate(()=>window.cafeDemandState.lastScore),0);
      await page.waitForFunction(()=>window.cafeOccupancyState.guests===0,null,{timeout:30000});
      await button('Pause').click();await page.waitForFunction(()=>window.cafeState.paused);await save();
      console.log(`${backend}: delivered, takeaway and failure reviews passed`);
      const checkpoint=await page.evaluate(()=>window.cafeDemandState);
      const saved=await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1'));
      await load();assert.deepEqual(await page.evaluate(()=>window.cafeDemandState),checkpoint);
      await button('Resume').click();await button('Resume foot traffic').click();
      await page.waitForFunction(()=>window.cafeDemandState.admitted===7,null,{timeout:150000});
      const next=await page.evaluate(()=>({profile:window.cafeDemandState.guests[0].profile,random:window.cafeDemandState.random,draws:window.cafeDemandState.draws}));
      await button('Pause').click();await page.waitForFunction(()=>window.cafeState.paused);
      await page.evaluate(saved=>localStorage.setItem('cafegame.shift.v1',saved),saved);await load();
      assert.equal(await page.evaluate(()=>window.cafeDemandState.reviews),3);
      await button('Resume').click();await button('Resume foot traffic').click();
      await page.waitForFunction(()=>window.cafeDemandState.admitted===7,null,{timeout:150000});
      assert.deepEqual(await page.evaluate(()=>({profile:window.cafeDemandState.guests[0].profile,random:window.cafeDemandState.random,draws:window.cafeDemandState.draws})),next);
      await button('Pause foot traffic').click();
      const economy=await page.evaluate(()=>window.cafeEconomyState);
      assert.equal(economy.cash,5000+economy.sales-economy.supplies-economy.wages-economy.maintenance-economy.furniture);
      assert.equal(economy.sales,firstPrice+500);
      assert.equal(await page.evaluate(()=>window.cafeHostError),null);assert.deepEqual(errors,[]);
      await page.screenshot({path:`build/evidence/${backend}-demand.png`,fullPage:true});
      console.log(`${backend}: traffic, closed/pause clocks, profiles, weighted reviews, takeaway, failure idempotency, save/load replay and finances passed`);
      } catch(error) {
        console.error(await page.evaluate(()=>({demand:window.cafeDemandState,state:window.cafeState,occupancy:window.cafeOccupancyState,workflow:window.cafeWorkflowState,hostError:window.cafeHostError})).catch(()=>null));
        await page.screenshot({path:`build/evidence/${backend}-demand-failure.png`,fullPage:true}).catch(()=>{});throw error;
      }
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

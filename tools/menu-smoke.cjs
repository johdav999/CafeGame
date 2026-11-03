// Rendered milestone-17 acceptance. Uses local approved content only.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {mkdir,readFile}=require('node:fs/promises');
(async()=>{
  await mkdir('build/evidence',{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,args:['--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader',...(process.env.CAFE_DISABLE_WEBGPU==='1'?['--disable-blink-features=WebGPU']:[])]});
  try {
    for(const backend of ['webgl2','automatic']) {
      const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      if(process.env.CAFE_DISABLE_WEBGPU==='1')await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
      try {
        const button=name=>page.getByRole('button',{name,exact:true});
        await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}&tools=1`);
        await page.waitForFunction(()=>window.cafeMenuState && window.cafeInspectorState && !document.querySelector('[data-command="2"]').disabled,null,{timeout:60000});
        await page.locator('#authoring-panel summary').click();await page.locator('#scenario-select').selectOption('2');await button('Start selected scenario').click();
        await page.waitForFunction(()=>window.cafeDiagnosticState.stock===100);
        await page.locator('#guest-profile').selectOption('1');
        for(const [p,second,price] of [[0,-1,500],[1,-1,600],[2,-1,700],[3,-1,400],[4,-1,350],[2,4,1050]]) {
          const count=await page.evaluate(()=>window.cafeState.served);
          if(count) {
            await page.locator('#guest-first').selectOption(String(p));await page.locator('#guest-second').selectOption(String(second));
            await button('Welcome guest').click();
            await page.waitForFunction(p=>window.cafeMenuState.tickets.some(t=>t.phase===0 && t.items[0].product===p),p);
          }
          const action=page.locator(`[data-command="${p===0?0:20+p}"]`);await action.click();
          await page.waitForFunction(()=>window.cafeMenuState.tickets.some(t=>t.phase===1));
          if(second===4) {
            await page.waitForFunction(()=>window.cafeMenuState.tickets.some(t=>t.phase===1 && t.items.some(i=>i.freshMs>0)));
            await button('Pause').click();await page.waitForFunction(()=>window.cafeState.paused);
            const ticket=await page.evaluate(()=>window.cafeMenuState.tickets.find(t=>t.phase===1));
            await button('Save shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
            await button('Resume').click();await button('Cancel order').click();await page.waitForFunction(()=>window.cafeDiagnosticState.order===4);
            await button('Pause').click();await button('Load shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent==='Saved shift restored.');
            assert.deepEqual(await page.evaluate(()=>window.cafeMenuState.tickets.find(t=>t.phase===1)),ticket);
            await button('Resume').click();
          }
          await page.waitForFunction(()=>window.cafeState.ready && !document.querySelector('[data-command="1"]').disabled,null,{timeout:60000});
          const ticket=await page.evaluate(()=>window.cafeMenuState.tickets.find(t=>t.phase===1));assert.equal(ticket.price,price);
          assert.ok(ticket.items.every(i=>i.status==='Ready for handover' && i.freshMs>0));
          assert.equal(ticket.items.length,second>=0?2:1);
          if(second===4)await page.screenshot({path:`build/evidence/menu-${backend}.png`,fullPage:true});
          const sales=await page.evaluate(()=>window.cafeEconomyState.sales),reviews=await page.evaluate(()=>window.cafeInspectorState.report.deliveredReviews);
          await button('Serve ticket').click();await page.waitForFunction(n=>window.cafeState.served===n+1,count);
          assert.equal(await page.evaluate(()=>window.cafeEconomyState.sales),sales+price);
          assert.equal(await page.evaluate(()=>window.cafeInspectorState.report.deliveredReviews),reviews+1);
          await page.evaluate(()=>Module._cafe_command(1));await page.waitForTimeout(100);
          assert.equal(await page.evaluate(()=>window.cafeEconomyState.sales),sales+price);
        }
        // Each ingredient reserves its own storeroom space and refunds its price.
        for(let n=0;n<5;++n) {
          await page.locator('#supply-ingredient').selectOption(String(n));
          const before=await page.evaluate(()=>window.cafeEconomyState.supplies);
          await page.locator('#ingredient-order').click();await page.waitForFunction(n=>window.cafeMenuState.ingredients[n].incoming===12,n);
          const cost=await page.evaluate(n=>window.cafeMenuState.ingredients[n].price*12,n);
          assert.equal(await page.evaluate(()=>window.cafeEconomyState.supplies),before+cost);
          await button('Cancel delivery').click();await page.waitForFunction(()=>!window.cafeSupplyState.pending);
          assert.equal(await page.evaluate(()=>window.cafeEconomyState.supplies),before);
        }
        // Loading incompatible historical content preserves the active game and slot.
        const fixture=(await readFile('tests/fixtures/schema8.hpp','utf8')).match(/"([0-9a-f]+)"/g).map(s=>s.slice(1,-1)).join('');
        await button('Pause').click();await page.waitForFunction(()=>window.cafeState.paused);
        const current=await page.evaluate(()=>window.cafeInspectorState);
        await page.evaluate(hex=>localStorage.setItem('cafegame.shift.v1',btoa(hex.match(/../g).map(b=>String.fromCharCode(parseInt(b,16))).join(''))),fixture);
        const stored=await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1'));
        await button('Load shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent.includes('different content version'));
        assert.deepEqual(await page.evaluate(()=>window.cafeInspectorState),current);
        assert.equal(await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1')),stored);
        assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>window.cafeHostError),null);
        console.log(`Menu acceptance passed: ${backend}`);
      } finally {await page.close();}
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

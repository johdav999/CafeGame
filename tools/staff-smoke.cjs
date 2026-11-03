const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {mkdir,readFile}=require('node:fs/promises');
(async()=>{
  await mkdir('build/evidence',{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,args:['--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader',...(process.env.CAFE_DISABLE_WEBGPU==='1'?['--disable-blink-features=WebGPU']:[])]});
  try {
    for(const backend of ['webgl2','automatic']) {
      const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      if(process.env.CAFE_DISABLE_WEBGPU==='1')await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
      try {
        const button=name=>page.getByRole('button',{name,exact:true});
        await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}&tools=1`);
        await page.waitForFunction(()=>window.cafeStaffState && window.cafeInspectorState && !document.querySelector('[data-command="2"]').disabled,null,{timeout:60000});
        await page.locator('#authoring-panel summary').click();await page.locator('#scenario-select').selectOption('2');await button('Start selected scenario').click();
        await page.waitForFunction(()=>window.cafeDiagnosticState.stock===100);
        await button('Hire staff · 15.00').click();await page.waitForFunction(()=>window.cafeStaffState.staff.length===2);
        await button('Hire staff · 15.00').click();await page.waitForFunction(()=>window.cafeStaffState.staff.length===3);
        assert.equal(await button('Hire staff · 15.00').isDisabled(),true);
        assert.equal(await page.evaluate(()=>window.cafeStaffState.hiringMinor),3000);
        const priorities=[[3,3,0,0],[0,3,0,3],[0,0,3,0]],names=['Alex','Sam','Robin'],roles=['Preparation','Serving','Restocking','Cleaning'];
        for(let w=0;w<3;++w)for(let r=0;r<4;++r) {
          await page.getByLabel(`${names[w]} ${roles[r]} priority`,{exact:true}).selectOption(String(priorities[w][r]));
          await page.waitForFunction(({w,r,p})=>window.cafeStaffState.staff[w].priorities[r]===p,{w,r,p:priorities[w][r]});
        }
        await page.locator('#supply-ingredient').selectOption('2');await page.locator('#ingredient-order').click();
        await page.waitForFunction(()=>window.cafeMenuState.ingredients[2].stored===12,null,{timeout:60000});
        await button('Brew espresso').click();await page.waitForFunction(()=>window.cafeState.ready && !document.querySelector('[data-command="1"]').disabled,null,{timeout:60000});
        await button('Serve ticket').click();await page.waitForFunction(()=>window.cafeState.served===1);
        await page.locator('#guest-profile').selectOption('1');await page.locator('#guest-first').selectOption('2');await button('Welcome guest').click();
        await page.waitForFunction(()=>window.cafeStaffState.staff.some(w=>w.task==='cafe:clean'),null,{timeout:60000});
        await button('Prepare latte').click();await page.locator('#ingredient-restock').click();
        await page.waitForFunction(()=>window.cafeStaffState.staff.filter(w=>w.task).length>=2 && window.cafeStaffState.staff[0].task==='cafe:prepare',null,{timeout:60000});
        assert.equal(await button('Dismiss Alex').isDisabled(),true);
        await button('Take break Alex').click();await page.waitForFunction(()=>window.cafeStaffState.staff[0].breakPending && window.cafeStaffState.staff[0].onShift);
        await button('Pause').click();await page.waitForFunction(()=>window.cafeState.paused);
        const roster=await page.evaluate(()=>window.cafeStaffState.staff);
        await page.waitForTimeout(250);assert.deepEqual(await page.evaluate(()=>window.cafeStaffState.staff),roster);
        await button('Save shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
        await button('Resume').click();await button('Cancel order').click();await page.waitForFunction(()=>window.cafeDiagnosticState.order===4);
        await button('Pause').click();await button('Load shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent==='Saved shift restored.');
        assert.deepEqual(await page.evaluate(()=>window.cafeStaffState.staff),roster);
        await button('Resume').click();await page.waitForFunction(()=>window.cafeState.ready && !document.querySelector('[data-command="1"]').disabled,null,{timeout:60000});
        assert.equal(await page.evaluate(()=>window.cafeStaffState.staff[0].onShift),false);
        assert.equal(await page.evaluate(()=>window.cafeStaffState.staff[1].task),'cafe:handover');
        await page.screenshot({path:`build/evidence/staff-${backend}.png`,fullPage:true});
        await button('Serve ticket').click();await page.waitForFunction(()=>window.cafeState.served===2);
        await page.waitForFunction(()=>!window.cafeMenuState.ingredients[2].restocking && window.cafeMenuState.ingredients[2].stored===8);
        const finance=await page.evaluate(()=>({economy:window.cafeEconomyState,crew:window.cafeStaffState}));
        assert.equal(finance.economy.cash,5000+finance.economy.sales-finance.economy.supplies-finance.economy.wages-finance.economy.maintenance-finance.economy.furniture-finance.crew.hiringMinor);
        assert.equal(finance.crew.staff.reduce((sum,w)=>sum+w.paid,0),finance.economy.wages);
        await button('Dismiss Alex').click();await page.waitForFunction(()=>window.cafeStaffState.staff.length===2);
        assert.deepEqual(await page.evaluate(()=>window.cafeStaffState.staff.map(w=>w.name)),['Sam','Robin']);
        await button('Pause').click();await button('Save shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
        const dismissed=await page.evaluate(()=>window.cafeStaffState.staff);await button('Load shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent==='Saved shift restored.');
        assert.deepEqual(await page.evaluate(()=>window.cafeStaffState.staff),dismissed);
        // Genuine previous-release save migrates without rewriting the device slot.
        const fixture=(await readFile('tests/fixtures/schema10.hpp','utf8')).match(/"([0-9a-f]+)"/g).map(s=>s.slice(1,-1)).join('');
        const legacy=Buffer.from(fixture,'hex').toString('base64');
        await page.evaluate(data=>localStorage.setItem('cafegame.shift.v1',data),legacy);await button('Load shift').click();
        await page.waitForFunction(()=>document.getElementById('save-status').textContent.includes('upgraded'));
        assert.equal(await page.evaluate(()=>window.cafeStaffState.staff.length),1);
        assert.equal(await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1')),legacy);
        assert.equal(await page.evaluate(()=>window.cafeState.brewing),2);
        await button('Save shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
        assert.equal(await page.evaluate(()=>new DataView(Uint8Array.from(atob(localStorage.getItem('cafegame.shift.v1')),c=>c.charCodeAt(0)).buffer).getBigUint64(8,true).toString()),'14');
        await button('Resume').click();await page.waitForFunction(()=>window.cafeState.ready && !document.querySelector('[data-command="1"]').disabled,null,{timeout:60000});
        await button('Serve ticket').click();await page.waitForFunction(()=>window.cafeState.served===1);
        assert.equal(await page.evaluate(()=>window.cafeEconomyState.cash),4300);
        assert.equal(await page.evaluate(()=>window.cafeHostError),null);assert.deepEqual(errors,[]);
        console.log(`Staff acceptance passed: ${backend}`);
      } catch(error) {
        console.error(await page.evaluate(()=>({staff:window.cafeStaffState,game:window.cafeState,workflow:window.cafeWorkflowState,error:window.cafeHostError})).catch(()=>null));throw error;
      } finally {await page.close();}
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {readFile,mkdir}=require('node:fs/promises');
(async()=>{
  await mkdir('build/evidence',{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,args:['--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader',...(process.env.CAFE_DISABLE_WEBGPU==='1'?['--disable-blink-features=WebGPU']:[])]});
  try {
    for(const backend of ['webgl2','automatic']) {
      const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
      if(process.env.CAFE_DISABLE_WEBGPU==='1')await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
      try {
        const button=name=>page.getByRole('button',{name,exact:true});
        await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}&tools=1`);
        await page.waitForFunction(()=>window.cafeEquipmentState && window.cafeInspectorState && !document.querySelector('[data-command="2"]').disabled,null,{timeout:60000});
        await page.locator('#authoring-panel summary').click();await page.locator('#scenario-select').selectOption('4');await button('Start selected scenario').click();
        await page.waitForFunction(()=>window.cafeLayoutState.editable && window.cafeEconomyState.cash===100000);
        await button('Pause').click();await page.waitForFunction(()=>window.cafeState.paused);
        const place=async(id,x,z)=>{
          await page.locator('#layout-id').selectOption(String(id));
          if(x!==undefined){await page.locator('#layout-x').fill(String(x*.5-6));await page.locator('#layout-z').fill(String(z*.5-5));}
          const expected=await page.evaluate(()=>({x:Math.round((Number(document.getElementById('layout-x').value)+6)*2),z:Math.round((Number(document.getElementById('layout-z').value)+5)*2)}));
          await page.locator('#layout-apply').click();
          await page.waitForFunction(({id,x,z})=>window.cafeLayoutState.tables.some(p=>p.id===id && p.x===x && p.z===z),{id,...expected});
        };
        await place(1,0,10);await place(2,6,10);await place(3,12,10);await place(4,18,10);
        await button('Upgrade espresso · 30.00').click();await page.waitForFunction(()=>window.cafeEquipmentState.fast);
        for(const id of [10,11,20,21,22,23])await place(id);
        await page.locator('#finish-select').selectOption('2');await page.waitForFunction(()=>window.cafeEquipmentState.finish===2);
        assert.equal(await page.evaluate(()=>window.cafeInspectorState.report.tables),4);assert.equal(await page.evaluate(()=>window.cafeEquipmentState.netCost),10500);
        const save=async()=>{await page.evaluate(()=>document.getElementById('save-status').textContent='Saving test state');await button('Save shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));return page.evaluate(()=>localStorage.getItem('cafegame.shift.v1'));};
        const original=await save();await page.evaluate(()=>Module._cafe_equipment(1,5,-6,0,0));await page.waitForFunction(()=>window.cafeEquipmentState.message.includes('overlap'));
        assert.equal(await save(),original); // Rejected placement changes no durable state.
        await button('Load shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent==='Saved shift restored.');
        assert.equal(await page.evaluate(()=>window.cafeEquipmentState.catalog.filter(i=>i.owned).length),7);
        await page.locator('.game').screenshot({path:`build/evidence/equipment-room-${backend}.png`});
        await page.locator('#equipment-panel').screenshot({path:`build/evidence/equipment-catalog-${backend}.png`});
        await button('Resume').click();await button('Hire staff · 15.00').click();await page.waitForFunction(()=>window.cafeStaffState.staff.length===2);
        await button('Reopen cafe').click();await page.waitForFunction(()=>!window.cafeLayoutState.closed);
        await page.locator('#guest-profile').selectOption('1');await page.locator('#guest-first').selectOption('0');await page.locator('#guest-second').selectOption('2');
        await button('Welcome guest').click();await page.waitForFunction(()=>window.cafeOccupancyState.waiting===1);
        await button('Brew espresso').click();await page.waitForFunction(()=>new Set(window.cafeInspectorState.jobs.filter(j=>j.state===1 || j.state===2).map(j=>j.worker)).size===2,null,{timeout:60000});
        await button('Pause').click();await page.waitForFunction(()=>window.cafeState.paused);const crew=await page.evaluate(()=>window.cafeStaffState.staff);
        assert.ok(crew.some(w=>w.task==='cafe:assist'));await save();await button('Load shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent==='Saved shift restored.');
        assert.deepEqual(await page.evaluate(()=>window.cafeStaffState.staff),crew);
        await button('Resume').click();await page.waitForFunction(()=>!document.querySelector('[data-command="1"]').disabled,null,{timeout:60000});
        await button('Serve ticket').click();await page.waitForFunction(()=>window.cafeState.served===1);
        assert.equal(await page.evaluate(()=>window.cafeEconomyState.sales),1200);
        await button('Close for layout').click();await page.waitForFunction(()=>window.cafeLayoutState.editable,null,{timeout:60000});
        await page.locator('#layout-id').selectOption('10');await page.locator('#layout-sell').click();await page.waitForFunction(()=>!window.cafeEquipmentState.station);
        assert.equal(await page.evaluate(()=>window.cafeEquipmentState.netCost),8250);
        // Reserve only the fourth table, then walk a real seated guest to it.
        for(const id of [1,2,3]){await page.locator('#layout-id').selectOption(String(id));await page.locator('#layout-sell').click();await page.waitForFunction(id=>!window.cafeLayoutState.tables.some(p=>p.id===id),id);}
        await button('Reopen cafe').click();await page.waitForFunction(()=>!window.cafeLayoutState.closed);
        await page.locator('#guest-profile').selectOption('0');await page.locator('#guest-first').selectOption('4');await page.locator('#guest-second').selectOption('-1');
        await button('Welcome guest').click();await page.waitForFunction(()=>window.cafeOccupancyState.waiting===1);
        await button('Plate croissant').click();await page.waitForFunction(()=>!document.querySelector('[data-command="1"]').disabled,null,{timeout:60000});await button('Serve ticket').click();
        await page.waitForFunction(()=>window.cafeInspectorState.claims.some(c=>c.pool===2 && c.point===3 && c.occupied),null,{timeout:60000});
        // Known campaign-19 saves migrate, including their old opening checkpoint.
        await button('Pause').click();const hex=(await readFile('tests/fixtures/schema12.hpp','utf8')).match(/"([0-9a-f]+)"/g).map(s=>s.slice(1,-1)).join('');const legacy=Buffer.from(hex,'hex').toString('base64');
        await page.evaluate(data=>localStorage.setItem('cafegame.shift.v1',data),legacy);await button('Load shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent.includes('upgraded'));
        assert.equal(await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1')),legacy);
        assert.equal(await page.evaluate(()=>window.cafeCampaignState.enabled),1);assert.equal(await page.evaluate(()=>window.cafeEquipmentState.fast),0);
        assert.equal(await page.evaluate(()=>window.cafeInspectorState.report.saveSchema),15);
        const oldHex=(await readFile('tests/fixtures/schema13.hpp','utf8')).match(/"([0-9a-f]+)"/g).map(s=>s.slice(1,-1)).join('');const old=Buffer.from(oldHex,'hex').toString('base64');
        await page.evaluate(data=>{localStorage.setItem('cafegame.shift.v1',data);document.getElementById('save-status').textContent='Loading waiting-seat fixture';},old);
        await button('Load shift').click();await page.waitForFunction(()=>window.cafeState.served===3 && window.cafeOccupancyState.waitingSeats===1);
        assert.equal(await page.evaluate(()=>window.cafeEconomyState.cash),6500);assert.equal(await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1')),old);
        await button('Resume').click();await page.waitForFunction(()=>window.cafeOccupancyState.waitingSeats===0,null,{timeout:60000});
        assert.equal(await page.evaluate(()=>window.cafeState.served),3);assert.deepEqual(errors,[]);
        console.log(`${backend}: workshop, four tables, catalog, finish, blocked placement, parallel physical preparation, partial restore, resale, campaign migration and waiting-seat restore/promotion passed`);
      } finally {await page.close();}
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

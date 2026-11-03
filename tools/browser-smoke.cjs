// Optional acceptance check: supply Playwright through NODE_PATH or install it locally.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
(async () => {
  await mkdir('build/evidence', { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE || undefined,
    headless: true,
    args: ['--no-proxy-server', '--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      ...(process.env.CAFE_DISABLE_WEBGPU === '1' ? ['--disable-blink-features=WebGPU'] : [])]
  });
  try {
    for (const backend of ['webgl2', 'automatic']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      if (process.env.CAFE_DISABLE_WEBGPU === '1') {
        // Emulate a browser without WebGPU; Chromium flags differ across releases.
        await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }));
      }
      const checkMoney = async sales => {
        const economy = await page.evaluate(() => window.cafeEconomyState);
        assert.equal(economy.sales, sales);
        assert.equal(economy.cash, 5000 + economy.sales - economy.supplies - economy.wages - economy.maintenance - economy.furniture);
        assert.equal(economy.profit, economy.sales - economy.supplies - economy.wages - economy.maintenance - economy.furniture);
      };
      const exerciseLayout = async expectedServed => {
      await page.getByRole('button', {name:'Close for layout', exact:true}).click();
      await page.waitForFunction(() => window.cafeLayoutState.editable, null, {timeout:60000});
      assert.equal(await page.getByRole('button', {name:'Brew espresso',exact:true}).isDisabled(),true);
      await page.locator('#layout-x').fill('2');await page.locator('#layout-z').fill('-0.5');
      await page.waitForFunction(() => document.getElementById('layout-preview').textContent.includes('Overlaps'));
      assert.equal(await page.locator('#layout-apply').isDisabled(),true);
      const layoutBefore=await page.evaluate(()=>window.cafeLayoutState.tables);
      await page.evaluate(()=>Module._cafe_layout(0,1,2,-.5,0));
      await page.waitForFunction(()=>document.getElementById('layout-status').textContent.includes('overlaps'));
      assert.deepEqual(await page.evaluate(()=>window.cafeLayoutState.tables),layoutBefore);
      await page.locator('#layout-x').fill('-5');await page.locator('#layout-z').fill('0');
      await page.locator('#layout-rotation').selectOption('1');
      await page.locator('#layout-apply').click();
      await page.waitForFunction(()=>window.cafeLayoutState.tables.find(p=>p.id===1)?.rotation===1);
      await page.getByRole('button', {name:'Save shift',exact:true}).click();
      await page.waitForFunction(()=>document.getElementById('save-status').textContent.includes('saved'));
      await page.reload();
      await page.waitForFunction(()=>window.cafeState && !document.querySelector('[data-command="4"]').disabled);
      await page.getByRole('button', {name:'Load shift',exact:true}).click();
      await page.waitForFunction(()=>window.cafeLayoutState.closed && window.cafeLayoutState.tables.find(p=>p.id===1)?.rotation===1);
      assert.equal(await page.evaluate(()=>window.cafeLayoutState.tables.find(p=>p.id===1).x),2);
      await page.locator('#layout-id').selectOption('2');
      const furnitureBefore=await page.evaluate(()=>window.cafeEconomyState.furniture);
      await page.locator('#layout-sell').click();
      await page.waitForFunction(()=>window.cafeLayoutState.tables.length===1);
      assert.equal(await page.evaluate(()=>window.cafeEconomyState.furniture),furnitureBefore-300);
      await page.locator('#layout-apply').click();
      await page.waitForFunction(()=>window.cafeLayoutState.tables.length===2);
      assert.equal(await page.evaluate(()=>window.cafeEconomyState.furniture),furnitureBefore+300);
      await page.locator('#layout-sell').click();
      await page.waitForFunction(()=>window.cafeLayoutState.tables.length===1);
      assert.equal(await page.evaluate(()=>window.cafeEconomyState.furniture),furnitureBefore);
      await page.screenshot({path:`build/evidence/${backend}-layout.png`,fullPage:true});
      await page.getByRole('button', {name:'Reopen cafe',exact:true}).click();
      // Reload resets practice form fields; keep this legacy service regression
      // explicit about the espresso ticket it expects after editing the layout.
      await page.locator('#guest-first').selectOption('0');
      await page.getByRole('button', {name:'Welcome guest',exact:true}).click();
      await page.waitForFunction(()=>window.cafeOccupancyState.waiting===1);
      await page.getByRole('button', {name:'Brew espresso',exact:true}).click();
      await page.waitForFunction(()=>window.cafeState.ready,null,{timeout:60000});
      await page.getByRole('button', {name:'Serve ticket',exact:true}).click();
      await page.waitForFunction(expectedServed=>window.cafeState.served===expectedServed, expectedServed);
      await page.waitForFunction(()=>window.cafeOccupancyState.dining===1,null,{timeout:60000});
      await page.screenshot({path:`build/evidence/${backend}-layout-seating.png`,fullPage:true});
      await page.waitForFunction(()=>window.cafeOccupancyState.guests===0 && window.cafeWorkflowState.dirty===0,null,{timeout:90000});
      await checkMoney(expectedServed*500);
      };
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${process.env.CAFE_URL || 'http://127.0.0.1:4173'}/?backend=${backend}&tools=1`);
      await page.getByRole('button', { name: 'Brew espresso' }).waitFor();
      await page.waitForFunction(() => window.cafeState && !document.querySelector('[data-command="0"]').disabled, null, { timeout: 60000 });
      await page.locator('#guest-first').selectOption('0');
      if (process.env.CAFE_DISABLE_WEBGPU === '1') {
        assert.match(await page.locator('#status').innerText(), /WebGL 2 renderer ready/);
      }
      if(await page.evaluate(()=>window.cafeDemandState?.automatic)) {
        await page.getByRole('button',{name:'Pause foot traffic',exact:true}).click();
        await page.waitForFunction(()=>!window.cafeDemandState.automatic);
      }
      assert.equal(await page.evaluate(() => window.cafeDiagnosticState.stock), 4);
      await checkMoney(0);
      if(process.env.CAFE_LAYOUT_ONLY==='1') {
        await exerciseLayout(1);assert.deepEqual(errors,[]);
        console.log(`${backend}: final layout preview/validation, move/rotate, buy/sell, reload, seating/cleanup and finance passed`);
        await page.close();continue;
      }
      await page.getByRole('button', { name: 'Save shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('Shift saved'));
      const openingSave = await page.evaluate(() => localStorage.getItem('cafegame.shift.v1'));
      // Valid current opening-cash fixture: no transactions have occurred yet.
      await page.evaluate(() => {
        const bytes = Uint8Array.from(atob(localStorage.getItem('cafegame.shift.v1')), c => c.charCodeAt(0));
        const view = new DataView(bytes.buffer);
        // Schema 24's fixed suffix follows the initial, empty ledger. Keep its
        // opening balance and current balance consistent with the wallet header.
        const suffix=16+112+256+31*8+8+32+(11+window.cafeDemandState.guests.length*3)*8+window.cafeDemandState.saveBytes+360+104;
        const ledgerEnd=bytes.length-suffix;
        if(view.getBigUint64(8,true)!==24n || view.getBigUint64(16,true)!==0n || window.cafeCampaignState.enabled ||
           view.getBigUint64(ledgerEnd-8,true)!==0n || view.getBigUint64(ledgerEnd-16,true)!==0n || view.getBigUint64(ledgerEnd-24,true)!==1n)
          throw new Error('Unexpected opening fixture');
        view.setBigUint64(24,100n,true);
        view.setBigUint64(ledgerEnd-40,100n,true);
        view.setBigUint64(ledgerEnd-32,100n,true);
        localStorage.setItem('cafegame.shift.v1', btoa(String.fromCharCode(...bytes)));
      });
      await page.getByRole('button', { name: 'Load shift' }).click();
      await page.waitForFunction(() => window.cafeEconomyState.cash === 100);
      assert.equal(await page.getByRole('button', { name: 'Order 12 beans' }).isDisabled(), true);
      await page.getByRole('button', { name: 'Enable auto supply' }).click();
      await page.waitForFunction(() => window.cafeSupplyState.automatic);
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => window.cafeSupplyState.pending), false);
      assert.equal(await page.evaluate(() => window.cafeEconomyState.cash), 100);
      await page.evaluate(value => localStorage.setItem('cafegame.shift.v1', value), openingSave);
      await page.getByRole('button', { name: 'Load shift' }).click();
      await page.waitForFunction(() => window.cafeEconomyState.cash === 5000 && !window.cafeSupplyState.automatic);
      await page.getByRole('button', { name: 'Order 12 beans' }).click();
      await page.waitForFunction(() => window.cafeSupplyState.pending);
      assert.equal(await page.evaluate(() => window.cafeSupplyState.incoming), 12);
      assert.equal(await page.evaluate(() => window.cafeEconomyState.supplies), 1200);
      await checkMoney(0);
      assert.equal(await page.getByRole('button', { name: 'Order 12 beans' }).isDisabled(), true);
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await page.waitForFunction(() => window.cafeState.paused);
      const deliveryTime = await page.evaluate(() => window.cafeSupplyState.remaining);
      const pausedStaffTime = await page.evaluate(() => window.cafeEconomyState.staffed);
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => window.cafeSupplyState.remaining), deliveryTime);
      assert.equal(await page.evaluate(() => window.cafeEconomyState.staffed), pausedStaffTime);
      await page.getByRole('button', { name: 'Save shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('Shift saved'));
      await page.locator('[data-command="2"]').click();
      await page.getByRole('button', { name: 'Cancel delivery' }).click();
      await page.waitForFunction(() => !window.cafeSupplyState.pending && window.cafeSupplyState.incoming === 0);
      assert.equal(await page.evaluate(() => window.cafeEconomyState.supplies), 0);
      await checkMoney(0);
      await page.getByRole('button', { name: 'Load shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('restored') && window.cafeSupplyState.pending);
      await page.waitForFunction(() => window.cafeSupplyState.stored === 12 && !window.cafeSupplyState.pending, null, {timeout:60000}).catch(async error=>{console.error(await page.evaluate(()=>({supply:window.cafeSupplyState,game:window.cafeState,error:window.cafeHostError,save:document.getElementById('save-status').textContent})));throw error;});
      await page.getByRole('button', { name: 'Restock machine' }).click();
      await page.waitForFunction(() => window.cafeSupplyState.stored === 8 && window.cafeDiagnosticState.stock === 8);
      await page.getByRole('button', { name: 'Enable auto supply' }).click();
      await page.waitForFunction(() => window.cafeSupplyState.automatic);
      await page.getByRole('button', { name: 'Restock machine' }).click();
      await page.waitForFunction(() => window.cafeSupplyState.pending && window.cafeSupplyState.incoming === 8);
      await page.getByRole('button', { name: 'Cancel delivery' }).click();
      await page.waitForFunction(() => !window.cafeSupplyState.pending && !window.cafeSupplyState.automatic);
      await page.screenshot({ path: `build/evidence/${backend}-supply.png`, fullPage:true });
      const initial = await page.locator('#viewport').screenshot();
      // Pause an idle employee before accepting work. Preparation breaks now
      // defer safely until the ticket finishes; staff-smoke covers that policy.
      await page.getByRole('button', { name: 'Take staff break' }).click();
      await page.waitForFunction(() => !window.cafeWorkflowState.onShift);
      await page.getByRole('button', { name: 'Brew espresso' }).click();
      const breakX = await page.evaluate(() => window.cafeTravel.staffX);
      const breakStaffTime = await page.evaluate(() => window.cafeEconomyState.staffed);
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => window.cafeTravel.staffX), breakX);
      assert.equal(await page.evaluate(() => window.cafeEconomyState.staffed), breakStaffTime);
      assert.equal(await page.evaluate(() => window.cafeState.brewing), 0);
      await page.getByRole('button', { name: 'Save shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('Shift saved'));
      await page.getByRole('button', { name: 'Load shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('restored'));
      assert.equal(await page.evaluate(() => window.cafeWorkflowState.onShift), false);
      await page.getByRole('button', { name: 'Resume staff shift' }).click();
      await page.waitForFunction(() => window.cafeWorkflowState.onShift);
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await page.waitForFunction(() => window.cafeState.paused);
      const walkingX = await page.evaluate(() => window.cafeTravel.staffX);
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => window.cafeTravel.staffX), walkingX);
      await page.getByRole('button', { name: 'Save shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('Shift saved'));
      await page.locator('[data-command="2"]').click();
      await page.getByRole('button', { name: 'Cancel order' }).click();
      await page.waitForFunction(() => window.cafeDiagnosticState.order === 4);
      await page.getByRole('button', { name: 'Load shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('restored'));
      await page.waitForFunction(() => window.cafeDiagnosticState.job >= 1 && window.cafeDiagnosticState.job <= 3);
      await page.waitForFunction(() => window.cafeState.brewing > 0 || window.cafeState.ready);
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await page.waitForFunction(() => window.cafeState.paused);
      const pausedTime = await page.evaluate(() => window.cafeState.brewing);
      const pausedX = await page.evaluate(() => window.cafeTravel.staffX);
      await page.waitForTimeout(400);
      assert.equal(await page.evaluate(() => window.cafeState.brewing), pausedTime);
      assert.equal(await page.evaluate(() => window.cafeTravel.staffX), pausedX);
      await page.getByRole('button', { name: 'Save shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('Shift saved'));
      await page.locator('[data-command="2"]').click();
      await page.getByRole('button', { name: 'Cancel order' }).click();
      await page.waitForFunction(() => window.cafeDiagnosticState.order === 4);
      await page.getByRole('button', { name: 'Load shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('restored'));
      assert.ok(await page.evaluate(() => window.cafeState.brewing > 0 || window.cafeState.ready));
      await page.waitForFunction(() => window.cafeState.ready);
      const ready = await page.locator('#viewport').screenshot();
      assert.ok(!initial.equals(ready), 'Prepared coffee must change the rendered canvas');
      await page.screenshot({ path: `build/evidence/${backend}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Serve ticket' }).click();
      await page.waitForFunction(() => window.cafeState.served === 1);
      await checkMoney(500);
      await page.getByRole('button', { name: 'Save shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('Shift saved'));
      await page.reload();
      await page.waitForFunction(() => window.cafeState && !document.querySelector('[data-command="4"]').disabled);
      await page.getByRole('button', { name: 'Load shift' }).click();
      await page.waitForFunction(() => window.cafeEconomyState.sales === 500);
      assert.equal(await page.evaluate(() => window.cafeState.served), 1);
      await page.waitForFunction(() => window.cafeOccupancyState.dining > 0, null, { timeout: 60000 });
      await page.screenshot({ path: `build/evidence/${backend}-seating.png`, fullPage: true });
      assert.equal(await page.evaluate(() => window.cafeOccupancyState.waiting), 2);
      await page.getByRole('button', { name: 'Welcome guest' }).click();
      await page.waitForFunction(() => window.cafeOccupancyState.waiting === 3);
      assert.equal(await page.getByRole('button', { name: 'Welcome guest' }).isDisabled(), true);
      await page.getByRole('button', { name: 'Brew espresso' }).click();
      await page.waitForFunction(() => window.cafeOccupancyState.counter === 1 && window.cafeOccupancyState.waiting === 2);
      await page.waitForFunction(() => window.cafeState.ready);
      await page.getByRole('button', { name: 'Serve ticket' }).click();
      await page.waitForFunction(() => window.cafeState.served === 2);
      await checkMoney(1000);
      assert.equal(await page.evaluate(() => window.cafeOccupancyState.counter), 0);
      await page.getByRole('button', { name: 'Save shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('Shift saved'));
      await page.reload();
      await page.waitForFunction(() => window.cafeState && !document.querySelector('[data-command="4"]').disabled);
      await page.getByRole('button', { name: 'Load shift' }).click();
      await page.waitForFunction(() => window.cafeEconomyState.sales === 1000);
      assert.equal(await page.evaluate(() => window.cafeOccupancyState.waiting), 2);
      await page.waitForFunction(() => window.cafeOccupancyState.seated === 0, null, { timeout: 60000 }).catch(async error => {
        console.error(await page.evaluate(() => ({state:window.cafeState, occupancy:window.cafeOccupancyState, workflow:window.cafeWorkflowState, travel:window.cafeTravel, error:window.cafeHostError})));
        await page.screenshot({path:`build/evidence/${backend}-workflow-failure.png`,fullPage:true});
        throw error;
      });
      assert.equal(await page.evaluate(() => window.cafeWorkflowState.dirty), 0);
      await page.waitForFunction(() => window.cafeOccupancyState.guests === 2, null, { timeout: 60000 });
      await page.evaluate(() => localStorage.setItem('cafegame.shift.v1', btoa('invalid')));
      await page.getByRole('button', { name: 'Load shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('damaged'));
      await checkMoney(1000);
      assert.equal(await page.evaluate(() => window.cafeHostError), null);
      const wasteBefore = await page.evaluate(() => window.cafeQualityState.wasted);
      await page.getByRole('button', { name: 'Brew espresso' }).click();
      await page.waitForFunction(() => window.cafeState.ready);
      await page.getByRole('button', { name: 'Pause', exact:true }).click();
      await page.waitForFunction(() => window.cafeState.paused);
      const freshness = await page.evaluate(() => window.cafeQualityState);
      assert.ok(freshness.remaining > 0 && freshness.score > 0);
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => window.cafeQualityState.remaining), freshness.remaining);
      await page.getByRole('button', { name: 'Save shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('Shift saved'));
      await page.getByRole('button', { name: 'Load shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('restored'));
      assert.equal(await page.evaluate(() => window.cafeQualityState.remaining), freshness.remaining);
      await page.locator('[data-command="2"]').click();
      await page.waitForFunction(waste => window.cafeQualityState.wasted === waste + 1 && !window.cafeState.ready, wasteBefore, {timeout:180000}).catch(async error => {
        console.error(await page.evaluate(() => ({state:window.cafeState,quality:window.cafeQualityState,workflow:window.cafeWorkflowState,error:window.cafeHostError})));
        await page.screenshot({path:`build/evidence/${backend}-quality-failure.png`,fullPage:true});
        throw error;
      });
      await checkMoney(1000);
      await page.waitForFunction(() => window.cafeEconomyState.wages >= 100, null, {timeout:70000});
      await page.getByRole('button', { name: 'Take staff break' }).click();
      await page.waitForFunction(() => !window.cafeWorkflowState.onShift);
      const payroll = await page.evaluate(() => window.cafeEconomyState);
      await page.getByRole('button', { name: 'Save shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('Shift saved'));
      await page.getByRole('button', { name: 'Load shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('restored'));
      assert.deepEqual(await page.evaluate(() => window.cafeEconomyState), payroll);
      await checkMoney(1000);
      await page.getByRole('button', { name: 'Repair machine', exact:true }).click();
      await page.waitForFunction(() => window.cafeQualityState.maintenance === 2);
      assert.equal(await page.evaluate(() => window.cafeEconomyState.maintenance), 500);
      await page.getByRole('button', { name: 'Cancel maintenance' }).click();
      await page.waitForFunction(() => window.cafeQualityState.maintenance === 0);
      assert.equal(await page.evaluate(() => window.cafeEconomyState.maintenance), 0);
      await page.getByRole('button', { name: 'Clean machine', exact:true }).click();
      await page.waitForFunction(() => window.cafeQualityState.maintenance === 1);
      const queuedCare = await page.evaluate(() => window.cafeQualityState.workRemaining);
      await page.getByRole('button', { name: 'Save shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('Shift saved'));
      await page.getByRole('button', { name: 'Load shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('restored'));
      assert.equal(await page.evaluate(() => window.cafeQualityState.workRemaining), queuedCare);
      await page.getByRole('button', { name: 'Resume staff shift' }).click();
      await page.waitForFunction(() => window.cafeQualityState.maintenance === 0 && window.cafeQualityState.cleanliness === 1000, null, {timeout:30000});
      await page.getByRole('button', { name: 'Repair machine', exact:true }).click();
      await page.waitForFunction(() => window.cafeQualityState.maintenance === 2 && window.cafeQualityState.taskState === 2);
      await page.getByRole('button', { name: 'Take staff break' }).click();
      await page.waitForFunction(() => !window.cafeWorkflowState.onShift);
      const repairRemaining = await page.evaluate(() => window.cafeQualityState.workRemaining);
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => window.cafeQualityState.workRemaining), repairRemaining);
      await page.getByRole('button', { name: 'Save shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('Shift saved'));
      await page.getByRole('button', { name: 'Load shift' }).click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('restored'));
      assert.equal(await page.evaluate(() => window.cafeQualityState.workRemaining), repairRemaining);
      await page.getByRole('button', { name: 'Resume staff shift' }).click();
      await page.waitForFunction(() => window.cafeQualityState.maintenance === 0 && window.cafeQualityState.integrity === 1000, null, {timeout:30000});
      await checkMoney(1000);
      assert.equal(await page.evaluate(() => window.cafeEconomyState.maintenance), 500);
      await page.screenshot({ path: `build/evidence/${backend}-quality.png`, fullPage:true });
      await page.screenshot({ path: `build/evidence/${backend}-economy.png`, fullPage:true });
      await exerciseLayout(3);
      assert.deepEqual(errors, []);
      console.log(`${backend}: freshness expiry, waste, cleaning, paid repair/refund, interrupted maintenance restore, layout preview/move/rotate/sell/buy/restore, new-route seating/cleanup, finance and service checks passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

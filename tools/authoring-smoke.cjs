// Rendered stage-15 checks; same Playwright/environment setup as browser-smoke.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {mkdir,readFile}=require('node:fs/promises');
(async()=>{
  await mkdir('build/evidence',{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,
    args:['--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader',...(process.env.CAFE_DISABLE_WEBGPU==='1'?['--disable-blink-features=WebGPU']:[])]});
  try {
    for(const backend of ['webgl2','automatic']) {
      const page=await browser.newPage({viewport:{width:1280,height:1000},acceptDownloads:true}),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      if(process.env.CAFE_DISABLE_WEBGPU==='1')await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
      try {
        const button=name=>page.getByRole('button',{name,exact:true});
        await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}&tools=1`);
        await page.waitForFunction(()=>window.cafeInspectorState && !document.querySelector('[data-command="2"]').disabled,null,{timeout:60000});
        await button('Pause').click();await page.waitForFunction(()=>window.cafeState.paused);
        await page.locator('#authoring-panel summary').click();await page.locator('#inspector-panel summary').click();
        await button('Save shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
        const saved=await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1'));
        const expected=[{beans:4,cash:5000,guests:3,staff:true},{beans:1,cash:2500,guests:3,staff:true},{beans:100,cash:5000,guests:1,staff:true},{beans:2,cash:1200,guests:2,staff:false}];
        for(let i=0;i<expected.length;i++) {
          await page.locator('#scenario-select').selectOption(String(i));await button('Start selected scenario').click();
          await page.waitForFunction(e=>window.cafeInspectorState.report.timeMs===0 && window.cafeInspectorState.report.cashMinor===e.cash && window.cafeOccupancyState.guests===e.guests,expected[i]);
          assert.equal(await page.evaluate(()=>window.cafeDiagnosticState.stock),expected[i].beans);
          assert.equal(await page.evaluate(()=>window.cafeWorkflowState.onShift),expected[i].staff);
          assert.equal(await page.evaluate(()=>window.cafeState.paused),true);
          assert.equal(await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1')),saved);
        }
        const before=await page.evaluate(()=>window.cafeInspectorState);
        await page.evaluate(()=>{Module._cafe_scenario(-1);Module._cafe_scenario(999);});await page.waitForTimeout(300);
        assert.deepEqual(await page.evaluate(()=>window.cafeInspectorState),before);
        assert.ok((await page.locator('#action-reasons').textContent()).includes('Resume the shift'));
        await button('Resume').click();await button('Brew espresso').click();
        await page.waitForFunction(()=>window.cafeInspectorState.jobs.length===1 && window.cafeInspectorState.tasks.length===3);
        assert.ok(await page.evaluate(()=>window.cafeInspectorState.jobs[0].reason.length>0));
        await page.locator('#scenario-select').selectOption('2');await button('Start selected scenario').click();
        await page.waitForFunction(()=>window.cafeDiagnosticState.stock===100 && window.cafeInspectorState.jobs.length===0 && window.cafeInspectorState.report.admitted===1);
        await button('Brew espresso').click();await page.waitForFunction(()=>window.cafeState.ready,null,{timeout:60000});
        await button('Serve ticket').click();await page.waitForFunction(()=>window.cafeState.served===1);
        await button('Pause').click();await page.waitForFunction(()=>window.cafeState.paused);
        const snapshot=await page.evaluate(()=>window.cafeInspectorState);
        const [download]=await Promise.all([page.waitForEvent('download'),button('Export shift report').click()]);
        const exported=JSON.parse(await readFile(await download.path(),'utf8'));assert.deepEqual(exported,snapshot);
        assert.equal(exported.report.schema,1);assert.equal(exported.report.served,1);assert.equal(exported.stocks.length,21);
        assert.deepEqual(await page.evaluate(()=>window.cafeInspectorState),snapshot);
        await button('Load shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent.includes('restored'));
        assert.equal(await page.evaluate(()=>window.cafeState.served),0);
        assert.equal(await page.evaluate(()=>window.cafeDiagnosticState.stock),4);
        assert.deepEqual(errors,[]);
        await page.screenshot({path:`build/evidence/authoring-${backend}.png`,fullPage:true});
        console.log(`${backend}: presets, paused reset, invalid index, active reset, inspectors, service, download and original save passed`);
      } catch(error) {
        await page.screenshot({path:`build/evidence/authoring-${backend}-failure.png`,fullPage:true});throw error;
      } finally {await page.close();}
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

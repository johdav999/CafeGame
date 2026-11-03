const {chromium}=require('playwright');
const {readFile,mkdir}=require('node:fs/promises');
const assert=require('node:assert/strict');
(async()=>{
  const fixture=(await readFile('tests/fixtures/schema8.hpp','utf8')).match(/"([0-9a-f]+)"/g).map(s=>s.slice(1,-1)).join('');
  const legacy=Buffer.from(fixture,'hex').toString('base64');await mkdir('build/evidence',{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,args:['--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader',...(process.env.CAFE_DISABLE_WEBGPU==='1'?['--disable-blink-features=WebGPU']:[])]});
  try {
    for(const backend of ['webgl2','automatic']) {
      const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
      if(process.env.CAFE_DISABLE_WEBGPU==='1')await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
      try {
        const button=name=>page.getByRole('button',{name,exact:true});
        await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}&tools=1`);
        await page.waitForFunction(()=>window.cafeInspectorState && !document.querySelector('[data-command="2"]').disabled,null,{timeout:60000});
        await button('Pause').click();await page.waitForFunction(()=>window.cafeState.paused);
        const before=await page.evaluate(()=>window.cafeInspectorState);
        await page.evaluate(data=>localStorage.setItem('cafegame.shift.v1',data),legacy);await button('Load shift').click();
        await page.waitForFunction(()=>document.getElementById('save-status').textContent.includes('different content version'));
        assert.deepEqual(await page.evaluate(()=>window.cafeInspectorState),before);
        assert.equal(await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1')),legacy);
        await button('Save shift').click();await page.waitForFunction(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
        const saved=await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1'));
        const snapshot=await page.evaluate(()=>window.cafeInspectorState);assert.equal(snapshot.report.saveSchema,15);assert.equal(snapshot.report.contentVersion,5);
        for(const [kind,message] of [['version','different content version'],['fingerprint','different game rules'],['schema','unsupported format']]) {
          await page.evaluate(({saved,kind})=>{
            const data=Uint8Array.from(atob(saved),c=>c.charCodeAt(0)),view=new DataView(data.buffer);
            if(kind==='version')view.setBigUint64(data.length-16,99n,true);
            if(kind==='fingerprint')data[data.length-1]^=1;
            if(kind==='schema')view.setBigUint64(8,15n,true);
            let text='';for(const c of data)text+=String.fromCharCode(c);localStorage.setItem('cafegame.shift.v1',btoa(text));
          },{saved,kind});
          await button('Load shift').click();await page.waitForFunction(message=>document.getElementById('save-status').textContent.includes(message),message);
          assert.deepEqual(await page.evaluate(()=>window.cafeInspectorState),snapshot);
        }
        await page.evaluate(saved=>localStorage.setItem('cafegame.shift.v1',saved),saved);await button('Load shift').click();
        await page.waitForFunction(()=>document.getElementById('save-status').textContent==='Saved shift restored.');
        await button('Resume').click();await button('Brew espresso').click();await page.waitForFunction(()=>window.cafeState.ready,null,{timeout:60000});await button('Serve ticket').click();
        await page.waitForFunction(()=>window.cafeState.served===1);assert.equal(await page.evaluate(()=>window.cafeEconomyState.cash),5500);
        assert.notDeepEqual(await page.evaluate(()=>window.cafeInspectorState),before);assert.deepEqual(errors,[]);
        await page.locator('#inspector-panel summary').click();await page.screenshot({path:`build/evidence/compatibility-${backend}.png`,fullPage:true});
        console.log(`${backend}: genuine schema-8 rejection, current save roundtrip, mismatch/future rejection, atomic preservation and service passed`);
      } finally {await page.close();}
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

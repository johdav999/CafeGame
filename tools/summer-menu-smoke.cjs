const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {spawn}=require('node:child_process');
(async()=>{
 const directory='build/evidence/garden-summer-browser';await fs.mkdir(directory,{recursive:true});
 let server,browser;const reports=[];
 try{
  const url=process.env.CAFE_URL||'http://127.0.0.1:4191';
  if(process.env.CAFE_START_SERVER==='1'){
   server=spawn(process.execPath,['tools/serve.mjs'],{env:{...process.env,PORT:'4191'},stdio:'ignore',windowsHide:true});
   let ready=false;for(let n=0;n<30&&!ready;n++){try{ready=(await fetch(url)).ok;}catch{}if(!ready)await new Promise(r=>setTimeout(r,200));}assert.ok(ready);
  }
  browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const backend of ['webgl2','automatic']){
   const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],stages=[];
   page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
   await page.addInitScript(()=>Object.defineProperty(window,'devicePixelRatio',{value:.5,configurable:true}));
   const wait=(fn,arg,timeout=180000)=>page.waitForFunction(fn,arg,{timeout,polling:50}).catch(async e=>{
    console.error(JSON.stringify(await page.evaluate(()=>({error:window.cafeHostError,state:window.cafeState,economy:window.cafeEconomyState,supply:window.cafeSupplyState,selected:document.getElementById('supply-ingredient').value,buttonDisabled:document.getElementById('ingredient-order').disabled,menu:window.cafeMenuState,staff:window.cafeStaffState,save:document.getElementById('save-status').textContent}))));
    await page.screenshot({path:`${directory}/${backend}-failure.png`});throw e;
   });
   await page.goto(`${url}/?backend=${backend}`);await wait(()=>window.cafeAssetsReady&&window.cafeGardenState);
   const owned=process.env.CAFE_GARDEN_OWNED!=='0';assert.equal(await page.evaluate(()=>cafeGardenState.owned),owned);
   if(!owned){
    await page.evaluate(()=>Module._cafe_command(2));await wait(()=>cafeState.paused);
    const before=await page.evaluate(()=>({served:cafeState.served,cash:cafeEconomyState.cash,tickets:cafeMenuState.tickets}));
    const bytes=(await fs.readFile('build/evidence/garden-g4/mixed-cold.save')).toString('base64');
    await page.evaluate(bytes=>{localStorage.setItem('cafegame.shift.v1',bytes);Module._cafe_command(4);},bytes);
    await wait(()=>document.getElementById('save-status').textContent.includes('requires installed and owned'));
    assert.deepEqual(await page.evaluate(()=>({served:cafeState.served,cash:cafeEconomyState.cash,tickets:cafeMenuState.tickets})),before);
    assert.equal(await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1')),bytes);
    assert.deepEqual(errors,[]);reports.push({backend,owned:false,preserved:true,errors});await page.close();continue;
   }
   await page.evaluate(()=>document.getElementById('garden-workshop').click());
   await wait(()=>cafeMenuState.summer&&cafeEquipmentState.catalog[7].owned);
   assert.equal(await page.evaluate(()=>cafeEconomyState.cash),96000);
   assert.equal(await page.evaluate(()=>document.querySelectorAll('#supply-ingredient option:not([hidden])').length),8);
   const select=async(id,value)=>page.evaluate(({id,value})=>{const field=document.getElementById(id);field.value=String(value);field.dispatchEvent(new Event('change',{bubbles:true}));},{id,value});
   const snapshot=async stage=>{
    await page.evaluate(()=>Module._cafe_command(2));await wait(()=>cafeState.paused);
    const before=await page.evaluate(()=>({served:cafeState.served,sales:cafeEconomyState.sales,tickets:cafeMenuState.tickets}));
    await page.evaluate(()=>{document.getElementById('save-status').textContent='Saving summer';Module._cafe_command(3);});
    await wait(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
    const bytes=await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1'));
    await page.evaluate(()=>{document.getElementById('save-status').textContent='Restoring summer';Module._cafe_command(4);});
    await wait(()=>document.getElementById('save-status').textContent.startsWith('Saved shift restored'));
    assert.deepEqual(await page.evaluate(()=>({served:cafeState.served,sales:cafeEconomyState.sales,tickets:cafeMenuState.tickets})),before);
    assert.equal(await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1')),bytes);stages.push(stage);console.log(`${backend}: restored ${stage}`);
    await page.evaluate(()=>Module._cafe_command(2));await wait(()=>!cafeState.paused);
   };
   // Use normal supply controls, including reserved delivery and refund.
   for(const n of [5,6,7]){
    await select('supply-ingredient',n);
    console.log(`${backend}: order ingredient ${n}`);
    await wait(()=>!document.getElementById('ingredient-order').disabled,undefined,15000);
    await page.evaluate(()=>document.getElementById('ingredient-order').click());await wait(()=>cafeSupplyState.pending,undefined,15000);
    if(n===5){await snapshot('ice delivery');await page.evaluate(()=>document.querySelector('[data-command="11"]').click());await wait(()=>!cafeSupplyState.pending);assert.equal(await page.evaluate(()=>cafeEconomyState.cash+cafeEconomyState.wages),96000);await page.evaluate(()=>document.getElementById('ingredient-order').click());await wait(()=>cafeSupplyState.pending);}
    await wait(n=>!cafeSupplyState.pending&&cafeMenuState.ingredients[n].stored===12,n);
    await page.evaluate(()=>document.getElementById('ingredient-restock').click());
    await wait(n=>cafeMenuState.ingredients[n].stored===8&&!cafeMenuState.ingredients[n].restocking,n);
   }
   assert.equal(await page.evaluate(()=>cafeEconomyState.supplies),4200);
   assert.equal(await page.evaluate(()=>cafeEconomyState.cash+cafeEconomyState.wages),91800);
   await snapshot('summer stock restocked');
   await page.evaluate(()=>document.querySelector('[data-command="15"]').click());
   await wait(()=>!cafeLayoutState.closed);
   const serve=async(first,second,sales)=>{
    await select('guest-profile',1);await select('guest-first',first);await select('guest-second',second);
    await wait(()=>!document.querySelector('[data-command="6"]').disabled);
    await page.evaluate(()=>document.querySelector('[data-command="6"]').click());
    await wait(first=>cafeMenuState.next===first&&!document.querySelector(`[data-product="${first}"]`).disabled,first);
    await page.evaluate(first=>document.querySelector(`[data-product="${first}"]`).click(),first);
    if(first===5){
     await wait(()=>cafeMenuState.tickets.some(t=>t.items.some(i=>i.status==='Brew espresso shot')));await snapshot('iced coffee espresso step');
     await wait(()=>cafeStaffState.staff.some(s=>s.reason.includes('Cold-preparation')));await snapshot('exclusive cold station');
    }
    await wait(()=>cafeState.ready);await snapshot(`${first} ready`);
    if(first===5){await page.screenshot({path:`${directory}/${backend}-mixed-ready.png`});}
    await wait(()=>!document.querySelector('[data-command="1"]').disabled);
    await page.evaluate(()=>document.querySelector('[data-command="1"]').click());await wait(sales=>cafeEconomyState.sales===sales,sales);
    assert.equal(await page.evaluate(()=>cafeMenuState.tickets.filter(t=>t.paid).length),1);
    await wait(()=>cafeMenuState.tickets.length===0);
   };
   await serve(5,7,1300);await serve(6,-1,1950);await serve(7,-1,2500);
   assert.equal(await page.evaluate(()=>cafeState.served),3);
   await page.screenshot({path:`${directory}/${backend}-summer.png`});
   await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:`${directory}/${backend}-narrow.png`});
   await page.evaluate(()=>document.querySelector('[data-command="15"]').click());await snapshot('closed and drained');
   assert.deepEqual(errors,[]);reports.push({backend,renderer:await page.locator('#status').textContent(),stages,served:3,sales:2500,errors});
   console.log(`${backend}: summer supply, recipes, single settlement and restore passed`);await page.close();
  }
  await fs.writeFile(`${directory}/${process.env.CAFE_GARDEN_OWNED==='0'?'unavailable':'report'}.json`,JSON.stringify(reports,null,2));
 }finally{await browser?.close();server?.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});

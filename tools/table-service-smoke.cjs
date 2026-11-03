const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const executablePath=process.env.BROWSER_EXECUTABLE||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p=>fs.existsSync(p));
 const browser=await chromium.launch({executablePath,headless:true,args:['--no-proxy-server',...(process.env.CAFE_SOFTWARE_RENDERING==='1'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[])]});
 const reports=[];
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const wait=fn=>page.waitForFunction(fn,null,{timeout:90000}).catch(async e=>{
   console.error(await page.evaluate(()=>({tickets:window.cafeMenuState?.tickets,hostError:window.cafeHostError,staff:window.cafeStaffAnimations,status:document.getElementById('status')?.textContent})));
   await page.screenshot({path:'build/evidence/table-service-failure.png'});throw e;
  });
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`);
  await wait(()=>window.cafeAssetsReady && window.cafeRenderMeasurements?.frames>10);
  await page.evaluate(()=>Module._cafe_scenario(2));
  await wait(()=>window.cafeMenuState?.tickets.length===1 && window.cafeMenuState.ingredients[0].stock===100);
  await page.evaluate(()=>Module._cafe_guest(0,0,-1));
  await wait(()=>window.cafeMenuState.tickets.length===2 && window.cafeMenuState.tickets.every(t=>t.service==='Waiting to order'));
  const ids=await page.evaluate(()=>window.cafeMenuState.tickets.map(t=>t.guest));
  async function badge(id){await page.locator(`.customer-badge[data-guest="${id}"]`).click();}
  await badge(ids[1]);
  await wait(()=>window.cafeStaffAnimations.some(a=>a.clip==='Walking'));
  await page.waitForFunction(id=>window.cafeMenuState.tickets.find(t=>t.guest===id)?.taken,ids[1]);
  await badge(ids[0]);
  await wait(()=>window.cafeMenuState.tickets.every(t=>t.taken));
  assert.equal(await page.evaluate(()=>window.cafeMenuState.tickets.filter(t=>t.service==='Preparing').length),0);
  await wait(()=>document.querySelectorAll('.prepare-order:not(:disabled)').length===2);
  for(const id of ids)assert.match(await page.locator(`.customer-badge[data-guest="${id}"] img`).getAttribute('src'),/service-waiting.webp$/);
  await page.locator(`.prepare-order[data-guest="${ids[1]}"]`).click();
  await page.waitForFunction(id=>window.cafeMenuState.tickets.find(t=>t.guest===id)?.service==='Preparing',ids[1]);
  await wait(()=>document.querySelectorAll('.prepare-order:not(:disabled)').length===0);
  await page.waitForFunction(id=>window.cafeMenuState.tickets.find(t=>t.guest===id)?.service==='Ready to serve',ids[1],{timeout:60000});
  await page.locator(`.prepare-order[data-guest="${ids[0]}"]`).click();
  await wait(()=>window.cafeMenuState.tickets.every(t=>t.service==='Ready to serve'));
  await wait(()=>document.querySelectorAll('.serve-order:not(:disabled)').length===2);
  await page.evaluate(()=>Module._cafe_command(2));
  await wait(()=>window.cafeState.paused && document.querySelectorAll('.serve-order:disabled').length===2);
  await page.evaluate(()=>Module._cafe_command(2));
  await wait(()=>!window.cafeState.paused && document.querySelectorAll('.serve-order:not(:disabled)').length===2);
  await page.evaluate(()=>Module._cafe_command(3));
  await wait(()=>document.getElementById('save-status').textContent.includes('saved'));
  await page.evaluate(()=>Module._cafe_command(4));
  await wait(()=>document.getElementById('save-status').textContent.includes('restored'));
  await wait(()=>window.cafeMenuState.tickets.every(t=>t.service==='Ready to serve'));
  fs.mkdirSync('build/evidence',{recursive:true});
  await page.screenshot({path:`build/evidence/table-service-ready-${backend}.png`});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`build/evidence/table-service-ready-mobile-${backend}.png`});
  await page.setViewportSize({width:1440,height:1000});
  await page.locator(`.serve-order[data-guest="${ids[1]}"]`).click(); // Choose the second ready customer.
  await wait(()=>window.cafeState.served===1);
  assert.equal(await page.evaluate(id=>window.cafeMenuState.tickets.find(t=>t.guest===id).paid,ids[1]),1);
  assert.equal(await page.evaluate(id=>window.cafeMenuState.tickets.find(t=>t.guest===id).paid,ids[0]),0);
  assert.equal(await page.locator(`.serve-order[data-guest="${ids[1]}"]`).count(),0);
  await page.locator(`.serve-order[data-guest="${ids[0]}"]`).click();
  await wait(()=>window.cafeState.served===2);
  await wait(()=>document.querySelectorAll('.serve-order').length===0);
  assert.deepEqual(errors,[]);
  reports.push({backend,served:2,stacked:true,chosenDelivery:true,pause:true,mobileLayout:true,saveLoad:true,errors});
  await page.close();
 }}finally{await browser.close();}
 fs.writeFileSync('build/evidence/table-service.json',JSON.stringify(reports,null,2));
 console.log('Table-service walking, badges, stacked orders, chosen delivery and save/load passed on both backends');
})().catch(e=>{console.error(e);process.exitCode=1;});

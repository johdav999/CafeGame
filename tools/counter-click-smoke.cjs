const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const executablePath=process.env.BROWSER_EXECUTABLE||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p=>fs.existsSync(p));
 const browser=await chromium.launch({executablePath,headless:true,args:['--no-proxy-server',...(process.env.CAFE_SOFTWARE_RENDERING==='1'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[])]});
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const wait=fn=>page.waitForFunction(fn,null,{timeout:90000});
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`);
  await wait(()=>window.cafeAssetsReady && window.cafeRenderMeasurements?.frames>10);
  console.log(`${backend}: scene ready`);
  await page.evaluate(()=>Module._cafe_scenario(4));
  await wait(()=>window.cafeLayoutState.closed && !window.cafeMenuState.tickets.length);
  await page.evaluate(()=>Module._cafe_command(15));
  await wait(()=>!window.cafeLayoutState.closed);
  const targets=await page.evaluate(()=>{
   const canvas=document.getElementById('viewport'),r=canvas.getBoundingClientRect(),found={};
   for(let y=.15;y<.8;y+=.025)for(let x=.15;x<.85;x+=.025){
    const px=r.left+x*r.width,py=r.top+y*r.height;
    if(document.elementFromPoint(px,py)!==canvas)continue;
    const hit=Module._cafe_service_pick(x,y,r.width/r.height);
    if(hit && !found[hit])found[hit]={x:px,y:py};
    if(found[1] && found[2])return found;
   }
   return found;
  });
  assert.ok(targets[1],'Counter is pickable');assert.ok(targets[2],'Machine is pickable');
  console.log(`${backend}: visible counter and machine found`);
  for(const id of [1,2]){
   await page.mouse.move(targets[id].x,targets[id].y);
   await wait(()=>getComputedStyle(document.getElementById('viewport')).cursor==='grab');
  }
  await page.mouse.move(0,0);
  await wait(()=>!document.getElementById('viewport').classList.contains('service-hover'));
  const click=async id=>page.mouse.click(targets[id].x,targets[id].y);
  const idle=async()=>assert.equal(await page.evaluate(()=>window.cafeState.ready || window.cafeState.brewing>0),false);
  await click(1);await click(2);await page.waitForTimeout(200);await idle();
  assert.equal(await page.evaluate(()=>window.cafeMenuState.tickets.length),0,'Empty clicks do not admit guests');
  await page.evaluate(()=>{Module._cafe_guest(1,3,4);Module._cafe_guest(1,0,-1);});
  await wait(()=>window.cafeMenuState.tickets.length===2);
  const first=await page.evaluate(()=>window.cafeMenuState.tickets[0].guest);
  await page.evaluate(()=>Module._cafe_command(2));await wait(()=>window.cafeState.paused);
  await click(2);await page.waitForTimeout(150);await idle();
  await wait(()=>!document.getElementById('viewport').classList.contains('service-hover'));
  await page.evaluate(()=>Module._cafe_command(2));await wait(()=>!window.cafeState.paused);
  for(const mode of ['build','menu']){
   await page.locator(`#${mode}-tab`).click();await click(1);await page.waitForTimeout(150);await idle();
   await wait(()=>!document.getElementById('viewport').classList.contains('service-hover'));
  }
  await page.locator('#serve-tab').click();
  await page.mouse.move(targets[2].x,targets[2].y);await page.mouse.down();
  await page.locator('#viewport').dispatchEvent('pointercancel');await page.mouse.up();
  await page.waitForTimeout(150);await idle();
  await page.keyboard.down('Shift');await click(2);await page.keyboard.up('Shift');await page.waitForTimeout(150);await idle();
  await page.mouse.move(targets[2].x,targets[2].y);await page.mouse.down();
  await page.mouse.move(targets[2].x+30,targets[2].y+20,{steps:5});await page.mouse.up();
  await page.waitForTimeout(150);await idle();
  await page.evaluate(()=>Module._cafe_camera(0,0,0));await page.waitForTimeout(150);
  await click(2);
  console.log(`${backend}: preparing first ticket`);
  await wait(()=>window.cafeMenuState.tickets.some(t=>t.service==='Preparing'));
  assert.equal(await page.evaluate(()=>window.cafeMenuState.tickets.find(t=>t.service==='Preparing').guest),first,'Machine prepares the front ticket');
  await click(1);
  await wait(()=>window.cafeState.ready);
  assert.equal(await page.evaluate(()=>window.cafeMenuState.tickets.find(t=>t.service==='Ready to serve').guest),first);
  await wait(()=>!document.querySelector('[data-command="1"]').disabled);
  await page.locator(`.serve-order[data-guest="${first}"]`).click();
  await wait(()=>window.cafeState.served===1);
  await page.touchscreen.tap(targets[1].x,targets[1].y);await wait(()=>window.cafeState.brewing>0 || window.cafeState.ready);
  await wait(()=>window.cafeState.ready);
  assert.equal(await page.evaluate(()=>window.cafeState.served),1,'Counter prepares without serving');
  assert.deepEqual(errors,[]);
  console.log(`${backend}: counter/machine picking, FIFO mixed ticket, empty queue, pause, mode, Shift, drag and active-ticket guards passed`);
  await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

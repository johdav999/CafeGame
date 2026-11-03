const {chromium}=require('playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report=[];
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4173/?backend='+backend);
  await page.waitForFunction(()=>window.cafeClockState&&window.cafeEquipmentState&&window.cafeAssetsReady,null,{timeout:120000});
  const load=async file=>{
   const data=(await fs.readFile(file)).toString('base64');
   await page.evaluate(data=>{localStorage.setItem('cafegame.shift.v1',data);document.getElementById('save-status').textContent='Loading room fixture';Module._cafe_command(4);},data);
   await page.waitForFunction(()=>document.getElementById('save-status').textContent.startsWith('Saved shift restored'),null,{timeout:60000});
  };
  await load('build/evidence/progression-fixtures/three-fragmented.bin');
  await page.locator('#build-tab').click();await page.waitForFunction(()=>cafeLayoutState.editable);
  const before=await page.evaluate(()=>({cash:cafeEconomyState.cash,decor:cafeLayoutState.tables.filter(p=>p.id>4)}));
  assert.equal(await page.evaluate(()=>cafeLayoutState.tables.filter(p=>p.id<=4).length),3);
  await page.locator('#arrange-tables').click();
  await page.waitForFunction(()=>cafeLayoutState.message.startsWith('Tables arranged free.'));
  assert.equal(await page.evaluate(()=>cafeEconomyState.cash),before.cash);
  assert.deepEqual(await page.evaluate(()=>cafeLayoutState.tables.filter(p=>p.id>4)),before.decor);
  assert.equal(await page.evaluate(()=>cafeLayoutState.tables.filter(p=>p.id<=4).length),3);
  await page.waitForFunction(()=>document.querySelector('[data-place-item="4"]').getAttribute('aria-pressed')==='true');
  const item=page.locator('[data-place-item="4"]');await item.scrollIntoViewIfNeeded();const r=await item.boundingBox();
  const target=await page.evaluate(()=>{
   const c=document.getElementById('viewport'),r=c.getBoundingClientRect();
   for(let y=10;y<r.height;y+=5)for(let x=10;x<r.width;x+=5){
    if(document.elementFromPoint(r.left+x,r.top+y)!==c)continue;
    const cell=Module._cafe_floor_pick(x/r.width,y/r.height,r.width/r.height);if(cell<0)continue;
    const wx=(cell%24-2)*.5-6,wz=(Math.floor(cell/24)-4)*.5-5;
    if(Module._cafe_layout_preview(4,wx,wz,0)===0)return{x:r.left+x,y:r.top+y};
   }return null;
  });
  assert.ok(target,'The fourth table must have a visible valid position');
  await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:15});
  await page.waitForFunction(()=>document.getElementById('placement-label').dataset.valid==='true');
  await page.screenshot({path:'build/evidence/table-room-'+backend+'-guide.png'});
  await page.mouse.up();await page.waitForFunction(()=>cafeLayoutState.tables.filter(p=>p.id<=4).length===4);
  assert.equal(await page.evaluate(()=>cafeEconomyState.cash),before.cash-600);
  await page.evaluate(()=>Module._cafe_command(3));await page.waitForFunction(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
  await page.evaluate(()=>Module._cafe_command(4));await page.waitForFunction(()=>document.getElementById('save-status').textContent.startsWith('Saved shift restored'));
  assert.equal(await page.evaluate(()=>cafeLayoutState.tables.filter(p=>p.id<=4).length),4);
  await page.mouse.move(1025,950);await page.screenshot({path:'build/evidence/table-room-'+backend+'-four-tables.png'});
  await page.setViewportSize({width:390,height:844});await page.locator('#arrange-tables').scrollIntoViewIfNeeded();
  assert.ok(await page.locator('#arrange-tables').isVisible());assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'build/evidence/table-room-'+backend+'-mobile.png'});
  await load('build/evidence/table-room-previous15.bin');assert.ok(await page.evaluate(()=>cafeLayoutState.tables.filter(p=>p.id<=4).length===3));
  assert.deepEqual(errors,[]);report.push({backend,arrangeFree:true,decorPreserved:true,fourthTableDrag:true,saveLoad:true,previousRules15:true,mobile:true,errors});
  console.log(backend+': free arrangement, decor, fourth-table drag, save/load, migration and mobile passed');
  await page.close();
 }}finally{await fs.writeFile('build/evidence/table-room-browser.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});

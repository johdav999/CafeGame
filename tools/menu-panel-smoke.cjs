const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined,args:['--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report=[];
 await fs.mkdir('build/evidence/menu-panel',{recursive:true});
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  await page.addInitScript(()=>Object.defineProperty(window,'devicePixelRatio',{value:.5,configurable:true}));
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`);
  await page.waitForFunction(()=>window.cafeState && !document.querySelector('[data-command="3"]').disabled,null,{timeout:90000});
  await page.locator('#menu-tab').click();
  await page.locator('.menu-banner').evaluate(img=>img.decode());
  console.log(`${backend}: menu ready`);
  await page.screenshot({path:`build/evidence/menu-panel/${backend}-desktop.png`});
  await page.locator('[data-command="3"]').click();
  await page.waitForFunction(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
  const saved=await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1'));
  for(const [name,id] of [['Your team','staff-panel'],['Finances','finance-panel'],['Preferences','settings-panel'],['Advanced','developer-panel']]){
   await page.getByRole('navigation',{name:'Menu sections'}).getByRole('link',{name,exact:true}).click();
   await page.locator(`#${id}>summary`).click();
   assert.equal(await page.locator(`#${id}`).getAttribute('open'),'');
  }
  await page.locator('#audio-muted').check();
  await page.locator('#ui-size').selectOption('1.3');
  await page.locator('#reduced-motion').check();
  assert.equal(await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1')),saved);
  console.log(`${backend}: section links and preferences passed`);
  for(const size of [{width:1440,height:1000},{width:768,height:1024},{width:390,height:844}]){
   await page.setViewportSize(size);
   await page.getByRole('navigation',{name:'Menu sections'}).getByRole('link',{name:'Preferences',exact:true}).click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const overflow=await page.locator('#menu-view').evaluate(el=>el.scrollWidth>el.clientWidth+1);
   assert.equal(overflow,false,`Menu overflow at ${size.width}`);
   await page.screenshot({path:`build/evidence/menu-panel/${backend}-${size.width}-preferences.png`});
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#menu-tab').click();
  await page.locator('[data-command="4"]').click();
  await page.waitForFunction(()=>document.getElementById('save-status').textContent.startsWith('Saved shift restored'));
  console.log(`${backend}: layouts and save/load passed`);
  await page.reload();
  await page.waitForFunction(()=>window.cafeState && !document.querySelector('[data-command="3"]').disabled);
  await page.locator('#menu-tab').click();
  await page.getByRole('navigation',{name:'Menu sections'}).getByRole('link',{name:'Preferences',exact:true}).click();
  await page.locator('#settings-panel>summary').click();
  assert.equal(await page.locator('#ui-size').inputValue(),'1.3');
  assert.equal(await page.locator('#reduced-motion').isChecked(),true);
  assert.deepEqual(errors,[]);
  report.push({backend,saveLoad:true,preferences:true,responsive:true,errors});
  await page.close();
 }}finally{await browser.close();await fs.writeFile('build/evidence/menu-panel/report.json',JSON.stringify(report,null,2));}
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});

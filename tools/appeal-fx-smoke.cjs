const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--no-proxy-server']});
 const reports=[];fs.mkdirSync('build/evidence/appeal-fx',{recursive:true});
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`);
  await page.waitForFunction(()=>window.cafeAssetsReady && window.cafeInspectorState?.report);
  // A real replacement must suppress feedback; direct API calls are covered too.
  await page.evaluate(()=>{window.replacements=0;addEventListener('cafe-session-replaced',()=>window.replacements++);Module._cafe_scenario(2);});
  await page.waitForFunction(()=>window.replacements>0);
  // Freeze the renderer and drive its existing presentation callback deterministically.
  await page.evaluate(()=>{Module._cafe_shutdown();window.score=n=>{const s=structuredClone(window.cafeInspectorState);s.report.attractiveness=n;window.cafeInspector(JSON.stringify(s));};dispatchEvent(new Event('cafe-session-replaced'));score(40);});
  assert.equal(await page.locator('.appeal-fx').isVisible(),false);
  await page.evaluate(()=>{score(45);window.firstBounce=document.querySelector('#attractiveness .imagegen-icon').getAnimations()[0];});await page.waitForTimeout(160);
  assert.ok(Number(await page.locator('#attractiveness-value').textContent())>40);
  await page.evaluate(()=>score(50));
  assert.equal(await page.locator('.appeal-gain').textContent(),'+10');
  assert.equal(await page.locator('.appeal-halo').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.querySelector('#attractiveness .imagegen-icon').getAnimations()[0]===window.firstBounce),true,'rapid gains must not restart the bounce');
  const visibleFx=await page.evaluate(()=>{
   const root=document.querySelector('#attractiveness');
   for(const a of root.getAnimations({subtree:true})){a.pause();a.currentTime=250;}
   const info=selector=>{const e=root.querySelector(selector),s=getComputedStyle(e),b=e.getBoundingClientRect();return {transform:s.transform,opacity:Number(s.opacity),width:b.width,height:b.height,color:s.color,borderImage:s.borderImageSource};};
   return {icon:info('.imagegen-icon'),value:info('strong'),sparkle:info('.appeal-sparkle'),gain:info('.appeal-gain')};
  });
  assert.notEqual(visibleFx.icon.transform,'none');assert.notEqual(visibleFx.value.transform,'none');
  assert.ok(Number(visibleFx.icon.transform.split(',').at(-1).replace(')','')) < -4,'heart must visibly lift at the sampled frame');
  assert.ok(visibleFx.sparkle.opacity>.8 && visibleFx.sparkle.width>=24);
  assert.ok(visibleFx.gain.opacity>.8 && visibleFx.gain.height>=30 && visibleFx.gain.borderImage.includes('panel.webp'));
  await page.screenshot({path:`build/evidence/appeal-fx/${backend}-milestone.png`});
  await page.waitForTimeout(1600);assert.equal(await page.locator('#attractiveness-value').textContent(),'50');assert.equal(await page.locator('.appeal-fx').isVisible(),false);
  await page.evaluate(()=>score(49));assert.equal(await page.locator('.appeal-fx').isVisible(),false);
  await page.evaluate(()=>{dispatchEvent(new Event('cafe-session-replaced'));score(80);});assert.equal(await page.locator('.appeal-fx').isVisible(),false);
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>score(85));
  assert.equal(await page.locator('#attractiveness-value').textContent(),'85');assert.equal(await page.locator('.appeal-gain').textContent(),'+5');
  assert.equal(await page.evaluate(()=>document.querySelector('#attractiveness').getAnimations({subtree:true}).length),0);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>document.body.classList.add('reduce-motion'));await page.evaluate(()=>score(90));
  assert.equal(await page.locator('#attractiveness-value').textContent(),'90');assert.equal(await page.locator('.appeal-halo').isVisible(),false);
  await page.evaluate(()=>document.body.classList.remove('reduce-motion'));await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{score(100);for(const a of document.querySelector('#attractiveness').getAnimations({subtree:true})){a.pause();a.currentTime=250;}});
  await page.screenshot({path:`build/evidence/appeal-fx/${backend}-mobile.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#attractiveness summary').click();assert.equal(await page.locator('.attractiveness-breakdown').isVisible(),true);
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('.appeal-fx img')].every(i=>i.complete && i.naturalWidth>0)));
  assert.deepEqual(errors,[]);reports.push({backend,passed:true,visibleFx,errors});await page.close();
 }}finally{await browser.close();}
 fs.writeFileSync('build/evidence/appeal-fx/report.json',JSON.stringify(reports,null,2));console.log(reports);
})().catch(e=>{console.error(e);process.exitCode=1;});

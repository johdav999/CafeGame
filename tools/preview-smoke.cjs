const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const site = path.resolve(process.env.CAFE_SITE_DIR || 'build/browser/site');
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.webp':'image/webp'};
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.BROWSER_EXECUTABLE || undefined,
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-proxy-server']});
  await fs.mkdir('build/evidence/preview', {recursive:true});
  try {
    for (const backend of ['webgl2','automatic']) {
      const page = await browser.newPage({viewport:{width:1280,height:800}}), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://cafe.test/**', async route => {
        const url = new URL(route.request().url());
        const file = path.resolve(site, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
        if (!file.startsWith(site + path.sep)) return route.fulfill({status:403,body:''});
        try { await route.fulfill({body:await fs.readFile(file),contentType:types[path.extname(file)] || 'application/octet-stream'}); }
        catch { await route.fulfill({status:404,body:'Missing staged file'}); }
      });
      await page.goto(`https://cafe.test/preview.html?backend=${backend}&tools=1`);
      const frame = await page.locator('#preview-game').contentFrame();
      await frame.locator('#play-shell').waitFor();
      await frame.locator('[data-command="3"]').waitFor({state:'attached'});
      await page.waitForFunction(() => {
        const game = document.getElementById('preview-game').contentWindow;
        return game.cafeAssetsReady && game.cafeDevice && game.cafeState && !game.document.querySelector('[data-command="3"]').disabled;
      }, null, {timeout:90000});
      const state = await frame.locator('body').evaluate(() => ({
        width:innerWidth,height:innerHeight,device:window.cafeDevice,
        prompt:!!document.getElementById('landscape-prompt'),
        safe:getComputedStyle(document.documentElement).getPropertyValue('--game-safe-left'),
        canvas:document.getElementById('viewport').getBoundingClientRect().toJSON(),
        backend:new URLSearchParams(location.search).get('backend'),
        tools:new URLSearchParams(location.search).get('tools')
      }));
      assert.equal(state.width,852); assert.equal(state.height,393);
      assert.equal(state.device.type,'phone'); assert.equal(state.device.preview,'iphone16');
      assert.equal(state.device.orientation,'landscape'); assert.equal(state.prompt,false);
      assert.equal(state.safe,'59px'); assert.equal(state.canvas.x,59);
      assert.equal(state.backend,backend); assert.equal(state.tools,null);
      // Check real projected character envelopes while customers move and the camera changes.
      await frame.locator('body').evaluate(() => {
        const previous=window.cafeWorldPins;
        window.cafeWorldPins=json=>{previous(json);window.badgeTestPins=JSON.parse(json);};
      });
      for(const camera of [[0,0,0],[3,-2,0],[1,.5,.12]]){
        await frame.locator('body').evaluate((node,args)=>{window.badgeTestPins=null;Module._cafe_camera(...args);},camera);
        await page.waitForFunction(()=>document.getElementById('preview-game').contentWindow.badgeTestPins?.some(p=>p.length===8));
        const geometry=await frame.locator('body').evaluate(()=>{
          const scene=document.querySelector('.game').getBoundingClientRect();
          return {pins:window.badgeTestPins.filter(p=>p[3]),badges:[...document.querySelectorAll('.customer-badge:not([hidden])')].map(b=>{
            const r=b.getBoundingClientRect();return {x:r.x-scene.x,y:r.y-scene.y,w:r.width,h:r.height};
          })};
        });
        assert(geometry.badges.length>0,'keep customer actions visible');
        for(const b of geometry.badges){
          assert.equal(b.w,72);assert.equal(b.h,44);
          for(const p of geometry.pins)assert(!(b.x<p[6] && b.x+b.w>p[4] && b.y<p[7] && b.y+b.h>p[5]),'mobile badge obscures a character');
        }
      }
      await frame.locator('body').evaluate(()=>Module._cafe_camera(0,0,0));
      await frame.locator('#menu-tab').click();
      await frame.locator('#menu-view').waitFor({state:'visible'});
      await page.locator('#preview-safe').uncheck();
      assert.equal(await frame.locator('#viewport').evaluate(node => node.getBoundingClientRect().x),0);
      await page.locator('#preview-safe').check();
      await frame.locator('#serve-tab').click();
      await page.mouse.move(10,10);
      await page.screenshot({path:`build/evidence/preview/${backend}-desktop.png`});
      await page.setViewportSize({width:650,height:550});
      assert.equal(await frame.locator('body').evaluate(() => innerWidth),852);
      await page.waitForFunction(() => {
        const bounds = document.getElementById('preview-game').getBoundingClientRect();
        return bounds.width < innerWidth && bounds.x >= 0 && bounds.right <= innerWidth;
      });
      const bounds = await page.locator('#preview-game').evaluate(node => node.getBoundingClientRect().toJSON());
      assert(bounds.width < 650 && bounds.x >= 0 && bounds.right <= 650);
      await page.locator('#preview-zoom').selectOption('1');
      assert.equal(await page.locator('#preview-game').evaluate(node => node.getBoundingClientRect().width),852);
      await page.locator('#preview-zoom').selectOption('fit');
      await page.screenshot({path:`build/evidence/preview/${backend}-fit.png`});
      assert.deepEqual(errors,[]);
      console.log(`${backend}: fixed viewport, phone layout, safe areas, controls and zoom passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});

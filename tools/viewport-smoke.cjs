// Local staged-site check: no server or external requests are needed.
const {chromium, devices} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const site = path.resolve(process.env.CAFE_SITE_DIR || 'build/browser/site');
const evidence = 'build/evidence/viewport';
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.webp':'image/webp'};
(async () => {
  await fs.mkdir(evidence, {recursive:true});
  const browser = await chromium.launch({headless:true, executablePath:process.env.BROWSER_EXECUTABLE || undefined,
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-proxy-server']});
  const report = [];
  try {
    for (const backend of ['webgl2', 'automatic']) {
      for (const [name, options, type] of [
        ['desktop', {viewport:{width:1440,height:900}}, 'desktop'],
        ['phone', {...devices['iPhone 13'], viewport:{width:844,height:390}}, 'phone'],
        ['tablet', {...devices['iPad Pro 11'], viewport:{width:1194,height:834}}, 'tablet']
      ]) {
        const context = await browser.newContext({...options, deviceScaleFactor:1});
        await context.route('https://cafe.test/**', async route => {
          const url = new URL(route.request().url());
          const file = path.resolve(site, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
          if (!file.startsWith(site + path.sep)) return route.fulfill({status:403, body:''});
          try { await route.fulfill({body:await fs.readFile(file), contentType:types[path.extname(file)] || 'application/octet-stream'}); }
          catch { await route.fulfill({status:404,body:'Missing staged file'}); }
        });
        await context.addInitScript(() => {
          window.orientationCalls = [];
          // Exercise denied APIs without changing the emulator's window or screen.
          Object.defineProperty(screen.orientation, 'lock', {value:async mode => {
            window.orientationCalls.push(mode); throw new DOMException('Test denial', 'NotSupportedError');
          }});
          Element.prototype.requestFullscreen = async () => {
            window.orientationCalls.push('fullscreen'); throw new DOMException('Test denial', 'NotAllowedError');
          };
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`https://cafe.test/?backend=${backend}`);
        await page.waitForFunction(() => window.cafeDevice && window.cafeState && !document.querySelector('[data-command="3"]').disabled, null, {timeout:90000});
        assert.equal(await page.evaluate(() => window.cafeDevice.type), type);
        async function fits() {
          const bounds = await page.evaluate(() => {
            const rect = id => { const r = document.getElementById(id).getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
            return {width:innerWidth,height:innerHeight,scale:visualViewport.scale,shell:rect('play-shell'),canvas:rect('viewport'),drawer:rect('play-drawer'),nav:document.querySelector('.mode-nav').getBoundingClientRect().toJSON(),scroll:document.documentElement.scrollHeight};
          });
          assert.equal(bounds.width, page.viewportSize().width, 'layout must not zoom out to accommodate overflow');
          assert.equal(bounds.scale, 1, 'mobile page must remain at its intended scale');
          for (const key of ['shell','canvas','drawer','nav']) {
            const r = bounds[key];
            assert(r.x >= -1 && r.y >= -1 && r.right <= bounds.width + 1 && r.bottom <= bounds.height + 1, `${name} ${key} outside viewport: ${JSON.stringify(bounds)}`);
            assert(r.width > 0 && r.height > 0);
          }
          assert(bounds.scroll <= bounds.height + 1, 'page overflows vertically');
          return bounds;
        }
        const bounds = await fits();
        await page.screenshot({path:`${evidence}/${backend}-${name}.png`});
        if (name === 'phone') {
          await page.setViewportSize({width:390,height:664});
          await page.locator('#landscape-prompt').waitFor({state:'visible'});
          await page.locator('#landscape-enter').click();
          assert((await page.evaluate(() => window.orientationCalls)).includes('fullscreen'));
          await page.locator('#landscape-dismiss').click();
          await page.locator('#landscape-prompt').waitFor({state:'hidden'});
          await fits();
          await page.screenshot({path:`${evidence}/${backend}-portrait.png`});
          await page.setViewportSize({width:568,height:320});
          await fits();
          await page.locator('#menu-tab').click();
          await fits();
          await page.screenshot({path:`${evidence}/${backend}-small-landscape.png`});
          assert.equal(await page.evaluate(() => window.cafeDevice.orientation), 'landscape');
        } else if (name === 'desktop') {
          assert.deepEqual(await page.evaluate(() => window.orientationCalls), []);
        }
        assert.deepEqual(errors, []);
        report.push({backend, name, type, bounds, errors});
        console.log(`${backend}: ${name} fits`);
        await context.close();
      }
    }
    await fs.writeFile(`${evidence}/report.json`, JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});

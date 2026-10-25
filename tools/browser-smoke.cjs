// Optional acceptance check: supply Playwright through NODE_PATH or install it locally.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
(async () => {
  await mkdir('build/evidence', { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE || undefined,
    headless: true,
    args: ['--no-proxy-server', '--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      ...(process.env.CAFE_DISABLE_WEBGPU === '1' ? ['--disable-blink-features=WebGPU'] : [])]
  });
  try {
    for (const backend of ['webgl2', 'automatic']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      if (process.env.CAFE_DISABLE_WEBGPU === '1') {
        // Emulate a browser without WebGPU; Chromium flags differ across releases.
        await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }));
      }
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${process.env.CAFE_URL || 'http://127.0.0.1:4173'}/?backend=${backend}`);
      await page.getByRole('button', { name: 'Brew espresso' }).waitFor();
      await page.waitForFunction(() => window.cafeState && !document.querySelector('[data-command="0"]').disabled, null, { timeout: 60000 });
      if (process.env.CAFE_DISABLE_WEBGPU === '1') {
        assert.match(await page.locator('#status').innerText(), /WebGL 2 renderer ready/);
      }
      const initial = await page.locator('canvas').screenshot();
      await page.getByRole('button', { name: 'Brew espresso' }).click();
      await page.waitForFunction(() => window.cafeState.brewing > 0);
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await page.waitForFunction(() => window.cafeState.paused);
      const pausedTime = await page.evaluate(() => window.cafeState.brewing);
      await page.waitForTimeout(400);
      assert.equal(await page.evaluate(() => window.cafeState.brewing), pausedTime);
      await page.getByRole('button', { name: 'Resume' }).click();
      await page.waitForFunction(() => window.cafeState.ready);
      const ready = await page.locator('canvas').screenshot();
      assert.ok(!initial.equals(ready), 'Prepared coffee must change the rendered canvas');
      await page.screenshot({ path: `build/evidence/${backend}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Serve coffee' }).click();
      await page.waitForFunction(() => window.cafeState.served === 1);
      assert.equal(await page.evaluate(() => window.cafeState.coins), 5);
      assert.equal(await page.evaluate(() => window.cafeHostError), null);
      assert.deepEqual(errors, []);
      console.log(`${backend}: rendered coffee, pause/resume and serving passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

// Optional browser acceptance pass. Requires Playwright and a Chromium install.
// Serve public/ on 4199, or pass UC_URL. Screenshots are written outside source.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {mkdirSync,writeFileSync} = require('node:fs');
const {resolve} = require('node:path');

(async () => {
  const output = resolve(process.env.UC_EVIDENCE || 'work/universe-clash-qa');
  mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({
    headless:true,
    ...(process.env.UC_BROWSER ? {executablePath:process.env.UC_BROWSER} : {}),
    args:['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  page.setDefaultTimeout(180000);
  const errors = [];
  try {
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && /THREE|shader|WebGL|TypeError|ReferenceError/.test(message.text())) errors.push(message.text());
    });
    await page.goto(process.env.UC_URL || 'http://127.0.0.1:4199/games/universe-clash/');
    await page.waitForFunction(() => window.__UC__?.ready, null, {timeout:180000});
    const screenshot = async name => {
      await page.screenshot({path:resolve(output, `${name}.png`)});
      console.log(`Captured ${name}`);
      const stats=await page.evaluate(() => window.__UC__.stats());
      writeFileSync(resolve(output,`${name}.json`),JSON.stringify(stats,null,2));
    };
    await screenshot('01-menu');

    await page.locator('#menu-settings').click();
    await page.locator('[data-pause-panel="visuals"]').click();
    await page.locator('#graphics-setting').selectOption('low');
    await page.locator('#fov-setting').evaluate(input => {input.value='70';input.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.locator('#sensitivity-setting').evaluate(input => {input.value='1.4';input.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal(await page.evaluate(() => window.__UC__.presentation().sensitivity),1.4);
    assert.equal(await page.evaluate(() => window.__UC__.stats().presentation.shadowSize),0);
    await screenshot('01b-camera-settings');
    const pausedFrames=await page.evaluate(() => window.__UC__.stats().renderedFrames);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => window.__UC__.stats().renderedFrames),pausedFrames,'a paused menu should not keep rendering the arena');
    await page.locator('#settings-dialog [data-close]').click();

    await page.locator('.main-nav [data-nav="studio"]').click();
    await page.locator('#studio-roster [data-studio-fighter="vegeta"]').click();
    assert.equal((await page.locator('#studio-name').innerText()).toLowerCase(), 'vegeta');
    await page.locator('[data-studio-form="1"]').click();
    await page.waitForFunction(() => window.__UC__.preview().fighters[0].form === 1);
    await screenshot('02-fighter-studio');
    await page.locator('#studio-dialog [data-close]').click();

    await page.locator('[data-mode="story"]').click();
    await page.locator('#play').click();
    assert.equal(await page.locator('#episode-list [data-episode]').count(), 16);
    await page.locator('#saga-continue').click();
    await screenshot('03-story');
    await page.locator('#scene-skip').click();
    await page.waitForFunction(() => window.__UC__.mode() === 'story' && window.__UC__.snapshot().phase === 'fight');
    await page.mouse.click(730,410);
    const yaw = await page.evaluate(() => window.__UC__.cameraLook().yaw);
    await page.mouse.move(850,430,{steps:8});
    await page.waitForFunction(before => window.__UC__.cameraLook().yaw !== before, yaw);
    await screenshot('04-fight');
    await page.keyboard.press('Escape');
    await page.locator('#exit-match').click();

    await page.locator('[data-mode="pit"]').click();
    await page.locator('#play').click();
    await page.waitForFunction(() => window.__UC__.snapshot().fighters.length === 12 && window.__UC__.snapshot().phase === 'fight');
    await screenshot('05-pit');
    const camera = await page.evaluate(() => window.__UC__.stats().camera);
    assert.ok(camera.framing?.local.inFrame, 'The player must remain inside the viewport');
    assert.ok(Math.abs(camera.framing.local.center[0]-.5)<.2, 'The player should stay close to horizontal center');
    await page.keyboard.press('Escape');
    await page.locator('#exit-match').click();

    await page.locator('#guide-open').click();
    await page.waitForFunction(() => window.__UC__.mode() === 'training');
    await page.keyboard.press('KeyZ');
    await page.waitForFunction(() => window.__UC__.snapshot().events.some(e => e.owner === 0 && e.evadeKind === 'vanish'));
    await page.waitForFunction(() => window.__UC__.snapshot().fighters[0].action === 'idle');
    await page.keyboard.press('KeyL');
    await page.waitForFunction(() => window.__UC__.snapshot().events.some(e => e.type==='attack' && e.owner===0 && e.kind==='blast'));
    await screenshot('06-tutorial');
    await page.locator('#training-exit').click();
    await page.setViewportSize({width:390,height:844});
    await screenshot('07-mobile-menu');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1), 'No horizontal page overflow');
    await page.reload();
    await page.waitForFunction(() => window.__UC__?.ready);
    assert.equal(await page.evaluate(() => window.__UC__.presentation().fov),70,'camera settings survive reload');
    await page.locator('#guide-open').click();
    await page.waitForFunction(() => window.__UC__.mode() === 'training');
    await screenshot('08-mobile-training');
    assert.deepEqual(errors, []);
    console.log(`Browser checks passed. Inspect screenshots in ${output}`);
  } catch (error) {
    await page.screenshot({path:resolve(output, 'failure.png')}).catch(() => {});
    const diagnostic=await page.evaluate(() => ({mode:window.__UC__?.mode(),state:window.__UC__?.snapshot(),cameraLook:window.__UC__?.cameraLook(),stats:window.__UC__?.stats(),dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id)})).catch(() => null);
    writeFileSync(resolve(output,'failure.json'),JSON.stringify({error:error.message,console:errors,diagnostic},null,2));
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

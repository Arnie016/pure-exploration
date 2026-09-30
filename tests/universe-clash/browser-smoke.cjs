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
  let page = await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  const errors = [];
  const monitor = target => {
    target.setDefaultTimeout(180000);
    target.on('pageerror', error => errors.push(error.message));
    target.on('console', message => {
      if (message.type() === 'error' && /THREE|shader|WebGL|TypeError|ReferenceError/.test(message.text())) errors.push(message.text());
    });
  };
  monitor(page);
  try {
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
    await page.reload();
    await page.waitForFunction(() => window.__UC__?.ready);
    assert.equal(await page.evaluate(() => window.__UC__.presentation().fov),70,'camera settings survive reload');
    await page.close();
    page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true});
    monitor(page);
    await page.addInitScript(() => localStorage.setItem('uc-presentation-v1',JSON.stringify({quality:'low'})));
    await page.goto(process.env.UC_URL || 'http://127.0.0.1:4199/games/universe-clash/');
    await page.waitForFunction(() => window.__UC__?.ready);
    await screenshot('07-mobile-menu');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1), 'No horizontal page overflow');
    await page.locator('#guide-open').click();
    await page.waitForFunction(() => window.__UC__.mode() === 'training');
    await screenshot('08-mobile-training');
    assert.ok(await page.locator('#thumbpad').isVisible(),'touch movement controls are visible');
    assert.ok(await page.locator('#look-pad').isVisible(),'touch camera control is visible');
    assert.ok(await page.evaluate(() => document.querySelector('.control-deck').getBoundingClientRect().top > window.__UC__.stats().camera.framing.local.bounds[3]*innerHeight),'mobile attack buttons clear the player silhouette');
    const checkFlight = async (expected, activations) => {
      const tick=await page.evaluate(() => window.__UC__.snapshot().tick);
      await page.waitForFunction(before => window.__UC__.snapshot().tick >= before+6,tick,{timeout:60000});
      const result=await page.evaluate(() => ({flying:window.__UC__.snapshot().fighters[0].flight,events:window.__UC__.snapshot().events.filter(e=>e.type==='flight'&&e.owner===0).length}));
      assert.deepEqual(result,{flying:expected,events:activations},'each activation toggles flight exactly once');
    };
    await page.locator('#flight-button').tap();
    await checkFlight(true,1);
    await page.locator('#flight-button').tap();
    await checkFlight(false,2);
    await page.locator('#flight-button').focus();
    await page.keyboard.press('Enter');
    await checkFlight(true,3);
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

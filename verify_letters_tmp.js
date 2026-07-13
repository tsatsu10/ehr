const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message.slice(0, 250)));
  await page.goto('http://localhost/openemr/interface/login/login.php?site=default', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.fill('#authUser', 'Adminstrator');
  await page.fill('#clearPass', 'passpass1');
  await page.click('#login-button');
  await page.waitForFunction(() => !window.location.href.includes('login.php'), { timeout: 30000 });

  // Path A: direct referrals hub for pid 4
  await page.goto('http://localhost/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/chart-depth/referrals.php?pid=4', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4500);
  const bodyText = (await page.locator('body').innerText().catch(()=>'')).replace(/\s+/g,' ').slice(0, 200);
  console.log('referrals hub body:', JSON.stringify(bodyText));
  const segs = await page.locator('[role="tab"]').allTextContents();
  console.log('segments on referrals hub:', JSON.stringify(segs));
  const props = await page.evaluate(() => {
    const el = document.querySelector('[data-island="chart-depth"]');
    if (!el) return 'NO ISLAND';
    const p = JSON.parse(el.getAttribute('data-props'));
    return { enableLetters: p.enableLetters, letterPrintUrl: p.letterPrintUrl, mode: p.mode };
  });
  console.log('chart-depth props:', JSON.stringify(props));

  // Path B: does the Clinical tab show an "Open referrals" link at all?
  await page.goto('http://localhost/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/patient-chart.php?pid=4&tab=clinical', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  const openRef = await page.getByText('Open referrals', { exact: false }).count();
  console.log('Open referrals link on Clinical tab:', openRef);
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(1); });

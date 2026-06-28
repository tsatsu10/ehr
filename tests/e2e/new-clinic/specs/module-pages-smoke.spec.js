/**
 * Authenticated HTTP 200 smoke for all New Clinic module entry points.
 *
 * Requires TEST_USERNAME_ADMIN / TEST_PASSWORD_ADMIN (defaults: Adminstrator / passpass1 on XAMPP).
 *
 * @group e2e
 * @group new-clinic-mandatory
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = (process.env.TEST_BASE_URL || 'http://localhost/openemr').replace(/\/$/, '');
const MODULE_BASE =
  BASE_URL + '/interface/modules/custom_modules/oe-module-new-clinic/public';

const ADMIN_USER = process.env.TEST_USERNAME_ADMIN || 'Adminstrator';
const ADMIN_PASS = process.env.TEST_PASSWORD_ADMIN || 'passpass1';

/** @type {Array<[string, string]>} */
const MODULE_PAGES = [
  ['front-desk', `${MODULE_BASE}/front-desk.php`],
  ['triage', `${MODULE_BASE}/triage.php`],
  ['doctor', `${MODULE_BASE}/doctor.php`],
  ['lab', `${MODULE_BASE}/lab.php`],
  ['pharmacy', `${MODULE_BASE}/pharmacy.php`],
  ['cashier', `${MODULE_BASE}/cashier.php`],
  ['visit-board', `${MODULE_BASE}/visit-board.php`],
  ['patient-registry', `${MODULE_BASE}/patient-registry.php`],
  ['reports', `${MODULE_BASE}/reports.php`],
  ['communications', `${MODULE_BASE}/communications.php`],
  ['admin', `${MODULE_BASE}/admin.php`],
  ['patient-chart', `${MODULE_BASE}/patient-chart.php?pid=4`],
  ['lab-ops', `${MODULE_BASE}/lab-ops/index.php`],
  ['chart-payments', `${MODULE_BASE}/chart-depth/payments.php?pid=4`],
  ['chart-referrals', `${MODULE_BASE}/chart-depth/referrals.php?pid=4`],
  ['chart-export', `${MODULE_BASE}/chart-depth/export.php?pid=4`],
  ['bill-ops', `${MODULE_BASE}/bill-ops/index.php`],
];

async function loginAsAdmin(page) {
  await page.goto(`${BASE_URL}/interface/login/login.php?site=default`);
  const hasForm = await page.locator('#authUser').isVisible({ timeout: 5000 }).catch(() => false);
  if (!hasForm) {
    test.skip(true, 'Login form not reachable — start Apache/MySQL (XAMPP) first');
  }
  await page.fill('#authUser', ADMIN_USER);
  await page.fill('#clearPass', ADMIN_PASS);
  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    page.locator('#login-button, #login_button').first().click(),
  ]);
  const url = page.url();
  if (url.includes('login.php') || url.includes('login_screen')) {
    test.skip(true, `Admin login failed for ${ADMIN_USER} — check credentials`);
  }
}

test.describe('New Clinic module pages (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const [label, url] of MODULE_PAGES) {
    test(`${label} returns 200 with React island shell`, async ({ page }) => {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), `${label} HTTP status`).toBe(200);

      const html = await page.content();
      const hasShell = html.includes('oe-nc-t1') || html.includes('id="oe-nc-t1"');
      const killSwitch = html.includes('react-island-disabled');
      const unauthorized = /unauthorized|Authentication Error/i.test(html);

      expect(unauthorized, `${label} should not be unauthorized`).toBe(false);
      expect(hasShell || killSwitch, `${label} should render island or kill-switch`).toBe(true);
    });
  }
});

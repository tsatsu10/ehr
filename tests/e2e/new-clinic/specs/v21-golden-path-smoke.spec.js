/**
 * §21 golden path rollout smoke — desk chain readiness + role shells (PRD §21.1 / §21.1b).
 *
 * @group e2e
 * @group new-clinic-v21-golden-path
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login } = require('../helpers/auth');

const MODULE_ROOT = path.join(
  __dirname,
  '../../../../interface/modules/custom_modules/oe-module-new-clinic',
);

const ROLE_PAGES = [
  ['reception', process.env.TEST_USERNAME_RECEPTION || 'reception_user', `${MODULE_BASE}/front-desk.php`],
  ['nurse', process.env.TEST_USERNAME_NURSE || 'nurse_user', `${MODULE_BASE}/triage.php`],
  ['doctor', process.env.TEST_USERNAME_DOCTOR || 'doctor_user', `${MODULE_BASE}/doctor.php`],
  ['lab', process.env.TEST_USERNAME_LAB || 'lab_user', `${MODULE_BASE}/lab.php`],
  ['pharmacy', process.env.TEST_USERNAME_PHARMACY || 'pharmacy_user', `${MODULE_BASE}/pharmacy.php`],
  ['cashier', process.env.TEST_USERNAME_CASHIER || 'cashier_user', `${MODULE_BASE}/cashier.php`],
];

const PASS = process.env.TEST_PASSWORD_RECEPTION || 'test_pass';

function runModulePhp(relativePath) {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, relativePath);
  execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
}

function readGoldenPathFixture() {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, 'scripts/v21-golden-path-smoke-fixture.php');
  const raw = execSync(`"${php}" "${script}"`, { encoding: 'utf8' }).trim();
  return JSON.parse(raw);
}

test.describe('§21 golden path rollout smoke', () => {
  test.beforeAll(() => {
    runModulePhp('bin/upgrade_sql.php');
    runModulePhp('scripts/pilot-enable-v21-golden-path.php');
    const seedScript = path.join(MODULE_ROOT, 'acl/seed_pilot_users.php');
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('readiness fixture reports golden_path_ready', () => {
    const fixture = readGoldenPathFixture();
    expect(fixture.golden_path_ready, JSON.stringify(fixture)).toBe(true);
    expect(fixture.visit_type_id, JSON.stringify(fixture)).toBeGreaterThan(0);
    expect(fixture.flags?.enable_triage, JSON.stringify(fixture.flags)).toBe(true);
    expect(fixture.flags?.enable_lab_role, JSON.stringify(fixture.flags)).toBe(true);
    expect(fixture.pilot_users_missing ?? [], JSON.stringify(fixture)).toEqual([]);
  });

  for (const [label, user, url] of ROLE_PAGES) {
    test(`${label} desk loads React shell`, async ({ page }) => {
      test.setTimeout(90_000);
      await login(page, user, PASS);
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), await page.content()).toBe(200);
      const html = await page.content();
      expect(
        html.includes('oe-nc-t1') || html.includes('id="oe-nc-t1"'),
        `${label} should render T1 shell`,
      ).toBe(true);
    });
  }

  test('visit board and daily reports load for admin', async ({ page }) => {
    test.setTimeout(90_000);
    const adminUser = process.env.TEST_USERNAME_ADMIN || 'Adminstrator';
    const adminPass = process.env.TEST_PASSWORD_ADMIN || 'passpass1';
    await login(page, adminUser, adminPass);

    for (const url of [`${MODULE_BASE}/visit-board.php`, `${MODULE_BASE}/reports.php`]) {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), url).toBe(200);
    }
  });
});

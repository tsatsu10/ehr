/**
 * V1.1-REG smoke — Patient Registry cohort search + Finder cutover (REG-1–REG-5).
 *
 * @group e2e
 * @group new-clinic-v11-registry
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { BASE_URL, MODULE_BASE, login: loginAsAdmin, login } = require('../helpers/auth');

const ADMIN_USER = process.env.TEST_USERNAME_ADMIN || 'Adminstrator';
const ADMIN_PASS = process.env.TEST_PASSWORD_ADMIN || 'passpass1';
const RECEPTION_USER = process.env.TEST_USERNAME_RECEPTION || 'reception_user';
const RECEPTION_PASS = process.env.TEST_PASSWORD_RECEPTION || 'test_pass';
const NURSE_USER = process.env.TEST_USERNAME_NURSE || 'nurse_user';
const NURSE_PASS = process.env.TEST_PASSWORD_NURSE || 'test_pass';
const SEARCH_NAME = process.env.TEST_CHART_SEARCH_NAME || 'Mavis';

const SCRIPTS_DIR = path.join(
  __dirname,
  '../../../../interface/modules/custom_modules/oe-module-new-clinic/scripts',
);

function runPhpScript(scriptName) {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(SCRIPTS_DIR, scriptName);
  execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
}

async function readMainMenuHasLegacyFinder(page) {
  await page.waitForFunction(
    () => {
      const menu = window.app_view_model?.application_data?.menu?.();
      return Array.isArray(menu) && menu.length > 0;
    },
    { timeout: 45000 },
  );

  return page.evaluate(() => {
    const menu = window.app_view_model.application_data.menu();

    function walk(items) {
      for (const item of items) {
        const url = typeof item.url === 'function' ? item.url() : item.url;
        if (item.target === 'fin' || (url && String(url).includes('dynamic_finder'))) {
          return true;
        }
        const kids = typeof item.children === 'function' ? item.children() : item.children;
        if (kids && kids.length > 0 && walk(kids)) {
          return true;
        }
      }
      return false;
    }

    return walk(menu);
  });
}

test.describe('V1.1-REG smoke', () => {
  test.beforeAll(() => {
    runPhpScript('pilot-enable-v11-reg.php');
    const seedScript = path.join(
      __dirname,
      '../../../../interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php',
    );
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('patient registry island loads presets and idle state', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);

    const presetsResp = page.waitForResponse(
      (resp) => resp.url().includes('cohort.presets') && resp.ok(),
      { timeout: 45000 },
    );

    await page.goto(`${MODULE_BASE}/patient-registry.php`);
    await expect(page.locator('[data-island="patient-registry"]')).toBeVisible({ timeout: 30000 });

    const response = await presetsResp;
    const body = await response.json();
    expect((body.data?.builtins ?? []).length).toBeGreaterThan(0);

    await expect(page.getByText(/Apply filters to search the registry/i)).toBeVisible();
    await expect(page.getByText(/No search yet/i)).toBeVisible();
    await expect(page.locator('#nc-registry-record-status')).toBeVisible();
  });

  test('cohort.search finds patients by name filter', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(`${MODULE_BASE}/patient-registry.php`);
    await expect(page.locator('[data-island="patient-registry"]')).toBeVisible({ timeout: 30000 });

    const searchResp = page.waitForResponse(
      (resp) => resp.url().includes('cohort.search') && resp.ok(),
      { timeout: 45000 },
    );

    await page.locator('#nc-registry-name').fill(SEARCH_NAME);
    await page.getByRole('button', { name: /^Apply$/i }).click();

    const response = await searchResp;
    const body = await response.json();
    expect(body.data?.total ?? 0).toBeGreaterThan(0);

    await expect(page.locator('#nc-registry-table')).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText(new RegExp(`${SEARCH_NAME}`, 'i')).first()).toBeVisible();
  });

  test('reception main menu hides legacy Finder when registry is ON', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, RECEPTION_USER, RECEPTION_PASS);

    const hasFinder = await readMainMenuHasLegacyFinder(page);
    expect(hasFinder).toBe(false);

    const finderResp = await page.request.get(
      `${BASE_URL}/interface/main/finder/dynamic_finder.php`,
    );
    expect(finderResp.status()).toBe(200);
  });

  test('nurse retains legacy Finder menu entry', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, NURSE_USER, NURSE_PASS);

    const hasFinder = await readMainMenuHasLegacyFinder(page);
    expect(hasFinder).toBe(true);
  });

  test('saved filter persists via cohort.saved_filter', async ({ page }) => {
    test.setTimeout(90_000);
    const filterName = `E2E filter ${Date.now()}`;

    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(`${MODULE_BASE}/patient-registry.php`);
    await expect(page.locator('[data-island="patient-registry"]')).toBeVisible({ timeout: 30000 });

    await page.locator('#nc-registry-name').fill(SEARCH_NAME);
    await page.getByRole('button', { name: /^Apply$/i }).click();
    await expect(page.locator('#nc-registry-table')).toBeVisible({ timeout: 20000 });

    const saveResp = page.waitForResponse(
      (resp) => resp.url().includes('cohort.saved_filter') && resp.ok(),
      { timeout: 45000 },
    );

    await page.locator('#nc-registry-save-filter').click();
    await expect(page.locator('#nc-registry-save-filter-modal')).toBeVisible({ timeout: 10000 });
    await page.locator('#nc-registry-filter-name').fill(filterName);
    await page.locator('#nc-registry-save-filter-modal').getByRole('button', { name: /^Save$/i }).click();

    const response = await saveResp;
    const body = await response.json();
    expect(body.data?.success ?? body.success).toBeTruthy();

    await expect(page.locator('select[aria-label="Presets"]')).toContainText(filterName);
  });

  test('export CSV triggers cohort.export', async ({ page }) => {
    test.setTimeout(90_000);

    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(`${MODULE_BASE}/patient-registry.php`);
    await expect(page.locator('[data-island="patient-registry"]')).toBeVisible({ timeout: 30000 });

    await page.locator('#nc-registry-name').fill(SEARCH_NAME);
    await page.getByRole('button', { name: /^Apply$/i }).click();
    await expect(page.locator('#nc-registry-table')).toBeVisible({ timeout: 20000 });

    const exportResp = page.waitForResponse(
      (resp) => resp.url().includes('cohort.export') && resp.ok(),
      { timeout: 45000 },
    );

    await page.locator('#nc-registry-export').click();
    await expect(page.locator('#nc-registry-export-modal')).toBeVisible({ timeout: 10000 });
    await page.locator('#nc-registry-export-modal').getByRole('button', { name: /^Export CSV$/i }).click();

    const response = await exportResp;
    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain('text/csv');
  });
});

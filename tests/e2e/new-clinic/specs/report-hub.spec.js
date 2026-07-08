/**
 * Reporting Operations Hub — M16 smoke (Today lens + clinical catalog + export audit).
 *
 * @group e2e
 * @group new-clinic-mandatory
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login: loginAsAdmin } = require('../helpers/auth');

const ADMIN_USER = process.env.TEST_USERNAME_ADMIN || 'Adminstrator';
const ADMIN_PASS = process.env.TEST_PASSWORD_ADMIN || 'passpass1';

function pilotPrep() {
  const script = path.join(
    __dirname,
    '../../../../interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-rep.php',
  );
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
}

test.describe('Reporting Operations Hub', () => {
  test.beforeAll(() => {
    pilotPrep();
  });

  test('admin loads hub, switches lenses, and audits report open', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(`${MODULE_BASE}/report-hub/index.php`);

    await expect(page.locator('#nc-report-hub')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#nc-reporthub-kpis')).toContainText(/Today cash/i, { timeout: 20000 });

    const clinicalTab = page.locator('#nc-reporthub-toolbar button[data-tab="clinical"]');
    await expect(clinicalTab).toBeVisible({ timeout: 10000 });

    const catalogResp = page.waitForResponse(
      (resp) => resp.url().includes('reports.catalog') && resp.ok(),
      { timeout: 45000 },
    );
    await clinicalTab.click();
    await catalogResp;

    await expect(page.getByRole('heading', { name: 'Immunizations given' })).toBeVisible({ timeout: 20000 });

    const runResp = page.waitForResponse(
      (resp) => resp.url().includes('reports.run') && resp.ok(),
      { timeout: 30000 },
    );
    await page.getByRole('button', { name: 'Run report' }).first().click();
    await runResp;

    const exportResp = page.waitForResponse(
      (resp) => resp.url().includes('reports.export') && resp.ok(),
      { timeout: 30000 },
    );
    await page.getByRole('button', { name: 'Export CSV' }).first().click();
    const exportResponse = await exportResp;
    const exportType = exportResponse.headers()['content-type'] ?? '';
    expect(exportType.includes('text/csv') || exportType.includes('application/json')).toBeTruthy();
  });
});

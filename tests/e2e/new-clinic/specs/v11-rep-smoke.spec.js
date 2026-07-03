/**
 * V1.1-REP smoke — PRD M16 Reporting Operations Hub (@new-clinic-v11-rep).
 *
 * @group e2e
 * @group new-clinic-v11-rep
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login } = require('../helpers/auth');

const MODULE_ROOT = path.join(
  __dirname,
  '../../../../interface/modules/custom_modules/oe-module-new-clinic',
);

const ADMIN_USER = process.env.TEST_USERNAME_ADMIN || 'Adminstrator';
const ADMIN_PASS = process.env.TEST_PASSWORD_ADMIN || 'passpass1';

function runModulePhp(relativePath) {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, relativePath);
  execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
}

function readRepFixture() {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, 'scripts/v11-rep-smoke-fixture.php');
  const raw = execSync(`"${php}" "${script}"`, { encoding: 'utf8' }).trim();
  return JSON.parse(raw);
}

test.describe('V1.1-REP smoke', () => {
  test.beforeAll(() => {
    runModulePhp('bin/upgrade_sql.php');
    runModulePhp('scripts/pilot-enable-v11-rep.php');
    const seedScript = path.join(MODULE_ROOT, 'acl/seed_pilot_users.php');
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('admin hub loads Today lens and clinical catalog APIs', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = readRepFixture();

    expect(fixture.enable_report_hub, JSON.stringify(fixture)).toBe(true);
    expect(fixture.runbook_count, JSON.stringify(fixture)).toBeGreaterThan(0);

    await login(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(`${MODULE_BASE}/report-hub/index.php`);

    await expect(page.locator('#nc-report-hub')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#nc-reporthub-kpis')).toContainText(/Today cash/i, { timeout: 20000 });

    const island = page.locator('[data-island="report-hub"]');
    const props = JSON.parse((await island.getAttribute('data-props')) ?? '{}');
    expect(props.canToday).toBe(true);
    expect(props.canClinical).toBe(true);
    expect(props.canFinancial).toBe(true);

    const catalogUrl = `${props.ajaxUrl}?action=reports.catalog&lens=clinical${
      props.facilityId ? `&facility_id=${props.facilityId}` : ''
    }`;
    const response = await page.request.get(catalogUrl);
    expect(response.ok(), await response.text()).toBe(true);
    const body = await response.json();
    expect(body.success, JSON.stringify(body)).toBe(true);
    expect((body.data?.cards ?? []).length).toBeGreaterThan(0);
  });

  test('clinical immunization report runs and exports CSV', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(`${MODULE_BASE}/report-hub/index.php`);

    const clinicalTab = page.locator('#nc-reporthub-toolbar button[data-tab="clinical"]');
    const catalogResp = page.waitForResponse(
      (resp) => resp.url().includes('reports.catalog') && resp.ok(),
      { timeout: 45000 },
    );
    await clinicalTab.click();
    await catalogResp;

    await expect(page.getByRole('heading', { name: 'Immunizations given' })).toBeVisible({
      timeout: 20000,
    });

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

  test('doctor role is denied report hub access', async ({ page }) => {
    test.setTimeout(60_000);
    const doctorUser = process.env.TEST_USERNAME_DOCTOR || 'doctor_user';
    const doctorPass = process.env.TEST_PASSWORD_DOCTOR || 'test_pass';

    await login(page, doctorUser, doctorPass);
    const response = await page.goto(`${MODULE_BASE}/report-hub/index.php`);
    expect(response?.status(), await page.content()).toBe(403);
  });

  test('pharmacy lead sees pharmacy lens but not financial tab', async ({ page }) => {
    test.setTimeout(90_000);
    const leadUser = process.env.TEST_USERNAME_PHARM_LEAD || 'pharmacy_lead_user';
    const leadPass = process.env.TEST_PASSWORD_PHARM_LEAD || 'test_pass';

    await login(page, leadUser, leadPass);
    await page.goto(`${MODULE_BASE}/report-hub/index.php`);

    await expect(page.locator('#nc-report-hub')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#nc-reporthub-toolbar button[data-tab="pharmacy"]')).toBeVisible();
    await expect(page.locator('#nc-reporthub-toolbar button[data-tab="financial"]')).toHaveCount(0);

    const island = page.locator('[data-island="report-hub"]');
    const props = JSON.parse((await island.getAttribute('data-props')) ?? '{}');
    expect(props.canPharmacy).toBe(true);
    expect(props.canFinancial).toBe(false);
  });
});

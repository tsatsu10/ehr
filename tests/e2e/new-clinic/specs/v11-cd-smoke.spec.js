/**
 * V1.1-CD smoke — PRD CD-1–CD-5 / FIN-2–3 / REF-2 / EXP-2 (@new-clinic-v11-cd).
 *
 * CDa payment timeline + receipt reprint; CDb referrals list; CDc export presets.
 *
 * @group e2e
 * @group new-clinic-v11-cd
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login } = require('../helpers/auth');

const MODULE_ROOT = path.join(
  __dirname,
  '../../../../interface/modules/custom_modules/oe-module-new-clinic',
);

function runModulePhp(relativePath) {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, relativePath);
  execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
}

function readCdFixture() {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, 'scripts/v11-cd-smoke-fixture.php');
  const raw = execSync(`"${php}" "${script}"`, { encoding: 'utf8' }).trim();
  return JSON.parse(raw);
}

function credentials() {
  return {
    cashier: {
      username: process.env.TEST_USERNAME_CASHIER || 'cashier_user',
      password: process.env.TEST_PASSWORD_CASHIER || 'test_pass',
    },
    doctor: {
      username: process.env.TEST_USERNAME_DOCTOR || 'doctor_user',
      password: process.env.TEST_PASSWORD_DOCTOR || 'test_pass',
    },
  };
}

test.describe('V1.1-CD smoke', () => {
  test.beforeAll(() => {
    runModulePhp('bin/upgrade_sql.php');
    runModulePhp('scripts/pilot-enable-v11-cd.php');
    runModulePhp('scripts/e2e-prep-golden-path.php');
    const seedScript = path.join(MODULE_ROOT, 'acl/seed_pilot_users.php');
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('CDa — payment history timeline loads', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = readCdFixture();
    const creds = credentials();

    await login(page, creds.cashier.username, creds.cashier.password);

    const listResp = page.waitForResponse(
      (resp) => resp.url().includes('chart_depth.payments_list') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/chart-depth/payments.php?pid=${fixture.pid}`);
    const response = await listResp;
    const body = await response.json();
    expect(body.success, JSON.stringify(body)).toBe(true);
    expect(Array.isArray(body.data?.rows)).toBe(true);

    await expect(page.locator('[data-island="chart-depth"]')).toBeVisible({ timeout: 20000 });
    const rows = page.locator('#nc-payments-rows tr');
    const empty = page.getByText(/No payment or charge history for this view/i);
    await expect(rows.first().or(empty)).toBeVisible({ timeout: 20000 });

    if (fixture.has_receipt) {
      expect(body.data.rows.length, JSON.stringify(body.data)).toBeGreaterThan(0);
    }
  });

  test('CDa — receipt reprint confirm shows patient MRN and receipt number', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = readCdFixture();
    expect(fixture.has_receipt, 'Run golden-path-lab-close-day or bill smoke prep to seed a receipt').toBe(true);

    const creds = credentials();
    await login(page, creds.cashier.username, creds.cashier.password);

    const listResp = page.waitForResponse(
      (resp) => resp.url().includes('chart_depth.payments_list') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/chart-depth/payments.php?pid=${fixture.pid}`);
    await listResp;

    const reprintBtn = page.getByRole('button', { name: 'Reprint' }).first();
    await expect(reprintBtn).toBeVisible({ timeout: 20000 });

    const reprintResp = page.waitForResponse(
      (resp) => resp.url().includes('chart_depth.receipt_reprint') && resp.ok(),
      { timeout: 30000 },
    );
    await reprintBtn.click();
    const reprintBody = await (await reprintResp).json();
    expect(reprintBody.success, JSON.stringify(reprintBody)).toBe(true);

    await expect(page.getByRole('heading', { name: /Reprint receipt/i })).toBeVisible();
    // Radix dialog since the shadcn migration (was a Bootstrap .modal.show);
    // identity banner renders "Name · … · MRN xxx" rather than "Patient:".
    const modal = page.getByRole('dialog', { name: /Reprint receipt/i });
    await expect(modal.getByText(/MRN/i).first()).toBeVisible();
    if (fixture.receipt_number) {
      await expect(modal).toContainText(fixture.receipt_number);
    }
  });

  test('CDb — referrals list loads with create action', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = readCdFixture();
    const creds = credentials();

    await login(page, creds.doctor.username, creds.doctor.password);

    const listResp = page.waitForResponse(
      (resp) => resp.url().includes('chart_depth.referrals_list') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/chart-depth/referrals.php?pid=${fixture.pid}`);
    const response = await listResp;
    const body = await response.json();
    expect(body.success, JSON.stringify(body)).toBe(true);
    expect(Array.isArray(body.data?.items)).toBe(true);

    await expect(page.locator('[data-island="chart-depth"]')).toBeVisible({ timeout: 20000 });
    // The create action is a button opening the wizard (was a link pre-wizard).
    await expect(page.getByRole('button', { name: /New referral/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/No referrals for this filter/i)).toBeVisible();
  });

  test('CDc — export builder presets load', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = readCdFixture();
    const creds = credentials();

    await login(page, creds.doctor.username, creds.doctor.password);

    const builderResp = page.waitForResponse(
      (resp) => resp.url().includes('chart_depth.export_builder') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/chart-depth/export.php?pid=${fixture.pid}`);
    const response = await builderResp;
    const body = await response.json();
    expect(body.success, JSON.stringify(body)).toBe(true);
    expect(Array.isArray(body.data?.presets)).toBe(true);
    expect(body.data.presets.length, JSON.stringify(body.data)).toBeGreaterThan(0);

    await expect(page.locator('#nc-export-builder')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#nc-export-preset')).toBeVisible();
  });
});

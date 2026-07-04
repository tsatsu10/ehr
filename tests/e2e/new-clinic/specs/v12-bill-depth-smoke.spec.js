/**
 * V1.2-BILL depth — charge correction + payment reverse (BILL-2 / BILL-3).
 *
 * @group e2e
 * @group new-clinic-v12-bill
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login } = require('../helpers/auth');

const MODULE_ROOT = path.join(
  __dirname,
  '../../../../interface/modules/custom_modules/oe-module-new-clinic',
);

const CASHIER_USER = process.env.TEST_USERNAME_CASHIER || 'cashier_user';
const CASHIER_PASS = process.env.TEST_PASSWORD_CASHIER || 'test_pass';
const BILL_OPS_URL = `${MODULE_BASE}/bill-ops/index.php`;

function runModulePhp(relativePath) {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, relativePath);
  execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
}

function readBillDepthFixture() {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, 'scripts/v12-bill-depth-smoke-fixture.php');
  const raw = execSync(`"${php}" "${script}"`, { encoding: 'utf8' }).trim();
  return JSON.parse(raw);
}

test.describe('V1.2-BILL depth smoke', () => {
  test.beforeAll(() => {
    runModulePhp('bin/upgrade_sql.php');
    runModulePhp('scripts/e2e-prep-golden-path.php');
    runModulePhp('scripts/pilot-enable-v12-bill.php');
    runModulePhp('scripts/v12-bill-depth-fixture-seed.php');
    const seedScript = path.join(MODULE_ROOT, 'acl/seed_pilot_users.php');
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('charge correction adds a fee line via bill_ops.charge_correct', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = readBillDepthFixture();

    expect(fixture.enable_bill_ops, JSON.stringify(fixture)).toBe(true);
    expect(fixture.correction_visit_id, JSON.stringify(fixture)).toBeGreaterThan(0);
    expect(fixture.add_fee_schedule_id, JSON.stringify(fixture)).toBeGreaterThan(0);

    await login(page, CASHIER_USER, CASHIER_PASS);
    await page.goto(BILL_OPS_URL);
    await expect(page.locator('[data-island="bill-ops"]')).toBeVisible({ timeout: 30000 });

    const chargesResp = page.waitForResponse(
      (resp) => resp.url().includes('bill_ops.visit_charges') && resp.ok(),
      { timeout: 45000 },
    );
    await page.locator('#nc-billops-visit-id').fill(String(fixture.correction_visit_id));
    await page.getByRole('button', { name: /^Load visit$/i }).click();
    const chargesBody = await (await chargesResp).json();
    const beforeCount = (chargesBody.data?.charges ?? []).length;

    await page.locator('select').first().selectOption(String(fixture.add_fee_schedule_id));
    await page.locator('#nc-billops-correction-reason').fill('E2E charge correction smoke');
    const correctResp = page.waitForResponse(
      (resp) => resp.url().includes('bill_ops.charge_correct') && resp.ok(),
      { timeout: 45000 },
    );
    await page.getByRole('button', { name: /^Save correction$/i }).click();
    const correctBody = await (await correctResp).json();
    expect(correctBody.success, JSON.stringify(correctBody)).toBe(true);
    expect((correctBody.data?.charges ?? []).length, JSON.stringify(correctBody.data)).toBeGreaterThan(
      beforeCount,
    );

    await expect(page.getByText('Existing charges', { exact: true })).toBeVisible();
  });

  test('payment reverse offsets receipt and blocks double reverse', async ({ page }) => {
    test.setTimeout(120_000);
    runModulePhp('scripts/v12-bill-depth-fixture-seed.php');
    const fixture = readBillDepthFixture();

    expect(fixture.reverse_receipt_id, JSON.stringify(fixture)).toBeGreaterThan(0);
    expect(fixture.reverse_receipt_number, JSON.stringify(fixture)).toBeTruthy();

    await login(page, CASHIER_USER, CASHIER_PASS);
    await page.goto(`${BILL_OPS_URL}?tab=payments`);
    await expect(page.locator('[data-island="bill-ops"]')).toBeVisible({ timeout: 30000 });

    if (fixture.reverse_receipt_date) {
      await page.locator('.oe-nc-billops-pane input[type="date"]').fill(fixture.reverse_receipt_date);
    }

    const searchResp = page.waitForResponse(
      (resp) => resp.url().includes('bill_ops.payments_search') && resp.ok(),
      { timeout: 45000 },
    );
    await page.getByPlaceholder('Receipt # / MRN / name').fill(String(fixture.reverse_receipt_id));
    await page.getByRole('button', { name: /^Search$/i }).click();
    await searchResp;

    await page.getByText(fixture.reverse_receipt_number).first().click();
    await expect(page.locator('#nc-billops-reverse-reason')).toBeVisible({ timeout: 20000 });
    await page.locator('#nc-billops-reverse-reason').fill('E2E payment reverse smoke');
    const reverseResp = page.waitForResponse(
      (resp) => resp.url().includes('bill_ops.payment_reverse') && resp.ok(),
      { timeout: 60000 },
    );
    await page.getByRole('button', { name: /^Reverse payment$/i }).click({ force: true });
    const reverseBody = await (await reverseResp).json();
    expect(reverseBody.success, JSON.stringify(reverseBody)).toBe(true);

    await expect(page.getByText('Reversed')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /^Reverse payment$/i })).toHaveCount(0);
  });
});

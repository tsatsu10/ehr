/**
 * V1.2-BILL smoke — M14 hub, daysheet, outstanding, insurance vault, menu cutover.
 *
 * @group e2e
 * @group new-clinic-v12-bill
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { BASE_URL, MODULE_BASE, login: loginAsAdmin, login } = require('../helpers/auth');

const ADMIN_USER = process.env.TEST_USERNAME_ADMIN || 'Adminstrator';
const ADMIN_PASS = process.env.TEST_PASSWORD_ADMIN || 'passpass1';
const CASHIER_USER = process.env.TEST_USERNAME_CASHIER || 'cashier_user';
const CASHIER_PASS = process.env.TEST_PASSWORD_CASHIER || 'test_pass';

const BILL_OPS_URL = `${MODULE_BASE}/bill-ops/index.php`;

const SCRIPTS_DIR = path.join(
  __dirname,
  '../../../../interface/modules/custom_modules/oe-module-new-clinic/scripts',
);

function runPhpScript(scriptName) {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(SCRIPTS_DIR, scriptName);
  execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
}

function readBillFixture() {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(SCRIPTS_DIR, 'bill-ops-smoke-fixture.php');
  const raw = execSync(`"${php}" "${script}"`, { encoding: 'utf8' }).trim();
  return JSON.parse(raw);
}

let billFixture = null;

async function readIslandProps(page) {
  const raw = await page.locator('[data-island="bill-ops"]').getAttribute('data-props');
  return JSON.parse(raw ?? '{}');
}

async function readMainMenuHasBillingManager(page) {
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
        if (url && String(url).includes('billing_report.php')) {
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

test.describe('V1.2-BILL smoke', () => {
  test.beforeAll(() => {
    runPhpScript('e2e-prep-golden-path.php');
    runPhpScript('pilot-enable-v12-bill.php');
    const seedScript = path.join(
      __dirname,
      '../../../../interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php',
    );
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
    billFixture = readBillFixture();
  });

  test('bill ops hub loads corrections workspace for cashier lead', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, CASHIER_USER, CASHIER_PASS);
    await page.goto(BILL_OPS_URL);

    await expect(page.locator('[data-island="bill-ops"]')).toBeVisible({ timeout: 30000 });
    const props = await readIslandProps(page);
    expect(props.canCorrect).toBe(true);
    expect(props.canClose).toBe(true);

    await expect(page.getByPlaceholder('Visit id')).toBeVisible();
    await expect(page.locator('#nc-billops-toolbar button[data-tab="close"]')).toBeVisible();
  });

  test('close day tab loads bill_ops.daysheet', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, CASHIER_USER, CASHIER_PASS);
    await page.goto(BILL_OPS_URL);
    await expect(page.locator('[data-island="bill-ops"]')).toBeVisible({ timeout: 30000 });

    const daysheetResp = page.waitForResponse(
      (resp) => resp.url().includes('bill_ops.daysheet') && resp.ok(),
      { timeout: 45000 },
    );
    await page.locator('#nc-billops-toolbar button[data-tab="close"]').click();
    const response = await daysheetResp;
    const body = await response.json();
    expect(body.data?.date).toBeTruthy();
    expect(body.data?.reconciliation).toBeTruthy();

    await expect(page.getByText(/Reconciliation:\s*(OK|WARN)/i)).toBeVisible({ timeout: 20000 });
  });

  test('outstanding tab loads bill_ops.outstanding_list for cashier lead', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, CASHIER_USER, CASHIER_PASS);
    await page.goto(`${BILL_OPS_URL}?tab=outstanding`);
    await expect(page.locator('[data-island="bill-ops"]')).toBeVisible({ timeout: 30000 });

    const props = await readIslandProps(page);
    expect(props.canOutstanding, 'Cashier lead should have outstanding ACL after bill pilot prep').toBe(true);

    const listResp = page.waitForResponse(
      (resp) => resp.url().includes('bill_ops.outstanding_list') && resp.ok(),
      { timeout: 45000 },
    );
    const response = await listResp;
    const body = await response.json();
    expect(body.data?.total ?? 0).toBeGreaterThanOrEqual(0);

    await expect(page.getByText('Outstanding balances', { exact: true })).toBeVisible({
      timeout: 20000,
    });
  });

  test('payments tab finds receipt via bill_ops.payments_search', async ({ page }) => {
    test.setTimeout(90_000);
    expect(billFixture?.receipt_number, 'Run golden-path-lab-close-day once to seed a receipt').toBeTruthy();

    await login(page, CASHIER_USER, CASHIER_PASS);
    await page.goto(`${BILL_OPS_URL}?tab=payments`);
    await expect(page.locator('[data-island="bill-ops"]')).toBeVisible({ timeout: 30000 });
    await page.waitForResponse(
      (resp) => resp.url().includes('bill_ops.payments_search') && resp.ok(),
      { timeout: 45000 },
    );

    if (billFixture.receipt_date) {
      await page.locator('.nc-billops-pane input[type="date"]').fill(billFixture.receipt_date);
    }

    const searchQuery = String(billFixture.receipt_id);
    const searchResp = page.waitForResponse(async (resp) => {
      if (!resp.url().includes('bill_ops.payments_search') || !resp.ok()) {
        return false;
      }
      try {
        const body = resp.request().postDataJSON();
        return body?.q === searchQuery;
      } catch {
        return false;
      }
    }, { timeout: 45000 });
    await page.getByPlaceholder('Receipt # / MRN / name').fill(searchQuery);
    await page.getByRole('button', { name: /^Search$/i }).click();

    const response = await searchResp;
    const body = await response.json();
    expect(body.data?.total ?? 0).toBeGreaterThan(0);
    expect(
      (body.data?.rows ?? []).some(
        (row) =>
          row.receipt_number === billFixture.receipt_number || row.id === billFixture.receipt_id,
      ),
    ).toBe(true);

    await expect(page.getByText(billFixture.receipt_number).first()).toBeVisible({
      timeout: 20000,
    });
  });

  test('corrections tab loads visit charges via bill_ops.visit_charges', async ({ page }) => {
    test.setTimeout(90_000);
    expect(billFixture?.visit_id, 'Run golden-path-lab-close-day once to seed a receipt visit').toBeGreaterThan(0);

    await login(page, CASHIER_USER, CASHIER_PASS);
    await page.goto(BILL_OPS_URL);
    await expect(page.locator('[data-island="bill-ops"]')).toBeVisible({ timeout: 30000 });

    const chargesResp = page.waitForResponse(
      (resp) => resp.url().includes('bill_ops.visit_charges') && resp.ok(),
      { timeout: 45000 },
    );

    await page.locator('#nc-billops-visit-id').fill(String(billFixture.visit_id));
    await page.getByRole('button', { name: /^Load visit$/i }).click();

    const response = await chargesResp;
    const body = await response.json();
    expect(body.data?.visit?.id ?? body.data?.visit_id).toBeTruthy();

    await expect(page.getByText('Existing charges', { exact: true })).toBeVisible({
      timeout: 20000,
    });
  });

  test('admin insurance tab shows scheme claims workspace', async ({ page }) => {
    // The legacy-US-gateway "vault" cards (Billing Manager / ERA upload) were
    // deliberately removed (US claims are a non-goal); the insurance tab is the
    // scheme-claims workspace now.
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(`${BILL_OPS_URL}?tab=insurance`);
    await expect(page.locator('[data-island="bill-ops"]')).toBeVisible({ timeout: 30000 });

    const props = await readIslandProps(page);
    expect(props.canInsurance, 'Admin should have insurance ACL after bill pilot prep').toBe(true);

    await expect(page.locator('#nc-billops-toolbar button[data-tab="insurance"]')).toBeVisible();
    await expect(page.getByText('Scheme claims to submit')).toBeVisible({ timeout: 20000 });
  });

  test('cashier main menu hides stock Billing Manager when bill ops ON', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, CASHIER_USER, CASHIER_PASS);

    const hasBillingManager = await readMainMenuHasBillingManager(page);
    expect(hasBillingManager).toBe(false);
  });
});

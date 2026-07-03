/**
 * V1.1-BRIDGE smoke — PRD M18 Queue Bridge Hub (@new-clinic-v11-bridge).
 *
 * @group e2e
 * @group new-clinic-v11-bridge
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

function runModulePhp(relativePath, args = '') {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, relativePath);
  execSync(`"${php}" "${script}" ${args}`.trim(), { stdio: 'inherit' });
}

function readBridgeFixture() {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, 'scripts/v11-bridge-smoke-fixture.php');
  const raw = execSync(`"${php}" "${script}"`, { encoding: 'utf8' }).trim();
  return JSON.parse(raw);
}

function resetBridgeFixture() {
  runModulePhp('scripts/queue-bridge-fixture-seed.php', '--cleanup');
}

test.describe('V1.1-BRIDGE smoke', () => {
  test.beforeAll(() => {
    runModulePhp('bin/upgrade_sql.php');
    runModulePhp('scripts/pilot-enable-v11-bridge.php');
    resetBridgeFixture();
    const seedScript = path.join(MODULE_ROOT, 'acl/seed_pilot_users.php');
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('admin hub lists EX-01 fixture and queue_bridge.list API', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = readBridgeFixture();

    expect(fixture.enable_queue_bridge, JSON.stringify(fixture)).toBe(true);
    expect(fixture.enable_scheduled_integration, JSON.stringify(fixture)).toBe(true);
    expect(fixture.fixture_pc_eid, JSON.stringify(fixture)).toBeGreaterThan(0);
    expect(fixture.action_exception_count, JSON.stringify(fixture)).toBeGreaterThan(0);

    await login(page, ADMIN_USER, ADMIN_PASS);

    const listResp = page.waitForResponse(
      (resp) => resp.url().includes('queue_bridge.list') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/queue-bridge/index.php`);
    const listBody = await (await listResp).json();
    expect(listBody.success, JSON.stringify(listBody)).toBe(true);
    expect(listBody.data?.counts?.action ?? 0, JSON.stringify(listBody.data)).toBeGreaterThan(0);

    await expect(page.locator('#nc-queue-bridge-root')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.oe-nc-queuebridge')).toBeVisible();
    await expect(page.getByText(/Arrived on schedule — no clinical visit/i)).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText('EX-01')).toBeVisible();

    const island = page.locator('[data-island="queue-bridge"]');
    const props = JSON.parse((await island.getAttribute('data-props')) ?? '{}');
    const apiUrl = `${props.ajaxUrl}?action=queue_bridge.list&lens=action${
      props.facilityId ? `&facility_id=${props.facilityId}` : ''
    }`;
    const response = await page.request.get(apiUrl);
    expect(response.ok(), await response.text()).toBe(true);
    const body = await response.json();
    expect(body.success, JSON.stringify(body)).toBe(true);
    expect((body.data?.rows ?? []).length).toBeGreaterThan(0);
  });

  test('scheduling tab shows queue bridge exception footer', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(`${MODULE_BASE}/reports.php`);

    const schedulingResp = page.waitForResponse(
      (resp) => resp.url().includes('reports.scheduling') && resp.ok(),
      { timeout: 45000 },
    );
    await page.getByRole('tab', { name: /Scheduling/i }).click();
    await schedulingResp;

    await expect(page.getByText(/Schedule vs queue exceptions/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('link', { name: 'View exceptions' })).toBeVisible();
  });

  test('doctor role is denied queue bridge hub access', async ({ page }) => {
    test.setTimeout(60_000);
    const doctorUser = process.env.TEST_USERNAME_DOCTOR || 'doctor_user';
    const doctorPass = process.env.TEST_PASSWORD_DOCTOR || 'test_pass';

    await login(page, doctorUser, doctorPass);
    const response = await page.goto(`${MODULE_BASE}/queue-bridge/index.php`);
    expect(response?.status(), await page.content()).toBe(403);
  });
});

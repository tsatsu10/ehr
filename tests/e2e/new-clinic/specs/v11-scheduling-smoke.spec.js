/**
 * S1 Scheduling & Flow smoke — calendar / flow / recalls lenses (@new-clinic-v11-scheduling).
 *
 * @group e2e
 * @group new-clinic-v11-scheduling
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

function readSchedulingFixture() {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, 'scripts/v11-scheduling-smoke-fixture.php');
  const raw = execSync(`"${php}" "${script}"`, { encoding: 'utf8' }).trim();
  return JSON.parse(raw);
}

test.describe('S1 Scheduling smoke', () => {
  test.beforeAll(() => {
    runModulePhp('bin/upgrade_sql.php');
    runModulePhp('scripts/e2e-prep-golden-path.php');
    runModulePhp('scripts/pilot-enable-v11-scheduling.php');
    runModulePhp('scripts/scheduling-recurring-fixture-seed.php');
    const seedScript = path.join(MODULE_ROOT, 'acl/seed_pilot_users.php');
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('admin loads calendar lens and scheduling.calendar.range API', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = readSchedulingFixture();

    expect(fixture.enable_scheduling_redesign, JSON.stringify(fixture)).toBe(true);
    expect(fixture.enable_scheduled_integration, JSON.stringify(fixture)).toBe(true);
    expect(fixture.smoke_fixture_pc_eid, JSON.stringify(fixture)).toBeGreaterThan(0);
    expect(fixture.calendar_event_count_today, JSON.stringify(fixture)).toBeGreaterThan(0);

    await login(page, ADMIN_USER, ADMIN_PASS);

    const rangeResp = page.waitForResponse(
      (resp) => resp.url().includes('scheduling.calendar.range') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/scheduling/index.php?lens=calendar`);
    const rangeBody = await (await rangeResp).json();
    expect(rangeBody.success, JSON.stringify(rangeBody)).toBe(true);
    expect((rangeBody.data?.events ?? []).length, JSON.stringify(rangeBody.data)).toBeGreaterThan(0);

    await expect(page.locator('#nc-scheduling-root')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('tab', { name: 'Calendar' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Calendar layout' })).toBeVisible();

    const island = page.locator('[data-island="scheduling"]');
    const props = JSON.parse((await island.getAttribute('data-props')) ?? '{}');
    const apiUrl = `${props.ajaxUrl}?action=scheduling.calendar.range&view=day&date=${encodeURIComponent(
      props.initialDate ?? new Date().toISOString().slice(0, 10),
    )}${props.facilityId ? `&facility_id=${props.facilityId}` : ''}`;
    const response = await page.request.get(apiUrl);
    expect(response.ok(), await response.text()).toBe(true);
    const body = await response.json();
    expect(body.success, JSON.stringify(body)).toBe(true);
    expect((body.data?.events ?? []).length).toBeGreaterThan(0);
  });

  test('admin loads flow board lens', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, ADMIN_USER, ADMIN_PASS);

    const boardResp = page.waitForResponse(
      (resp) => resp.url().includes('scheduling.flow_board.list') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/scheduling/index.php?lens=flow`);
    await boardResp;

    await expect(page.locator('#nc-scheduling-root')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('tab', { name: 'Flow Board' })).toBeVisible();
    await expect(page.getByText(/Mode 2 arrivals only/i)).toBeVisible();
  });

  test('admin loads recalls lens', async ({ page }) => {
    test.setTimeout(90_000);
    const fixture = readSchedulingFixture();
    expect(fixture.recurring_fixture_present, JSON.stringify(fixture)).toBe(true);

    await login(page, ADMIN_USER, ADMIN_PASS);

    const recallsResp = page.waitForResponse(
      (resp) => resp.url().includes('scheduling.recalls.list') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/scheduling/index.php?lens=recalls`);
    await recallsResp;

    await expect(page.locator('#nc-scheduling-root')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('tab', { name: 'Recalls' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Due now/i })).toBeVisible();
  });

  test('doctor role is denied scheduling hub access', async ({ page }) => {
    test.setTimeout(60_000);
    const doctorUser = process.env.TEST_USERNAME_DOCTOR || 'doctor_user';
    const doctorPass = process.env.TEST_PASSWORD_DOCTOR || 'test_pass';

    await login(page, doctorUser, doctorPass);
    const response = await page.goto(`${MODULE_BASE}/scheduling/index.php`);
    expect(response?.status(), await page.content()).toBe(403);
  });
});

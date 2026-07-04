/**
 * V1.1-COM smoke — PRD Communications Hub messages + reminders (COM-1 / COM-2 subset).
 *
 * @group e2e
 * @group new-clinic-v11-comms
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
const COMMS_URL = `${MODULE_BASE}/communications.php`;

function runModulePhp(relativePath, args = '') {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, relativePath);
  execSync(`"${php}" "${script}" ${args}`.trim(), { stdio: 'inherit' });
}

function readCommsFixture() {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, 'scripts/v11-comms-smoke-fixture.php');
  const raw = execSync(`"${php}" "${script}"`, { encoding: 'utf8' }).trim();
  return JSON.parse(raw);
}

test.describe('V1.1-COM smoke', () => {
  test.beforeAll(() => {
    runModulePhp('bin/upgrade_sql.php');
    runModulePhp('scripts/pilot-enable-v11-comms.php');
    runModulePhp('scripts/v11-comms-fixture-seed.php');
    const seedScript = path.join(MODULE_ROOT, 'acl/seed_pilot_users.php');
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('admin hub loads counts and fixture message via communications.messages_list', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = readCommsFixture();

    expect(fixture.communications_hub_enable, JSON.stringify(fixture)).toBe(true);
    expect(fixture.message_id, JSON.stringify(fixture)).toBeGreaterThan(0);

    await login(page, ADMIN_USER, ADMIN_PASS);

    const listResp = page.waitForResponse(
      (resp) => resp.url().includes('communications.messages_list') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(COMMS_URL);
    const listBody = await (await listResp).json();
    expect(listBody.success, JSON.stringify(listBody)).toBe(true);
    expect(
      (listBody.data?.rows ?? []).some((row) => row.id === fixture.message_id),
      JSON.stringify(listBody.data),
    ).toBe(true);

    await expect(page.locator('#nc-communications-hub')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-island="communications-hub"]')).toBeVisible();

    const island = page.locator('[data-island="communications-hub"]');
    const props = JSON.parse((await island.getAttribute('data-props')) ?? '{}');
    const countsUrl = `${props.ajaxUrl}?action=communications.hub_counts`;
    const countsResponse = await page.request.get(countsUrl);
    expect(countsResponse.ok(), await countsResponse.text()).toBe(true);
    const countsBody = await countsResponse.json();
    expect(countsBody.success, JSON.stringify(countsBody)).toBe(true);
    expect(typeof countsBody.data?.messages_active).toBe('number');
  });

  test('fixture message opens detail and marks done', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = readCommsFixture();

    await login(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(COMMS_URL);
    await expect(page.locator('#nc-communications-hub')).toBeVisible({ timeout: 20000 });

    await page.getByText(fixture.message_type, { exact: true }).first().click();
    await expect(page.getByText(fixture.message_marker)).toBeVisible({ timeout: 20000 });

    const doneResp = page.waitForResponse(
      (resp) => resp.url().includes('communications.message_done') && resp.ok(),
      { timeout: 45000 },
    );
    await page.locator('#nc-comm-mark-done').click();
    const doneBody = await (await doneResp).json();
    expect(doneBody.success, JSON.stringify(doneBody)).toBe(true);
  });

  test('reminders lens shows fixture and marks completed', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = readCommsFixture();

    expect(fixture.reminder_id, JSON.stringify(fixture)).toBeGreaterThan(0);

    await login(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(COMMS_URL);
    await expect(page.locator('#nc-communications-hub')).toBeVisible({ timeout: 20000 });

    const remindersResp = page.waitForResponse(
      (resp) => resp.url().includes('communications.reminders_list') && resp.ok(),
      { timeout: 45000 },
    );
    await page.locator('#nc-comm-lens-reminders').click();
    const remindersBody = await (await remindersResp).json();
    expect(remindersBody.success, JSON.stringify(remindersBody)).toBe(true);
    expect(
      (remindersBody.data?.rows ?? []).some((row) => row.id === fixture.reminder_id),
      JSON.stringify(remindersBody.data),
    ).toBe(true);

    await page.getByText(fixture.reminder_marker).first().click();
    await expect(page.locator('#nc-comm-reminder-complete')).toBeVisible({ timeout: 20000 });

    const completeResp = page.waitForResponse(
      (resp) => resp.url().includes('communications.reminder_done') && resp.ok(),
      { timeout: 45000 },
    );
    await page.locator('#nc-comm-reminder-complete').click();
    const completeBody = await (await completeResp).json();
    expect(completeBody.success, JSON.stringify(completeBody)).toBe(true);
  });
});

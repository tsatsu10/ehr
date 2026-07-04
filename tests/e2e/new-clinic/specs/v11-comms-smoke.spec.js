/**
 * V1.1-COM smoke — PRD Communications Hub messages + reminders (COM-1 / COM-2 subset).
 *
 * @group e2e
 * @group new-clinic-v11-comms
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login, logout } = require('../helpers/auth');

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

async function readIslandProps(page) {
  await expect(page.locator('#nc-communications-hub')).toBeVisible({ timeout: 60000 });
  const island = page.locator('[data-island="communications-hub"]');
  return JSON.parse((await island.getAttribute('data-props')) ?? '{}');
}

async function fetchMessagesList(page, props) {
  const params = new URLSearchParams({
    action: 'communications.messages_list',
    activity: '1',
    begin: '0',
    limit: '25',
    sortby: 'pnotes.date',
    sortorder: 'desc',
  });
  const url = `${props.ajaxUrl}${props.ajaxUrl.includes('?') ? '&' : '?'}${params.toString()}`;
  const response = await page.request.get(url);
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
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

    await logout(page);
    await login(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(COMMS_URL);
    const props = await readIslandProps(page);
    const listBody = await fetchMessagesList(page, props);
    expect(listBody.success, JSON.stringify(listBody)).toBe(true);
    expect(
      (listBody.data?.rows ?? []).some((row) => row.id === fixture.message_id),
      JSON.stringify(listBody.data),
    ).toBe(true);

    const countsUrl = `${props.ajaxUrl}?action=communications.hub_counts`;
    const countsResponse = await page.request.get(countsUrl);
    expect(countsResponse.ok(), await countsResponse.text()).toBe(true);
    const countsBody = await countsResponse.json();
    expect(countsBody.success, JSON.stringify(countsBody)).toBe(true);
    expect(typeof countsBody.data?.messages_active).toBe('number');
  });

  test('fixture message opens detail and marks done', async ({ page }) => {
    test.setTimeout(120_000);
    runModulePhp('scripts/v11-comms-fixture-seed.php');
    const fixture = readCommsFixture();

    await logout(page);
    await login(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(COMMS_URL);
    await readIslandProps(page);
    await page.locator('#nc-comm-refresh').click();
    const messageRow = page.locator('.oe-nc-comm-row').filter({ hasText: fixture.message_type }).first();
    await expect(messageRow).toBeVisible({ timeout: 30000 });

    await messageRow.click();
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

    await logout(page);
    await login(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(COMMS_URL);
    await readIslandProps(page);

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

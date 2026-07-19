/**
 * V1.2 doctor ready notify smoke — PRD §16.1 test 35 (@new-clinic-v12).
 *
 * In-app toast debounce via new_visit_notify_log + sessionStorage; no notify when Taking patients OFF.
 *
 * @group e2e
 * @group new-clinic-v12
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login, logout } = require('../helpers/auth');

const MODULE_ROOT = path.join(
  __dirname,
  '../../../../interface/modules/custom_modules/oe-module-new-clinic',
);

function runModulePhp(relativePath) {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, relativePath);
  execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
}

function readNotifyFixture() {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, 'scripts/v12-doctor-notify-smoke-fixture.php');
  // clear_queue=1: e2e wants the fully deterministic queue (cancels non-fixture
  // ready_for_doctor visits + wipes today's notify log) — opt-in for hand-run smokes.
  const raw = execSync(`"${php}" "${script}" clear_queue=1`, { encoding: 'utf8' }).trim();
  return JSON.parse(raw);
}

function readNotifyLogCount(visitId, recipientUserId) {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, 'scripts/v12-doctor-notify-log-count.php');
  const raw = execSync(
    `"${php}" "${script}" --visit_id=${visitId} --recipient_user_id=${recipientUserId}`,
    { encoding: 'utf8' },
  ).trim();
  return JSON.parse(raw);
}

async function waitForQueueCard(page, lname) {
  const card = page.locator(`[class*="queue-card"]:has-text("${lname}")`).first();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (await card.isVisible().catch(() => false) && await card.isEnabled().catch(() => false)) {
      return card;
    }
    const refresh = page.getByRole('button', { name: 'Refresh' });
    if (await refresh.isVisible().catch(() => false)) {
      await refresh.click();
    }
    await page.waitForTimeout(2000);
  }
  return card;
}

async function triageSendPatient(page, lname) {
  const triageCard = await waitForQueueCard(page, lname);
  await expect(triageCard).toBeVisible({ timeout: 30000 });

  const selectResp = page.waitForResponse(
    (resp) => resp.url().includes('triage.select') && resp.ok(),
    { timeout: 30000 },
  );
  await triageCard.click();
  await selectResp;
  await expect(page.locator('#nc-triage-active-pane')).toContainText(lname, { timeout: 15000 });

  const startTriage = page.getByRole('button', { name: 'Start triage' });
  if (await startTriage.isVisible().catch(() => false)) {
    await startTriage.click();
    await page.waitForTimeout(500);
  }

  const reenter = page.getByRole('button', { name: 'Record another set' });
  if (await reenter.isVisible().catch(() => false)) {
    await reenter.click();
  }

  await page.locator('#nc-vitals-bps').waitFor({ state: 'visible', timeout: 15000 });
  await page.fill('#nc-vitals-bps', '120');
  await page.fill('#nc-vitals-bpd', '80');
  await page.fill('#nc-vitals-pulse', '72');
  await page.fill('#nc-vitals-temperature', '36.6');
  await page.fill('#nc-vitals-weight', '70');
  await page.fill('#nc-vitals-respiration', '16');

  const saveButton = page.getByRole('button', { name: 'Save vitals' });
  await expect(saveButton).toBeEnabled({ timeout: 15000 });
  const [saveResponse] = await Promise.all([
    page.waitForResponse(
      (resp) => resp.url().includes('triage.save_vitals') && resp.ok(),
      { timeout: 60000 },
    ),
    saveButton.click(),
  ]);
  const saveBody = await saveResponse.json();
  expect(saveBody.success, JSON.stringify(saveBody)).toBe(true);

  const sendButton = page.getByRole('button', { name: 'Send to doctor' });
  await expect(sendButton).toBeVisible({ timeout: 20000 });

  const [sendResponse] = await Promise.all([
    page.waitForResponse(
      (resp) => resp.url().includes('triage.send_doctor') && resp.ok(),
      { timeout: 60000 },
    ),
    sendButton.click(),
  ]);
  const sendBody = await sendResponse.json();
  expect(sendBody.success, JSON.stringify(sendBody)).toBe(true);
  expect(sendBody.data?.visit?.state, JSON.stringify(sendBody)).toBe('ready_for_doctor');
}

function credentials() {
  return {
    nurse: {
      username: process.env.TEST_USERNAME_NURSE || 'nurse_user',
      password: process.env.TEST_PASSWORD_NURSE || 'test_pass',
    },
    doctor: {
      username: process.env.TEST_USERNAME_DOCTOR || 'doctor_user',
      password: process.env.TEST_PASSWORD_DOCTOR || 'test_pass',
    },
  };
}

test.describe('V1.2 doctor ready notify smoke', () => {
  test.beforeAll(() => {
    runModulePhp('bin/upgrade_sql.php');
    runModulePhp('scripts/pilot-enable-v12-doctor-notify.php');
    runModulePhp('scripts/e2e-prep-golden-path.php');
    const seedScript = path.join(MODULE_ROOT, 'acl/seed_pilot_users.php');
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test.afterAll(() => {
    // A leftover ready_for_doctor Notify visit fires a persistent "Patient
    // ready" toast on every later doctor-desk load, parking over the queue
    // toolbar and intercepting clicks in unrelated specs.
    runModulePhp('scripts/v12-doctor-notify-smoke-fixture.php', 'cleanup=1');
  });

  test('debounced in-app toast; no notify when Taking patients OFF', async ({ page }) => {
    test.setTimeout(300_000);
    const fixture = readNotifyFixture();
    const creds = credentials();
    const primary = fixture.primary;
    const secondary = fixture.secondary;
    const doctorUserId = fixture.doctor_user_id;

    await test.step('Nurse sends primary patient to doctor pool', async () => {
      await login(page, creds.nurse.username, creds.nurse.password);

      const queueResp = page.waitForResponse(
        (resp) => resp.url().includes('triage.queue') && resp.ok(),
        { timeout: 45000 },
      );
      await page.goto(`${MODULE_BASE}/triage.php`);
      const queueResponse = await queueResp;
      const queueBody = await queueResponse.json();
      expect(queueBody.success, JSON.stringify(queueBody)).toBe(true);

      await triageSendPatient(page, primary.lname);

      const logCount = readNotifyLogCount(primary.visit_id, doctorUserId);
      expect(logCount.count, JSON.stringify(logCount)).toBe(1);

      await logout(page);
    });

    await test.step('Doctor sees Patient ready toast once', async () => {
      await login(page, creds.doctor.username, creds.doctor.password);
      await page.goto(`${MODULE_BASE}/doctor.php`);

      await page.waitForResponse(
        (resp) => resp.url().includes('doctor.queue') && resp.ok(),
        { timeout: 30000 },
      );

      // The notice is a sonner desk toast now (auto-dismisses; no Dismiss
      // button, no role=status) — assert content, let it expire, then prove
      // the once-per-session debounce holds across a queue refresh.
      const readyToast = page.locator('[data-sonner-toast]').filter({ hasText: /Patient ready/i });
      await expect(readyToast).toContainText(primary.lname, { timeout: 15000 });
      await expect(readyToast).toContainText(String(primary.queue_number));
      await expect(readyToast).toHaveCount(0, { timeout: 20000 });

      await page.locator('#nc-doctor-refresh').click();
      await page.waitForResponse(
        (resp) => resp.url().includes('doctor.queue') && resp.ok(),
        { timeout: 30000 },
      );
      await expect(page.locator('[data-sonner-toast]').filter({ hasText: /Patient ready/i })).toHaveCount(0);
    });

    await test.step('Doctor pauses Taking patients; nurse sends secondary — no new toast', async () => {
      // Roster redesign: the personal duty toggle lives in the desk status bar.
      const takingBtn = page.getByRole('button', { name: 'Taking patients' });
      await expect(takingBtn).toBeVisible({ timeout: 15000 });
      const pauseResp = page.waitForResponse(
        (resp) => resp.url().includes('doctor.roster.set_taking') && resp.ok(),
        { timeout: 15000 },
      );
      await takingBtn.click();
      await pauseResp;
      await expect(page.getByRole('button', { name: 'Paused' })).toBeVisible();

      await logout(page);

      runModulePhp('scripts/release-pilot-doctor-desks.php');
      await login(page, creds.nurse.username, creds.nurse.password);
      await page.goto(`${MODULE_BASE}/triage.php`);
      await page.waitForResponse(
        (resp) => resp.url().includes('triage.queue') && resp.ok(),
        { timeout: 45000 },
      );

      await triageSendPatient(page, secondary.lname);

      const logCount = readNotifyLogCount(secondary.visit_id, doctorUserId);
      expect(logCount.count, JSON.stringify(logCount)).toBe(0);

      await logout(page);

      runModulePhp('scripts/release-pilot-doctor-desks.php');
      await login(page, creds.doctor.username, creds.doctor.password);
      await page.goto(`${MODULE_BASE}/doctor.php`);
      await page.evaluate(() => {
        sessionStorage.removeItem('doctor_desk_active_visit_id');
        sessionStorage.removeItem('doctor_desk_left_via');
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForResponse(
        (resp) => resp.url().includes('doctor.queue') && resp.ok(),
        { timeout: 30000 },
      );

      await expect(page.locator('[data-sonner-toast]').filter({ hasText: /Patient ready/i })).toHaveCount(0);

      const secondaryCard = await waitForQueueCard(page, secondary.lname);
      await expect(secondaryCard).toBeVisible({ timeout: 20000 });
    });
  });
});

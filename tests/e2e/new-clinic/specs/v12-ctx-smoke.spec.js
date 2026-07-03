/**
 * V1.2-CTX smoke — legacy strip (T1-F18) + shared-device warning (T1-F19).
 *
 * @group e2e
 * @group new-clinic-v12-ctx
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { login: loginAsAdmin, BASE_URL, MODULE_BASE } = require('../helpers/auth');

const ADMIN_USER = process.env.TEST_USERNAME_ADMIN || 'Adminstrator';
const ADMIN_PASS = process.env.TEST_PASSWORD_ADMIN || 'passpass1';
const CHART_PID = Number(process.env.TEST_CHART_PID || '4');
const ALT_PID = Number(process.env.TEST_ALT_CHART_PID || '1');

const SCRIPTS_DIR = path.join(
  __dirname,
  '../../../../interface/modules/custom_modules/oe-module-new-clinic/scripts',
);

function runPhpScript(scriptName) {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(SCRIPTS_DIR, scriptName);
  execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
}

function readCtxFixture() {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(SCRIPTS_DIR, 'v12-ctx-smoke-fixture.php');
  const raw = execSync(`"${php}" "${script}"`, { encoding: 'utf8' }).trim();
  return JSON.parse(raw);
}

test.describe('V1.2-CTX smoke', () => {
  test.beforeAll(() => {
    runPhpScript('e2e-prep-golden-path.php');
    runPhpScript('pilot-enable-legacy-chart-context.php');
  });

  test('CTX-1: demographics shows legacy patient context strip via set_pid', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);

    await page.goto(
      `${BASE_URL}/interface/patient_file/summary/demographics.php?set_pid=${CHART_PID}`,
    );

    const strip = page.locator('#legacy-patient-context-strip');
    await expect(strip).toBeVisible({ timeout: 30000 });
    await expect(strip).toHaveAttribute('data-host', 'legacy_chart');
    await expect(strip.getByText(/MRN/i)).toBeVisible();
  });

  test('CTX-5: triage desk shows session mismatch banner after patient switch', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = readCtxFixture();
    expect(fixture.has_waiting_visit, JSON.stringify(fixture)).toBe(true);

    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);

    const queueResp = page.waitForResponse(
      (resp) => resp.url().includes('triage.queue') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/triage.php`);
    const response = await queueResp;
    const body = await response.json();
    const visits = body.data?.visits ?? [];
    const waiting = visits.find(
      (v) => v.state === 'waiting' || v.state === 'in_triage' || v.id === fixture.visit_id,
    );
    expect(waiting, 'Fixture should seed a waiting/in_triage visit for CTX smoke').toBeTruthy();

    const visitPid = Number(waiting.pid);
    const mismatchPid = visitPid === ALT_PID ? CHART_PID : ALT_PID;

    await page.evaluate(
      ({ visitId, key }) => {
        window.sessionStorage.setItem(key, String(visitId));
      },
      { visitId: waiting.visit_id ?? waiting.id, key: 'triage_desk_active_visit_id' },
    );

    await page.goto(
      `${BASE_URL}/interface/patient_file/summary/demographics.php?set_pid=${mismatchPid}`,
    );

    const probeResp = page.waitForResponse(
      (resp) => resp.url().includes('desk.shared_session_probe') && resp.ok(),
      { timeout: 45000 },
    );
    await page.goto(`${MODULE_BASE}/triage.php`);
    const probe = await probeResp;
    const probeBody = await probe.json();
    expect(probeBody.data?.mismatch).toBe(true);

    await expect(page.getByText(/Browser session is on another patient/i)).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByRole('button', { name: /Restore encounter session/i })).toBeVisible();
  });
});

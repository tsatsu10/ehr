/**
 * V1.1-LAB-ORD smoke — PRD M4-F36 doctor panel quick order (@new-clinic-v11-lab-ord).
 *
 * @group e2e
 * @group new-clinic-v11-lab-ord
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

function readLabOrdFixture() {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(MODULE_ROOT, 'scripts/v11-lab-ord-smoke-fixture.php');
  const raw = execSync(`"${php}" "${script}"`, { encoding: 'utf8' }).trim();
  return JSON.parse(raw);
}

async function waitForQueueCard(page, lname) {
  const card = page.locator(`.nc-queue-card:has-text("${lname}")`).first();
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

async function prepareDoctorDesk(page) {
  await page.evaluate(() => {
    sessionStorage.removeItem('doctor_desk_active_visit_id');
    sessionStorage.removeItem('doctor_desk_left_via');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForResponse(
    (resp) => resp.url().includes('doctor.queue') && resp.ok(),
    { timeout: 20000 },
  ).catch(() => {});
}

async function triageSendPatient(page, lname) {
  const triageCard = await waitForQueueCard(page, lname);
  await expect(triageCard).toBeVisible({ timeout: 30000 });
  await triageCard.click();
  await expect(page.locator('#nc-triage-active-pane')).toContainText(lname, { timeout: 15000 });

  const startTriage = page.getByRole('button', { name: 'Start triage' });
  if (await startTriage.isVisible().catch(() => false)) {
    await startTriage.click();
    await page.waitForTimeout(500);
  }

  await page.locator('#nc-vitals-bps').waitFor({ state: 'visible', timeout: 15000 });
  await page.fill('#nc-vitals-bps', '118');
  await page.fill('#nc-vitals-bpd', '76');
  await page.fill('#nc-vitals-pulse', '70');
  await page.fill('#nc-vitals-temperature', '36.7');
  await page.fill('#nc-vitals-weight', '68');
  await page.fill('#nc-vitals-respiration', '16');
  await page.getByRole('button', { name: 'Save vitals' }).click();
  await page.getByRole('button', { name: 'Send to doctor' }).click();
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

test.describe('V1.1-LAB-ORD smoke', () => {
  test.beforeAll(() => {
    runModulePhp('bin/upgrade_sql.php');
    runModulePhp('scripts/pilot-enable-v11-lab-ord.php');
    runModulePhp('scripts/e2e-prep-golden-path.php');
    const seedScript = path.join(MODULE_ROOT, 'acl/seed_pilot_users.php');
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('doctor desk exposes lab panel order flag and catalog', async ({ page }) => {
    test.setTimeout(90_000);
    const fixture = readLabOrdFixture();
    const creds = credentials();

    expect(fixture.catalog_enabled, JSON.stringify(fixture)).toBe(true);
    expect(fixture.catalog_has_tests, JSON.stringify(fixture)).toBe(true);

    await login(page, creds.doctor.username, creds.doctor.password);
    await page.goto(`${MODULE_BASE}/doctor.php`);

    const island = page.locator('[data-island="doctor-desk"]');
    await expect(island).toBeVisible({ timeout: 20000 });
    const props = JSON.parse((await island.getAttribute('data-props')) ?? '{}');
    expect(props.labPanelOrderEnabled).toBe(true);

    const catalogUrl = `${props.ajaxUrl}?action=doctor.lab_panel_catalog${
      props.facilityId ? `&facility_id=${props.facilityId}` : ''
    }`;
    const response = await page.request.get(catalogUrl);
    expect(response.ok(), await response.text()).toBe(true);
    const body = await response.json();
    expect(body.success, JSON.stringify(body)).toBe(true);
    expect(body.data?.has_catalog, JSON.stringify(body.data)).toBe(true);
    expect((body.data?.tests ?? []).length).toBeGreaterThan(0);
  });

  test('doctor places starter panel quick lab order during consult', async ({ page }) => {
    test.setTimeout(300_000);
    const fixture = readLabOrdFixture();
    const creds = credentials();

    await test.step('Nurse sends patient to doctor pool', async () => {
      await login(page, creds.nurse.username, creds.nurse.password);
      await page.goto(`${MODULE_BASE}/triage.php`);
      await triageSendPatient(page, fixture.lname);
      await logout(page);
    });

    await test.step('Doctor takes patient and places lab panel order', async () => {
      await login(page, creds.doctor.username, creds.doctor.password);
      await page.goto(`${MODULE_BASE}/doctor.php`);
      await prepareDoctorDesk(page);

      const doctorCard = await waitForQueueCard(page, fixture.lname);
      const takeResp = page.waitForResponse(
        (resp) => resp.url().includes('doctor.take') && resp.ok(),
        { timeout: 45000 },
      );
      await doctorCard.click();
      await takeResp;
      await expect(page.locator('#nc-doctor-active-pane')).toContainText(fixture.lname, {
        timeout: 20000,
      });

      const quickLab = page.getByRole('button', { name: 'Quick lab order' });
      await expect(quickLab).toBeVisible({ timeout: 15000 });

      const catalogResp = page.waitForResponse(
        (resp) => resp.url().includes('doctor.lab_panel_catalog') && resp.ok(),
        { timeout: 45000 },
      );
      await quickLab.click();
      const catalogBody = await (await catalogResp).json();
      expect(catalogBody.success, JSON.stringify(catalogBody)).toBe(true);
      expect(catalogBody.data?.has_catalog, JSON.stringify(catalogBody.data)).toBe(true);

      await expect(page.locator('#nc-doctor-lab-panel-modal')).toBeVisible({ timeout: 15000 });
      await page.locator('#nc-lab-panel-starter').click();

      const checked = page.locator('.nc-lab-panel-test:checked');
      await expect(checked.first()).toBeVisible({ timeout: 10000 });
      const selectedCount = await checked.count();
      expect(selectedCount).toBeGreaterThan(0);

      const placeResp = page.waitForResponse(
        (resp) => resp.url().includes('doctor.lab_panel_place') && resp.ok(),
        { timeout: 45000 },
      );
      await page.locator('#nc-lab-panel-place').click();
      const placeBody = await (await placeResp).json();
      expect(placeBody.success, JSON.stringify(placeBody)).toBe(true);
      expect(placeBody.data?.procedure_order_id ?? placeBody.data?.order_id, JSON.stringify(placeBody.data)).toBeTruthy();

      await expect(page.locator('#nc-doctor-lab-panel-modal')).toBeHidden({ timeout: 15000 });
    });
  });
});

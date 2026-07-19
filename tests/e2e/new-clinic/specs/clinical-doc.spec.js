/**
 * Clinical Documentation Hub — M17 smoke (hub shell + catalog API + doctor encounter route).
 *
 * @group e2e
 * @group new-clinic-mandatory
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login: loginAsAdmin, logout } = require('../helpers/auth');
const { registerAndStartVisit } = require('../helpers/registration');

const ADMIN_USER = process.env.TEST_USERNAME_ADMIN || 'Adminstrator';
const ADMIN_PASS = process.env.TEST_PASSWORD_ADMIN || 'passpass1';

function runPhpScript(scriptName) {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(
    __dirname,
    '../../../../interface/modules/custom_modules/oe-module-new-clinic/scripts',
    scriptName,
  );
  execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
}

function pilotPrep() {
  runPhpScript('pilot-enable-v11-doc.php');
}

function credentials() {
  return {
    reception: {
      username: process.env.TEST_USERNAME_RECEPTION || 'reception_user',
      password: process.env.TEST_PASSWORD_RECEPTION || 'test_pass',
    },
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

function generatePatientName() {
  const timestamp = Date.now();
  const suffix = String(timestamp).slice(-8);
  // Registration validates names as letters-only — map digits to letters.
  const letterSuffix = suffix.replace(/\d/g, (d) => 'abcdefghij'[Number(d)]);
  return {
    fname: `Etoe${letterSuffix.slice(0, 4)}`,
    lname: `Doc${letterSuffix}`,
    fullName: `Etoe${letterSuffix.slice(0, 4)} Doc${letterSuffix}`,
    phone: `0246${suffix.slice(-6).padStart(6, '0')}`,
    nationalId: `GHDOC${timestamp}`,
  };
}

async function waitForQueueCard(page, lname) {
  const card = page.locator(`[class*="queue-card"]:has-text("${lname}")`).first();
  for (let attempt = 0; attempt < 15; attempt += 1) {
    if (await card.isVisible().catch(() => false) && await card.isEnabled().catch(() => false)) {
      return card;
    }
    const refresh = page.locator('#nc-doctor-refresh');
    if (await refresh.isVisible().catch(() => false)) {
      await refresh.click();
      await page.waitForResponse(
        (resp) => resp.url().includes('doctor.queue') && resp.ok(),
        { timeout: 20000 },
      ).catch(() => {});
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

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const loading = page.getByText('Loading consult');
    if (await loading.isVisible().catch(() => false)) {
      await expect(loading).toBeHidden({ timeout: 20000 });
    }

    const completeBtn = page.locator('#nc-doctor-complete-btn');
    if (await completeBtn.isVisible().catch(() => false) && await completeBtn.isEnabled().catch(() => false)) {
      await completeBtn.click();
      await expect(page.locator('#nc-doctor-routing-modal')).toBeVisible();
      const labCheckbox = page.locator('#nc-routing-lab');
      if (await labCheckbox.isChecked().catch(() => false)) {
        await labCheckbox.uncheck();
      }
      const rxCheckbox = page.locator('#nc-routing-rx');
      if (await rxCheckbox.isChecked().catch(() => false)) {
        await rxCheckbox.uncheck();
      }
      await page.locator('#nc-routing-confirm').click();
      await expect(page.locator('#nc-doctor-routing-modal')).toBeHidden({ timeout: 15000 });
      await page.locator('#nc-doctor-refresh').click();
      await page.waitForTimeout(1000);
      continue;
    }
    break;
  }
}

test.describe('Clinical Documentation Hub', () => {
  test.beforeAll(() => {
    runPhpScript('e2e-prep-golden-path.php');
    runPhpScript('pilot-enable-v11-doc.php');
  });

  test('admin loads hub shell and clinical catalog API', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(`${MODULE_BASE}/clinical-doc/index.php`);

    await expect(page.locator('#nc-clinical-doc')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#nc-clinicaldoc-toolbar button[data-tab="visit"]')).toBeVisible();
    await expect(page.locator('#nc-clinicaldoc-toolbar button[data-tab="consult"]')).toBeVisible();

    const propsRaw = await page.locator('#nc-clinical-doc').getAttribute('data-props');
    expect(propsRaw).toBeTruthy();
    const props = JSON.parse(propsRaw);
    const catalogResp = await page.request.get(
      `${props.ajaxUrl}?action=clinical_doc.catalog&lens=consult`,
    );
    expect(catalogResp.ok()).toBeTruthy();
    const catalogJson = await catalogResp.json();
    expect(catalogJson.success).toBe(true);
    expect(Array.isArray(catalogJson.data?.cards)).toBe(true);

    await page.locator('#nc-clinicaldoc-toolbar button[data-tab="consult"]').click();
    await expect(page.getByText(/Go to Doctor Desk/i)).toBeVisible({ timeout: 15000 });
  });

  test('doctor open encounter routes to documentation hub with visit context', async ({ page }) => {
    test.setTimeout(180_000);
    const creds = credentials();
    const patient = generatePatientName();

    await logout(page).catch(() => {});
    await loginAsAdmin(page, creds.reception.username, creds.reception.password);
    await page.goto(`${MODULE_BASE}/front-desk.php`);
    await registerAndStartVisit(page, patient);

    await logout(page);
    await loginAsAdmin(page, creds.nurse.username, creds.nurse.password);
    await page.goto(`${MODULE_BASE}/triage.php`);
    const triageCard = await waitForQueueCard(page, patient.lname);
    await triageCard.click();
    await expect(page.locator('#nc-triage-active-pane')).toContainText(patient.lname, { timeout: 15000 });

    const startTriage = page.getByRole('button', { name: 'Start triage' });
    if (await startTriage.isVisible().catch(() => false)) {
      await startTriage.click();
      await page.waitForTimeout(500);
    }

    await page.fill('#nc-vitals-bps', '120');
    await page.fill('#nc-vitals-bpd', '80');
    await page.fill('#nc-vitals-pulse', '72');
    await page.fill('#nc-vitals-temperature', '37.0');
    await page.fill('#nc-vitals-weight', '70');
    await page.fill('#nc-vitals-respiration', '16');
    // The triage desk auto-saves vitals - click Save if still enabled, then
    // wait for the SAVED STATE (not the response, which can race the
    // auto-save), and await the send mutation itself.
    const saveButton = page.getByRole('button', { name: 'Save vitals' });
    if (await saveButton.isEnabled().catch(() => false)) {
      await saveButton.click().catch(() => {});
    }
    await expect(page.getByText(/Vitals saved/i).first()).toBeVisible({ timeout: 30000 });
    const sendResp = page.waitForResponse(
      (resp) => resp.url().includes('triage.send_doctor') && resp.ok(),
      { timeout: 30000 },
    );
    await page.getByRole('button', { name: 'Send to doctor' }).click();
    await sendResp;

    await logout(page);
    await loginAsAdmin(page, creds.doctor.username, creds.doctor.password);
    await page.goto(`${MODULE_BASE}/doctor.php`);
    await prepareDoctorDesk(page);

    const doctorCard = await waitForQueueCard(page, patient.lname);
    await doctorCard.click();
    await expect(page.locator('#nc-doctor-active-pane')).toContainText(patient.lname, { timeout: 30000 });
    await expect(page.locator('.nc-shortcut-btn[data-shortcut="encounter_hub"]')).toBeVisible({
      timeout: 30000,
    });

    const preflightPromise = page.waitForResponse(
      (resp) => resp.url().includes('doctor.shortcut_preflight') && resp.ok(),
      { timeout: 60000 },
    );
    const navigationPromise = page.waitForURL(/clinical-doc\/index\.php/, { timeout: 60000 });
    await page.locator('.nc-shortcut-btn[data-shortcut="encounter_hub"]').click();
    await Promise.all([preflightPromise, navigationPromise]);

    await expect(page).toHaveURL(/clinical-doc\/index\.php\?visit_id=\d+/, { timeout: 20000 });
    await expect(page.locator('#nc-clinical-doc')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#nc-clinicaldoc-toolbar button[data-tab="visit"]')).toBeVisible();
  });
});

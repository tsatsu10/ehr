/**
 * Native encounter consult form — hub → save → validate → sign → sign overview.
 *
 * @group e2e
 * @group new-clinic-encounter-consult
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login, logout } = require('../helpers/auth');
const { registerAndStartVisit } = require('../helpers/registration');

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
    lname: `Enc${letterSuffix}`,
    fullName: `Etoe${letterSuffix.slice(0, 4)} Enc${letterSuffix}`,
    phone: `0247${suffix.slice(-6).padStart(6, '0')}`,
    nationalId: `GHENC${timestamp}`,
  };
}

async function waitForQueueCard(page, lname) {
  const card = page.locator(`[class*="queue-card"]:has-text("${lname}")`).first();
  for (let attempt = 0; attempt < 15; attempt += 1) {
    if (await card.isVisible().catch(() => false) && await card.isEnabled().catch(() => false)) {
      return card;
    }
    const refresh = page.locator('#nc-doctor-refresh, #nc-triage-refresh').first();
    if (await refresh.isVisible().catch(() => false)) {
      await refresh.click();
      await page.waitForResponse(
        (resp) => (resp.url().includes('doctor.queue') || resp.url().includes('triage.queue')) && resp.ok(),
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
  // Advisory-routing chooser (config can persist from the routing spec):
  // confirm the pool send when the dialog appears.
  const poolBtn = page.getByRole('button', { name: 'Send to doctor pool' });
  await poolBtn.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  if (await poolBtn.isVisible().catch(() => false)) {
    await poolBtn.click();
  }
  await sendResp;

}

// Desktop renders one section at a time (focus mode) — only the active section's
// fields are in the DOM, so navigate via the section nav before each fill.
async function gotoConsultSection(page, sectionLabel) {
  const nav = page.getByRole('navigation', { name: 'Consult note sections' });
  await nav.getByRole('button', { name: sectionLabel }).click();
}

async function fillGeneralOpdConsultNote(page) {
  await expect(page.locator('#nc-encounter-consult-root')).toBeVisible({ timeout: 30000 });

  const allergyAck = page.locator('label:has-text("I reviewed the allergy information") input[type="checkbox"]');
  if (await allergyAck.isVisible().catch(() => false)) {
    await allergyAck.check();
  }
  const medsAck = page.locator('label:has-text("I reviewed the medication list") input[type="checkbox"]');
  if (await medsAck.isVisible().catch(() => false)) {
    await medsAck.check();
  }

  await gotoConsultSection(page, /Chief complaint/);
  await page.locator('#encounter-cc').fill('Headache for two days');

  await gotoConsultSection(page, /History of present illness/);
  await page.locator('#encounter-hpi').fill('Gradual onset without trauma or fever.');

  await gotoConsultSection(page, /Review of systems/);
  const markAllNegative = page.getByRole('button', { name: 'Mark all reviewed negative' });
  if (await markAllNegative.isVisible().catch(() => false)) {
    await markAllNegative.click();
  }

  await gotoConsultSection(page, /Physical examination/);
  await page.locator('#encounter-pe-general').fill('Alert, no focal neurological deficit.');

  await gotoConsultSection(page, /Assessment & plan/);
  // The section seeds a default problem row — only add one when none exists.
  if (await page.getByLabel('Problem label').count() === 0) {
    await page.getByRole('button', { name: 'Add problem' }).click();
  }
  await page.getByLabel('Problem label').first().fill('Tension headache');
  await page.getByLabel('Assessment narrative').first().fill('Likely primary tension headache.');
  await page.getByRole('button', { name: 'Add item' }).first().click();
  await page.getByPlaceholder('Plan action / recommendation').first().fill('Rest, hydration, and analgesia as needed.');

  await gotoConsultSection(page, /Follow-up/);
  await page.locator('#encounter-follow-up-instructions').fill('Return in two weeks if symptoms persist.');
}

test.describe('Native encounter consult form', () => {
  test.beforeAll(() => {
    runModulePhp('bin/upgrade_sql.php');
    runModulePhp('scripts/e2e-prep-golden-path.php');
    runModulePhp('scripts/pilot-enable-v11-doc.php');
    runModulePhp('scripts/pilot-enable-native-encounter-note.php');
    runModulePhp('scripts/e2e-set-encounter-note-config.php', 'release_doctor=1');
    const seedScript = path.join(MODULE_ROOT, 'acl/seed_pilot_users.php');
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('hub opens native form, save, validate, sign, and sign overview updates', async ({ page }) => {
    test.setTimeout(420_000);
    const creds = credentials();
    const patient = generatePatientName();

    await test.step('Register visit and send to doctor', async () => {
      await login(page, creds.reception.username, creds.reception.password);
      await page.goto(`${MODULE_BASE}/front-desk.php`);
      await registerAndStartVisit(page, patient);
      await logout(page);

      await login(page, creds.nurse.username, creds.nurse.password);
      await page.goto(`${MODULE_BASE}/triage.php`);
      await triageSendPatient(page, patient.lname);
      await logout(page);
    });

    let hubUrl = '';

    await test.step('Doctor opens documentation hub', async () => {
      await login(page, creds.doctor.username, creds.doctor.password);
      await page.goto(`${MODULE_BASE}/doctor.php`);
      await prepareDoctorDesk(page);

      const doctorCard = await waitForQueueCard(page, patient.lname);
      await doctorCard.click();
      await expect(page.locator('#nc-doctor-active-pane')).toContainText(patient.lname, {
        timeout: 30000,
      });

      const preflightPromise = page.waitForResponse(
        (resp) => resp.url().includes('doctor.shortcut_preflight') && resp.ok(),
        { timeout: 60000 },
      );
      const navigationPromise = page.waitForURL(/clinical-doc\/index\.php/, { timeout: 60000 });
      await page.locator('.nc-shortcut-btn[data-shortcut="encounter_hub"]').click();
      await Promise.all([preflightPromise, navigationPromise]);

      hubUrl = page.url();
      await expect(page.locator('#nc-clinical-doc')).toBeVisible({ timeout: 20000 });
      await page.locator('#nc-clinicaldoc-toolbar button[data-tab="visit"]').click();
    });

    await test.step('Open native consultation note from hub card', async () => {
      const consultCard = page.locator('.nc-clinicaldoc-card').filter({ hasText: 'Consultation note' });
      await expect(consultCard).toBeVisible({ timeout: 20000 });

      const openFormPromise = page.waitForResponse(
        (resp) => resp.url().includes('clinical_doc.open_form') && resp.ok(),
        { timeout: 60000 },
      );
      const navigationPromise = page.waitForURL(/encounter-consult\.php/, { timeout: 60000 });
      await consultCard.getByRole('button', { name: 'Open form' }).click();
      await Promise.all([openFormPromise, navigationPromise]);

      await expect(page.locator('#nc-encounter-consult-root')).toBeVisible({ timeout: 30000 });
    });

    await test.step('Save and validate consult note', async () => {
      await fillGeneralOpdConsultNote(page);

      const savePromise = page.waitForResponse(
        (resp) => resp.url().includes('encounter_note.save') && resp.ok(),
        { timeout: 60000 },
      );
      await page.getByRole('button', { name: 'Save draft' }).click();
      const saveResp = await savePromise;
      const saveJson = await saveResp.json();
      expect(saveJson.success, JSON.stringify(saveJson)).toBe(true);

      const validatePromise = page.waitForResponse(
        (resp) => resp.url().includes('encounter_note.validate') && resp.ok(),
        { timeout: 60000 },
      );
      await page.getByRole('button', { name: 'Validate' }).click();
      const validateResp = await validatePromise;
      const validateJson = await validateResp.json();
      expect(validateJson.success, JSON.stringify(validateJson)).toBe(true);
      expect(validateJson.data?.valid, JSON.stringify(validateJson)).toBe(true);
      await expect(page.getByText(/Validation passed/i)).toBeVisible({ timeout: 15000 });
    });

    await test.step('Sign consult note', async () => {
      await page.getByRole('button', { name: 'Sign note' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.locator('#encounter-sign-password').fill(creds.doctor.password);

      const signPromise = page.waitForResponse(
        (resp) => resp.url().includes('encounter_note.sign') && resp.ok(),
        { timeout: 60000 },
      );
      await page.getByRole('dialog').getByRole('button', { name: 'Sign note' }).click();
      const signResp = await signPromise;
      const signJson = await signResp.json();
      expect(signJson.success, JSON.stringify(signJson)).toBe(true);
      expect(signJson.data?.signed, JSON.stringify(signJson)).toBe(true);

      await expect(page.getByText('Signed consultation note')).toBeVisible({ timeout: 15000 });
    });

    await test.step('Hub sign overview shows encounter signed', async () => {
      const summaryPromise = page.waitForResponse(
        (resp) => resp.url().includes('clinical_doc.visit_summary') && resp.ok(),
        { timeout: 60000 },
      );
      await page.getByRole('link', { name: 'Back', exact: true }).click();
      await summaryPromise;

      await expect(page).toHaveURL(/clinical-doc\/index\.php/);
      await page.locator('#nc-clinicaldoc-toolbar button[data-tab="visit"]').click();

      const overview = page.locator('.nc-clinicaldoc-sign-overview');
      await expect(overview).toBeVisible({ timeout: 20000 });
      await expect(overview).toContainText('Encounter signed');

      const signedCard = page.locator('.nc-clinicaldoc-card').filter({ hasText: 'Consultation note' });
      await expect(signedCard).toContainText('Signed');
    });

    expect(hubUrl).toMatch(/visit_id=\d+/);
  });
});

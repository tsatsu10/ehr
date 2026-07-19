/**
 * New Clinic E2E Golden Path Test (Test 23)
 *
 * Registration → triage vitals → doctor route to pharmacy → pharmacy skip → cashier payment.
 *
 * @group e2e
 * @group new-clinic-mandatory
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login, logout } = require('../helpers/auth');
const { registerAndStartVisit } = require('../helpers/registration');
const { completeCashierVisit } = require('../helpers/cashier');

test.describe.configure({ timeout: 300_000 });

function generatePatientName() {
  const timestamp = Date.now();
  const suffix = String(timestamp).slice(-8);
  // Registration validates names as letters-only — map digits to letters.
  const letterSuffix = suffix.replace(/\d/g, (d) => 'abcdefghij'[Number(d)]);
  return {
    fname: `Etoe${letterSuffix.slice(0, 4)}`,
    lname: `Pt${letterSuffix}`,
    fullName: `Etoe${letterSuffix.slice(0, 4)} Pt${letterSuffix}`,
    phone: `0244${suffix.slice(-6).padStart(6, '0')}`,
    nationalId: `GHA${timestamp}`,
  };
}

async function waitForQueueCard(page, lname) {
  const card = page.locator(`[class*="queue-card"]:has-text("${lname}")`).first();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await card.isVisible().catch(() => false) && await card.isEnabled().catch(() => false)) {
      return card;
    }
    const refresh = page.getByRole('button', { name: 'Refresh' });
    if (await refresh.isVisible().catch(() => false)) {
      await refresh.click({ timeout: 5000 }).catch(() => {}); // toast may briefly intercept
    }
    await page.waitForTimeout(2000);
  }
  return card;
}

async function resetDoctorDeskSession(page) {
  await page.evaluate(() => {
    sessionStorage.removeItem('doctor_desk_active_visit_id');
    sessionStorage.removeItem('doctor_desk_left_via');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
}

async function prepareDoctorDesk(page) {
  await resetDoctorDeskSession(page);

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
      await page.getByRole('button', { name: 'Refresh' }).click();
      await page.waitForTimeout(1000);
      continue;
    }
    break;
  }
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
    pharmacy: {
      username: process.env.TEST_USERNAME_PHARMACY || 'pharmacy_user',
      password: process.env.TEST_PASSWORD_PHARMACY || 'test_pass',
    },
    cashier: {
      username: process.env.TEST_USERNAME_CASHIER || 'cashier_user',
      password: process.env.TEST_PASSWORD_CASHIER || 'test_pass',
    },
  };
}

test.describe('New Clinic Golden Path Workflow', () => {
  test.beforeAll(() => {
    const script = path.join(
      __dirname,
      '../../../../interface/modules/custom_modules/oe-module-new-clinic/scripts/e2e-prep-golden-path.php',
    );
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
  });

  test('complete patient journey from registration to payment', async ({ page }) => {
    const patient = generatePatientName();
    const creds = credentials();
    let queueNumber;
    let visitClosed = false;

    await test.step('Register patient and start visit', async () => {
      await login(page, creds.reception.username, creds.reception.password);
      await page.goto(`${MODULE_BASE}/front-desk.php`);
      const result = await registerAndStartVisit(page, patient);
      queueNumber = result.queueNumber;
    });

    await test.step('Enter vitals in triage', async () => {
      await logout(page);
      await login(page, creds.nurse.username, creds.nurse.password);
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

      // The triage desk auto-saves vitals — drive to the SAVED STATE, then
      // await the send mutation (and confirm the advisory-routing chooser
      // when other specs left that config on).
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
      const poolBtn = page.getByRole('button', { name: 'Send to doctor pool' });
      await poolBtn.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
      if (await poolBtn.isVisible().catch(() => false)) {
        await poolBtn.click();
      }
      await sendResp;
    });

    await test.step('Doctor consultation and pharmacy routing', async () => {
      await logout(page);
      await login(page, creds.doctor.username, creds.doctor.password);
      await page.goto(`${MODULE_BASE}/doctor.php`);
      await prepareDoctorDesk(page);

      const doctorCard = await waitForQueueCard(page, patient.lname);
      await doctorCard.click();
      await expect(page.locator('#nc-doctor-active-pane')).toContainText(
        patient.lname,
        { timeout: 20000 },
      );

      await expect(page.locator('.nc-shortcut-btn[data-shortcut="encounter"]')).toBeVisible();
      await expect(page.locator('.nc-shortcut-btn[data-shortcut="lab"]')).toBeVisible();

      await page.locator('#nc-doctor-complete-btn').click();
      await expect(page.locator('#nc-doctor-routing-modal')).toBeVisible();

      const labCheckbox = page.locator('#nc-routing-lab');
      if (await labCheckbox.isChecked().catch(() => false)) {
        await labCheckbox.uncheck();
      }

      const rxCheckbox = page.locator('#nc-routing-rx');
      await rxCheckbox.check();
      await expect(rxCheckbox).toBeChecked();

      await page.locator('#nc-routing-confirm').click();
      await expect(page.locator('.alert-success, #nc-doctor-routing-modal')).toBeHidden({ timeout: 15000 });
    });

    await test.step('Pharmacy desk skip to payment', async () => {
      await logout(page);
      await login(page, creds.pharmacy.username, creds.pharmacy.password);
      await page.goto(`${MODULE_BASE}/pharmacy.php`);

      const pharmacyCard = await waitForQueueCard(page, patient.lname);
      await pharmacyCard.click();
      await expect(page.locator('#nc-pharmacy-active-pane')).toContainText(
        patient.lname,
        { timeout: 15000 },
      );

      const skipBtn = page.locator('#nc-pharmacy-skip-btn');
      await expect(skipBtn).toBeVisible({ timeout: 10000 });
      await skipBtn.click();

      await expect(page.locator('#nc-pharmacy-skip-modal')).toBeVisible();
      await page.fill('#nc-pharmacy-skip-reason', 'E2E golden path — skip pharmacy queue');
      await page.locator('#nc-pharmacy-skip-modal').getByRole('button', { name: 'Skip to payment' }).click();
      await expect(page.locator('#nc-pharmacy-skip-modal')).toBeHidden({ timeout: 15000 });
      await expect(page.locator(`[class*="queue-card"]:has-text("${patient.lname}")`)).toHaveCount(0, {
        timeout: 15000,
      });
    });

    await test.step('Cashier payment or zero close', async () => {
      await logout(page);
      await login(page, creds.cashier.username, creds.cashier.password);
      await page.goto(`${MODULE_BASE}/cashier.php`);

      const cashierCard = await waitForQueueCard(page, patient.lname);
      await cashierCard.click();
      await completeCashierVisit(page, patient, 'E2E golden path — no charges on visit');
      visitClosed = true;
    });

    await test.step('Verify journey completed', async () => {
      expect(visitClosed).toBe(true);
      expect(patient.lname).toBeTruthy();
      // eslint-disable-next-line no-console
      console.log(`Golden path OK: ${patient.fullName} queue=${queueNumber ?? 'N/A'}`);
    });
  });
});

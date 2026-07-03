/**
 * New Clinic E2E — lab route + cashier + bill ops close day
 *
 * Registration → triage → doctor route to lab → lab skip → cashier payment → close day daysheet.
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
  return {
    fname: `E2E${suffix.slice(0, 4)}`,
    lname: `Lb${suffix}`,
    fullName: `E2E${suffix.slice(0, 4)} Lb${suffix}`,
    phone: `0246${suffix.slice(-6).padStart(6, '0')}`,
    nationalId: `GHLB${timestamp}`,
  };
}

async function waitForQueueCard(page, lname) {
  const card = page.locator(`.nc-queue-card:has-text("${lname}")`).first();
  for (let attempt = 0; attempt < 8; attempt += 1) {
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
    lab: {
      username: process.env.TEST_USERNAME_LAB || 'lab_user',
      password: process.env.TEST_PASSWORD_LAB || 'test_pass',
    },
    cashier: {
      username: process.env.TEST_USERNAME_CASHIER || 'cashier_user',
      password: process.env.TEST_PASSWORD_CASHIER || 'test_pass',
    },
    admin: {
      username: process.env.TEST_USERNAME_ADMIN || 'Adminstrator',
      password: process.env.TEST_PASSWORD_ADMIN || 'passpass1',
    },
  };
}

test.describe('New Clinic Lab + Close Day Golden Path', () => {
  test.beforeAll(() => {
    const script = path.join(
      __dirname,
      '../../../../interface/modules/custom_modules/oe-module-new-clinic/scripts/e2e-prep-golden-path.php',
    );
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
  });

  test('lab skip, cashier payment, and bill ops close day daysheet', async ({ page }) => {
    const patient = generatePatientName();
    const creds = credentials();
    let visitClosed = false;
    let closeDayLoaded = false;

    await test.step('Register patient and start visit', async () => {
      await login(page, creds.reception.username, creds.reception.password);
      await page.goto(`${MODULE_BASE}/front-desk.php`);
      await registerAndStartVisit(page, patient);
    });

    await test.step('Enter vitals in triage', async () => {
      await logout(page);
      await login(page, creds.nurse.username, creds.nurse.password);
      await page.goto(`${MODULE_BASE}/triage.php`);

      const triageCard = await waitForQueueCard(page, patient.lname);
      await triageCard.click();

      const startTriage = page.getByRole('button', { name: 'Start triage' });
      if (await startTriage.isVisible().catch(() => false)) {
        await startTriage.click();
      }

      await page.fill('#nc-vitals-bps', '120');
      await page.fill('#nc-vitals-bpd', '80');
      await page.fill('#nc-vitals-pulse', '72');
      await page.fill('#nc-vitals-temperature', '37.0');
      await page.fill('#nc-vitals-weight', '70');
      await page.fill('#nc-vitals-respiration', '16');

      await page.getByRole('button', { name: 'Save vitals' }).click();
      await page.getByRole('button', { name: 'Send to doctor' }).click();
    });

    await test.step('Doctor consultation and lab routing', async () => {
      await logout(page);
      await login(page, creds.doctor.username, creds.doctor.password);
      await page.goto(`${MODULE_BASE}/doctor.php`);
      await prepareDoctorDesk(page);

      const doctorCard = await waitForQueueCard(page, patient.lname);
      await doctorCard.click();

      await page.locator('#nc-doctor-complete-btn').click();
      await expect(page.locator('#nc-doctor-routing-modal')).toBeVisible();

      const rxCheckbox = page.locator('#nc-routing-rx');
      if (await rxCheckbox.isChecked().catch(() => false)) {
        await rxCheckbox.uncheck();
      }

      const labCheckbox = page.locator('#nc-routing-lab');
      await labCheckbox.check();
      await expect(labCheckbox).toBeChecked();

      await page.locator('#nc-routing-confirm').click();
      await expect(page.locator('#nc-doctor-routing-modal')).toBeHidden({ timeout: 15000 });
    });

    await test.step('Lab desk skip to payment', async () => {
      await logout(page);
      await login(page, creds.lab.username, creds.lab.password);
      await page.goto(`${MODULE_BASE}/lab.php`);

      const labCard = await waitForQueueCard(page, patient.lname);
      await labCard.click();
      await expect(page.locator('#nc-lab-active-pane')).toContainText(patient.lname, { timeout: 15000 });

      const skipBtn = page.locator('#nc-lab-skip-btn');
      await expect(skipBtn).toBeVisible({ timeout: 10000 });
      await skipBtn.click();

      await expect(page.locator('#nc-lab-skip-modal')).toBeVisible();
      await page.fill('#nc-lab-skip-reason', 'E2E lab golden path — skip lab queue');
      await page.locator('#nc-lab-skip-modal').getByRole('button', { name: 'Skip to payment' }).click();
      await expect(page.locator('#nc-lab-skip-modal')).toBeHidden({ timeout: 15000 });
      await expect(page.locator(`.nc-queue-card:has-text("${patient.lname}")`)).toHaveCount(0, {
        timeout: 15000,
      });
    });

    await test.step('Cashier payment or zero close', async () => {
      await logout(page);
      await login(page, creds.cashier.username, creds.cashier.password);
      await page.goto(`${MODULE_BASE}/cashier.php`);

      const cashierCard = await waitForQueueCard(page, patient.lname);
      await cashierCard.click();
      await completeCashierVisit(page, patient, 'E2E lab golden path — no charges');
      visitClosed = true;
    });

    await test.step('Bill ops close day daysheet', async () => {
      await logout(page);
      await login(page, creds.admin.username, creds.admin.password);
      await page.goto(`${MODULE_BASE}/bill-ops/index.php?tab=close`);

      await expect(page.locator('.oe-nc-billops-hub')).toBeVisible({ timeout: 20000 });

      await page.waitForResponse(
        (resp) => resp.url().includes('bill_ops.daysheet') && resp.ok(),
        { timeout: 20000 },
      );

      await expect(page.locator('.oe-nc-billops-daysheet-print')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Receipts')).toBeVisible();
      await expect(page.getByText('Reconciliation:')).toBeVisible();
      closeDayLoaded = true;
    });

    await test.step('Verify journey completed', async () => {
      expect(visitClosed).toBe(true);
      expect(closeDayLoaded).toBe(true);
      // eslint-disable-next-line no-console
      console.log(`Lab + close day golden path OK: ${patient.fullName}`);
    });
  });
});
